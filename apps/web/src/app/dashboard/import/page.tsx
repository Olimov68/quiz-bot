'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileUp,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Calculator,
  Save,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { MathView } from '@/components/MathView';
import { apiRequest } from '@/lib/api';

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseResult, setParseResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setQuizTitle(selected.name.replace(/\.docx$/i, ''));
      setErrorMsg(null);
    }
  };

  const handleUploadAndParse = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiRequest('/import/docx', {
        method: 'POST',
        body: formData,
      });

      if (!res.success && res.globalIssues?.length > 0) {
        setErrorMsg(res.globalIssues[0].message);
      } else {
        setParseResult(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Faylni yuklashda xatolik yuz berdi');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!parseResult || !parseResult.questions) return;

    setIsSaving(true);
    try {
      await apiRequest('/import/save-quiz', {
        method: 'POST',
        body: JSON.stringify({
          title: quizTitle || 'Yangi import qilingan test',
          questions: parseResult.questions,
        }),
      });

      router.push('/dashboard/quizzes');
    } catch (err: any) {
      setErrorMsg(err.message || 'Testni saqlashda xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Word (.docx) testlarini import qilish
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Word hujjatingizdan savollar, formulalar va rasmlarni avtomatik tarzda platformaga yuklang.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
        <FileUp className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-400" />
        <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">Word (.docx) faylini tanlang</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Maksimal hajm: 20 MB</p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <input
            type="file"
            accept=".docx"
            id="docx-file-input"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="docx-file-input"
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            {file ? file.name : 'Faylni tanlash'}
          </label>

          {file && (
            <button
              onClick={handleUploadAndParse}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Tahlil qilinmoqda...</span>
                </>
              ) : (
                <span>Tahlil qilish</span>
              )}
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mx-auto mt-4 max-w-lg rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
            ⚠️ {errorMsg}
          </div>
        )}
      </div>

      {/* Parse Result Summary */}
      {parseResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
              <span className="text-xs font-medium text-gray-500">Jami savollar</span>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {parseResult.totalQuestions}
              </div>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center dark:border-green-900/50 dark:bg-green-950/30">
              <span className="text-xs font-medium text-green-700 dark:text-green-300">To‘g‘ri savollar</span>
              <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <span>{parseResult.validQuestions}</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-900/50 dark:bg-amber-950/30">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Tekshirish kerak</span>
              <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
                <span>{parseResult.invalidQuestions}</span>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Formulalar</span>
              <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                <Calculator className="h-5 w-5" />
                <span>{parseResult.formulasCount}</span>
              </div>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center dark:border-purple-900/50 dark:bg-purple-950/30">
              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Rasmlar</span>
              <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold text-purple-700 dark:text-purple-300">
                <ImageIcon className="h-5 w-5" />
                <span>{parseResult.imagesCount}</span>
              </div>
            </div>
          </div>

          {/* Test Title & Save Action */}
          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 max-w-lg">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                Test sarlavhasi:
              </label>
              <input
                type="text"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            <button
              onClick={handleSaveQuiz}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Testni saqlash va nashr qilish</span>
            </button>
          </div>

          {/* Questions Preview List */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Savollar ro‘yxati (Ko‘rib chiqish)</h3>

            {parseResult.questions.map((q: any) => {
              const hasErrors = q.issues?.some((i: any) => i.severity === 'ERROR');
              const hasWarnings = q.issues?.some((i: any) => i.severity === 'WARNING');

              return (
                <div
                  key={q.index}
                  className={`rounded-xl border p-5 shadow-sm transition-colors ${
                    hasErrors
                      ? 'border-red-300 bg-red-50/20 dark:border-red-900/60 dark:bg-red-950/20'
                      : hasWarnings
                      ? 'border-amber-300 bg-amber-50/20 dark:border-amber-900/60 dark:bg-amber-950/20'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        #{q.index}
                      </span>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        <MathView content={q.text} />
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {q.hasMath && (
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          Matematika
                        </span>
                      )}
                      {q.hasChemistry && (
                        <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                          Kimyo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((opt: any) => (
                      <div
                        key={opt.index}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                          opt.isCorrect
                            ? 'border-green-300 bg-green-50 text-green-900 font-medium dark:border-green-800 dark:bg-green-950/50 dark:text-green-200'
                            : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{opt.letter})</span>
                          <MathView content={opt.text} />
                        </div>
                        {opt.isCorrect && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Issues */}
                  {q.issues && q.issues.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {q.issues.map((iss: any, idx: number) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-1.5 text-xs ${
                            iss.severity === 'ERROR'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{iss.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
