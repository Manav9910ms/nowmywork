import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NowMyWork — Work finds you.',
  description: 'A faster freelance marketplace that matches clients with the right freelancers instead of endless bidding.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
