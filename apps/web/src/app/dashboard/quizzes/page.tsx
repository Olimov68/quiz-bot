'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  Copy,
  Trash2,
  Edit,
  Play,
  Clock,
  Send,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQuizzes = async () => {
    try {
      const data = await apiRequest(`/quizzes${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setQuizzes(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, [search]);

  const handleDuplicate = async (id: string) => {
    setActionLoading(`dup_${id}`);
    try {
      await apiRequest(`/quizzes/${id}/duplicate`, { method: 'POST' });
      await fetchQuizzes();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Haqiqatan ham ushbu testni o‘chirmoqchimisiz?')) return;
    setActionLoading(`del_${id}`);
    try {
      await apiRequest(`/quizzes/${id}`, { method: 'DELETE' });
      await fetchQuizzes();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Testlarim
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Yaratilgan barcha testlar, ularning versiyalari va boshqaruv vositalari
          </p>
        </div>

        <Link
          href="/dashboard/quizzes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          <span>Yangi test yaratish</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Test nomi yoki fan bo‘yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {/* Quizzes Grid */}
      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Yuklanmoqda...</div>
      ) : quizzes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Hech qanday test topilmadi</h3>
          <p className="mt-1 text-sm text-gray-500">Yangi test yarating yoki Word fayldan import qiling.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => (
            <div
              key={q.id}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {q.subject || 'Umumiy'}
                  </span>
                  <span className="text-xs text-gray-400">v{q.currentVersion}</span>
                </div>

                <h3 className="mt-3 text-base font-bold text-gray-900 dark:text-white line-clamp-2">
                  {q.title}
                </h3>
                {q.description && (
                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{q.description}</p>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>📝 {q.questionsCount} ta savol</span>
                  <span>🎯 {q.sessionsCount} ta sessiya</span>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicate(q.id)}
                      disabled={actionLoading === `dup_${q.id}`}
                      title="Nusxa olish"
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={actionLoading === `del_${q.id}`}
                      title="O‘chirish"
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <Link
                    href={`/dashboard/quizzes/${q.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Tahrirlash</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
