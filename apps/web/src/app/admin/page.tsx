'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Users, BookOpen, Target, Activity, Lock, Unlock, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
      const [sData, uData] = await Promise.all([
        apiRequest('/admin/stats').catch((e) => {
          setErrorMsg(e.message);
          return null;
        }),
        apiRequest('/admin/users').catch(() => ({ users: [] })),
      ]);

      setStats(sData);
      setUsers(uData?.users || []);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleUser = async (userId: string, currentStatus: boolean) => {
    try {
      await apiRequest(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      await loadAdminData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Super Administrator paneli
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Tizim sog‘lig‘i, platforma statistikasi va foydalanuvchilar boshqaruvi
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Yuklanmoqda...</div>
      ) : stats ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="text-xs font-medium text-gray-500">Jami foydalanuvchilar</span>
              <div className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">
                {stats.totalUsers}
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">O‘qituvchilar</span>
              <div className="mt-2 text-3xl font-extrabold text-blue-700 dark:text-blue-300">
                {stats.totalTeachers}
              </div>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm dark:border-green-900/50 dark:bg-green-950/30">
              <span className="text-xs font-medium text-green-700 dark:text-green-300">Jami testlar</span>
              <div className="mt-2 text-3xl font-extrabold text-green-700 dark:text-green-300">
                {stats.totalQuizzes}
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Faol sessiyalar</span>
              <div className="mt-2 text-3xl font-extrabold text-indigo-700 dark:text-indigo-300">
                {stats.activeSessions}
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Foydalanuvchilar ro‘yxati</h2>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-3">Telegram ID</th>
                  <th className="px-6 py-3">Foydalanuvchi</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Holat</th>
                  <th className="px-6 py-3">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-mono text-xs">{u.telegramId}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {u.firstName} {u.lastName || ''}
                      {u.username && <span className="ml-2 text-xs text-gray-400">@{u.username}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          u.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        }`}
                      >
                        {u.isActive ? 'Faol' : 'Bloklangan'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleUser(u.id, u.isActive)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      >
                        {u.isActive ? (
                          <>
                            <Lock className="h-3.5 w-3.5 text-red-500" />
                            <span>Bloklash</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5 text-green-500" />
                            <span>Faollashtirish</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
