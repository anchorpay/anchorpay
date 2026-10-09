import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AnchorPay — Pay Your Bills with USDC',
  description:
    'Pay Nigerian airtime, data, electricity, and cable TV bills with USDC on Stellar. Fast. Cheap. No banks needed.',
  keywords: ['Stellar', 'USDC', 'Nigeria', 'airtime', 'electricity', 'VTPass', 'Soroban'],
  openGraph: {
    title: 'AnchorPay',
    description: 'Pay your Nigerian bills with USDC on Stellar',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
