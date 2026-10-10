import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

const googleAnalyticsId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
  'G-NVG3T24XBX';

export const metadata: Metadata = {
  metadataBase: new URL('https://nowmywork.com'),
  title: { default: 'NowMyWork — Work should find you.', template: '%s — NowMyWork' },
  description: 'A freelance marketplace that matches clients with the right freelancers instead of endless bidding.',
  icons: {
    icon: 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png',
    shortcut: 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png',
    apple: 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png',
  },
  openGraph: { title: 'NowMyWork — Work should find you.', description: 'Post the work. We find the people.', type: 'website', url: 'https://nowmywork.com', images: ['https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png'] },
  twitter: { card: 'summary', title: 'NowMyWork — Work should find you.', description: 'A freelance marketplace built around private matching.' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Script
        id="google-analytics-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${googleAnalyticsId}');
        `}
      </Script>
    </html>
  );
}
