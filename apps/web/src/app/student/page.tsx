'use client';

import React, { useEffect, useState } from 'react';
import { UserCheck, Award, CheckCircle2, XCircle, TrendingUp, BookOpen, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function StudentPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/student/stats')
      .then((data) => setStats(data))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          O‘quvchi profili va statistikasi
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Siz qatnashgan testlar, to‘plagan ballaringiz va shaxsiy rivojlanish ko‘rsatkichlaringiz
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Yuklanmoqda...</div>
      ) : (
        <>
          {/* Stats KPI */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <span className="text-xs font-medium text-gray-500">Ishlangan testlar</span>
              <div className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">
                {stats?.quizzesCount || 0}
              </div>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900/50 dark:bg-green-950/30">
              <span className="text-xs font-medium text-green-700 dark:text-green-300">To‘g‘ri javoblar</span>
              <div className="mt-2 text-3xl font-extrabold text-green-700 dark:text-green-300">
                {stats?.totalCorrect || 0}
              </div>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900/50 dark:bg-red-950/30">
              <span className="text-xs font-medium text-red-700 dark:text-red-300">Noto‘g‘ri javoblar</span>
              <div className="mt-2 text-3xl font-extrabold text-red-700 dark:text-red-300">
                {stats?.totalIncorrect || 0}
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-center dark:border-blue-900/50 dark:bg-blue-950/30">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">O‘rtacha natija</span>
              <div className="mt-2 text-3xl font-extrabold text-blue-700 dark:text-blue-300">
                {(stats?.averagePercentage || 0).toFixed(1)}%
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Eng yuqori natija</span>
              <div className="mt-2 text-3xl font-extrabold text-amber-700 dark:text-amber-300">
                {(stats?.bestScore || 0).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Recent Attempts */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Oxirgi ishlangan testlar</h2>
            </div>

            {(!stats?.recentAttempts || stats.recentAttempts.length === 0) ? (
              <div className="p-12 text-center text-sm text-gray-500">
                Siz hali hech qaysi testda qatnashmadingiz.
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {stats.recentAttempts.map((att: any) => (
                  <div key={att.id} className="flex items-center justify-between p-6">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                        {att.quizTitle}
                      </h3>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                        <span>Ball: {att.score}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(att.completedAt).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        {att.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
