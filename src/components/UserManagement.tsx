/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Shield,
  ShieldAlert,
  UserPlus,
  Trash2,
  CheckCircle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { AppUser, UserRole, UserSession } from '../types';
import {
  getLocalUsers,
  registerOrUpdateUser,
  changeUserRole,
  deleteUser,
  formatDisplayName,
} from '../lib/sheetsService';

interface UserManagementProps {
  currentSession: UserSession;
  onUsersUpdated?: () => void;
  onRoleChangedForCurrentSession?: (newRole: UserRole) => void;
}

export default function UserManagement({
  currentSession,
  onUsersUpdated,
  onRoleChangedForCurrentSession,
}: UserManagementProps) {
  const [users, setUsers] = useState<AppUser[]>(getLocalUsers());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [notification, setNotification] = useState<string | null>(null);

  const isSuperAdmin = currentSession.role === 'super_admin';
  const isAdmin = currentSession.role === 'admin';
  const canManageRoles = isSuperAdmin;

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedEmail = newEmail.trim().toLowerCase();
    if (!sanitizedEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      alert('Format email tidak valid.');
      return;
    }

    const created = registerOrUpdateUser(sanitizedEmail, newName.trim(), newRole);
    setUsers(getLocalUsers());
    setShowAddModal(false);
    setNewEmail('');
    setNewName('');
    setNewRole('operator');
    showToast(`Pengguna ${created.email} berhasil ditambahkan dengan level ${getRoleLabel(created.role)}.`);

    if (onUsersUpdated) onUsersUpdated();
  };

  const handleChangeRole = (email: string, targetRole: UserRole) => {
    if (!isSuperAdmin) {
      alert('Hanya Super Admin yang berhak mengubah level akun pengguna.');
      return;
    }

    // If changing role of current user
    if (email.toLowerCase() === currentSession.email.toLowerCase() && targetRole !== 'super_admin') {
      const confirmSelf = confirm('Anda sedang menurunkan level akun Anda sendiri. Anda akan kehilangan hak akses konfigurasi Super Admin. Lanjutkan?');
      if (!confirmSelf) return;
    }

    const updated = changeUserRole(email, targetRole);
    setUsers(updated);

    if (email.toLowerCase() === currentSession.email.toLowerCase() && onRoleChangedForCurrentSession) {
      onRoleChangedForCurrentSession(targetRole);
    }

    showToast(`Level akun ${email} berhasil diubah menjadi ${getRoleLabel(targetRole)}.`);
    if (onUsersUpdated) onUsersUpdated();
  };

  const handleDeleteUser = (email: string) => {
    if (!isSuperAdmin) {
      alert('Hanya Super Admin yang dapat menghapus pengguna.');
      return;
    }

    if (email.toLowerCase() === currentSession.email.toLowerCase()) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      return;
    }

    if (!confirm(`Hapus akses untuk akun ${email}?`)) return;

    const updated = deleteUser(email);
    setUsers(updated);
    showToast(`Pengguna ${email} telah dihapus dari sistem.`);
    if (onUsersUpdated) onUsersUpdated();
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'operator':
        return 'Operator Kas';
      case 'viewer':
        return 'Viewer (Peninjau)';
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'operator':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'viewer':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          {notification}
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-50 p-2.5 rounded-xl text-purple-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Manajemen Pengguna &amp; Hak Akses</h3>
              <p className="text-xs text-slate-500">
                Kelola akun Google yang diizinkan mengakses pembukuan kas dan atur level perannya
              </p>
            </div>
          </div>

          {canManageRoles && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-emerald-50 transition cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="h-4 w-4" />
              Tambah Akun Pengguna
            </button>
          )}
        </div>

        {/* Roles Hierarchy Explanations */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-purple-900 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              Super Admin
            </div>
            <p className="text-[11px] text-purple-800 leading-relaxed">
              Akses penuh: Mengatur URL Apps Script, kelola database, atur level pengguna lain, dan semua transaksi.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-1">
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              Admin
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Pengelolaan keuangan: Tambah, edit, dan hapus transaksi, kelola kategori, serta ekspor laporan.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              Operator Kas
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Petugas pencatat: Mencatat penerimaan dan pengeluaran, edit transaksi miliknya, dan ekspor laporan.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
              <Info className="h-3.5 w-3.5 text-slate-500" />
              Viewer (Peninjau)
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Read-only: Hanya dapat melihat dashboard dan mencetak/mengekspor laporan tanpa izin edit.
            </p>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>Daftar Akun Terdaftar ({users.length})</span>
          {!isSuperAdmin && (
            <span className="text-[11px] text-slate-400 font-normal">
              Mode baca: Hanya Super Admin yang dapat mengubah role
            </span>
          )}
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <th className="pb-3 px-3">Pengguna</th>
                <th className="pb-3 px-3">Email Google</th>
                <th className="pb-3 px-3">Level Akun</th>
                <th className="pb-3 px-3">Terakhir Masuk</th>
                {canManageRoles && <th className="pb-3 px-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((user) => {
                const isCurrent = user.email.toLowerCase() === currentSession.email.toLowerCase();
                const safeName = formatDisplayName(user.email, user.name);
                const formattedDate = new Date(user.lastLogin).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={user.email} className={`hover:bg-slate-50/50 transition ${isCurrent ? 'bg-purple-50/30' : ''}`}>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 uppercase">
                          {safeName.charAt(0) || user.email.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {safeName}
                            {isCurrent && (
                              <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                Anda
                              </span>
                            )}
                          </div>
                          {user.isInitialSuperAdmin && (
                            <span className="text-[10px] text-purple-600 block">Pembuat Setup Pertama</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600">
                      {user.email}
                    </td>

                    <td className="py-3.5 px-3">
                      {canManageRoles ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.email, e.target.value as UserRole)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer ${getRoleBadgeStyle(user.role)}`}
                        >
                          <option value="super_admin">Super Admin</option>
                          <option value="admin">Admin</option>
                          <option value="operator">Operator Kas</option>
                          <option value="viewer">Viewer (Peninjau)</option>
                        </select>
                      ) : (
                        <span className={`inline-block px-2.5 py-1 rounded-lg border text-xs font-semibold ${getRoleBadgeStyle(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formattedDate}
                      </div>
                    </td>

                    {canManageRoles && (
                      <td className="py-3.5 px-3 text-right">
                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteUser(user.email)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-600" />
                Tambah Pengguna Baru
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Daftarkan email akun Google pengguna baru dan tentukan level hak aksesnya. Pengguna dapat langsung masuk menggunakan akun Google tersebut.
            </p>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Akun Google <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="pengguna@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap / Panggilan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Siti Rahma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Level Akun (Hak Akses)
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="operator">Operator Kas (Input &amp; Edit Transaksi)</option>
                  <option value="admin">Admin (Kelola Transaksi, Kategori, &amp; Ekspor)</option>
                  <option value="viewer">Viewer (Hanya Melihat &amp; Ekspor)</option>
                  <option value="super_admin">Super Admin (Akses Penuh Konfigurasi &amp; Database)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-50"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
