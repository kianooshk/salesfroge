import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Salesfroge',
  description: 'Salesfroge CRM',
  icons: { icon: '/logo.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/slds/styles/salesforce-lightning-design-system.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
