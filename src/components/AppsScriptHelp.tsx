/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Copy, Check, ExternalLink, HelpCircle, AlertCircle, FileText, Settings, Play } from 'lucide-react';
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
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800">Panduan Integrasi Google Sheets</h3>
          <p className="text-xs text-slate-500">Hubungkan pembukuan Anda dengan Google Spreadsheet pribadi</p>
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
              Buat Google Spreadsheet Baru
              <FileText className="h-4 w-4 text-slate-400" />
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Buka <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-medium hover:underline inline-flex items-center gap-0.5">Google Sheets <ExternalLink className="h-3 w-3" /></a> dengan akun Google Anda. Beri nama file spreadsheet Anda, misalnya <strong>"appdb"</strong>.
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
              Buka Apps Script editor
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
              <h4 className="text-sm font-semibold text-slate-800">Salin &amp; Tempel Kode Apps Script</h4>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition ${
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
                    <Copy className="h-3.5 w-3.5" /> Salin Kode
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Hapus semua kode bawaan di dalam editor script, lalu tempelkan kode Apps Script yang Anda salin melalui tombol di atas.
            </p>
            <div className="mt-2.5 max-h-[140px] overflow-y-auto rounded-lg border border-slate-100 bg-slate-950 p-3 text-[11px] font-mono text-slate-300">
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
              Terapkan sebagai Web App
              <Play className="h-4 w-4 text-slate-400" />
            </h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Ikuti petunjuk publikasi berikut:
            </p>
            <ol className="list-decimal list-inside text-xs text-slate-600 mt-1.5 space-y-1.5 pl-1">
              <li>Klik tombol <strong>Terapkan (Deploy)</strong> &gt; <strong>Penerapan baru (New deployment)</strong> di bagian kanan atas.</li>
              <li>Klik ikon gerigi di sebelah "Pilih tipe" (Select type) dan pilih <strong>Aplikasi web (Web app)</strong>.</li>
              <li>Isi deskripsi (misalnya: <em>"Buku Kas PWA Sync"</em>).</li>
              <li>Atur <strong>Jalankan sebagai (Execute as)</strong> ke: <strong>Saya (Your account)</strong>. <span className="text-amber-700 font-medium">(PENTING: Jangan pilih "User accessing the web app", karena sistem tidak akan bisa masuk!)</span></li>
              <li>Atur <strong>Siapa yang memiliki akses (Who has access)</strong> ke: <strong>Siapa saja (Anyone)</strong>. <span className="text-amber-700 font-medium">(PENTING: Jangan pilih "Only myself" atau "Anyone with Google account"!)</span></li>
              <li>Klik <strong>Terapkan (Deploy)</strong>.</li>
              <li>Bila diminta, klik <strong>Berikan izin akses (Authorize access)</strong> dan setujui izinnya. (Klik "Advanced" &gt; "Go to Untitled project (unsafe)" jika muncul peringatan dari Google).</li>
              <li>Salin <strong>URL Aplikasi Web (Web app URL)</strong> yang diberikan di layar akhir.</li>
            </ol>

            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100 space-y-2">
              <div className="flex gap-2.5 items-start">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-800 leading-relaxed">
                  <strong className="block font-bold text-rose-900 mb-1">🚨 Masih Mengalami Error "Halaman HTML/Login"?</strong>
                  Jika Anda mendapatkan pesan error bahwa Apps Script mengembalikan halaman Login/HTML, hal ini terjadi karena Google meminta login Google Account sebelum mengakses link Anda. Solusi mengatasinya:
                </div>
              </div>
              <ul className="list-disc list-inside text-[11px] text-rose-700 space-y-1.5 pl-6">
                <li>
                  <strong>Apakah Anda menggunakan akun kantor/sekolah (Google Workspace)?</strong> Beberapa akun organisasi melarang opsi akses "Anyone" (Siapa saja secara anonim). Solusi terbaik adalah membuat Spreadsheet menggunakan <strong>akun Gmail pribadi (@gmail.com)</strong>.
                </li>
                <li>
                  <strong>Pastikan "Execute as" diatur ke "Me" (Saya):</strong> Jika diatur ke "User accessing", Google akan memaksa browser untuk login sebelum data bisa diambil.
                </li>
                <li>
                  <strong>Setiap ada perubahan kode, lakukan "New Version":</strong> Jika Anda mengedit kode di Apps Script, perubahan tidak langsung aktif. Anda harus mengklik <strong>Deploy &gt; Manage Deployments</strong>, klik ikon pensil (edit), pilih <strong>"New Version" (Versi Baru)</strong> dari dropdown Versi, lalu klik <strong>Deploy</strong> kembali.
                </li>
                <li>
                  <strong>Pastikan link berakhiran /exec:</strong> Jangan gunakan link editor script atau link berakhiran <code>/dev</code>. Link yang benar harus berakhiran <code>/exec</code>.
                </li>
              </ul>
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex gap-2.5 items-start">
              <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 leading-relaxed">
                <strong className="block font-semibold">PENTING:</strong>
                Tempelkan URL Web App yang telah disalin ke dalam menu <strong>Pengaturan</strong> di dalam aplikasi ini untuk mengaktifkan sinkronisasi otomatis dan pencadangan Google Sheets.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
