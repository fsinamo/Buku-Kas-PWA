/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, Category, SyncStatus } from '../types';

const APP_SCRIPT_URL_KEY = 'buku_kas_appscript_url';
const TRANSACTIONS_KEY = 'buku_kas_transactions';
const CATEGORIES_KEY = 'buku_kas_categories';
const LAST_SYNC_KEY = 'buku_kas_last_sync_time';

// Default categories if nothing exists
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_1', name: 'Penjualan', type: 'income', status: 'synced' },
  { id: 'cat_2', name: 'Gaji', type: 'income', status: 'synced' },
  { id: 'cat_3', name: 'Investasi', type: 'income', status: 'synced' },
  { id: 'cat_4', name: 'Belanja Bahan', type: 'expense', status: 'synced' },
  { id: 'cat_5', name: 'Sewa Tempat', type: 'expense', status: 'synced' },
  { id: 'cat_6', name: 'Operasional', type: 'expense', status: 'synced' },
  { id: 'cat_7', name: 'Pemasaran', type: 'expense', status: 'synced' },
  { id: 'cat_8', name: 'Lain-lain', type: 'expense', status: 'synced' },
];

export function getSavedAppScriptUrl(): string {
  return localStorage.getItem(APP_SCRIPT_URL_KEY) || '';
}

export function saveAppScriptUrl(url: string): void {
  if (url) {
    localStorage.setItem(APP_SCRIPT_URL_KEY, url.trim());
  } else {
    localStorage.removeItem(APP_SCRIPT_URL_KEY);
  }
}

export function validateAppScriptUrl(url: string): { isValid: boolean; error: string | null } {
  const trimmed = url.trim();
  if (!trimmed) {
    return { isValid: false, error: 'URL tidak boleh kosong.' };
  }
  if (trimmed === 'demo' || trimmed === 'simulation') {
    return { isValid: true, error: null };
  }
  if (trimmed.includes('docs.google.com/spreadsheets')) {
    return { 
      isValid: false, 
      error: 'Anda memasukkan URL Google Spreadsheet, bukan URL Web App. Silakan salin URL Web App Apps Script Anda yang berakhiran dengan /exec.' 
    };
  }
  if (trimmed.includes('script.google.com/home') || trimmed.includes('script.google.com/d/') || (trimmed.includes('script.google.com') && !trimmed.includes('/macros/'))) {
    return { 
      isValid: false, 
      error: 'Anda memasukkan URL Editor Apps Script. Silakan pilih Deploy > New Deployment di Google Apps Script dan salin URL Web App berakhiran /exec.' 
    };
  }
  if (trimmed.includes('/dev')) {
    return { 
      isValid: false, 
      error: 'Anda menggunakan URL Developer (/dev). URL /dev memerlukan login pemilik akun Google dan tidak didukung oleh aplikasi eksternal. Silakan buat Deployment baru sebagai Web App dan salin URL berakhiran /exec.' 
    };
  }
  if (!trimmed.startsWith('https://script.google.com/macros/s/')) {
    return {
      isValid: false,
      error: 'Format URL tidak dikenali. URL Web App Apps Script yang benar biasanya dimulai dengan https://script.google.com/macros/s/ dan diakhiri dengan /exec.'
    };
  }
  if (!trimmed.includes('/exec')) {
    return {
      isValid: false,
      error: 'URL Web App harus berakhiran dengan /exec. Pastikan Anda menyalin URL Web App dari menu Deploy, bukan link editor script.'
    };
  }
  return { isValid: true, error: null };
}

