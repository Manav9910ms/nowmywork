import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://nowmywork.com'),
  title: { default: 'NowMyWork — Work should find you.', template: '%s — NowMyWork' },
  description: 'A freelance marketplace that matches clients with the right freelancers instead of endless bidding.',
  icons: { icon: '/icon.png', shortcut: '/icon.png', apple: '/icon.png' },
  openGraph: { title: 'NowMyWork — Work should find you.', description: 'Post the work. We find the people.', type: 'website', url: 'https://nowmywork.com', images: ['/icon.png'] },
  twitter: { card: 'summary', title: 'NowMyWork — Work should find you.', description: 'A freelance marketplace built around private matching.' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
