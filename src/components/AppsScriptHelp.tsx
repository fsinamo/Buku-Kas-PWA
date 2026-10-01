/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Copy, Check, ExternalLink, HelpCircle, AlertCircle, FileText, Settings, Play, Users, Sparkles } from 'lucide-react';
import { getAppsScriptCode } from '../lib/sheetsService';

export default function AppsScriptHelp() {
  const [copied, setCopied] = useState(false);
  const code = getAppsScriptCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Panduan Integrasi Google Sheets &amp; Apps Script</h3>
          <p className="text-xs text-slate-500">Hubungkan pembukuan kas kecil dengan Google Spreadsheet pribadi &amp; multi-level hak akses</p>
        </div>
      </div>

      {/* Highlight on Multi-Level Accounts */}
      <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100 flex gap-3 items-start">
        <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-900 leading-relaxed">
          <strong className="font-bold block text-sm mb-1">Mendukung Multi-Level Akun (Super Admin, Admin, Operator, Viewer)</strong>
          Google Apps Script versi terbaru ini otomatis membuat sheet <code>pengguna</code> untuk menyimpan data hak akses akun Google. 
          Pengguna yang pertama kali melakukan setup URL Web App otomatis ditetapkan sebagai <strong>Super Admin</strong>.
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
              1
            </div>
            <div className="w-0.5 h-full bg-slate-100 min-h-[30px]"></div>
          </div>
          <div className="pb-4">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              Buka Google Spreadsheet
              <FileText className="h-4 w-4 text-slate-400" />
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Buka <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-medium hover:underline inline-flex items-center gap-0.5">Google Sheets Baru <ExternalLink className="h-3 w-3" /></a> dengan akun Google Anda. Beri nama spreadsheet Anda, misalnya <strong>"Buku Kas Kecil"</strong>.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
              2
            </div>
            <div className="w-0.5 h-full bg-slate-100 min-h-[30px]"></div>
          </div>
          <div className="pb-4">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              Buka Apps Script Editor
              <Settings className="h-4 w-4 text-slate-400" />
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Pada menu bagian atas Spreadsheet Anda, klik <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
              3
            </div>
            <div className="w-0.5 h-full bg-slate-100 min-h-[50px]"></div>
          </div>
          <div className="pb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">Salin &amp; Tempel Kode Script Terbaru</h4>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Salin Kode Script
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Hapus seluruh isi file <code>Code.gs</code> di editor Apps Script, lalu tempel kode script terbaru di bawah ini:
            </p>
            <div className="mt-2.5 max-h-[160px] overflow-y-auto rounded-lg border border-slate-100 bg-slate-950 p-3 text-[11px] font-mono text-slate-300">
              <pre>{code}</pre>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
              4
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              Deploy sebagai Web App (Kunci Menghindari 'Failed to fetch')
              <Play className="h-4 w-4 text-slate-400" />
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Ikuti konfigurasi publikasi yang benar agar tidak terjadi error <em>Failed to fetch</em>:
            </p>
            <ol className="list-decimal list-inside text-xs text-slate-600 mt-1.5 space-y-2 pl-1">
              <li>Klik tombol <strong>Terapkan (Deploy)</strong> &gt; <strong>Penerapan baru (New deployment)</strong> di bagian kanan atas.</li>
              <li>Klik ikon gerigi di sebelah "Pilih tipe" (Select type) dan pilih <strong>Aplikasi web (Web app)</strong>.</li>
              <li>Isi deskripsi (misalnya: <em>"Buku Kas Kecil PWA Sync"</em>).</li>
              <li>
                Atur <strong>Jalankan sebagai (Execute as)</strong> ke: <strong>Saya / Me (Your account)</strong>.
                <span className="text-rose-600 font-bold block ml-4 mt-0.5">⚠️ JANGAN pilih "User accessing the web app" karena akan menyebabkan Google menolak akses anonim!</span>
              </li>
              <li>
                Atur <strong>Siapa yang memiliki akses (Who has access)</strong> ke: <strong>Siapa saja / Anyone</strong>.
                <span className="text-rose-600 font-bold block ml-4 mt-0.5">⚠️ WAJIB pilih "Anyone" agar browser dapat mengirim &amp; mengunduh data kas tanpa blokir CORS.</span>
              </li>
              <li>Klik <strong>Terapkan (Deploy)</strong>.</li>
              <li>Bila Google meminta izin, klik <strong>Authorize access</strong> &gt; pilih akun Google Anda &gt; klik <strong>Advanced</strong> &gt; klik <strong>Go to Buku Kas (unsafe)</strong> &gt; klik <strong>Allow</strong>.</li>
              <li>Salin <strong>URL Aplikasi Web (Web app URL)</strong> yang berakhiran <code>/exec</code>.</li>
            </ol>

            {/* Troubleshooting Solusi Failed to fetch */}
            <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
              <div className="flex gap-2.5 items-start">
                <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong className="block font-bold text-sm mb-1">💡 Mengapa Terjadi Error "Failed to fetch"?</strong>
                  Penyebab error <em>Failed to fetch</em> adalah salah satu dari 3 hal berikut:
                </div>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-900 space-y-1.5 pl-6">
                <li>
                  <strong>Pengaturan "Who has access" bukan "Anyone":</strong> Jika diatur ke "Only myself" atau "Anyone with Google account", server Google akan merespon dengan halaman login Google dan memblokir fetch (CORS block). Solusinya: Ubah ke <strong>Anyone (Siapa saja)</strong>.
                </li>
                <li>
                  <strong>Perubahan kode belum di "New Version":</strong> Jika Anda baru saja memperbarui kode script, Anda <strong>WAJIB</strong> klik <em>Deploy &gt; Manage deployments &gt; ikon Pensil (Edit) &gt; pilih Version: New version &gt; Deploy</em>. Jika tidak memilih <em>New version</em>, Google tetap menjalankan versi lama Anda.
                </li>
                <li>
                  <strong>Akun Google Workspace (Organisasi/Kampus/Sekolah):</strong> Beberapa organisasi melarang opsi deployment "Anyone". Jika demikian, gunakan <strong>akun Gmail pribadi (@gmail.com)</strong> untuk membuat Spreadsheet dan script tersebut.
                </li>
              </ul>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex gap-2.5 items-start">
              <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 leading-relaxed">
                <strong className="block font-semibold">Langkah Terakhir:</strong>
                Tempelkan URL Web App ke menu <strong>Pengaturan URL</strong> di aplikasi ini, lalu klik tombol <strong>"Uji Koneksi &amp; Simpan"</strong> untuk langsung mengaktifkan sinkronisasi otomatis!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
