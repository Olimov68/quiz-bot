'use client';

import React, { useEffect, useState } from 'react';
import { FolderKanban, Plus, Search, Trash2, Tag } from 'lucide-react';
import { MathView } from '@/components/MathView';
import { apiRequest } from '@/lib/api';

export default function QuestionsBankPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchQuestions = async () => {
    try {
      const data = await apiRequest(`/question-bank${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setQuestions(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Savollar banki
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Qayta ishlatiladigan savollar kolleksiyasi, mavzular va qiyinlik darajalari bo‘yicha
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Savol matni bo‘yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Yuklanmoqda...</div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900">
          <FolderKanban className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Savollar banki bo‘sh</h3>
          <p className="mt-1 text-sm text-gray-500">Test yaratishda savollarni bankka saqlashingiz mumkin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between">
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {q.subject || 'Umumiy'}
                </span>
                <span className="text-xs text-gray-400">{q.difficulty}</span>
              </div>
              <div className="mt-3 text-base font-medium text-gray-900 dark:text-white">
                <MathView content={q.text} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
