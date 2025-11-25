import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { LiffProvider } from '@/components/LiffProvider';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={inter.className}>
      <head>
        <Script
          id="clarity-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "u78xp06n40");
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <LiffProvider initialize={true}>
          {children}
        </LiffProvider>
      </body>
    </html>
  );
}
