import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: '__SHEETPANE_NAME__' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
