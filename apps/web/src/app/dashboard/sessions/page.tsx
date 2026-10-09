'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, Users, Clock, Award, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function SessionsListPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/sessions')
      .then((data) => setSessions(data || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Test sessiyalari va natijalar
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Guruhlarda o‘tkazilgan barcha jonli testlar, ishtirokchilar reytingi va hisobotlar
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Yuklanmoqda...</div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <Target className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Hali sessiyalar mavjud emas</h3>
          <p className="mt-1 text-sm text-gray-500">
            Telegram bot orqali guruhda testni boshlang va bu yerda natijalarni kuzatib boring.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      s.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                        : s.status === 'ACTIVE'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {s.status === 'COMPLETED' ? 'Yakunlangan' : s.status === 'ACTIVE' ? 'Jarayonda' : 'Kutilmoqda'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(s.createdAt).toLocaleDateString('uz-UZ')}
                  </span>
                </div>

                <h3 className="mt-3 text-base font-bold text-gray-900 dark:text-white line-clamp-2">
                  {s.quizVersion?.title || 'Test'}
                </h3>

                <div className="mt-4 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {s._count?.participants || 0} nafar qatnashchi
                  </span>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800 flex items-center justify-between">
                <a
                  href={`/api/export/session/${s.id}/excel`}
                  download
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Excel hisobot</span>
                </a>

                <Link
                  href={`/dashboard/sessions/${s.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <span>Natijalar</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
