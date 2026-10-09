'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Moon, Sun, User, Bot } from 'lucide-react';
import { initTelegramAuth } from '@/lib/api';

export const Navbar: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    initTelegramAuth().then((user) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Smart Quiz</span>
            <span className="ml-1 text-xs font-semibold text-blue-600 dark:text-blue-400">PRO</span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 sm:block"
          >
            O‘qituvchi paneli
          </Link>
          <Link
            href="/student"
            className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 sm:block"
          >
            O‘quvchi profili
          </Link>

          <button
            onClick={toggleDarkMode}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Rang sxemasini almashtirish"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
              {currentUser?.firstName || 'O‘qituvchi'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
