'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  BookOpen,
  FileUp,
  FolderKanban,
  Target,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Boshqaruv paneli', icon: LayoutDashboard },
    { href: '/dashboard/quizzes/new', label: 'Yangi test yaratish', icon: PlusCircle },
    { href: '/dashboard/quizzes', label: 'Testlarim', icon: BookOpen },
    { href: '/dashboard/import', label: 'Word (.docx) import', icon: FileUp },
    { href: '/dashboard/questions', label: 'Savollar banki', icon: FolderKanban },
    { href: '/dashboard/sessions', label: 'Test sessiyalari', icon: Target },
    { href: '/student', label: 'O‘quvchi statistikasi', icon: UserCheck },
    { href: '/admin', label: 'Super Admin', icon: ShieldAlert },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
