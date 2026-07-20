/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar, Filter, AlertCircle } from 'lucide-react';
import { Transaction } from '../types';
import { formatRupiah } from './Analytics';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ExportPanelProps {
  transactions: Transaction[];
}

export default function ExportPanel({ transactions }: ExportPanelProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Set default dates: start of current month and today
  React.useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    setStartDate(`${yyyy}-${mm}-01`);
    setEndDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Filtered transactions based on selected date range
  const filteredTxs = useMemo(() => {
    setError(null);
    if (!startDate || !endDate) return [];

    if (startDate > endDate) {
      setError('Tanggal Mulai tidak boleh setelah Tanggal Selesai.');
      return [];
    }

    // Filter, sort chronologically (ascending date) to calculate running balance correctly
    return transactions
      .filter(tx => tx.status !== 'pending_delete' && tx.tanggal >= startDate && tx.tanggal <= endDate)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [transactions, startDate, endDate]);

  // Aggregate stats for filtered data
  const stats = useMemo(() => {
    let debetSum = 0;
    let kreditSum = 0;
    filteredTxs.forEach(tx => {
      debetSum += tx.debet;
      kreditSum += tx.kredit;
    });
    return {
      totalDebet: debetSum,
      totalKredit: kreditSum,
      finalBalance: debetSum - kreditSum,
    };
  }, [filteredTxs]);

  // Handle PDF Export
  const handleExportPDF = () => {
    if (filteredTxs.length === 0) {
      alert('Tidak ada data transaksi pada rentang tanggal yang dipilih.');
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Header Design
      doc.setFillColor(5, 150, 105); // emerald-600
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('BUKU KAS UTAMA', 10, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Laporan Pertanggungjawaban Keuangan Kas (PWA Sync)', 10, 25);
      doc.text(`Periode Laporan: ${formatDateIndo(startDate)} s.d. ${formatDateIndo(endDate)}`, 10, 30);

      // Metainfo on right side
      doc.setFontSize(9);
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 140, 18);
      doc.text('User: ravinaarcamanik@gmail.com', 140, 23);
      doc.text('Status Data: Terverifikasi (Sync)', 140, 28);

      // Title below header banner
      doc.setTextColor(30, 41, 59); // slate-800
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Rincian Arus Kas Transaksi', 10, 50);

      // Table preparation
      const tableRows = filteredTxs.map((tx, idx) => [
        idx + 1,
        formatDateIndo(tx.tanggal),
        tx.kategori,
        tx.keterangan,
        tx.debet > 0 ? formatRupiahSimple(tx.debet) : '-',
        tx.kredit > 0 ? formatRupiahSimple(tx.kredit) : '-',
        formatRupiahSimple(tx.saldo),
      ]);

      // Add a final summary row
      const summaryRow = [
        '',
        'TOTAL',
        '',
        '',
        formatRupiahSimple(stats.totalDebet),
        formatRupiahSimple(stats.totalKredit),
        formatRupiahSimple(stats.finalBalance),
      ];
      tableRows.push(summaryRow);

      autoTable(doc, {
        startY: 55,
        margin: { left: 10, right: 10 },
        head: [['No', 'Tanggal', 'Kategori', 'Keterangan', 'Penerimaan (Debet)', 'Pengeluaran (Kredit)', 'Saldo']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 24, halign: 'center' },
          2: { cellWidth: 28 },
          3: { cellWidth: 44 },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
          6: { cellWidth: 30, halign: 'right' },
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
        },
        didParseCell: (data) => {
          // Highlight the final total row
          if (data.row.index === tableRows.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249]; // slate-100
            data.cell.styles.textColor = [15, 23, 42]; // slate-900
          }
        },
      });

      // Save document
      doc.save(`Laporan_Kas_${startDate}_to_${endDate}.pdf`);

    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat memproses ekspor PDF.');
    }
  };

  // Handle Excel Export
  const handleExportExcel = () => {
    if (filteredTxs.length === 0) {
      alert('Tidak ada data transaksi pada rentang tanggal yang dipilih.');
      return;
    }

    try {
      // Structure the data for Sheets with Indonesian titles
      const dataRows = filteredTxs.map((tx, idx) => ({
        'No.': idx + 1,
        'Tanggal': tx.tanggal,
        'Kategori': tx.kategori,
        'Keterangan': tx.keterangan,
        'Penerimaan (Debet)': tx.debet,
        'Pengeluaran (Kredit)': tx.kredit,
        'Saldo Akhir': tx.saldo,
      }));

      // Create sheet from JSON
      const ws = XLSX.utils.json_to_sheet(dataRows);
      
      // Auto-fit columns helper
      const colWidths = [
        { wch: 6 },
        { wch: 12 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
      ];
      ws['!cols'] = colWidths;

      // Add worksheet metadata and book
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kas Utama');

      // Write workbook file
      XLSX.writeFile(wb, `Laporan_Kas_${startDate}_to_${endDate}.xlsx`);

    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat memproses ekspor Excel.');
    }
  };

  // Helper date formatter
  const formatDateIndo = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length < 3) return dateStr;
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Simple Rupiah format for tables without symbols to prevent spacing issues in columns
  const formatRupiahSimple = (val: number): string => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
          <Download className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Ekspor Laporan Keuangan</h3>
          <p className="text-xs text-slate-500">Unduh data pembukuan kas Anda dalam format resmi PDF atau Excel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Start Date */}
        <div>
          <label htmlFor="start_date" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Mulai Tanggal
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="date"
              id="start_date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition animate-fade-in"
            />
          </div>
        </div>

        {/* End Date */}
        <div>
          <label htmlFor="end_date" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Selesai Tanggal
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <input
              type="date"
              id="end_date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-sm transition"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex gap-2.5 items-start">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs font-semibold text-red-800">{error}</div>
        </div>
      )}

      {/* Info Panel of Filtered Items */}
      {!error && startDate && endDate ? (
        <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <div className="text-xs text-slate-600">
              Ditemukan <span className="font-bold text-slate-800">{filteredTxs.length} transaksi</span> aktif dalam periode terpilih.
            </div>
          </div>
          {filteredTxs.length > 0 && (
            <div className="flex gap-4 text-xs font-semibold border-t md:border-t-0 border-slate-200 pt-2.5 md:pt-0 w-full md:w-auto">
              <div className="flex-1 md:flex-initial">
                <span className="text-slate-400 block text-[10px] uppercase">Penerimaan</span>
                <span className="text-emerald-600">{formatRupiah(stats.totalDebet)}</span>
              </div>
              <div className="flex-1 md:flex-initial">
                <span className="text-slate-400 block text-[10px] uppercase">Pengeluaran</span>
                <span className="text-red-600">{formatRupiah(stats.totalKredit)}</span>
              </div>
              <div className="flex-1 md:flex-initial">
                <span className="text-slate-400 block text-[10px] uppercase">Arus Kas Bersih</span>
                <span className={stats.finalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatRupiah(stats.finalBalance)}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Export Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export to PDF */}
        <button
          onClick={handleExportPDF}
          disabled={!!error || filteredTxs.length === 0}
          className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl border border-red-200 text-red-700 bg-red-50/50 hover:bg-red-50 hover:shadow-md hover:shadow-red-50 font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          <FileText className="h-5 w-5 text-red-600" />
          Ekspor PDF (.pdf)
        </button>

        {/* Export to Excel */}
        <button
          onClick={handleExportExcel}
          disabled={!!error || filteredTxs.length === 0}
          className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl border border-emerald-200 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-50 hover:shadow-md hover:shadow-emerald-50 font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          Ekspor Excel (.xlsx)
        </button>
      </div>
    </div>
  );
}
