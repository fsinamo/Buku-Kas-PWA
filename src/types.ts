/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  tanggal: string; // Format: YYYY-MM-DD
  kategori: string;
  keterangan: string;
  debet: number;   // Penerimaan
  kredit: number;  // Pengeluaran
  saldo: number;   // Calculated dynamically or cached
  status: 'synced' | 'pending_add' | 'pending_edit' | 'pending_delete';
  updatedAt: number; // Timestamp
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense'; // 'income' corresponding to debet, 'expense' to kredit
  status: 'synced' | 'pending_add' | 'pending_delete';
}

export type UserRole = 'super_admin' | 'admin' | 'operator' | 'viewer';

export interface AppUser {
  email: string;
  name: string;
  role: UserRole;
  picture?: string;
  isGoogleVerified?: boolean;
  createdAt: number;
  lastLogin: number;
  isInitialSuperAdmin?: boolean;
}

export interface UserSession {
  email: string;
  name: string;
  role: UserRole;
  picture?: string;
  isGoogleVerified?: boolean;
  loggedInAt: number;
  expiresAt: number;
}

export interface SyncStatus {
  lastSyncTime: number | null;
  isSyncing: boolean;
  error: string | null;
}

export interface SheetDataPayload {
  transactions: Transaction[];
  categories: Category[];
  users?: AppUser[];
}