export function getLocalTransactions(): Transaction[] {
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveLocalTransactions(txs: Transaction[]): void {
  // Sort by date descending, then updatedAt descending
  const sorted = [...txs].sort((a, b) => {
    const dateCompare = b.tanggal.localeCompare(a.tanggal);
    if (dateCompare !== 0) return dateCompare;
    return b.updatedAt - a.updatedAt;
  });

  // Calculate dynamic balances sequentially from oldest to newest
  // To do this, we need to sort ascending first
  const ascTxs = [...sorted].reverse();
  let currentBalance = 0;
  const withBalance = ascTxs.map(tx => {
    // If it's pending deletion, we don't count it towards the active running balance
    if (tx.status === 'pending_delete') {
      return { ...tx, saldo: currentBalance };
    }
    currentBalance = currentBalance + tx.debet - tx.kredit;
    return { ...tx, saldo: currentBalance };
  });

  // Store in descending order for list presentation
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(withBalance.reverse()));
}

export function getLocalCategories(): Category[] {
  const data = localStorage.getItem(CATEGORIES_KEY);
  if (!data) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return DEFAULT_CATEGORIES;
  }
  return JSON.parse(data);
}

export function saveLocalCategories(cats: Category[]): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

export function getLastSyncTime(): number | null {
  const val = localStorage.getItem(LAST_SYNC_KEY);
  return val ? parseInt(val, 10) : null;
}

export function saveLastSyncTime(timestamp: number): void {
  localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
}

/**
 * 2-Way Merging Algorithm:
 * - We merge local items and remote items.
 * - For transactions:
 *   - If remote transaction is not in local list:
 *     - If it was deleted locally (we don't have it and its updatedAt is older than lastSyncTime), we ignore it.
 *     - Otherwise, we add it locally as 'synced'.
 *   - If local transaction has 'pending_add', we send it to remote.
 *   - If local transaction has 'pending_edit', we compare timestamps (updatedAt) with remote. Newer wins.
 *   - If local transaction has 'pending_delete', we delete it from remote.
 *   - If remote transaction is missing but was 'synced' locally: it means it was deleted on another device, so we delete it locally.
 */
export function mergeTransactions(local: Transaction[], remote: Transaction[]): {
  merged: Transaction[];
  toUpload: Transaction[];
} {
  const remoteMap = new Map<string, Transaction>();
  remote.forEach(tx => remoteMap.set(tx.id, tx));

  const localMap = new Map<string, Transaction>();
  local.forEach(tx => localMap.set(tx.id, tx));

  const mergedMap = new Map<string, Transaction>();
  const toUpload: Transaction[] = [];

  // Process all local items
  local.forEach(localTx => {
    const remoteTx = remoteMap.get(localTx.id);

    if (localTx.status === 'pending_delete') {
      // User deleted it locally. We do not keep it, and we do not upload it.
      // The server will sync with the uploaded list (which won't contain this ID)
      return;
    }

    if (localTx.status === 'pending_add') {
      // New local transaction. Mark as synced once we upload.
      // Keep it in merged and prepare to upload
      mergedMap.set(localTx.id, { ...localTx, status: 'synced' });
      toUpload.push(localTx);
    } else if (localTx.status === 'pending_edit') {
      if (!remoteTx) {
        // Doesn't exist on remote, maybe deleted there, but we edited it. Let's upload.
        mergedMap.set(localTx.id, { ...localTx, status: 'synced' });
        toUpload.push(localTx);
      } else {
        // Exists on both, compare timestamps
        if (localTx.updatedAt >= remoteTx.updatedAt) {
          mergedMap.set(localTx.id, { ...localTx, status: 'synced' });
          toUpload.push(localTx);
        } else {
          // Remote is newer, take remote
          mergedMap.set(localTx.id, { ...remoteTx, status: 'synced' });
        }
      }
    } else {
      // Already marked as synced locally
      if (remoteTx) {
        // Exists on both, compare timestamps in case remote was updated
        if (remoteTx.updatedAt > localTx.updatedAt) {
          mergedMap.set(localTx.id, { ...remoteTx, status: 'synced' });
        } else {
          mergedMap.set(localTx.id, localTx);
        }
      } else {
        // Missing on remote. It means it was deleted on Google Sheets directly or from another device.
        // We delete it locally.
        // (Do nothing, let it be removed)
      }
    }
  });

  // Process remaining remote items that are not in local
  remote.forEach(remoteTx => {
    if (!localMap.has(remoteTx.id)) {
      // It's a new remote item. Check if we deleted it locally.
      // If its updatedAt is older than our lastSyncTime, and it's not in our local list,
      // it might have been deleted locally. Otherwise, it's a new item from sheet.
      // To be safe, always add remote items that are not present.
      mergedMap.set(remoteTx.id, { ...remoteTx, status: 'synced' });
    }
  });

  const mergedList = Array.from(mergedMap.values());

  return {
    merged: mergedList,
    toUpload: mergedList, // Overwrite with complete consolidated synced list
  };
}

