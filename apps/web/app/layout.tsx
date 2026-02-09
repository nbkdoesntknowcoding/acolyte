import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Acolyte AI — Medical Education Platform',
  description:
    'Bridge Layer AI platform for medical education. Socratic questioning, NMC compliance, CBME tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className={`${inter.className} bg-dark-bg text-white antialiased`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
