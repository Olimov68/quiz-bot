'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Award, FileSpreadsheet, Users, Clock, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

export default function SessionDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      apiRequest(`/sessions/${id}/leaderboard`)
        .then((res) => setData(res))
        .catch((e) => console.error(e))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-gray-500">Yuklanmoqda...</div>;
  }

  if (!data) {
    return <div className="p-12 text-center text-sm text-red-500">Sessiya topilmadi</div>;
  }

  const session = data.session;
  const leaderboard = data.leaderboard || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/sessions"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            {session.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Jami {session.totalQuestions} ta savol • {session.participantsCount} nafar ishtirokchi
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-gray-900 dark:text-white">Yetakchilar reytingi (Leaderboard)</span>
        </div>

        <a
          href={`/api/export/session/${id}/excel`}
          download
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Excel (.xlsx) hisobotni yuklab olish</span>
        </a>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {leaderboard.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            Hozircha ishtirokchilar javob bermadi.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-3">O‘rin</th>
                <th className="px-6 py-3">Ishtirokchi</th>
                <th className="px-6 py-3">Ball</th>
                <th className="px-6 py-3">Foiz</th>
                <th className="px-6 py-3">Sarflangan vaqt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {leaderboard.map((entry: any) => {
                const medals = ['🥇', '🥈', '🥉'];
                const medal = entry.rank <= 3 ? medals[entry.rank - 1] : null;

                return (
                  <tr key={entry.userId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 font-bold">
                      {medal ? <span className="text-lg">{medal}</span> : <span>#{entry.rank}</span>}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {entry.displayName}
                      {entry.username && (
                        <span className="ml-2 text-xs font-normal text-gray-400">@{entry.username}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400">
                      {entry.score} / {entry.totalQuestions}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${Math.min(100, entry.percentage)}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {entry.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {(entry.totalTimeMs / 1000).toFixed(1)} soniya
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
