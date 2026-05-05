"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NavBar({ user, currentPage = "chat", ragCollectionName, setRagCollectionName, ragCollections, ragTopK, setRagTopK, sidebarOpen, setSidebarOpen }) {
  const [capOpen, setCapOpen] = useState(false);
  const router = useRouter();

  const pages = [
    { id: "chat", label: "Chat · Gemini", path: "/chat" },
    { id: "agent-chats", label: "Agent Chats", path: "/agentChats" },
    { id: "rag", label: "RAG", path: "/rag" },
    { id: "deep-research", label: "Deep Research", path: "/deep-research" },
    { id: "sdxl", label: "SDXL Image", path: "/sdxl" },
    { id: "flux", label: "FLUX Image", path: "/flux" },
    { id: "flux-kontext", label: "FLUX Kontext", path: "/flux_kontext" },
    { id: "music-gen", label: "Music Gen", path: "/music-gen" },
    { id: "video-gen", label: "Video Gen", path: "/video-gen" },
    { id: "voice-gen", label: "Voice Gen", path: "/voice-gen" },
  ];

  const currentPageLabel = pages.find(p => p.id === currentPage)?.label || "Chat";

  function handlePageChange(path) {
    setCapOpen(false);
    router.push(path);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="neon-text bg-gradient-to-b from-sky-300 to-blue-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
          Agent Weave
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="relative flex items-center gap-2">
            {/* Sidebar toggle for pages that have sidebars */}
            {(currentPage === "chat" || currentPage === "rag" || currentPage === "agent-chats") && setSidebarOpen && (
              <>
                <button onClick={() => setSidebarOpen((v) => !v)} className="btn-neon px-3 py-1 text-sm">
                  {sidebarOpen ? "Hide" : "Show"} Sidebar
                </button>
                <div className="hidden text-slate-400 sm:block">|</div>
              </>
            )}
            
            <button 
              onClick={() => setCapOpen((v) => !v)} 
              className="btn-neon px-3 py-2 text-sm"
            >
              Select Model
            </button>
            <Link href="/profile" className="btn-neon px-3 py-2 text-sm">Profile</Link>
            
            {/* RAG-specific controls */}
            {currentPage === "rag" && ragCollections && (
              <>
                <div className="hidden text-slate-400 sm:block">|</div>
                <select value={ragCollectionName || ""} onChange={(e) => setRagCollectionName && setRagCollectionName(e.target.value)} className="neon-select text-sm max-w-xs">
                  <option value="">Select collection</option>
                  {ragCollections.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <label className="text-sm text-slate-400">TopK</label>
                <input type="range" min={1} max={20} value={ragTopK || 5} onChange={(e) => setRagTopK && setRagTopK(parseInt(e.target.value))} />
                <span className="text-sm text-slate-300">{ragTopK || 5}</span>
              </>
            )}
            
            {capOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCapOpen(false)} />
                <div className="absolute left-0 top-full z-[60] mt-2 w-72 rounded-xl border border-slate-800/60 bg-black/60 p-2 shadow-xl backdrop-blur-md">
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-slate-400">Chat & RAG</div>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/chat")}
                  >
                    Chat · Gemini
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/rag")}
                  >
                    RAG
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/agentChats")}
                  >
                    Agent Chats
                  </button>

                  <div className="mt-2 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-400">Settings</div>
                  <button
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10"
                    onClick={() => handlePageChange('/profile')}
                  >
                    Profile
                  </button>
                  <div className="mt-2 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-400">Tools</div>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/deep-research")}
                  >
                    Deep Research
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/sdxl")}
                  >
                    SDXL Image
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/flux")}
                  >
                    FLUX Image
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/flux_kontext")}
                  >
                    FLUX Kontext
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/music-gen")}
                  >
                    Music Gen
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/video-gen")}
                  >
                    Video Gen
                  </button>
                  <button 
                    className="w-full rounded-md px-3 py-2 text-left text-slate-200 hover:bg-sky-500/10" 
                    onClick={() => handlePageChange("/voice-gen")}
                  >
                    Voice Gen
                  </button>
                </div>
              </>
            )}
          </div>
          
          <div className="text-sm text-slate-400">{user ? user.email : ""}</div>
        </div>
      </div>
    </header>
  );
}
