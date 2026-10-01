/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
  CloudCheck,
  CloudLightning,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Transaction, Category } from '../types';
import { formatRupiah } from './Analytics';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function TransactionList({
  transactions,
  categories,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: TransactionListProps) {
  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState<'All' | 'income' | 'expense'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter transactions
  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Search text filter (case insensitive)
      const matchesSearch = tx.keterangan.toLowerCase().includes(search.toLowerCase()) || 
                            tx.kategori.toLowerCase().includes(search.toLowerCase());

      // 2. Category filter
      const matchesCategory = selectedCategory === 'All' || tx.kategori === selectedCategory;

      // 3. Type filter (income corresponds to debet > 0, expense to kredit > 0)
      const matchesType =
        selectedType === 'All' ||
        (selectedType === 'income' && tx.debet > 0) ||
        (selectedType === 'expense' && tx.kredit > 0);

      // 4. Date filter
      const matchesStartDate = !startDate || tx.tanggal >= startDate;
      const matchesEndDate = !endDate || tx.tanggal <= endDate;

      return matchesSearch && matchesCategory && matchesType && matchesStartDate && matchesEndDate;
    });
  }, [transactions, search, selectedCategory, selectedType, startDate, endDate]);

  // Reset pagination when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, selectedType, startDate, endDate]);

  // Paginated data
  const paginatedTxs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTxs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTxs, currentPage]);

  const totalPages = Math.ceil(filteredTxs.length / itemsPerPage) || 1;

  // Formatting date for display
  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const activeCategories = useMemo(() => {
    return categories.filter(c => c.status !== 'pending_delete');
  }, [categories]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      {/* Search & Filter Header */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Text Search */}
          <div className="flex-1 relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Cari keterangan atau kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-700 text-sm bg-white transition placeholder-slate-400"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setSelectedType('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedType === 'All' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setSelectedType('income')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedType === 'income' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Penerimaan
            </button>
            <button
              onClick={() => setSelectedType('expense')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedType === 'expense' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pengeluaran
            </button>
          </div>

          {/* Category Filter */}
          <div className="relative rounded-xl shadow-sm shrink-0 min-w-[160px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Filter className="h-4 w-4" />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-700 text-sm bg-white transition appearance-none"
            >
              <option value="All">Semua Kategori</option>
              {activeCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Date Filters Expandable */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="font-semibold">Saring Tanggal:</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span>s.d.</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {(startDate || endDate || selectedCategory !== 'All' || selectedType !== 'All' || search) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
                setSelectedType('All');
                setStartDate('');
                setEndDate('');
              }}
              className="text-emerald-600 font-semibold hover:underline cursor-pointer ml-auto"
            >
              Atur Ulang Filter
            </button>
          )}
        </div>
      </div>

      {/* Table Section (Desktop) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-5">Status</th>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Kategori</th>
              <th className="py-3 px-4">Keterangan</th>
              <th className="py-3 px-4 text-right">Debet (Penerimaan)</th>
              <th className="py-3 px-4 text-right">Kredit (Pengeluaran)</th>
              <th className="py-3 px-4 text-right">Saldo</th>
              <th className="py-3 px-5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {paginatedTxs.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-400 font-medium">
                  Tidak ditemukan transaksi yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              paginatedTxs.map((tx) => {
                const isIncome = tx.debet > 0;
                const isPending = tx.status !== 'synced';

                return (
                  <tr key={tx.id} className={`hover:bg-slate-50/50 transition ${tx.status === 'pending_delete' ? 'opacity-40 line-through bg-red-50/20' : ''}`}>
                    {/* Sync status */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-center">
                        {isPending ? (
                          tx.status === 'pending_delete' ? (
                            <span title="Dihapus offline (Menunggu Sync)" className="bg-red-50 text-red-600 p-1 rounded-md">
                              <CloudLightning className="h-4 w-4" />
                            </span>
                          ) : (
                            <span title="Menunggu Sinkronisasi ke Sheet" className="bg-amber-50 text-amber-600 p-1 rounded-md">
                              <CloudLightning className="h-4 w-4" />
                            </span>
                          )
                        ) : (
                          <span title="Data tersinkronisasi" className="bg-emerald-50 text-emerald-600 p-1 rounded-md">
                            <CloudCheck className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tanggal */}
                    <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {formatDateDisplay(tx.tanggal)}
                    </td>

                    {/* Kategori */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {tx.kategori}
                      </span>
                    </td>

                    {/* Keterangan */}
                    <td className="py-3.5 px-4 font-medium text-slate-600 max-w-[200px] truncate" title={tx.keterangan}>
                      {tx.keterangan}
                    </td>

                    {/* Debet */}
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                      {tx.debet > 0 ? formatRupiah(tx.debet) : '-'}
                    </td>

                    {/* Kredit */}
                    <td className="py-3.5 px-4 text-right font-bold text-red-600">
                      {tx.kredit > 0 ? formatRupiah(tx.kredit) : '-'}
                    </td>

                    {/* Saldo */}
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                      {formatRupiah(tx.saldo)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-5 text-center">
                      <div className="flex justify-center items-center gap-2">
                        {tx.status !== 'pending_delete' && (
                          <>
                            {canEdit && (
                              <button
                                onClick={() => onEdit(tx)}
                                className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition"
                                title="Ubah"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => onDelete(tx.id)}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            {!canEdit && !canDelete && (
                              <span className="text-[11px] text-slate-400 italic">Lihat saja</span>
                            )}
                          </>
                        )}
                        {tx.status === 'pending_delete' && (
                          <span className="text-xs text-red-500 font-semibold italic">Dihapus</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Cards List (Mobile Layout) */}
      <div className="block md:hidden divide-y divide-slate-100">
        {paginatedTxs.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-medium text-sm">
            Tidak ditemukan transaksi yang cocok dengan filter.
          </div>
        ) : (
          paginatedTxs.map((tx) => {
            const isIncome = tx.debet > 0;
            const isPending = tx.status !== 'synced';

            return (
              <div
                key={tx.id}
                className={`p-4 hover:bg-slate-50/50 transition flex flex-col gap-2.5 ${
                  tx.status === 'pending_delete' ? 'opacity-40 line-through bg-red-50/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{formatDateDisplay(tx.tanggal)}</span>
                  
                  <div className="flex items-center gap-1.5">
                    {/* Sync Status Badge */}
                    {isPending ? (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        tx.status === 'pending_delete' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        <CloudLightning className="h-3 w-3" /> Offline
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
                        <CloudCheck className="h-3 w-3" /> Sync
                      </span>
                    )}

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {tx.kategori}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{tx.keterangan}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-400">Saldo:</span>
                      <span className="text-xs font-semibold text-slate-700">{formatRupiah(tx.saldo)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-base font-bold ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
                      {isIncome ? `+${formatRupiah(tx.debet)}` : `-${formatRupiah(tx.kredit)}`}
                    </p>
                  </div>
                </div>

                {/* Actions Row Mobile */}
                {tx.status !== 'pending_delete' && (canEdit || canDelete) && (
                  <div className="flex justify-end gap-3 mt-1 pt-2 border-t border-slate-50">
                    {canEdit && (
                      <button
                        onClick={() => onEdit(tx)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 py-1 px-2 rounded hover:bg-emerald-50 transition font-medium"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Ubah
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(tx.id)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 py-1 px-2 rounded hover:bg-red-50 transition font-medium"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Menampilkan <span className="font-semibold text-slate-700">{filteredTxs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> hingga{' '}
          <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredTxs.length)}</span> dari{' '}
          <span className="font-semibold text-slate-700">{filteredTxs.length}</span> transaksi
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-600 font-semibold self-center px-1">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Offline sync note */}
      <div className="p-3 bg-emerald-50/40 border-t border-slate-100 text-[11px] text-slate-500 flex gap-2 items-center">
        <Info className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>
          Ikon petir <CloudLightning className="h-3 w-3 inline text-amber-500" /> menunjukkan data tersimpan di perangkat (offline) dan akan disinkronkan otomatis saat ada koneksi internet.
        </span>
      </div>
    </div>
  );
}
