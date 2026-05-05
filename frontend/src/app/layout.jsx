import './globals.css';
import CursorGlow from "../components/CursorGlow";
import ParticlesBackground from "../components/ParticlesBackground";

export const metadata = {
  title: 'Neon App',
  description: 'Black & Electric Blue Tron-style UI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#040509] text-slate-100 antialiased">
        {/* Background visual layers */}
        <div className="fixed inset-0 -z-30 bg-[radial-gradient(1200px_600px_at_80%_-10%,rgba(14,165,233,0.08),transparent),radial-gradient(1200px_600px_at_0%_110%,rgba(59,130,246,0.08),transparent)]" />
        <div className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(transparent,rgba(59,130,246,0.04)_1px),linear-gradient(90deg,transparent,rgba(59,130,246,0.04)_1px)] bg-[size:100%_48px,48px_100%]" />

        {/* Client visual effects - mounted once globally */}
        <CursorGlow className="pointer-events-none fixed inset-0 -z-10" />
        <ParticlesBackground className="pointer-events-none fixed inset-0 -z-20" />

        <main className="relative z-0">{children}</main>
      </body>
    </html>
  );
}

// We keep layout server-side simple; pages can inject effects if desired


