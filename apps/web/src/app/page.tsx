'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  FileText,
  FlaskConical,
  BarChart3,
  Users,
  Send,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // If opened inside Telegram WebApp, automatically redirect to Dashboard
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative px-4 pb-20 pt-16 sm:px-6 sm:pb-32 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
            <span>Yangi avlod ta’limiy test platformasi</span>
          </div>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Word fayllardan <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Telegram Quiz</span> gacha bir zumda
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            O‘qituvchilar va o‘quvchilar uchun to‘liq avtomatlashtirilgan tizim: Word (.docx) dan savollarni yuklang,
            matematik formulalar va kimyoviy tenglamalarni saqlang, guruhlarda jonli test o‘tkazing va professional Excel hisobotlarni yuklab oling.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-blue-500/35"
            >
              <span>Boshqaruv panelini ochish</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/dashboard/import"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Word fayl yuklash</span>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mx-auto mt-20 max-w-6xl grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Aqlli Word (.docx) Importer</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Oddiy matn, rasmlar, <code>1. A) B) *C)</code> formatlari va <code>Javob: C</code> kalitlarini avtomatik aniqlaydi. Xatoliklar hisobotini taqdim etadi.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <FlaskConical className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Matematika va Kimyo formulalari</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Word OMML formulalarini LaTeX ga o‘tkazish, KaTeX render qilish hamda organik va anorganik kimyoviy tenglamalarni (H₂SO₄, reaksiyalar) to‘liq qo‘llab-quvvatlaydi.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Send className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Haqiqiy Telegram Quiz Poll</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Soxta xabarlar emas, balki Telegram rasmiy Bot API <code>sendPoll</code> (quiz mode) orqali guruhlarda ketma-ket testlar va individual havolalar.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <BarChart3 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Excel Hisobotlar (.xlsx)</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              3 varaqli professional hisobot: Umumiy natijalar, Har bir savol bo‘yicha batafsil javoblar va Guruh statistikasi.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Ko‘p foydalanuvchili platforma</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Super Admin, O‘qituvchi va O‘quvchi rollari. Har bir o‘qituvchi faqat o‘z testlari va guruhlari ma’lumotlarini boshqaradi.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">Telegram Mini App</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Telegram ichida bir tugma orqali ochiladi. HMAC-SHA256 xavfsiz autentifikatsiya, qulay mobil interfeys.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
