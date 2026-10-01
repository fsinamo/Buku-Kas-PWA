/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  Tag,
  Trash2,
  Sparkles,
  Users,
  Shield,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

import { Transaction, Category, UserSession, SyncStatus, UserRole } from './types';
import Login from './components/Login';
import Analytics from './components/Analytics';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import ExportPanel from './components/ExportPanel';
import AppsScriptHelp from './components/AppsScriptHelp';
import UserManagement from './components/UserManagement';
import {
  getSavedAppScriptUrl,
  saveAppScriptUrl,
  validateAppScriptUrl,
  testAppScriptConnection,
  getLocalTransactions,
  saveLocalTransactions,
  getLocalCategories,
  saveLocalCategories,
  getLocalUsers,
  saveLocalUsers,
  getLastSyncTime,
  performSync,
  registerOrUpdateUser,
} from './lib/sheetsService';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // App data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [appScriptUrl, setAppScriptUrl] = useState('');
  
  // UI states
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'export' | 'users' | 'settings' | 'help'>('dashboard');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');

  // Test Connection state
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; spreadsheetName?: string; spreadsheetUrl?: string } | null>(null);

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
        if (Date.now() < parsed.expiresAt) {
          // Verify with latest local user role in case it was updated
          const currentUsers = getLocalUsers();
          const match = currentUsers.find(u => u.email.toLowerCase() === parsed.email.toLowerCase());
          if (match && match.role !== parsed.role) {
            parsed.role = match.role;
            localStorage.setItem('buku_kas_user_session', JSON.stringify(parsed));
          }
          setSession(parsed);
        } else {
          localStorage.removeItem('buku_kas_user_session');
        }
      } catch {
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
    }, 25000);

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

      // Update current session role if it changed on remote
      if (session) {
        const updatedUsers = getLocalUsers();
        const me = updatedUsers.find(u => u.email.toLowerCase() === session.email.toLowerCase());
        if (me && me.role !== session.role) {
          const updatedSession = { ...session, role: me.role };
          setSession(updatedSession);
          localStorage.setItem('buku_kas_user_session', JSON.stringify(updatedSession));
        }
      }
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
    if (getSavedAppScriptUrl()) {
      triggerSync();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('buku_kas_user_session');
    setSession(null);
  };

  // Test and save Google Apps Script URL
  const handleTestAndSaveUrl = async (url: string) => {
    const trimmed = url.trim();
    setTestResult(null);
    setIsTestingUrl(true);

    if (!trimmed) {
      setIsTestingUrl(false);
      saveAppScriptUrl('');
      setAppScriptUrl('');
      setTestResult({ success: false, message: 'URL tidak boleh kosong.' });
      return;
    }

    const validation = validateAppScriptUrl(trimmed);
    if (!validation.isValid) {
      setIsTestingUrl(false);
      setTestResult({ success: false, message: validation.error || 'URL tidak valid.' });
      return;
    }

    // Run connection test
    const res = await testAppScriptConnection(trimmed);
    setIsTestingUrl(false);
    setTestResult(res);

    if (res.success) {
      saveAppScriptUrl(trimmed);
      setAppScriptUrl(trimmed);
      setSyncStatus(prev => ({ ...prev, error: null }));

      // If current user is doing the initial setup, ensure they are Super Admin
      if (session) {
        const users = getLocalUsers();
        const me = users.find(u => u.email.toLowerCase() === session.email.toLowerCase());
        if (!me || me.role !== 'super_admin') {
          const updatedUser = registerOrUpdateUser(session.email, session.name, 'super_admin');
          const updatedSession: UserSession = { ...session, role: 'super_admin' };
          setSession(updatedSession);
          localStorage.setItem('buku_kas_user_session', JSON.stringify(updatedSession));
        }
      }

      // Trigger sync
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
    if (session?.role === 'viewer') {
      alert('Akun Viewer tidak memiliki izin menambah atau mengubah transaksi.');
      return;
    }

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
        saldo: 0,
        status: 'pending_add',
        updatedAt: Date.now(),
      };
      updated = [newTx, ...transactions];
    }

    setTransactions(updated);
    saveLocalTransactions(updated);
    setShowFormModal(false);
    setEditingTransaction(null);

    // Auto trigger sync in background unless bulk
    if (isOnline && appScriptUrl && syncMode !== 'bulk') {
      triggerSync();
    }
  };

  const handleTransactionEdit = (tx: Transaction) => {
    if (session?.role === 'viewer') {
      alert('Akun Viewer tidak memiliki izin mengubah transaksi.');
      return;
    }
    setEditingTransaction(tx);
    setShowFormModal(true);
  };

  const handleTransactionDelete = (id: string) => {
    if (session?.role === 'viewer' || session?.role === 'operator') {
      alert('Hanya Admin dan Super Admin yang dapat menghapus transaksi.');
      return;
    }

    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) return;

    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    let updated: Transaction[];
    if (tx.status === 'pending_add') {
      updated = transactions.filter(t => t.id !== id);
    } else {
      updated = transactions.map(t => {
        if (t.id === id) {
          return { ...t, status: 'pending_delete', updatedAt: Date.now() };
        }
        return t;
      });
    }

    setTransactions(updated);
    saveLocalTransactions(updated);

    if (isOnline && appScriptUrl) {
      triggerSync();
    }
  };

  // Category Actions
  const handleAddCategory = (name: string, type: 'income' | 'expense') => {
    if (session?.role === 'viewer' || session?.role === 'operator') {
      alert('Hanya Admin dan Super Admin yang dapat menambah kategori.');
      return;
    }

    const newCat: Category = {
      id: `cat_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
      name,
      type,
      status: 'pending_add',
    };

    const updated = [...categories, newCat];
    setCategories(updated);
    saveLocalCategories(updated);

    if (isOnline && appScriptUrl) {
      triggerSync();
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (session?.role === 'viewer' || session?.role === 'operator') {
      alert('Hanya Admin dan Super Admin yang dapat menghapus kategori.');
      return;
    }

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

  // Role permissions checks
  const isSuperAdmin = session?.role === 'super_admin';
  const isAdminOrSuper = session?.role === 'super_admin' || session?.role === 'admin';
  const canAddTransaction = session?.role !== 'viewer';
  const canEditTransaction = session?.role !== 'viewer';
  const canDeleteTransaction = isAdminOrSuper;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', style: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'admin':
        return { label: 'Admin', style: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'operator':
        return { label: 'Operator Kas', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'viewer':
        return { label: 'Viewer', style: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  // Render tab content
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
            canEdit={canEditTransaction}
            canDelete={canDeleteTransaction}
          />
        );
      case 'export':
        return <ExportPanel transactions={transactions} />;
      case 'users':
        return session ? (
          <UserManagement
            currentSession={session}
            onUsersUpdated={() => {
              if (getSavedAppScriptUrl()) triggerSync();
            }}
            onRoleChangedForCurrentSession={(newRole) => {
              const updatedSession = { ...session, role: newRole };
              setSession(updatedSession);
              localStorage.setItem('buku_kas_user_session', JSON.stringify(updatedSession));
            }}
          />
        ) : null;
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
                  <h3 className="text-lg font-bold text-slate-800">Pengaturan URL Google Apps Script</h3>
                  <p className="text-xs text-slate-500">
                    Koneksikan Google Sheets Anda sebagai cloud storage pembukuan kas kecil
                  </p>
                </div>
              </div>

              {!isSuperAdmin && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Hanya <strong>Super Admin</strong> yang dapat mengubah URL Web App Apps Script. Akun Anda saat ini ({getRoleBadge(session!.role).label}) hanya memiliki izin melihat.</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="appscript_url_input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    URL Web App Google Apps Script (/exec)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      id="appscript_url_input"
                      disabled={!isSuperAdmin}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={appScriptUrl}
                      onChange={(e) => setAppScriptUrl(e.target.value)}
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleTestAndSaveUrl(appScriptUrl)}
                        disabled={isTestingUrl}
                        className="bg-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-700 transition shadow-md shadow-emerald-50 shrink-0 text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isTestingUrl ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Menguji Koneksi...
                          </>
                        ) : (
                          'Uji Koneksi & Simpan'
                        )}
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          setAppScriptUrl('demo');
                          handleTestAndSaveUrl('demo');
                        }}
                        className="border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-semibold px-4 py-3 rounded-xl transition shrink-0 text-sm flex items-center gap-1.5 justify-center cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                        Gunakan Mode Simulasi
                      </button>
                    )}
                  </div>
                </div>

                {/* Test Result Message Box */}
                {testResult && (
                  <div className={`p-4 rounded-xl text-xs border animate-fade-in ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <strong className="block font-bold">
                          {testResult.success ? 'Koneksi Berhasil!' : 'Koneksi Gagal / Failed to fetch'}
                        </strong>
                        <p className="leading-relaxed whitespace-pre-line">{testResult.message}</p>
                        {testResult.spreadsheetName && (
                          <p className="text-[11px] font-semibold text-emerald-900 mt-1">
                            Nama Spreadsheet: {testResult.spreadsheetName}
                          </p>
                        )}
                        {testResult.spreadsheetUrl && (
                          <a
                            href={testResult.spreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 underline font-semibold mt-1"
                          >
                            Buka Google Spreadsheet <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 border border-slate-100 rounded-xl">
                  <strong>Catatan Penting:</strong> URL ini disimpan <strong>secara permanen</strong> di perangkat Anda. Pengguna pertama yang melakukan setup URL otomatis diangkat sebagai <strong>Super Admin</strong>.
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
                {isAdminOrSuper ? (
                  <form onSubmit={handleCreateCategoryInSettings} className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Kategori Baru</h4>
                    
                    <div>
                      <label htmlFor="cat_name" className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Kategori</label>
                      <input
                        type="text"
                        id="cat_name"
                        required
                        placeholder="Contoh: Transportasi, Konsumsi..."
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
                      className="w-full bg-emerald-600 text-white text-xs py-2 px-4 rounded-lg font-bold hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Tambah Kategori
                    </button>
                  </form>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500">
                    Penambahan kategori hanya dapat dilakukan oleh Admin dan Super Admin.
                  </div>
                )}

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
                              {isAdminOrSuper && (
                                <button
                                  onClick={() => handleDeleteCategory(c.id)}
                                  className="text-slate-400 hover:text-red-600 transition cursor-pointer"
                                  title="Hapus Kategori"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
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
            <div className="flex items-center gap-2.5 border-l border-slate-100 pl-3">
              <div className="hidden lg:block text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs font-semibold text-slate-700">{session.name || session.email}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${getRoleBadge(session.role).style}`}>
                    {getRoleBadge(session.role).label}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block font-medium font-mono">{session.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition cursor-pointer"
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
          <nav className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'export'
                  ? 'bg-white text-emerald-700 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Download className="h-4 w-4" />
              Ekspor Laporan
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-white text-purple-700 shadow-sm shadow-slate-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="h-4 w-4 text-purple-600" />
              Hak Akses
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
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
          {canAddTransaction && (
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
          )}
        </div>

        {/* Sync Warn Banner if URL missing */}
        {!getSavedAppScriptUrl() && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-800">Penyimpanan Cloud Google Sheet Belum Dihubungkan</h4>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                  Aplikasi saat ini berjalan dalam mode offline lokal. Buka menu Pengaturan URL untuk menghubungkan Google Apps Script Web App. Pengguna pertama yang melakukan setup otomatis menjadi Super Admin.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <button
                onClick={() => setActiveTab('help')}
                className="px-3.5 py-1.5 border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Baca Panduan Setup
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Setup URL Sekarang
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
                  <p className="text-xs text-rose-700 mt-1.5 leading-relaxed bg-white/50 p-3 rounded-xl border border-rose-100/40 font-medium whitespace-pre-line">
                    {syncStatus.error}
                  </p>
                </div>

                {/* Steps Checklist */}
                <div className="bg-white/80 border border-rose-100/60 rounded-xl p-4 space-y-3 shadow-inner animate-fade-in">
                  <span className="text-xs font-bold text-rose-900 block">💡 Solusi Mudah Mengatasi 'Failed to fetch' / Akses Ditolak:</span>
                  <ul className="text-xs text-slate-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">1.</span>
                      <span>Salin kode Google Apps Script versi terbaru dari tab <strong>"Panduan Setup"</strong> (kami telah memperbaiki error eksekusi).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">2.</span>
                      <span>Di editor script Google, tempel kode baru, lalu klik <strong>Deploy &gt; Manage deployments &gt; Edit (ikon pensil)</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">3.</span>
                      <span>Pilih <strong>Version: New version</strong> (WAJIB agar server Google mengaktifkan pembaruan kode).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">4.</span>
                      <span>Pastikan <strong>Execute as: Me (Saya)</strong> dan <strong>Who has access: Anyone (Siapa saja)</strong>, lalu klik Deploy.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-rose-100/50">
              <button
                onClick={() => setSyncStatus(prev => ({ ...prev, error: null }))}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Tutup Pesan
              </button>
              <button
                onClick={() => setActiveTab('help')}
                className="px-3.5 py-1.5 border border-rose-200 text-rose-800 bg-rose-50 hover:bg-rose-100/80 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Lihat Panduan Setup
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
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
        <p>&copy; 2026 Buku Kas PWA Sync. Multi-Level Account &amp; Google Apps Script.</p>
        <p className="mt-1">Dibuat menggunakan React, Tailwind CSS, &amp; Google Sheets Database.</p>
      </footer>
    </div>
  );
}
