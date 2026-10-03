import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import ToastContainer from '@/components/Toast';
import Navbar from '@/components/Navbar';
import { JetBrains_Mono, Inter } from 'next/font/google';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata = {
  title: 'PRISON — Pull Request Isolation & Security Observation Network',
  description: 'Autonomous AI-powered supply chain attack detection. Detonate PRs in microVMs, trace with eBPF, remediate with ANAKIN AI.',
  keywords: 'DevSecOps, supply chain security, eBPF, microVM, CI/CD security, AI remediation',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Press+Start+2P&family=Silkscreen:wght@400;700&family=VT323&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      retroBg: '#06070a',
                      retroPanel: '#0d1017',
                      retroBorder: '#1c2433',
                      pixelCyan: '#00f0ff',
                      pixelGreen: '#00ff66',
                      pixelAmber: '#ffb000',
                      pixelRed: '#ff2a5f',
                      pixelMagenta: '#e024c3',
                      retroCard: '#0a0e1a',
                      neonGreen: '#10b981',
                      neonYellow: '#f59e0b',
                      silkIndigo: '#4f46e5',
                      silkIndigoLight: '#818cf8',
                      'prison-bg': '#050810',
                      'prison-panel': '#0c101d',
                      'prison-border': '#1a2238',
                      'prison-accent': '#6366f1',
                      'prison-muted': '#64748b',
                      'retro-bg': '#060814',
                      'retro-surface': '#0b0f1e',
                      'retro-surfaceHover': '#131930',
                      'retro-border': '#1a2236',
                      'retro-indigo': '#4f46e5',
                      'retro-indigoBright': '#818cf8',
                      'retro-indigoLight': '#a5b4fc',
                      'retro-emerald': '#10b981',
                      'retro-rose': '#e11d48',
                      'retro-amber': '#d97706',
                    },
                    fontFamily: {
                      arcade: ['"Press Start 2P"', 'monospace'],
                      pixel: ['"Silkscreen"', 'monospace'],
                      silk: ['"Silkscreen"', 'monospace'],
                      terminal: ['"VT323"', 'monospace'],
                      mono: ['"JetBrains Mono"', '"VT323"', 'monospace'],
                      code: ['"Courier Prime"', 'monospace'],
                    },
                    boxShadow: {
                      'pixel-cyan': '4px 4px 0px 0px #008b99',
                      'pixel-cyan-hover': '2px 2px 0px 0px #008b99',
                      'pixel-dark': '4px 4px 0px 0px #000000',
                      'pixel-red': '4px 4px 0px 0px #850024',
                      'pixel-card': '4px 4px 0px 0px #000000, -2px -2px 0px 0px #1c2738'
                    }
                  }
                }
              };
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-[#090D16] text-slate-100 antialiased`}>
        <ClerkProvider>
          <Navbar />
          {children}
          <ToastContainer />
        </ClerkProvider>
      </body>
    </html>
  );
}