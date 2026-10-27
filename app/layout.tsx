import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TriCert Lab | Learn through delivery',
  description:
    'A 13-week, project-based PMP, PL-300, CISSP, and ITIL Foundation study and portfolio workspace.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'TriCert Lab | Learn through delivery',
    description: 'Plan the work. Measure the value. Secure and operate the service.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'TriCert Lab learning workspace' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TriCert Lab | Learn through delivery',
    description: 'Plan the work. Measure the value. Secure and operate the service.',
    images: ['/og.png'],
  },
};

/* Night is the default; "system" (saved from version 7 on) leaves the choice
   to the device. Matches savedTheme() in tricert-app.tsx. */
const themeScript = `try{var p=JSON.parse(localStorage.getItem('tricert.ui.v3')||'{}');var r=document.documentElement;var t=p.theme==='light'?'light':p.theme==='system'&&p.v===7?'system':'dark';if(t!=='system')r.dataset.theme=t;r.dataset.accent=['beacon','rose','canola','glacier'].indexOf(p.accent)>-1?p.accent:'beacon';}catch(e){document.documentElement.dataset.theme='dark';}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          href="/fonts/geist-latin-wght-normal.woff2"
        />
        {/* Apply the learner's colour and appearance before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
