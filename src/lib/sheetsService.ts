/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, Category, AppUser, UserRole } from '../types';

const APP_SCRIPT_URL_KEY = 'buku_kas_appscript_url';
const TRANSACTIONS_KEY = 'buku_kas_transactions';
const CATEGORIES_KEY = 'buku_kas_categories';
const USERS_KEY = 'buku_kas_users';
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

// ========================
// USER & ROLES MANAGEMENT
// ========================

export function getLocalUsers(): AppUser[] {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveLocalUsers(users: AppUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Register or authenticate a user.
 * The first person to ever register or configure the system is designated as super_admin.
 */
export function registerOrUpdateUser(email: string, name: string, preferredRole?: UserRole): AppUser {
  const sanitizedEmail = email.trim().toLowerCase();
  const currentUsers = getLocalUsers();

  const existingIndex = currentUsers.findIndex(u => u.email.toLowerCase() === sanitizedEmail);

  if (existingIndex >= 0) {
    const existing = currentUsers[existingIndex];
    const updated: AppUser = {
      ...existing,
      name: name.trim() || existing.name,
      lastLogin: Date.now(),
    };
    currentUsers[existingIndex] = updated;
    saveLocalUsers(currentUsers);
    return updated;
  }

  // Brand new user:
  // If no users exist at all, this user is the Super Admin!
  const isFirstUser = currentUsers.length === 0;
  const role: UserRole = isFirstUser ? 'super_admin' : (preferredRole || 'operator');

  const newUser: AppUser = {
    email: sanitizedEmail,
    name: name.trim() || sanitizedEmail.split('@')[0],
    role,
    createdAt: Date.now(),
    lastLogin: Date.now(),
    isInitialSuperAdmin: isFirstUser,
  };

  const updatedUsers = [...currentUsers, newUser];
  saveLocalUsers(updatedUsers);
  return newUser;
}

export function changeUserRole(email: string, newRole: UserRole): AppUser[] {
  const sanitized = email.trim().toLowerCase();
  const currentUsers = getLocalUsers();
  const updated = currentUsers.map(u => {
    if (u.email.toLowerCase() === sanitized) {
      return { ...u, role: newRole };
    }
    return u;
  });
  saveLocalUsers(updated);
  return updated;
}

export function deleteUser(email: string): AppUser[] {
  const sanitized = email.trim().toLowerCase();
  const currentUsers = getLocalUsers();
  const updated = currentUsers.filter(u => u.email.toLowerCase() !== sanitized);
  saveLocalUsers(updated);
  return updated;
}

export function mergeUsers(local: AppUser[], remote: AppUser[]): {
  merged: AppUser[];
  toUpload: AppUser[];
} {
  const map = new Map<string, AppUser>();

  // Process remote first
  remote.forEach(u => {
    if (u && u.email) {
      map.set(u.email.toLowerCase(), u);
    }
  });

  // Process local
  local.forEach(u => {
    if (!u || !u.email) return;
    const key = u.email.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, u);
    } else {
      // If local is super_admin or has newer login, preserve local's newer state
      if (u.role === 'super_admin' && existing.role !== 'super_admin') {
        map.set(key, { ...existing, role: 'super_admin' });
      } else if (u.lastLogin > existing.lastLogin) {
        map.set(key, { ...existing, lastLogin: u.lastLogin, name: u.name || existing.name });
      }
    }
  });

  const merged = Array.from(map.values());
  return {
    merged,
    toUpload: merged,
  };
}

// ========================
// TRANSACTIONS & CATEGORIES
// ========================

