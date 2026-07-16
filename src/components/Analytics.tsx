/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Transaction } from '../types';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

interface AnalyticsProps {
  transactions: Transaction[];
}

// Colors for visual appeal
const INCOME_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];
const EXPENSE_COLORS = ['#dc2626', '#f87171', '#ef4444', '#fb7185', '#fca5a5', '#fee2e2', '#f43f5e', '#ec4899'];

// Indonesian Currency Formatter helper
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function Analytics({ transactions }: AnalyticsProps) {
  // Exclude pending delete transactions
  const activeTxs = useMemo(() => {
    return transactions.filter(tx => tx.status !== 'pending_delete');
  }, [transactions]);

  // Aggregate Category Income data
  const incomeCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    activeTxs.forEach(tx => {
      if (tx.debet > 0) {
        map.set(tx.kategori, (map.get(tx.kategori) || 0) + tx.debet);
      }
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeTxs]);

  // Aggregate Category Expense data
  const expenseCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    activeTxs.forEach(tx => {
      if (tx.kredit > 0) {
        map.set(tx.kategori, (map.get(tx.kategori) || 0) + tx.kredit);
      }
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeTxs]);

  // Aggregate Monthly Trend data
  const monthlyTrendData = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    
    // Sort transactions chronologically to build month sequence correctly
    const chronological = [...activeTxs].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    chronological.forEach(tx => {
      // Extract YYYY-MM
      const dateParts = tx.tanggal.split('-');
      if (dateParts.length < 2) return;
      const key = `${dateParts[0]}-${dateParts[1]}`; // e.g. "2026-07"
      
      // Format to "Jul 26" or similar
      const dateObj = new Date(tx.tanggal);
      const formattedMonth = dateObj.toLocaleDateString('id-ID', {
        month: 'short',
        year: '2-digit',
      });

      const current = map.get(key) || { month: formattedMonth, income: 0, expense: 0 };
      current.income += tx.debet;
      current.expense += tx.kredit;
      map.set(key, current);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, val]) => val);
  }, [activeTxs]);

  const totalIncome = useMemo(() => activeTxs.reduce((sum, tx) => sum + tx.debet, 0), [activeTxs]);
  const totalExpense = useMemo(() => activeTxs.reduce((sum, tx) => sum + tx.kredit, 0), [activeTxs]);
  const balance = totalIncome - totalExpense;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-xl border border-slate-800">
          <p className="text-slate-300 font-medium mb-1">{payload[0].name}</p>
          <p className="text-emerald-400 text-sm font-bold">{formatRupiah(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const MultiTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-xl text-xs shadow-xl border border-slate-800">
          <p className="font-bold text-slate-300 border-b border-slate-800 pb-1.5 mb-2">{label}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-slate-400">Penerimaan:</span>
              <span className="text-emerald-400 font-bold">{formatRupiah(payload[0].value)}</span>
            </div>
            <div className="flex items-center gap-2 justify-between">
              <span className="text-slate-400">Pengeluaran:</span>
              <span className="text-red-400 font-bold">{formatRupiah(payload[1].value)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Saldo Akhir</span>
            <span className={`text-2xl font-bold tracking-tight ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatRupiah(balance)}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${balance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Debet Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Penerimaan (Debet)</span>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">{formatRupiah(totalIncome)}</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <ArrowUpRight className="h-6 w-6" />
          </div>
        </div>

        {/* Kredit Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Pengeluaran (Kredit)</span>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">{formatRupiah(totalExpense)}</span>
          </div>
          <div className="bg-red-50 text-red-600 p-3 rounded-xl">
            <ArrowDownRight className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Trend Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[380px]">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-800">Tren Arus Kas Bulanan</h4>
            <p className="text-xs text-slate-400">Komparasi debet dan kredit dari waktu ke waktu</p>
          </div>
          <div className="flex-1 w-full text-xs">
            {monthlyTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Belum ada data bulanan untuk divisualisasikan.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} tickFormatter={(val) => `Rp ${val / 1000}k`} />
                  <Tooltip content={<MultiTooltip />} />
                  <Legend verticalAlign="top" height={36} />
                  <Area name="Penerimaan" type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area name="Pengeluaran" type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown (Kredit & Debet side-by-side or stacked tabs) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[380px]">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-800">Distribusi Pengeluaran</h4>
            <p className="text-xs text-slate-400">Persentase pengeluaran (kredit) berdasarkan kategori</p>
          </div>
          <div className="flex-1 w-full flex flex-col md:flex-row items-center justify-center gap-4 text-xs">
            {expenseCategoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Belum ada data pengeluaran.
              </div>
            ) : (
              <>
                <div className="w-full md:w-[50%] h-[180px] md:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expenseCategoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 max-h-[160px] md:max-h-[260px] overflow-y-auto w-full space-y-2 pr-2">
                  {expenseCategoryData.map((item, index) => {
                    const percentage = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0';
                    return (
                      <div key={item.name} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }}
                          />
                          <span className="font-semibold text-slate-700 truncate max-w-[120px]">{item.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-800">{formatRupiah(item.value)}</span>
                          <span className="text-[10px] text-slate-400 font-medium ml-1.5">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 - Income Distribution */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-[280px]">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-800">Distribusi Penerimaan</h4>
            <p className="text-xs text-slate-400">Persentase pemasukan (debet) berdasarkan kategori</p>
          </div>
          <div className="flex-1 w-full flex flex-col md:flex-row items-center justify-center gap-6 text-xs">
            {incomeCategoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Belum ada data penerimaan.
              </div>
            ) : (
              <>
                <div className="w-full md:w-[40%] h-[150px] md:h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomeCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {incomeCategoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 max-h-[140px] md:max-h-[200px] overflow-y-auto w-full grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
                  {incomeCategoryData.map((item, index) => {
                    const percentage = totalIncome > 0 ? ((item.value / totalIncome) * 100).toFixed(1) : '0';
                    return (
                      <div key={item.name} className="flex items-center justify-between gap-4 border-b border-slate-50 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: INCOME_COLORS[index % INCOME_COLORS.length] }}
                          />
                          <span className="font-semibold text-slate-700 truncate max-w-[120px]">{item.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-800">{formatRupiah(item.value)}</span>
                          <span className="text-[10px] text-slate-400 font-medium ml-1.5">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
