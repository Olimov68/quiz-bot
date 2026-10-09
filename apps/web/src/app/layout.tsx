import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Smart Quiz Platform — Professional Telegram Test Tizimi',
  description:
    'Word (.docx) hujjatlaridan testlarni avtomatik yuklash, matematik va kimyoviy formulalar, guruhlarda jonli Telegram Quiz Poll va professional Excel hisobotlar.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
