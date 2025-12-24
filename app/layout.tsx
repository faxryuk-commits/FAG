import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'Delever Food Map — Карта ресторанов',
  description: 'Найдите лучшие рестораны, кафе и заведения в вашем городе. Рейтинги, отзывы, меню и доставка через Delever.',
  keywords: 'рестораны, кафе, доставка еды, Delever, Ташкент, еда, меню',
  openGraph: {
    title: 'Delever Food Map',
    description: 'Карта ресторанов и заведений с доставкой',
    siteName: 'Delever Food Map',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

