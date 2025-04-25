import { Inter } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/Footer';
import { ClientLiffProvider } from '@/components/ClientLiffProvider';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={inter.className}>
      <body suppressHydrationWarning>
        <ClientLiffProvider initialize={true}>
          <div className="flex flex-col min-h-screen">
            <main className="flex-1 pb-20">{children}</main>
            <Footer />
          </div>
        </ClientLiffProvider>
      </body>
    </html>
  );
}