export function getLocalTransactions(): Transaction[] {
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveLocalTransactions(txs: Transaction[]): void {
  const sorted = [...txs].sort((a, b) => {
    const dateCompare = b.tanggal.localeCompare(a.tanggal);
    if (dateCompare !== 0) return dateCompare;
    return b.updatedAt - a.updatedAt;
  });

  const ascTxs = [...sorted].reverse();
  let currentBalance = 0;
  const withBalance = ascTxs.map(tx => {
    if (tx.status === 'pending_delete') {
      return { ...tx, saldo: currentBalance };
    }
    currentBalance = currentBalance + tx.debet - tx.kredit;
    return { ...tx, saldo: currentBalance };
  });

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

  local.forEach(localTx => {
    const remoteTx = remoteMap.get(localTx.id);

    if (localTx.status === 'pending_delete') {
      return;
    }

    if (localTx.status === 'pending_add') {
      mergedMap.set(localTx.id, { ...localTx, status: 'synced' });
      toUpload.push(localTx);
    } else if (localTx.status === 'pending_edit') {
      if (!remoteTx) {
        mergedMap.set(localTx.id, { ...localTx, status: 'synced' });
        toUpload.push(localTx);
      } else {
        if (localTx.updatedAt >= remoteTx.updatedAt) {
          mergedMap.set(localTx.id, { ...localTx, status: 'synced' });
          toUpload.push(localTx);
        } else {
          mergedMap.set(localTx.id, { ...remoteTx, status: 'synced' });
        }
      }
    } else {
      if (remoteTx) {
        if (remoteTx.updatedAt > localTx.updatedAt) {
          mergedMap.set(localTx.id, { ...remoteTx, status: 'synced' });
        } else {
          mergedMap.set(localTx.id, localTx);
        }
      }
    }
  });

  remote.forEach(remoteTx => {
    if (!localMap.has(remoteTx.id)) {
      mergedMap.set(remoteTx.id, { ...remoteTx, status: 'synced' });
    }
  });

  const mergedList = Array.from(mergedMap.values());

  return {
    merged: mergedList,
    toUpload: mergedList,
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

  local.forEach(localCat => {
    if (localCat.status === 'pending_delete') {
      return;
    }
    if (localCat.status === 'pending_add') {
      mergedMap.set(localCat.id, { ...localCat, status: 'synced' });
    } else {
      if (remoteMap.has(localCat.id)) {
        mergedMap.set(localCat.id, localCat);
      }
    }
  });

  remote.forEach(remoteCat => {
    if (!localMap.has(remoteCat.id)) {
      mergedMap.set(remoteCat.id, { ...remoteCat, status: 'synced' });
    }
  });

  const mergedList = Array.from(mergedMap.values());
  const finalMergedList = mergedList.length > 0 ? mergedList : DEFAULT_CATEGORIES;

  return {
    merged: finalMergedList,
    toUpload: finalMergedList,
  };
}

// ========================
// NETWORK & PROXY FALLBACK
// ========================

/**
 * Fetch from Google Apps Script, trying Express proxy first (for dev/full-stack),
 * with robust fallback to direct browser fetch (for Vercel / GitHub Pages static deployments).
 */
export async function fetchWithProxyFallback(
  url: string,
  action: 'read' | 'sync' | 'test',
  payload?: any
): Promise<any> {
  const isSync = action === 'sync';
  
  // Try proxy first
  try {
    const proxyUrl = isSync 
      ? '/api/sync-proxy' 
      : `/api/sync-proxy?url=${encodeURIComponent(url)}&action=${action}`;
      
    const options: RequestInit = isSync ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, payload }),
    } : {
      method: 'GET',
    };
    
    const response = await fetch(proxyUrl, options);
    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data && data.success === false && data.error) {
          throw new Error(data.error);
        }
        return data;
      } else {
        throw new Error('Non-JSON response returned from proxy endpoint ( kemungkinan static host 404/redirect )');
      }
    } else {
      throw new Error(`Proxy responded with HTTP ${response.status}`);
    }
  } catch (proxyError: any) {
    // If the proxy returned an informative error from Google Apps Script, rethrow it
    if (proxyError.message && (
        proxyError.message.includes('Keamanan Google') || 
        proxyError.message.includes('ERROR EKSEKUSI') || 
        proxyError.message.includes('Authorization Required') || 
        proxyError.message.includes('belum disetujui')
    )) {
      throw proxyError;
    }

    console.warn(`[Proxy Fallback] Proxy request (${action}) failed (${proxyError.message}), trying direct connection to Google Apps Script...`);
    
    // Direct browser-to-Apps Script fetch fallback
    const directUrl = isSync ? url : `${url}${url.includes('?') ? '&' : '?'}action=${action}`;
    
    // Use text/plain for POST to avoid CORS preflight OPTIONS which Apps Script does not support
    const directOptions: RequestInit = isSync ? {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    } : {
      method: 'GET',
    };
    
    try {
      const response = await fetch(directUrl, directOptions);
      if (!response.ok) {
        throw new Error(`Gagal menghubungi Apps Script secara langsung (HTTP ${response.status})`);
      }
      
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return json;
      } catch (parseErr) {
        if (text.includes('ServiceLogin') || text.includes('accounts.google.com') || text.includes('sign-in')) {
          throw new Error("Keamanan Google memblokir akses langsung (meminta login akun). Pastikan Web App dideploy dengan opsi Who has access: 'Anyone' (Siapa saja) dan Execute as: 'Me' (Saya), lalu buat 'New version'.");
        }
        if (text.includes('errorMessage') || text.includes('ScriptError')) {
          throw new Error(`Terjadi error pada Google Apps Script: ${text.substring(0, 150)}...`);
        }
        throw new Error(`Format data tidak valid dari Apps Script: ${text.substring(0, 100)}...`);
      }
    } catch (directError: any) {
      if (directError.name === 'TypeError' && directError.message.toLowerCase().includes('failed to fetch')) {
        throw new Error(
          "Gagal menghubungi Google Apps Script (Failed to fetch). Penyebab utama:\n" +
          "1. Deploy Web App belum diatur ke 'Anyone' (Siapa saja), sehingga Google memblokir akses lintas domain (CORS).\n" +
          "2. Perubahan kode script belum di-deploy ulang dengan 'New version'.\n" +
          "3. Silakan periksa tab 'Panduan Setup' dan pastikan salin kode script versi terbaru kami."
        );
      }
      throw directError;
    }
  }
}

