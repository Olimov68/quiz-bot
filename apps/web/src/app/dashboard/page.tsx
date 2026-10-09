'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  HelpCircle,
  PlayCircle,
  Users,
  Plus,
  FileUp,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [qData, sData] = await Promise.all([
          apiRequest('/quizzes').catch(() => []),
          apiRequest('/sessions').catch(() => []),
        ]);
        setQuizzes(qData || []);
        setSessions(sData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalQuestions = quizzes.reduce((acc, q) => acc + (q.questionsCount || 0), 0);
  const totalParticipants = sessions.reduce((acc, s) => acc + (s._count?.participants || 0), 0);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Boshqaruv paneli
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Testlaringiz, sessiyalaringiz va o‘quvchilar natijalari monitoringi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/import"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <FileUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Word (.docx) yuklash</span>
          </Link>
          <Link
            href="/dashboard/quizzes/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Yangi test</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Jami testlar</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{quizzes.length}</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">ta yaratilgan</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Jami savollar</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <HelpCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{totalQuestions}</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">ta savol</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">O‘tkazilgan sessiyalar</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <PlayCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{sessions.length}</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">ta guruhda</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Jami qatnashchilar</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{totalParticipants}</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">nafar ishtirok</span>
          </div>
        </div>
      </div>

      {/* Recent Quizzes List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Oxirgi testlar</h2>
          <Link
            href="/dashboard/quizzes"
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <span>Barchasini ko‘rish</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Yuklanmoqda...</div>
        ) : quizzes.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-base font-medium text-gray-900 dark:text-white">Hozircha testlar mavjud emas</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Word (.docx) faylini yuklab bir necha soniyada yangi test yarating.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/dashboard/import"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <FileUp className="h-4 w-4" />
                <span>Word fayl yuklash</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {quizzes.slice(0, 5).map((q) => (
              <div key={q.id} className="flex items-center justify-between p-6">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">{q.title}</h3>
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>📚 Fan: {q.subject || 'Umumiy'}</span>
                    <span>📝 Savollar: {q.questionsCount} ta</span>
                    <span>🎯 Sessiyalar: {q.sessionsCount} ta</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(q.createdAt).toLocaleDateString('uz-UZ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/quizzes/${q.id}/edit`}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Tahrirlash
                  </Link>
                  <Link
                    href={`/dashboard/sessions`}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                  >
                    Natijalar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
