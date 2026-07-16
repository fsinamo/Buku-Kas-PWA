/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, X, Calendar, Tag, FileText, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { Transaction, Category } from '../types';

interface TransactionFormProps {
  categories: Category[];
  transactionToEdit?: Transaction | null;
  onSubmit: (data: {
    tanggal: string;
    kategori: string;
    keterangan: string;
    debet: number;
    kredit: number;
  }) => void;
  onCancel: () => void;
  onAddCategory: (name: string, type: 'income' | 'expense') => void;
}

export default function TransactionForm({
  categories,
  transactionToEdit,
  onSubmit,
  onCancel,
  onAddCategory,
}: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [tanggal, setTanggal] = useState('');
  const [kategori, setKategori] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [jumlah, setJumlah] = useState<number | ''>('');
  
  // Inline category addition state
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Set initial form state for today's date
  useEffect(() => {
    if (transactionToEdit) {
      setType(transactionToEdit.debet > 0 ? 'income' : 'expense');
      setTanggal(transactionToEdit.tanggal);
      setKategori(transactionToEdit.kategori);
      setKeterangan(transactionToEdit.keterangan);
      setJumlah(transactionToEdit.debet > 0 ? transactionToEdit.debet : transactionToEdit.kredit);
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setTanggal(`${yyyy}-${mm}-${dd}`);
      
      // Default to the first category of the selected type
      const defaultType = 'expense';
      setType(defaultType);
      const filtered = categories.filter(c => c.type === defaultType && c.status !== 'pending_delete');
      if (filtered.length > 0) {
        setKategori(filtered[0].name);
      } else {
        setKategori('');
      }
    }
  }, [transactionToEdit, categories]);

  // Adjust categories when Type changes
  const handleTypeChange = (newType: 'income' | 'expense') => {
    setType(newType);
    const filtered = categories.filter(c => c.type === newType && c.status !== 'pending_delete');
    if (filtered.length > 0) {
      setKategori(filtered[0].name);
    } else {
      setKategori('');
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    
    // Check if category already exists
    const exists = categories.some(
      c => c.name.toLowerCase() === trimmed.toLowerCase() && c.type === type && c.status !== 'pending_delete'
    );
    
    if (exists) {
      alert('Kategori dengan nama dan tipe ini sudah ada!');
      return;
    }

    onAddCategory(trimmed, type);
    setKategori(trimmed);
    setNewCatName('');
    setShowAddCat(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggal || !kategori || !keterangan || !jumlah || Number(jumlah) <= 0) {
      alert('Mohon lengkapi semua isian dengan benar.');
      return;
    }

    const amt = Number(jumlah);
    onSubmit({
      tanggal,
      kategori,
      keterangan: keterangan.trim(),
      debet: type === 'income' ? amt : 0,
      kredit: type === 'expense' ? amt : 0,
    });
  };

  const filteredCategories = categories.filter(c => c.type === type && c.status !== 'pending_delete');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-100 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">
          {transactionToEdit ? 'Ubah Transaksi' : 'Tambah Transaksi Baru'}
        </h3>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
        {/* Type Selector (Debet vs Kredit) */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Jenis Arus Kas
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm border transition ${
                type === 'income'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-50'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowUpRight className={`h-5 w-5 ${type === 'income' ? 'text-emerald-600' : 'text-slate-400'}`} />
              Penerimaan (Debet)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm border transition ${
                type === 'expense'
                  ? 'bg-red-50 border-red-200 text-red-700 shadow-sm shadow-red-50'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowDownRight className={`h-5 w-5 ${type === 'expense' ? 'text-red-600' : 'text-slate-400'}`} />
              Pengeluaran (Kredit)
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div>
          <label htmlFor="tanggal" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Tanggal Transaksi
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="date"
              id="tanggal"
              required
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
            />
          </div>
        </div>

        {/* Category Selector with Inline Quick Add */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="kategori" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kategori
            </label>
            <button
              type="button"
              onClick={() => setShowAddCat(!showAddCat)}
              className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> Buat Baru
            </button>
          </div>

          {showAddCat ? (
            <div className="flex gap-2 mb-2 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-fade-in">
              <input
                type="text"
                placeholder="Nama kategori baru..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleCreateCategory}
                className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-emerald-700 transition"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowAddCat(false)}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1.5"
              >
                Batal
              </button>
            </div>
          ) : null}

          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Tag className="h-4 w-4" />
            </div>
            <select
              id="kategori"
              required
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm bg-white transition appearance-none"
            >
              {filteredCategories.length === 0 ? (
                <option value="">Belum ada kategori. Klik 'Buat Baru'</option>
              ) : (
                filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))
              )}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor="jumlah" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Nominal Transaksi (Rupiah)
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-semibold text-sm">
              Rp
            </div>
            <input
              type="number"
              id="jumlah"
              min="1"
              required
              placeholder="0"
              value={jumlah}
              onChange={(e) => {
                const val = e.target.value;
                setJumlah(val === '' ? '' : Number(val));
              }}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm font-semibold transition"
            />
          </div>
        </div>

        {/* Description Input */}
        <div>
          <label htmlFor="keterangan" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Keterangan
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <FileText className="h-4 w-4" />
            </div>
            <input
              type="text"
              id="keterangan"
              required
              placeholder="Contoh: Pembayaran invoice #204, beli ATK kantor..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            type="submit"
            className="flex-1 py-3 px-4 rounded-xl text-white font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-50 hover:shadow-lg transition"
          >
            {transactionToEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </button>
        </div>
      </form>
    </div>
  );
}
