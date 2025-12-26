import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'leaflet/dist/leaflet.css';

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  display: 'swap', // Faster font loading
  preload: true,
});

export const metadata: Metadata = {
  title: 'Delever Food Map — Карта ресторанов',
  description: 'Найдите лучшие рестораны, кафе и заведения в вашем городе. Рейтинги, отзывы, меню и доставка через Delever.',
  keywords: 'рестораны, кафе, доставка еды, Delever, Ташкент, еда, меню',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/delever-icon.svg',
  },
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
      <head>
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}

