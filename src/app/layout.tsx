import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusPass | Smart Attendance',
  description: 'A smart campus attendance dashboard with face, card, and manual entry workflows.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