export function mergeCategories(local: Category[], remote: Category[]): {
  merged: Category[];
  toUpload: Category[];
} {
  const remoteMap = new Map<string, Category>();
  remote.forEach(c => remoteMap.set(c.id, c));

  const localMap = new Map<string, Category>();
  local.forEach(c => localMap.set(c.id, c));

  const mergedMap = new Map<string, Category>();

  // Process local
  local.forEach(localCat => {
    if (localCat.status === 'pending_delete') {
      // Delete on server too (by not including in upload)
      return;
    }
    if (localCat.status === 'pending_add') {
      mergedMap.set(localCat.id, { ...localCat, status: 'synced' });
    } else {
      // Synced
      if (remoteMap.has(localCat.id)) {
        mergedMap.set(localCat.id, localCat);
      } else {
        // Deleted on remote
      }
    }
  });

  // Process remaining remote
  remote.forEach(remoteCat => {
    if (!localMap.has(remoteCat.id)) {
      mergedMap.set(remoteCat.id, { ...remoteCat, status: 'synced' });
    }
  });

  const mergedList = Array.from(mergedMap.values());
  // If merged list is empty, restore default categories to prevent empty states
  const finalMergedList = mergedList.length > 0 ? mergedList : DEFAULT_CATEGORIES;

  return {
    merged: finalMergedList,
    toUpload: finalMergedList,
  };
}

/**
 * Perform actual sync with the Google Sheets Apps Script Web App.
 */
