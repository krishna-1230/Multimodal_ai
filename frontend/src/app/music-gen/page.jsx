"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { resolveMediaUrl } from "@/lib/media";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function MusicGenPageContent() {
  const { user, authHeaders } = useAuth();
  
  // Music Gen state
  const [musicTags, setMusicTags] = useState("");
  const [musicLyrics, setMusicLyrics] = useState("");
  const [musicDuration, setMusicDuration] = useState(30);
  const [runningMusic, setRunningMusic] = useState(false);
  const [musicOutput, setMusicOutput] = useState("");

  async function runMusicGen() {
    if (!musicTags.trim()) return;
    
    setRunningMusic(true);
    setMusicOutput("");
    try {
      const res = await fetch(`${API_BASE}/integrations/music-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ 
          tags: musicTags, 
          lyrics: musicLyrics, 
          duration: musicDuration 
        }),
      });
      const text = await res.text();
      
      // Try to parse as JSON to extract audio URL
      try {
        const parsed = JSON.parse(text);
        if (parsed.audio) {
          // Clean the URL by trimming whitespace and removing leading comma
          const cleanUrl = parsed.audio.trim().replace(/^,+/, '').trim();
          console.log('Original Audio URL:', parsed.audio);
          console.log('Cleaned Audio URL:', cleanUrl);
          setMusicOutput(resolveMediaUrl(cleanUrl));
        } else {
          setMusicOutput(text); // Store raw response if no audio field
        }
      } catch {
        setMusicOutput(text); // Store raw response if not valid JSON
      }
    } catch (e) {
      setMusicOutput("Error: " + e.message);
    } finally {
      setRunningMusic(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <NavBar user={user} currentPage="music-gen" />
      
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-4xl p-6">
          <div className="mb-6">
            <h1 className="neon-text text-2xl font-bold text-sky-300">Music Generation</h1>
            <p className="mt-2 text-slate-300/80">Generate music tracks with custom tags and lyrics.</p>
          </div>

          <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
                <input
                  value={musicTags}
                  onChange={(e) => setMusicTags(e.target.value)}
                  placeholder="e.g., rock, ambient, electronic, upbeat"
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Lyrics (optional)</label>
                <textarea
                  value={musicLyrics}
                  onChange={(e) => setMusicLyrics(e.target.value)}
                  placeholder="Enter lyrics for the song..."
                  rows={4}
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Duration (seconds)</label>
                <input 
                  type="number" 
                  min={5} 
                  max={120} 
                  value={musicDuration} 
                  onChange={(e)=> setMusicDuration(parseInt(e.target.value||"0")||30)} 
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none" 
                />
              </div>

              <button 
                onClick={runMusicGen} 
                disabled={runningMusic || !musicTags.trim()} 
                className="btn-neon w-full"
              >
                {runningMusic ? "Generating..." : "Generate Music"}
              </button>
            </div>
          </div>

          {musicOutput && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Generated Music</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
                <div className="mb-2 text-xs text-slate-400">
                  Debug: URL detected as {(musicOutput.startsWith('http') || musicOutput.includes('://')) ? 'AUDIO' : 'TEXT'}
                </div>
                {(musicOutput.startsWith('http') || musicOutput.includes('://')) ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-slate-300 mb-4">🎵 Your generated music is ready!</p>
                      <audio 
                        controls 
                        preload="metadata"
                        className="w-full max-w-md mx-auto"
                        onError={() => console.log('Audio failed to load:', musicOutput)}
                        onLoadedMetadata={() => console.log('Audio loaded successfully:', musicOutput)}
                      >
                        <source src={musicOutput} type="audio/mpeg" />
                        <source src={musicOutput} type="audio/wav" />
                        <source src={musicOutput} type="audio/ogg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                    <div className="text-center">
                      <a 
                        href={musicOutput} 
                        download="generated-music.mp3"
                        className="btn-neon inline-block px-4 py-2 text-sm"
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Download Audio
                      </a>
                    </div>
                  </div>
                ) : (
                  <pre className="max-h-96 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">
                    {musicOutput}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function MusicGenPage() {
  return (
    <AuthGuard>
      <MusicGenPageContent />
    </AuthGuard>
  );
}
