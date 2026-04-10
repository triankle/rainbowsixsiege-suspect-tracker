import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Historique — R6 Suspect Check',
  description: 'Soumissions enregistrées en base',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
