"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// Simple inline icons (stroke inherits from parent color)
function ChatIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4H6a2 2 0 0 1-2-2V6z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}

function BookIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M14 3h4a2 2 0 0 1 2 2v16a2 2 0 0 0-2-2h-4V3z" />
    </svg>
  );
}

function ImageIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M7 13l3-3 4 5 3-3 3 4" />
      <circle cx="8.5" cy="9" r="1.2" />
    </svg>
  );
}

function VideoIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <path d="M17 10l4-2v8l-4-2v-4z" />
    </svg>
  );
}

function MusicIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" />
      <path d="M21 14a3 3 0 1 1-3-3 3 3 0 0 1 3 3z" />
      <path d="M9 15V6l12-3v9" />
    </svg>
  );
}

function FolderIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-[100svh] w-full bg-[radial-gradient(600px_300px_at_10%_10%,rgba(14,165,233,0.06),transparent),radial-gradient(800px_400px_at_90%_80%,rgba(56,189,248,0.04),transparent)]">
      {/* Header - compact centered brand with subtle nav */}
      <header className="fixed inset-x-0 top-6 z-50">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="neon-text bg-gradient-to-b from-sky-300 to-blue-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
            Agent Weave
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300/90 sm:flex">
            {/* <Link href="#features" className="text-slate-300/80 hover:text-sky-300 transition">Features</Link>
            <Link href="/library" className="text-slate-300/80 hover:text-sky-300 transition">Library</Link>
            <Link href="/docs" className="text-slate-300/80 hover:text-sky-300 transition">Docs</Link> */}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-3 py-1 rounded-md border border-sky-500/30 text-sky-300 hover:bg-sky-900/20 transition">Login</Link>
            <Link href="/signup" className="btn-neon">Sign up</Link>
          </div>
        </div>
      </header>

      {/* Hero - split layout with visual card */}
      <section className="relative mx-auto flex w-full max-w-6xl items-center gap-12 px-6 pt-28 pb-12 sm:pt-32">
        <div className="w-full basis-1/2">
          <motion.h1
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="neon-text bg-gradient-to-b from-sky-300 to-blue-400 bg-clip-text text-4xl font-extrabold tracking-tight pb-4 text-transparent sm:text-5xl"
          >
            Agent Weave
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-1 max-w-xl text-slate-300/90"
          >
            A unified AI workspace for chat, RAG search, and creative generation — fast to start, built for collaboration.
          </motion.p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn-neon">Get started</Link>
            <Link href="/demo" className="px-4 py-2 rounded-md border border-slate-700 text-slate-300/90 hover:border-sky-500/40 transition">Live demo</Link>
          </div>

          <div className="mt-8 flex gap-6 text-xs text-slate-400">
            <div>
              <div className="text-sky-300 font-semibold">100k+</div>
              <div className="mt-1">Generated artifacts</div>
            </div>
            <div>
              <div className="text-sky-300 font-semibold">99.9%</div>
              <div className="mt-1">Uptime</div>
            </div>
          </div>
        </div>

        {/* <div className="hidden sm:block w-full basis-1/2">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-[0_10px_30px_rgba(2,6,23,0.6)]"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300/80">Recent activity</div>
              <div className="text-xs text-slate-500">Live</div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-sky-900 flex items-center justify-center text-sky-300">AI</div>
                <div>
                  <div className="text-sm font-medium text-slate-200">Conversation exported</div>
                  <div className="text-xs text-slate-400">2 hours ago</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-sky-900 flex items-center justify-center text-sky-300">RG</div>
                <div>
                  <div className="text-sm font-medium text-slate-200">New collection created</div>
                  <div className="text-xs text-slate-400">Yesterday</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div> */}
      </section>

      {/* Features - staggered cards with icon left */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55, delay: i * 0.06 }}
              whileHover={{ y: -6 }}
              className="flex gap-4 items-start rounded-2xl border border-slate-800/60 bg-black/30 p-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-sky-800/20 to-sky-900/10 text-sky-300">
                {c.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-sky-300">{c.title}</h3>
                <p className="mt-1 text-sm text-slate-300/80">{c.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-center text-xs text-slate-500">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div>© {new Date().getFullYear()} Agent Weave</div>
          <div className="text-slate-400">Built with care • <Link href="/docs" className="text-sky-300 hover:underline">Docs</Link></div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: <ChatIcon />, title: "Conversational Hub", body: "Unified chat across models with context memory and quick switching." },
  { icon: <BookIcon />, title: "RAG Workspace", body: "Create collections, upload documents, and query with hybrid search." },
  { icon: <ImageIcon />, title: "Image Generation", body: "SDXL and FLUX pipelines with presets, sizes, and context support." },
  { icon: <VideoIcon />, title: "Video & Motion", body: "Spin up short clips and storyboards from scripts or prompts." },
  { icon: <MusicIcon />, title: "Audio & Voice", body: "Generate music and voiceovers with your preferred providers." },
  { icon: <FolderIcon />, title: "Library", body: "Every output is saved — filter images, video, audio, and share links." },
];
// removed extra sections for a simpler, focused landing