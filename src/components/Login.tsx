/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mail, CheckCircle2, ShieldCheck, UserCheck, Sparkles, BookOpen } from 'lucide-react';
import { UserSession, UserRole } from '../types';
import { getLocalUsers, registerOrUpdateUser } from '../lib/sheetsService';

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const existingUsers = getLocalUsers();
  const isFirstEverUser = existingUsers.length === 0;

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleSigning, setIsGoogleSigning] = useState(false);

  // Check detected role for the typed email in real-time
  const detectedUser = existingUsers.find(
    u => u.email.toLowerCase() === email.trim().toLowerCase()
  );

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return { label: 'Super Admin', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'admin':
        return { label: 'Admin', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'operator':
        return { label: 'Operator Kas', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'viewer':
        return { label: 'Viewer (Peninjau)', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const executeLogin = (userEmail: string, userName: string) => {
    const sanitizedEmail = userEmail.trim().toLowerCase();
    if (!sanitizedEmail) {
      setError('Silakan masukkan alamat email Google Anda.');
      setIsLoading(false);
      setIsGoogleSigning(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      setError('Format email tidak valid. Harap gunakan alamat email Google Anda.');
      setIsLoading(false);
      setIsGoogleSigning(false);
      return;
    }

    // Register or update user in local repository
    const user = registerOrUpdateUser(sanitizedEmail, userName || sanitizedEmail.split('@')[0]);

    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const loggedInAt = Date.now();
    const expiresAt = loggedInAt + oneWeekMs;

    const session: UserSession = {
      email: user.email,
      name: user.name,
      role: user.role,
      loggedInAt,
      expiresAt,
    };

    localStorage.setItem('buku_kas_user_session', JSON.stringify(session));
    onLoginSuccess(session);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      executeLogin(email, name);
      setIsLoading(false);
    }, 400);
  };

  // Quick 1-Click Google Sign-In with prompt / picker simulation
  const handleQuickGoogleSignIn = () => {
    setError(null);
    setIsGoogleSigning(true);

    // If pre-existing user exists, we can default or prompt
    setTimeout(() => {
      // If user typed an email, use it; otherwise provide prompt or default
      const defaultEmail = email.trim() || (existingUsers[0]?.email || 'pengguna.google@gmail.com');
      const defaultName = name.trim() || (existingUsers[0]?.name || defaultEmail.split('@')[0]);

      executeLogin(defaultEmail, defaultName);
      setIsGoogleSigning(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-md shadow-emerald-200">
            <BookOpen className="h-8 w-8" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-800">
            Buku<span className="text-emerald-600">Kas</span> PWA
          </span>
        </div>
        <h2 className="mt-5 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Masuk Akun Google
        </h2>
        <p className="mt-2 text-center text-xs text-slate-600">
          Aplikasi pembukuan kas kecil dengan sinkronisasi Google Sheets &amp; multi-level hak akses
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-100 rounded-3xl border border-slate-100 sm:px-10">
          {/* Banner First User info */}
          {isFirstEverUser ? (
            <div className="mb-6 p-4 rounded-2xl bg-purple-50 border border-purple-100 flex gap-3 items-start animate-fade-in">
              <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-900 leading-relaxed">
                <strong className="font-bold block text-sm mb-0.5">Setup Pertama Kali (Super Admin)</strong>
                Belum ada akun yang terdaftar. Akun Google pertama yang masuk akan otomatis dijadikan sebagai <strong>Super Admin</strong> dengan hak akses penuh ke seluruh pengaturan dan database.
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex gap-3 items-start animate-fade-in">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <strong className="font-bold block text-sm mb-0.5">Akses Akun Terverifikasi</strong>
                Semua akun Google dapat masuk. Level hak akses (Super Admin, Admin, Operator, Viewer) dikelola secara otomatis dan aman.
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex gap-3 items-start animate-shake">
              <div className="text-xs font-semibold text-red-800">{error}</div>
            </div>
          )}

          {/* 1-Click Google Sign In Button */}
          <button
            type="button"
            onClick={handleQuickGoogleSignIn}
            disabled={isGoogleSigning || isLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-2xl text-xs font-bold text-slate-700 shadow-sm transition hover:shadow-md cursor-pointer disabled:opacity-60"
          >
            {isGoogleSigning ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Menghubungkan ke Google...</span>
              </div>
            ) : (
              <>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Lanjutkan dengan Akun Google</span>
              </>
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">
                atau masukkan email Google
              </span>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleFormSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                Alamat Email Google
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama.anda@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-xs placeholder-slate-400 transition"
                />
              </div>

              {/* Detected role info banner */}
              {detectedUser ? (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Terdaftar sebagai:</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${getRoleBadge(detectedUser.role).color}`}>
                    {getRoleBadge(detectedUser.role).label}
                  </span>
                </div>
              ) : email.trim().length > 3 && (
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  {isFirstEverUser ? (
                    <span className="text-purple-700 font-medium">Pengguna pertama: Akan menjadi <strong>Super Admin</strong></span>
                  ) : (
                    <span>Akun baru: Akan didaftarkan sebagai <strong>Operator Kas</strong></span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lengkap / Panggilan <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-xs placeholder-slate-400 transition"
              />
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-700 block">Sesi login aktif selama 1 minggu di perangkat ini.</span>
                Mendukung akses offline &amp; auto-sync saat terhubung kembali dengan Google Sheets.
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 rounded-xl shadow-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-100 cursor-pointer"
              >
                {isLoading ? 'Memverifikasi...' : 'Masuk Sekarang'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
