import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';

import { layoutMetadata } from '@/constants/metadata';

import { Navbar, NavbarFallback } from '@/components/navigation/navbar';
import { ThemeProvider } from '@/components/theme/provider';
import { Toaster } from '@/components/theme/toaster';

import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = layoutMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className={`${geistSans.variable} ${geistMono.variable} h-full font-sans antialiased`} suppressHydrationWarning>
      <body className='bg-background text-foreground flex min-h-full flex-col'>
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
          <Suspense fallback={<NavbarFallback />}>
            <Navbar />
          </Suspense>
          <main className='flex flex-1 flex-col'>{children}</main>
          <Toaster position='top-center' />
        </ThemeProvider>
      </body>
    </html>
  );
}