export async function performSync(): Promise<{
  success: boolean;
  error: string | null;
  transactionsCount: number;
  categoriesCount: number;
}> {
  const url = getSavedAppScriptUrl();
  if (!url) {
    return { success: false, error: 'URL Google Apps Script belum diatur. Silakan atur di Pengaturan.', transactionsCount: 0, categoriesCount: 0 };
  }

  // Handle Simulation Mode / Demo mode
  if (url === 'demo' || url === 'simulation' || url.toLowerCase().includes('demo') || url.toLowerCase().includes('simulation')) {
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const localTx = getLocalTransactions();
      const localCat = getLocalCategories();

      const syncedTx = localTx.map(tx => ({ ...tx, status: 'synced' as const }));
      const syncedCat = localCat.map(c => ({ ...c, status: 'synced' as const }));

      saveLocalTransactions(syncedTx);
      saveLocalCategories(syncedCat);
      saveLastSyncTime(Date.now());

      return {
        success: true,
        error: null,
        transactionsCount: syncedTx.length,
        categoriesCount: syncedCat.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Gagal menjalankan simulasi sinkronisasi.',
        transactionsCount: 0,
        categoriesCount: 0,
      };
    }
  }

  try {
    // 1. Pull current remote data via our server-side proxy to completely bypass browser CORS and sandbox iframe redirects
    const proxyGetUrl = `/api/sync-proxy?url=${encodeURIComponent(url)}&action=read`;
    const response = await fetch(proxyGetUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      let errMsg = `Gagal mengunduh data (HTTP ${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) {
          errMsg = errJson.error;
        }
      } catch (e) {
        // use default message
      }
      throw new Error(errMsg);
    }

    const remoteData = await response.json();
    
    const remoteTx: Transaction[] = Array.isArray(remoteData.transactions) ? remoteData.transactions.map((tx: any) => ({
      id: String(tx.id || ''),
      tanggal: String(tx.tanggal || ''),
      kategori: String(tx.kategori || ''),
      keterangan: String(tx.keterangan || ''),
      debet: Number(tx.debet || 0),
      kredit: Number(tx.kredit || 0),
      saldo: Number(tx.saldo || 0),
      status: 'synced',
      updatedAt: Number(tx.updatedAt || Date.now()),
    })) : [];

    const remoteCat: Category[] = Array.isArray(remoteData.categories) ? remoteData.categories.map((c: any) => ({
      id: String(c.id || ''),
      name: String(c.name || ''),
      type: c.type === 'income' || c.type === 'expense' ? c.type : 'expense',
      status: 'synced',
    })) : [];

    // 2. Load current local data
    const localTx = getLocalTransactions();
    const localCat = getLocalCategories();

    // 3. Merge
    const txMerge = mergeTransactions(localTx, remoteTx);
    const catMerge = mergeCategories(localCat, remoteCat);

    // 4. Push merged data back to sheets via our server-side proxy
    const syncPayload = {
      action: 'sync',
      transactions: txMerge.toUpload,
      categories: catMerge.toUpload,
    };

    const pushResponse = await fetch('/api/sync-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        payload: syncPayload,
      }),
    });

    if (!pushResponse.ok) {
      let errMsg = `Gagal mengunggah data (HTTP ${pushResponse.status})`;
      try {
        const errJson = await pushResponse.json();
        if (errJson && errJson.error) {
          errMsg = errJson.error;
        }
      } catch (e) {
        // use default message
      }
      throw new Error(errMsg);
    }

    const pushResult = await pushResponse.json();
    if (pushResult && pushResult.success === false) {
      throw new Error(pushResult.error || 'Gagal menyimpan data ke Google Sheet.');
    }

    // 5. Save updated merged data back to local storage as 'synced'
    saveLocalTransactions(txMerge.merged);
    saveLocalCategories(catMerge.merged);
    saveLastSyncTime(Date.now());

    return {
      success: true,
      error: null,
      transactionsCount: txMerge.merged.length,
      categoriesCount: catMerge.merged.length,
    };

  } catch (error: any) {
    console.error('Sync error:', error);
    return {
      success: false,
      error: error.message || 'Koneksi gagal atau URL Apps Script tidak valid.',
      transactionsCount: 0,
      categoriesCount: 0,
    };
  }
}

/**
 * Returns the copyable Google Apps Script code.
 */
export function getAppsScriptCode(): string {
  return `/*
  Google Apps Script untuk Aplikasi Buku Kas PWA
  Silakan salin kode ini ke Google Apps Script (script.google.com).
  Lalu publikasikan sebagai Web App dengan akses "Anyone" (Siapa saja).
*/

function getSpreadsheet() {
  var sheet = null;
  try {
    sheet = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    sheet = null;
  }
  
  if (!sheet) {
    var userProperties = PropertiesService.getUserProperties();
    var savedId = userProperties.getProperty("SPREADSHEET_ID");
    if (savedId) {
      try {
        sheet = SpreadsheetApp.openById(savedId);
      } catch (err) {
        sheet = null;
      }
    }
    
    if (!sheet) {
      try {
        sheet = SpreadsheetApp.create("Buku Kas PWA Sync");
        userProperties.setProperty("SPREADSHEET_ID", sheet.getId());
      } catch (err) {
        throw new Error("Gagal menginisialisasi Google Spreadsheet otomatis. Pastikan Script dibuat melalui menu Ekstensi > Apps Script di dalam Google Spreadsheet Anda.");
      }
    }
  }
  return sheet;
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "read";
    var sheet = getSpreadsheet();
    
    // Ambil atau buat sheet 'kas'
    var kasSheet = sheet.getSheetByName("kas");
    if (!kasSheet) {
      kasSheet = sheet.insertSheet("kas");
      kasSheet.appendRow(["id", "tanggal", "kategori", "keterangan", "debet", "kredit", "saldo", "updatedAt"]);
    }
    
    // Ambil atau buat sheet 'kategori'
    var catSheet = sheet.getSheetByName("kategori");
    if (!catSheet) {
      catSheet = sheet.insertSheet("kategori");
      catSheet.appendRow(["id", "name", "type"]);
      
      // Default categories
      var defaults = [
        ["cat_1", "Penjualan", "income"],
        ["cat_2", "Gaji", "income"],
        ["cat_3", "Investasi", "income"],
        ["cat_4", "Belanja Bahan", "expense"],
        ["cat_5", "Sewa Tempat", "expense"],
        ["cat_6", "Operasional", "expense"],
        ["cat_7", "Pemasaran", "expense"],
        ["cat_8", "Lain-lain", "expense"]
      ];
      defaults.forEach(function(row) {
        catSheet.appendRow(row);
      });
    }

    if (action === "read") {
      var transactions = [];
      var kasRows = kasSheet.getDataRange().getValues();
      if (kasRows.length > 1) {
        for (var i = 1; i < kasRows.length; i++) {
          var row = kasRows[i];
          if (row[0]) { // Pastikan ID terisi
            transactions.push({
              id: String(row[0]),
              tanggal: formatDate(row[1]),
              kategori: String(row[2]),
              keterangan: String(row[3]),
              debet: Number(row[4] || 0),
              kredit: Number(row[5] || 0),
              saldo: Number(row[6] || 0),
              updatedAt: Number(row[7] || Date.now())
            });
          }
        }
      }

      var categories = [];
      var catRows = catSheet.getDataRange().getValues();
      if (catRows.length > 1) {
        for (var j = 1; j < catRows.length; j++) {
          var crow = catRows[j];
          if (crow[0]) {
            categories.push({
              id: String(crow[0]),
              name: String(crow[1]),
              type: String(crow[2])
            });
          }
        }
      }

      var output = {
        transactions: transactions,
        categories: categories
      };

      return ContentService.createTextOutput(JSON.stringify(output))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Aksi tidak dikenali" }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message || err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
}

function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var sheet = getSpreadsheet();
    
    if (action === "sync") {
      // 1. Simpan Transaksi
      var kasSheet = sheet.getSheetByName("kas") || sheet.insertSheet("kas");
      kasSheet.clear();
      kasSheet.appendRow(["id", "tanggal", "kategori", "keterangan", "debet", "kredit", "saldo", "updatedAt"]);
      
      var transactions = postData.transactions || [];
      transactions.forEach(function(tx) {
        kasSheet.appendRow([
          tx.id,
          tx.tanggal,
          tx.kategori,
          tx.keterangan,
          Number(tx.debet || 0),
          Number(tx.kredit || 0),
          Number(tx.saldo || 0),
          Number(tx.updatedAt || Date.now())
        ]);
      });
      
      // 2. Simpan Kategori
      var catSheet = sheet.getSheetByName("kategori") || sheet.insertSheet("kategori");
      catSheet.clear();
      catSheet.appendRow(["id", "name", "type"]);
      
      var categories = postData.categories || [];
      categories.forEach(function(cat) {
        catSheet.appendRow([
          cat.id,
          cat.name,
          cat.type
        ]);
      });
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Sinkronisasi berhasil!" }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Aksi POST tidak valid" }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
}

// Fungsi bantu format tanggal ke YYYY-MM-DD
function formatDate(dateVal) {
  if (dateVal instanceof Date) {
    var jsDate = dateVal;
    var y = jsDate.getFullYear();
    var m = ("0" + (jsDate.getMonth() + 1)).slice(-2);
    var d = ("0" + jsDate.getDate()).slice(-2);
    return y + "-" + m + "-" + d;
  }
  
  var str = String(dateVal);
  if (str.indexOf("GMT") !== -1 || str.indexOf("T") !== -1) {
    try {
      var parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        var yr = parsed.getFullYear();
        var mo = ("0" + (parsed.getMonth() + 1)).slice(-2);
        var dy = ("0" + parsed.getDate()).slice(-2);
        return yr + "-" + mo + "-" + dy;
      }
    } catch(e) {}
  }
  
  return str;
}
`;
}
