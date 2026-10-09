'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, CheckCircle2, Save, ArrowLeft, Loader2, Calculator } from 'lucide-react';
import { MathView } from './MathView';
import { apiRequest } from '@/lib/api';

interface QuestionItem {
  text: string;
  explanation?: string;
  hasMath?: boolean;
  hasChemistry?: boolean;
  options: { text: string; isCorrect: boolean }[];
}

interface QuizEditorProps {
  initialData?: {
    id?: string;
    title: string;
    description?: string;
    subject?: string;
    settings?: any;
    questions?: any[];
  };
}

export const QuizEditor: React.FC<QuizEditorProps> = ({ initialData }) => {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [subject, setSubject] = useState(initialData?.subject || 'Umumiy');
  const [timer, setTimer] = useState<number>(initialData?.settings?.timeLimitPerQuestionSeconds ?? 30);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [questions, setQuestions] = useState<QuestionItem[]>(
    initialData?.questions?.length
      ? initialData.questions.map((q) => ({
          text: q.text,
          explanation: q.explanation || '',
          hasMath: q.hasMath,
          hasChemistry: q.hasChemistry,
          options: q.options?.map((opt: any) => ({
            text: opt.text,
            isCorrect: Boolean(opt.isCorrect),
          })) || [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
          ],
        }))
      : [
          {
            text: '',
            explanation: '',
            hasMath: false,
            hasChemistry: false,
            options: [
              { text: '', isCorrect: true },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
              { text: '', isCorrect: false },
            ],
          },
        ]
  );

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        text: '',
        explanation: '',
        hasMath: false,
        hasChemistry: false,
        options: [
          { text: '', isCorrect: true },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
          { text: '', isCorrect: false },
        ],
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionTextChange = (idx: number, val: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx].text = val;
      copy[idx].hasMath = val.includes('$') || val.includes('\\');
      return copy;
    });
  };

  const handleOptionTextChange = (qIdx: number, optIdx: number, val: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx].options[optIdx].text = val;
      return copy;
    });
  };

  const handleSetCorrectOption = (qIdx: number, optIdx: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx].options.forEach((opt, i) => {
        opt.isCorrect = i === optIdx;
      });
      return copy;
    });
  };

  const handleAddOption = (qIdx: number) => {
    if (questions[qIdx].options.length >= 10) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx].options.push({ text: '', isCorrect: false });
      return copy;
    });
  };

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    if (questions[qIdx].options.length <= 2) return;
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx].options = copy[qIdx].options.filter((_, i) => i !== optIdx);
      if (!copy[qIdx].options.some((o) => o.isCorrect) && copy[qIdx].options.length > 0) {
        copy[qIdx].options[0].isCorrect = true;
      }
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMsg('Test sarlavhasini kiriting');
      return;
    }

    if (questions.length === 0) {
      setErrorMsg('Kamida 1 ta savol kiritilishi shart');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) {
        setErrorMsg(`${i + 1}-savol matni bo‘sh`);
        return;
      }
      for (let j = 0; j < questions[i].options.length; j++) {
        if (!questions[i].options[j].text.trim()) {
          setErrorMsg(`${i + 1}-savolning ${String.fromCharCode(65 + j)} varianti matni bo‘sh`);
          return;
        }
      }
    }

    setIsSaving(true);
    setErrorMsg(null);

    const payload = {
      title,
      description,
      subject,
      settings: {
        timeLimitPerQuestionSeconds: timer,
        shuffleQuestions: true,
        shuffleOptions: true,
        showExplanation: true,
      },
      questions,
    };

    try {
      if (initialData?.id) {
        await apiRequest(`/quizzes/${initialData.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/quizzes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      router.push('/dashboard/quizzes');
    } catch (err: any) {
      setErrorMsg(err.message || 'Saqlashda xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Orqaga</span>
        </button>

        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Saqlash va nashr qilish</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Quiz Metadata Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">Asosiy ma’lumotlar</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Test mavzusi:</label>
            <input
              type="text"
              placeholder="Masalan: Organik kimyo — Alkenlar"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Fan:</label>
            <input
              type="text"
              placeholder="Masalan: Kimyo, Matematika, Fizika"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Tavsif (ixtiyoriy):</label>
          <textarea
            rows={2}
            placeholder="Test bo‘yicha qisqacha ma’lumot yoki ko‘rsatma..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Har bir savol uchun vaqt (soniya):</label>
          <select
            value={timer}
            onChange={(e) => setTimer(Number(e.target.value))}
            className="mt-1 rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value={0}>Cheklanmagan</option>
            <option value={10}>10 soniya</option>
            <option value={15}>15 soniya</option>
            <option value={20}>20 soniya</option>
            <option value={30}>30 soniya</option>
            <option value={45}>45 soniya</option>
            <option value={60}>60 soniya</option>
            <option value={90}>90 soniya</option>
            <option value={120}>120 soniya</option>
          </select>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Savollar ({questions.length} ta)
          </h2>
          <button
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <Plus className="h-4 w-4 text-blue-600" />
            <span>Savol qo‘shish</span>
          </button>
        </div>

        {questions.map((q, qIdx) => (
          <div
            key={qIdx}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                #{qIdx + 1}
              </span>
              <button
                onClick={() => handleRemoveQuestion(qIdx)}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>O‘chirish</span>
              </button>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Savol matni (Formula uchun $formula$ ishlatishingiz mumkin):
              </label>
              <textarea
                rows={2}
                value={q.text}
                onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                placeholder="Savol matnini kiriting..."
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              {q.text && (
                <div className="mt-2 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-gray-500">Ko‘rinishi: </span>
                  <MathView content={q.text} />
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500">Variantlar (to‘g‘risini belgilang):</label>
              {q.options.map((opt, optIdx) => (
                <div key={optIdx} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetCorrectOption(qIdx, optIdx)}
                    title={opt.isCorrect ? 'To‘g‘ri javob' : 'To‘g‘ri deb belgilash'}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                      opt.isCorrect
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 bg-gray-100 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {String.fromCharCode(65 + optIdx)}
                  </button>

                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionTextChange(qIdx, optIdx, e.target.value)}
                    placeholder={`${String.fromCharCode(65 + optIdx)} varianti`}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />

                  {q.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(qIdx, optIdx)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              {q.options.length < 10 && (
                <button
                  type="button"
                  onClick={() => handleAddOption(qIdx)}
                  className="mt-1 text-xs text-blue-600 hover:underline"
                >
                  + Variant qo‘shish
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="text-center">
          <button
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <Plus className="h-4 w-4" />
            <span>Yangi savol qo‘shish</span>
          </button>
        </div>
      </div>
    </div>
  );
};
