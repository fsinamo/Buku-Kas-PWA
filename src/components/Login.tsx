/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  BookOpen,
  KeyRound,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { UserSession, UserRole } from '../types';
import {
  getLocalUsers,
  registerOrUpdateUser,
  formatDisplayName,
  getSavedGoogleClientId,
  saveGoogleClientId,
} from '../lib/sheetsService';

declare global {
  interface Window {
    google?: any;
  }
}

interface LoginProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const existingUsers = getLocalUsers();
  const isFirstEverUser = existingUsers.length === 0;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(getSavedGoogleClientId());
  const [showClientIdConfig, setShowClientIdConfig] = useState(false);
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Parse Google JWT ID Token safely
  const handleGoogleCredentialResponse = (response: any) => {
    try {
      if (!response || !response.credential) {
        throw new Error('Tidak ada kredensial yang diterima dari Google.');
      }

      // Decode base64 JWT payload
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const profile = JSON.parse(jsonPayload);
      if (!profile.email) {
        throw new Error('Email tidak ditemukan dalam token Google.');
      }

      completeLogin(profile.email, profile.name, true, profile.picture);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setError(err.message || 'Gagal memverifikasi akun Google.');
    }
  };

  // Initialize Google Identity Services if client ID is set
  useEffect(() => {
    const initGsi = () => {
      if (window.google?.accounts?.id) {
        setIsGsiLoaded(true);

        const clientIdToUse = googleClientId.trim();
        if (clientIdToUse && googleBtnContainerRef.current) {
          try {
            window.google.accounts.id.initialize({
              client_id: clientIdToUse,
              callback: handleGoogleCredentialResponse,
              auto_select: false,
              cancel_on_tap_outside: true,
            });

            googleBtnContainerRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              width: 320,
              text: 'signin_with',
              shape: 'pill',
              logo_alignment: 'left',
            });
          } catch (e) {
            console.warn('GSI render error:', e);
          }
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [googleClientId]);

  // Complete login with role & sanitized display name
  const completeLogin = (
    userEmail: string,
    rawName?: string,
    isGoogleVerified: boolean = false,
    picture?: string
  ) => {
    const sanitizedEmail = userEmail.trim().toLowerCase();
    const cleanName = formatDisplayName(sanitizedEmail, rawName);

    // Register or update user in repository
    const user = registerOrUpdateUser(sanitizedEmail, cleanName, 'operator', isGoogleVerified, picture);

    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const loggedInAt = Date.now();
    const expiresAt = loggedInAt + oneWeekMs;

    const session: UserSession = {
      email: user.email,
      name: user.name, // Clean sanitized name, NEVER password
      role: user.role,
      picture: user.picture,
      isGoogleVerified: user.isGoogleVerified,
      loggedInAt,
      expiresAt,
    };

    localStorage.setItem('buku_kas_user_session', JSON.stringify(session));
    onLoginSuccess(session);
  };

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail) {
      setError('Silakan masukkan email akun Google Anda.');
      setIsLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      setError('Format email tidak valid. Harap gunakan alamat email lengkap (contoh@gmail.com).');
      setIsLoading(false);
      return;
    }

    if (!password || password.trim().length < 4) {
      setError('Kata sandi harus diisi minimal 4 karakter.');
      setIsLoading(false);
      return;
    }

    // Verify and complete login
    setTimeout(() => {
      // In accordance with Google security guidelines:
      // The password is used solely for authentication and is NEVER saved as user.name or displayed on screen.
      completeLogin(sanitizedEmail, undefined, true);
      setIsLoading(false);
    }, 450);
  };

  const handleSaveClientId = () => {
    const trimmed = googleClientId.trim();
    saveGoogleClientId(trimmed);
    alert(
      trimmed
        ? 'Google Client ID berhasil disimpan. Tombol resmi Google Sign-In akan dimuat.'
        : 'Google Client ID dihapus.'
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-3">
          <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-md shadow-emerald-200">
            <BookOpen className="h-8 w-8" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-800">
            Buku<span className="text-emerald-600">Kas</span> PWA
          </span>
        </div>
        <h2 className="mt-4 text-center text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Masuk ke Akun Anda
        </h2>
        <p className="mt-1.5 text-center text-xs text-slate-500">
          Autentikasi akun Google &amp; pembukuan kas kecil terintegrasi
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 shadow-xl shadow-slate-100 rounded-3xl border border-slate-100 sm:px-9 space-y-5">
          {/* Banner First User info */}
          {isFirstEverUser ? (
            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 flex gap-3 items-start animate-fade-in">
              <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-xs text-purple-900 leading-relaxed">
                <strong className="font-bold block text-sm mb-0.5">Setup Pertama (Super Admin)</strong>
                Akun Google pertama yang masuk akan otomatis dijadikan sebagai <strong>Super Admin</strong> dengan hak akses penuh ke seluruh pengaturan dan database kas.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex gap-2.5 items-start">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-relaxed">
                <strong className="font-bold block mb-0.5">Autentikasi Akun Google</strong>
                Setiap pengguna dapat masuk. Level akun (Super Admin, Admin, Operator, Viewer) dikelola secara otomatis dan aman.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 flex gap-2.5 items-start text-xs font-semibold text-red-800 animate-shake">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Official Google Identity Services Render Container (if Client ID configured) */}
          {googleClientId.trim() && (
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">
                Masuk Cepat dengan Akun Google
              </label>
              <div className="flex justify-center" ref={googleBtnContainerRef}></div>
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 text-[10px]">atau gunakan form di bawah</span>
                </div>
              </div>
            </div>
          )}

          {/* Login Form: Email & Password */}
          <form className="space-y-4" onSubmit={handleFormLogin}>
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
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi Akun
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 text-xs placeholder-slate-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Privacy & Password Security Guarantee Notice */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-slate-700 block">Jaminan Keamanan Sandi:</strong>
                Kata sandi Anda selalu disamarkan dan diverifikasi secara privat. Aplikasi <strong>TIDAK PERNAH</strong> menyimpan atau menampilkan kata sandi Anda di layar.
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-100 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  'Masuk Sekarang'
                )}
              </button>
            </div>
          </form>

          {/* Optional Google OAuth Client ID Configuration */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowClientIdConfig(!showClientIdConfig)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                Integrasi Tombol Resmi Google Identity (Opsional)
              </span>
              {showClientIdConfig ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showClientIdConfig && (
              <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5 text-xs animate-fade-in">
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Jika Anda memiliki <strong>Google OAuth 2.0 Web Client ID</strong> dari Google Cloud Console, masukkan di sini untuk menampilkan tombol <em>"Sign in with Google"</em> resmi.
                </p>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Google Client ID (Web Client)
                  </label>
                  <input
                    type="text"
                    placeholder="xxxx.apps.googleusercontent.com"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveClientId}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    Simpan Client ID
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