/**
 * Test connectivity to Google Apps Script URL.
 */
export async function testAppScriptConnection(url: string): Promise<{
  success: boolean;
  message: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
}> {
  const validation = validateAppScriptUrl(url);
  if (!validation.isValid) {
    return { success: false, message: validation.error || 'URL tidak valid' };
  }

  if (url === 'demo' || url === 'simulation') {
    return {
      success: true,
      message: 'Mode Simulasi Aktif (Data disimpan di browser lokal).',
      spreadsheetName: 'Demo Simulation Database',
    };
  }

  try {
    const data = await fetchWithProxyFallback(url, 'test');
    if (data && data.success) {
      return {
        success: true,
        message: data.message || 'Koneksi ke Google Apps Script berhasil!',
        spreadsheetName: data.spreadsheetName || 'Buku Kas Spreadsheet',
        spreadsheetUrl: data.spreadsheetUrl,
      };
    } else {
      // Fallback to checking read if test action wasn't handled in older script versions
      const readData = await fetchWithProxyFallback(url, 'read');
      if (readData && Array.isArray(readData.transactions)) {
        return {
          success: true,
          message: 'Koneksi ke Google Apps Script berhasil (Data dapat dibaca)!',
          spreadsheetName: 'Google Spreadsheet',
        };
      }
      return {
        success: false,
        message: data?.error || 'Respon dari Apps Script tidak dikenali.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal menghubungi Google Apps Script.',
    };
  }
}

/**
 * Perform actual sync with the Google Sheets Apps Script Web App.
 */
export async function performSync(): Promise<{
  success: boolean;
  error: string | null;
  transactionsCount: number;
  categoriesCount: number;
  usersCount: number;
}> {
  const url = getSavedAppScriptUrl();
  if (!url) {
    return { success: false, error: 'URL Google Apps Script belum diatur. Silakan atur di Pengaturan.', transactionsCount: 0, categoriesCount: 0, usersCount: 0 };
  }

  // Handle Simulation Mode / Demo mode
  if (url === 'demo' || url === 'simulation' || url.toLowerCase().includes('demo') || url.toLowerCase().includes('simulation')) {
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const localTx = getLocalTransactions();
      const localCat = getLocalCategories();
      const localUsers = getLocalUsers();

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
        usersCount: localUsers.length,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Gagal menjalankan simulasi sinkronisasi.',
        transactionsCount: 0,
        categoriesCount: 0,
        usersCount: 0,
      };
    }
  }

  try {
    // 1. Pull remote data
    const remoteData = await fetchWithProxyFallback(url, 'read');
    
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

    const remoteUsers: AppUser[] = Array.isArray(remoteData.users) ? remoteData.users.map((u: any) => ({
      email: String(u.email || '').toLowerCase(),
      name: String(u.name || ''),
      role: (['super_admin', 'admin', 'operator', 'viewer'].includes(u.role) ? u.role : 'operator') as UserRole,
      createdAt: Number(u.createdAt || Date.now()),
      lastLogin: Number(u.lastLogin || Date.now()),
    })) : [];

    // 2. Load local data
    const localTx = getLocalTransactions();
    const localCat = getLocalCategories();
    const localUsers = getLocalUsers();

    // 3. Merge
    const txMerge = mergeTransactions(localTx, remoteTx);
    const catMerge = mergeCategories(localCat, remoteCat);
    const userMerge = mergeUsers(localUsers, remoteUsers);

    // 4. Push merged data back to sheets via proxy or direct
    const syncPayload = {
      action: 'sync',
      transactions: txMerge.toUpload,
      categories: catMerge.toUpload,
      users: userMerge.toUpload,
    };

    const pushResult = await fetchWithProxyFallback(url, 'sync', syncPayload);
    if (pushResult && pushResult.success === false) {
      throw new Error(pushResult.error || pushResult.message || 'Gagal menyimpan data ke Google Sheet.');
    }

    // 5. Save updated merged data back to local storage
    saveLocalTransactions(txMerge.merged);
    saveLocalCategories(catMerge.merged);
    saveLocalUsers(userMerge.merged);
    saveLastSyncTime(Date.now());

    return {
      success: true,
      error: null,
      transactionsCount: txMerge.merged.length,
      categoriesCount: catMerge.merged.length,
      usersCount: userMerge.merged.length,
    };

  } catch (error: any) {
    console.error('Sync error:', error);
    return {
      success: false,
      error: error.message || 'Koneksi gagal atau URL Apps Script tidak valid.',
      transactionsCount: 0,
      categoriesCount: 0,
      usersCount: 0,
    };
  }
}

