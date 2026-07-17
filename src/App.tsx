/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  ReceiptText,
  Download,
  Settings,
  HelpCircle,
  LogOut,
  PlusCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertTriangle,
  FolderSync,
  Tag,
  Trash2,
  Sparkles,
} from 'lucide-react';

import { Transaction, Category, UserSession, SyncStatus } from './types';
import Login from './components/Login';
import Analytics, { formatRupiah } from './components/Analytics';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import ExportPanel from './components/ExportPanel';
import AppsScriptHelp from './components/AppsScriptHelp';
import {
  getSavedAppScriptUrl,
  saveAppScriptUrl,
  validateAppScriptUrl,
  getLocalTransactions,
  saveLocalTransactions,
  getLocalCategories,
  saveLocalCategories,
  getLastSyncTime,
  performSync,
} from './lib/sheetsService';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // App data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [appScriptUrl, setAppScriptUrl] = useState('');
  
  // UI states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'export' | 'settings' | 'help'>('dashboard');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSyncTime: getLastSyncTime(),
    isSyncing: false,
    error: null,
  });

  // Load session on start
  useEffect(() => {
    const savedSession = localStorage.getItem('buku_kas_user_session');
    if (savedSession) {
      try {
        const parsed: UserSession = JSON.parse(savedSession);
        // Verify expiry (1 week)
        if (Date.now() < parsed.expiresAt) {
          setSession(parsed);
        } else {
          // Expired, clear
          localStorage.removeItem('buku_kas_user_session');
        }
      } catch (e) {
        localStorage.removeItem('buku_kas_user_session');
      }
    }

    // Load static URL and offline cache
    setAppScriptUrl(getSavedAppScriptUrl());
    setTransactions(getLocalTransactions());
    setCategories(getLocalCategories());
  }, []);

  // Monitor network online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync on network return
      if (getSavedAppScriptUrl()) {
        triggerSync();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync interval if pending local items exist
  useEffect(() => {
    const interval = setInterval(() => {
      const hasPendingTx = transactions.some(tx => tx.status !== 'synced');
      const hasPendingCat = categories.some(c => c.status !== 'synced');
      
      if (navigator.onLine && (hasPendingTx || hasPendingCat) && getSavedAppScriptUrl() && !syncStatus.isSyncing) {
        triggerSync();
      }
    }, 25000); // Check every 25 seconds

    return () => clearInterval(interval);
  }, [transactions, categories, syncStatus.isSyncing]);

  // Synchronize action helper
  const triggerSync = async () => {
    const url = getSavedAppScriptUrl();
    if (!url) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));
    
    const result = await performSync();
    
    if (result.success) {
      setTransactions(getLocalTransactions());
      setCategories(getLocalCategories());
      setSyncStatus({
        lastSyncTime: Date.now(),
        isSyncing: false,
        error: null,
      });
    } else {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: result.error,
      }));
    }
  };

  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    // On login, attempt sync if URL configured
    if (getSavedAppScriptUrl()) {
      triggerSync();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('buku_kas_user_session');
    setSession(null);
  };

  // Saved AppScript URL handler
  const handleSaveUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed) {
      const validation = validateAppScriptUrl(trimmed);
      if (!validation.isValid) {
        setSyncStatus(prev => ({
          ...prev,
          error: validation.error,
        }));
        saveAppScriptUrl(trimmed);
        setAppScriptUrl(trimmed);
        return;
      }
    }

    saveAppScriptUrl(trimmed);
    setAppScriptUrl(trimmed);
    setSyncStatus(prev => ({ ...prev, error: null }));
    
    // Trigger sync once new URL is registered
    if (trimmed) {
      setTimeout(() => {
        triggerSync();
      }, 500);
    }
  };

  // Transaction Actions
  const handleTransactionSubmit = (
    data: {
      tanggal: string;
      kategori: string;
      keterangan: string;
      debet: number;
      kredit: number;
    },
    syncMode?: 'online' | 'bulk'
  ) => {
    let updated: Transaction[];

    if (editingTransaction) {
      // Edit mode
      updated = transactions.map(tx => {
        if (tx.id === editingTransaction.id) {
          return {
            ...tx,
            ...data,
            status: tx.status === 'pending_add' ? 'pending_add' : 'pending_edit',
            updatedAt: Date.now(),
          };
        }
        return tx;
      });
    } else {
      // Add mode
      const newTx: Transaction = {
        id: `tx_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
        ...data,
        saldo: 0, // Calculated sequentially upon save
        status: 'pending_add',
        updatedAt: Date.now(),
      };
      updated = [newTx, ...transactions];
    }

    setTransactions(updated);
    saveLocalTransactions(updated);
    setShowFormModal(false);
    setEditingTransaction(null);

    // Auto trigger sync in background unless "bulk" (menumpuk) is chosen
    if (isOnline && appScriptUrl && syncMode !== 'bulk') {
      triggerSync();
    }
  };

  const handleTransactionEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setShowFormModal(true);
  };

  const handleTransactionDelete = (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;

    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    let updated: Transaction[];
    if (tx.status === 'pending_add') {
      // If it hasn't been uploaded yet, just remove from state entirely
      updated = transactions.filter(t => t.id !== id);
    } else {
      // Mark as pending delete, and filter out on Google Sheets sync
      updated = transactions.map(t => {
        if (t.id === id) {
          return { ...t, status: 'pending_delete', updatedAt: Date.now() };
        }
        return t;
      });
    }

    setTransactions(updated);
    saveLocalTransactions(updated);

    // Auto trigger sync in background
    if (isOnline && appScriptUrl) {
      triggerSync();
    }
  };

  // Category Actions
  const handleAddCategory = (name: string, type: 'income' | 'expense') => {
    const newCat: Category = {
      id: `cat_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
      name,
      type,
      status: 'pending_add',
    };

    const updated = [...categories, newCat];
    setCategories(updated);
    saveLocalCategories(updated);

    // Auto trigger sync in background
    if (isOnline && appScriptUrl) {
      triggerSync();
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (!confirm('Hapus kategori ini? Transaksi yang sudah menggunakan kategori ini tidak akan hilang, namun kategori tidak bisa dipilih lagi.')) return;

    const cat = categories.find(c => c.id === id);
    if (!cat) return;

    let updated: Category[];
    if (cat.status === 'pending_add') {
      updated = categories.filter(c => c.id !== id);
    } else {
      updated = categories.map(c => {
        if (c.id === id) {
          return { ...c, status: 'pending_delete' };
        }
        return c;
      });
    }

    setCategories(updated);
    saveLocalCategories(updated);

    if (isOnline && appScriptUrl) {
      triggerSync();
    }
  };

  const handleCreateCategoryInSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    const exists = categories.some(
      c => c.name.toLowerCase() === trimmed.toLowerCase() && c.type === newCategoryType && c.status !== 'pending_delete'
    );

    if (exists) {
      alert('Kategori dengan nama dan tipe ini sudah ada!');
      return;
    }

    handleAddCategory(trimmed, newCategoryType);
    setNewCategoryName('');
  };

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Analytics transactions={transactions} />;
      case 'transactions':
        return (
          <TransactionList
            transactions={transactions}
            categories={categories}
            onEdit={handleTransactionEdit}
            onDelete={handleTransactionDelete}
          />
        );
      case 'export':
        return <ExportPanel transactions={transactions} />;
      case 'settings':
        return (
          <div className="space-y-6">
            {/* AppsScript configuration */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Pengaturan Google Apps Script</h3>
                  <p className="text-xs text-slate-500">Gunakan Google Sheets Anda sebagai cloud storage pembukuan</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="appscript_url_input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    URL Web App Google Apps Script
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      id="appscript_url_input"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={appScriptUrl}
                      onChange={(e) => setAppScriptUrl(e.target.value)}
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
                    />
                    <button
                      onClick={() => handleSaveUrl(appScriptUrl)}
                      className="bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 transition shadow-md shadow-emerald-50 shrink-0 text-sm cursor-pointer"
                    >
                      Simpan &amp; Hubungkan
                    </button>
                    <button
                      onClick={() => {
                        setAppScriptUrl('demo');
                        handleSaveUrl('demo');
                      }}
                      className="border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-semibold px-4 py-3 rounded-xl transition shrink-0 text-sm flex items-center gap-1.5 justify-center cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                      Gunakan Mode Simulasi
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 border border-slate-100 rounded-xl">
                  <strong>Catatan Penting:</strong> URL ini disimpan <strong>secara permanen</strong> di perangkat Anda. Anda tidak perlu mengisinya kembali saat masuk atau keluar akun.
                </div>
              </div>
            </div>

            {/* Category Manager */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                  <Tag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Manajemen Kategori Kustom</h3>
                  <p className="text-xs text-slate-500">Tambah atau hapus kategori penerimaan dan pengeluaran</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Form Add Category */}
                <form onSubmit={handleCreateCategoryInSettings} className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kategori Baru</h4>
                  
                  <div>
                    <label htmlFor="cat_name" className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Kategori</label>
                    <input
                      type="text"
                      id="cat_name"
                      required
                      placeholder="Contoh: Transportasi, Jasa Desain..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Jenis Kategori</label>
                    <div className="flex gap-4 text-xs">
                      <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="cat_type"
                          checked={newCategoryType === 'expense'}
                          onChange={() => setNewCategoryType('expense')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        Pengeluaran (Kredit)
                      </label>
                      <label className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="cat_type"
                          checked={newCategoryType === 'income'}
                          onChange={() => setNewCategoryType('income')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        Penerimaan (Debet)
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white text-xs py-2 px-4 rounded-lg font-bold hover:bg-emerald-700 transition"
                  >
                    Tambah Kategori
                  </button>
                </form>

                {/* List Categories */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Daftar Kategori Aktif</h4>
                  <div className="max-h-[220px] overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-white">
                    {categories.filter(c => c.status !== 'pending_delete').length === 0 ? (
                      <p className="text-xs text-slate-400 p-4 text-center">Tidak ada kategori.</p>
                    ) : (
                      categories
                        .filter(c => c.status !== 'pending_delete')
                        .map(c => (
                          <div key={c.id} className="flex items-center justify-between p-3 text-xs">
                            <span className="font-semibold text-slate-700">{c.name}</span>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                c.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {c.type === 'income' ? 'Penerimaan' : 'Pengeluaran'}
                              </span>
                              <button
                                onClick={() => handleDeleteCategory(c.id)}
                                className="text-slate-400 hover:text-red-600 transition"
                                title="Hapus Kategori"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'help':
        return <AppsScriptHelp />;
      default:
        return null;
    }
  };

  // If session is empty or expired, force Login screen
  if (!session) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  // Active sync status label helper
  const getSyncLabel = () => {
    const isDemo = getSavedAppScriptUrl() === 'demo';
    if (syncStatus.isSyncing) return isDemo ? 'Simulasi Sinkronisasi...' : 'Menyingkronkan...';
    if (syncStatus.error) return 'Gagal Sinkronisasi';
    if (syncStatus.lastSyncTime) {
      const timeStr = new Date(syncStatus.lastSyncTime).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return isDemo ? `Simulasi Tersinkron: ${timeStr}` : `Tersinkronisasi: ${timeStr}`;
    }
    return isDemo ? 'Simulasi Siap' : 'Belum Tersinkron';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 text-white p-2 rounded-xl">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-slate-800 tracking-tight">
              Buku<span className="text-emerald-600">Kas</span>
            </span>
            <span className="bg-slate-100 text-[10px] text-slate-600 font-bold px-2 py-0.5 rounded-full ml-1">
              PWA Sync
            </span>
          </div>

          {/* Sync & Connection Info Panel */}
          <div className="flex items-center gap-3">
            {/* Connection badge */}
            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
              isOnline
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : 'bg-amber-50 border-amber-100 text-amber-800'
            }`}>
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-amber-600" />
                  Offline Mode
                </>
              )}
            </div>

            {/* Sync trigger button */}
            {getSavedAppScriptUrl() && (
              <button
                onClick={triggerSync}
                disabled={syncStatus.isSyncing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  syncStatus.error
                    ? 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                    : getSavedAppScriptUrl() === 'demo'
                      ? 'border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-50 hover:border-amber-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {getSavedAppScriptUrl() === 'demo' ? (
                  <Sparkles className={`h-3.5 w-3.5 ${syncStatus.isSyncing ? 'animate-spin text-amber-500' : 'text-amber-500 animate-pulse'}`} />
                ) : (
                  <RefreshCw className={`h-3.5 w-3.5 ${syncStatus.isSyncing ? 'animate-spin text-emerald-600' : 'text-slate-400'}`} />
                )}
                <span className="hidden md:inline">{getSyncLabel()}</span>
              </button>
            )}

            {/* Session info & logout */}
            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
              <div className="hidden lg:block text-right">
                <span className="text-xs font-semibold text-slate-700 block">ravinaarcamanik@gmail.com</span>
                <span className="text-[10px] text-slate-400 block font-medium">Sesi Aktif (1 Minggu)</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition"
                title="Keluar Akun"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content & Tab layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Navigation Tabs bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-2">
          <nav className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'dashboard'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'transactions'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ReceiptText className="h-4 w-4" />
              Buku Transaksi
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'export'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Download className="h-4 w-4" />
              Ekspor Laporan
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'settings'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="h-4 w-4" />
              Pengaturan URL
            </button>
            <button
              onClick={() => setActiveTab('help')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'help'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              Panduan Setup
            </button>
          </nav>

          {/* Quick action buttons */}
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowFormModal(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-100 transition shadow-md shadow-emerald-50 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Catat Transaksi
          </button>
        </div>

        {/* Sync Warn Banner if URL missing */}
        {!getSavedAppScriptUrl() && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-800">Penyimpanan Cloud Google Sheet Belum Aktif</h4>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Aplikasi saat ini berjalan dalam mode offline lokal. Silakan hubungkan Google Sheet melalui halaman panduan setup untuk mencadangkan pembukuan secara 2 arah.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <button
                onClick={() => setActiveTab('help')}
                className="px-3.5 py-1.5 border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl text-xs font-semibold transition"
              >
                Baca Panduan Setup
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition"
              >
                Atur URL Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Sync Error Banner & Troubleshooter */}
        {syncStatus.error && (
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col gap-4 shadow-sm animate-fade-in">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-rose-800 flex flex-wrap items-center gap-2">
                    Gagal Sinkronisasi dengan Google Sheet
                    <span className="bg-rose-100 text-[10px] text-rose-700 font-bold px-2 py-0.5 rounded-full">
                      Masalah Izin Akses / URL
                    </span>
                  </h4>
                  <p className="text-xs text-rose-700 mt-1.5 leading-relaxed bg-white/50 p-3 rounded-xl border border-rose-100/40 font-medium">
                    {syncStatus.error}
                  </p>
                </div>

                {/* Interactive Steps Checklist */}
                <div className="bg-white/80 border border-rose-100/60 rounded-xl p-4 space-y-3 shadow-inner animate-fade-in">
                  <span className="text-xs font-bold text-rose-900 block">💡 Mengapa ini terjadi walaupun script Anda sudah benar?</span>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                    Meskipun baris kode script sudah benar, Google Server akan menolak akses (mengembalikan halaman Login HTML) jika pengaturan publikasi atau versi deploy-nya belum diperbarui secara resmi di Google Cloud. Silakan ikuti checkbox langkah demi langkah di bawah ini untuk mengatasinya:
                  </p>
                  <ul className="text-xs text-slate-700 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4 shrink-0" id="step-1" />
                      <label htmlFor="step-1" className="cursor-pointer select-none text-slate-600 leading-relaxed">
                        <strong>Langkah 1:</strong> Buka editor Google Apps Script Anda, klik tombol <strong>Deploy</strong> &gt; <strong>Manage deployments</strong> di sudut kanan atas.
                      </label>
                    </li>
                    <li className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4 shrink-0" id="step-2" />
                      <label htmlFor="step-2" className="cursor-pointer select-none text-slate-600 leading-relaxed">
                        <strong>Langkah 2:</strong> Klik tombol edit (ikon pensil) pada deployment aktif Anda. Pastikan opsi <strong>Execute as</strong> (Jalankan sebagai) diatur ke <strong>Me (Saya / email Anda)</strong> dan <strong>Who has access</strong> (Siapa yang memiliki akses) diatur ke <strong>Anyone</strong> (Siapa saja / Anonim).
                      </label>
                    </li>
                    <li className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4 shrink-0" id="step-3" />
                      <label htmlFor="step-3" className="cursor-pointer select-none text-slate-600 leading-relaxed">
                        <strong>Langkah 3 (PENTING):</strong> Pada dropdown <strong>Version</strong> (Versi), Anda <strong>WAJIB</strong> memilih <strong>"New version" (Versi Baru)</strong> setiap kali memperbarui atau menyimpan script agar perubahan kode aktif di server Google.
                      </label>
                    </li>
                    <li className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4 shrink-0" id="step-4" />
                      <label htmlFor="step-4" className="cursor-pointer select-none text-slate-600 leading-relaxed">
                        <strong>Langkah 4:</strong> Klik tombol <strong>Deploy</strong>, lalu salin kembali URL baru berakhiran <strong>/exec</strong> yang dihasilkan. Tempelkan URL tersebut di tab <strong>Pengaturan</strong> aplikasi ini.
                      </label>
                    </li>
                    <li className="flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer h-4 w-4 shrink-0" id="step-5" />
                      <label htmlFor="step-5" className="cursor-pointer select-none text-slate-600 leading-relaxed">
                        <strong>Catatan Akun Google Workspace:</strong> Jika Anda menggunakan email kantor/sekolah, Google membatasi akses anonim. Solusinya, silakan gunakan <strong>akun Gmail pribadi (@gmail.com)</strong> untuk membuat Spreadsheet dan script tersebut.
                      </label>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-rose-100/50">
              <button
                onClick={() => {
                  setSyncStatus(prev => ({ ...prev, error: null }));
                }}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer"
              >
                Abaikan Peringatan
              </button>
              <button
                onClick={() => {
                  handleSaveUrl('demo');
                }}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Aktifkan Mode Simulasi (Tanpa Setup)
              </button>
              <button
                onClick={() => setActiveTab('help')}
                className="px-3.5 py-1.5 border border-rose-200 text-rose-800 bg-rose-50 hover:bg-rose-100/80 rounded-xl text-xs font-semibold transition shadow-sm cursor-pointer"
              >
                Lihat Panduan Visual
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition shadow-md cursor-pointer"
              >
                Buka Pengaturan URL
              </button>
              <button
                onClick={triggerSync}
                disabled={syncStatus.isSyncing}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-100 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                Coba Sinkronisasi Lagi
              </button>
            </div>
          </div>
        )}

        {/* Active Tab View */}
        <div className="animate-fade-in">{renderTabContent()}</div>
      </main>

      {/* Transaction Add/Edit Modal Overlay */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
            <TransactionForm
              categories={categories}
              transactionToEdit={editingTransaction}
              onSubmit={handleTransactionSubmit}
              onCancel={() => {
                setShowFormModal(false);
                setEditingTransaction(null);
              }}
              onAddCategory={handleAddCategory}
            />
          </div>
        </div>
      )}

      {/* App Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400">
        <p>&copy; 2026 Buku Kas PWA Sync. Semua Hak Cipta Dilindungi.</p>
        <p className="mt-1">Dibuat menggunakan React, Tailwind CSS, &amp; Google Apps Script.</p>
      </footer>
    </div>
  );
}