/**
 * Returns the latest clean, bulletproof Google Apps Script code.
 * CRITICAL FIX: Removed .setHeader("Access-Control-Allow-Origin", "*") which was causing
 * TypeError: setHeader is not a function and crashing doGet / doPost resulting in Failed to fetch.
 */
export function getAppsScriptCode(): string {
  return `/*
  ==============================================================
  GOOGLE APPS SCRIPT - BUKU KAS KECIL PWA SYNC
  ==============================================================
  Fitur:
  - Otomatis membuat / mendeteksi sheet: 'kas', 'kategori', 'pengguna'
  - Mendukung multi-level account (super_admin, admin, operator, viewer)
  - Otomatis menunjuk pengguna pertama sebagai super_admin
  - Kompatibel dengan CORS browser (Vercel, GitHub Pages, & PWA)
  
  PANDUAN DEPLOYMENT:
  1. Klik tombol 'Deploy' (Terapkan) > 'New deployment' (Penerapan baru).
  2. Pilih jenis: 'Web app' (Aplikasi web).
  3. Execute as (Jalankan sebagai): 'Me' (Saya).
  4. Who has access (Siapa yang memiliki akses): 'Anyone' (Siapa saja).
  5. Klik 'Deploy', berikan izin (Authorize), lalu salin URL berakhiran /exec.
  ==============================================================
*/

// Mendapatkan Spreadsheet (otomatis mendeteksi atau membuat baru)
function getSpreadsheet() {
  var sheet = null;
  try {
    sheet = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    sheet = null;
  }
  
  if (!sheet) {
    var props = PropertiesService.getScriptProperties();
    var savedId = props.getProperty("SPREADSHEET_ID");
    if (savedId) {
      try {
        sheet = SpreadsheetApp.openById(savedId);
      } catch (err) {
        sheet = null;
      }
    }
    
    if (!sheet) {
      try {
        sheet = SpreadsheetApp.create("Buku Kas Kecil PWA Sync");
        props.setProperty("SPREADSHEET_ID", sheet.getId());
      } catch (err) {
        throw new Error("Gagal menginisialisasi Google Spreadsheet. Harap buat Script melalui menu Ekstensi > Apps Script di dalam Google Spreadsheet Anda.");
      }
    }
  }
  return sheet;
}

// Inisialisasi sheet-sheet yang dibutuhkan
function initSheets(sheet) {
  // 1. Sheet 'kas'
  var kasSheet = sheet.getSheetByName("kas");
  if (!kasSheet) {
    kasSheet = sheet.insertSheet("kas");
    kasSheet.appendRow(["id", "tanggal", "kategori", "keterangan", "debet", "kredit", "saldo", "updatedAt"]);
    kasSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e2e8f0");
  }
  
  // 2. Sheet 'kategori'
  var catSheet = sheet.getSheetByName("kategori");
  if (!catSheet) {
    catSheet = sheet.insertSheet("kategori");
    catSheet.appendRow(["id", "name", "type"]);
    catSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#e2e8f0");
    
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

  // 3. Sheet 'pengguna' (User Roles)
  var userSheet = sheet.getSheetByName("pengguna");
  if (!userSheet) {
    userSheet = sheet.insertSheet("pengguna");
    userSheet.appendRow(["email", "name", "role", "createdAt", "lastLogin"]);
    userSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#e2e8f0");
  }

  return { kasSheet: kasSheet, catSheet: catSheet, userSheet: userSheet };
}

// Helper untuk format respon JSON standar (tanpa memanggil method ilegal .setHeader)
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Handler GET
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "read";
    var sheet = getSpreadsheet();
    var sheets = initSheets(sheet);

    // 1. Aksi Test Ping / Setup
    if (action === "test") {
      return createJsonResponse({
        success: true,
        message: "Koneksi Google Apps Script berhasil terhubung!",
        spreadsheetName: sheet.getName(),
        spreadsheetUrl: sheet.getUrl(),
        timestamp: new Date().toISOString()
      });
    }

    // 2. Aksi Baca Data (read)
    if (action === "read") {
      // Ambil Transaksi
      var transactions = [];
      var kasRows = sheets.kasSheet.getDataRange().getValues();
      if (kasRows.length > 1) {
        for (var i = 1; i < kasRows.length; i++) {
          var row = kasRows[i];
          if (row[0]) {
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

      // Ambil Kategori
      var categories = [];
      var catRows = sheets.catSheet.getDataRange().getValues();
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

      // Ambil Pengguna
      var users = [];
      var userRows = sheets.userSheet.getDataRange().getValues();
      if (userRows.length > 1) {
        for (var k = 1; k < userRows.length; k++) {
          var urow = userRows[k];
          if (urow[0]) {
            users.push({
              email: String(urow[0]).toLowerCase(),
              name: String(urow[1] || ""),
              role: String(urow[2] || "operator"),
              createdAt: Number(urow[3] || Date.now()),
              lastLogin: Number(urow[4] || Date.now())
            });
          }
        }
      }

      return createJsonResponse({
        success: true,
        transactions: transactions,
        categories: categories,
        users: users
      });
    }

    return createJsonResponse({ success: false, message: "Aksi GET tidak dikenali" });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.message || err.toString() });
  }
}

// Handler POST
function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var sheet = getSpreadsheet();
    var sheets = initSheets(sheet);

    if (action === "sync") {
      // 1. Simpan Transaksi Kas
      var kasSheet = sheets.kasSheet;
      kasSheet.clear();
      kasSheet.appendRow(["id", "tanggal", "kategori", "keterangan", "debet", "kredit", "saldo", "updatedAt"]);
      kasSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e2e8f0");

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
      var catSheet = sheets.catSheet;
      catSheet.clear();
      catSheet.appendRow(["id", "name", "type"]);
      catSheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#e2e8f0");

      var categories = postData.categories || [];
      categories.forEach(function(cat) {
        catSheet.appendRow([
          cat.id,
          cat.name,
          cat.type
        ]);
      });

      // 3. Simpan Pengguna (Multi-Level Roles)
      if (Array.isArray(postData.users)) {
        var userSheet = sheets.userSheet;
        userSheet.clear();
        userSheet.appendRow(["email", "name", "role", "createdAt", "lastLogin"]);
        userSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#e2e8f0");

        postData.users.forEach(function(u) {
          userSheet.appendRow([
            String(u.email || "").toLowerCase(),
            String(u.name || ""),
            String(u.role || "operator"),
            Number(u.createdAt || Date.now()),
            Number(u.lastLogin || Date.now())
          ]);
        });
      }

      return createJsonResponse({
        success: true,
        message: "Sinkronisasi berhasil disimpan di Google Sheets!",
        transactionsSaved: transactions.length,
        categoriesSaved: categories.length,
        usersSaved: (postData.users || []).length
      });
    }

    return createJsonResponse({ success: false, message: "Aksi POST tidak valid" });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.message || err.toString() });
  }
}

// Format tanggal ke YYYY-MM-DD
function formatDate(dateVal) {
  if (dateVal instanceof Date) {
    var y = dateVal.getFullYear();
    var m = ("0" + (dateVal.getMonth() + 1)).slice(-2);
    var d = ("0" + dateVal.getDate()).slice(-2);
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
