"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { resolveMediaUrl } from "@/lib/media";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function VoiceGenPageContent() {
  const { user, authHeaders } = useAuth();
  
  // Voice Gen state
  const [voiceType, setVoiceType] = useState("am_adam");
  const [voiceScript, setVoiceScript] = useState("");
  const [runningVoice, setRunningVoice] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState("");

  async function runVoiceGen() {
    if (!voiceScript.trim()) return;
    
    setRunningVoice(true);
    setVoiceOutput("");
    try {
      const res = await fetch(`${API_BASE}/integrations/voice-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ 
          user_id: user?.id || "", 
          voice_type: voiceType, 
          script: voiceScript 
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
          setVoiceOutput(resolveMediaUrl(cleanUrl));
        } else {
          setVoiceOutput(text); // Store raw response if no audio field
        }
      } catch {
        setVoiceOutput(text); // Store raw response if not valid JSON
      }
    } catch (e) {
      setVoiceOutput("Error: " + e.message);
    } finally {
      setRunningVoice(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <NavBar user={user} currentPage="voice-gen" />
      
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-4xl p-6">
          <div className="mb-6">
            <h1 className="neon-text text-2xl font-bold text-sky-300">Voice Generation</h1>
            <p className="mt-2 text-slate-300/80">Generate voiceovers and speech using TTS models.</p>
          </div>

          <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Voice Type</label>
                <select 
                  value={voiceType} 
                  onChange={(e) => setVoiceType(e.target.value)} 
                  className="neon-select w-full"
                >
                  <option value="am_adam">Adam (Male)</option>
                  <option value="am_liam">Liam (Male)</option>
                  <option value="am_nova">Nova (Female)</option>
                  <option value="am_alloy">Alloy (Neutral)</option>
                  <option value="am_echo">Echo (Male)</option>
                  <option value="am_onyx">Onyx (Deep Male)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Script</label>
                <textarea
                  value={voiceScript}
                  onChange={(e) => setVoiceScript(e.target.value)}
                  placeholder="Enter the text you want to convert to speech..."
                  rows={6}
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none resize-none"
                />
              </div>

              <button 
                onClick={runVoiceGen} 
                disabled={runningVoice || !voiceScript.trim()} 
                className="btn-neon w-full"
              >
                {runningVoice ? "Generating..." : "Generate Voice"}
              </button>
            </div>
          </div>

          {voiceOutput && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Generated Voice</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
                <div className="mb-2 text-xs text-slate-400">
                  Debug: URL detected as {(voiceOutput.startsWith('http') || voiceOutput.includes('://')) ? 'AUDIO' : 'TEXT'}
                </div>
                {(voiceOutput.startsWith('http') || voiceOutput.includes('://')) ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-slate-300 mb-4">🎤 Your generated voice is ready!</p>
                      <audio 
                        controls 
                        preload="metadata"
                        className="w-full max-w-md mx-auto"
                        onError={() => console.log('Audio failed to load:', voiceOutput)}
                        onLoadedMetadata={() => console.log('Audio loaded successfully:', voiceOutput)}
                      >
                        <source src={voiceOutput} type="audio/mpeg" />
                        <source src={voiceOutput} type="audio/wav" />
                        <source src={voiceOutput} type="audio/ogg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                    <div className="text-center">
                      <a 
                        href={voiceOutput} 
                        download="generated-voice.mp3"
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
                    {voiceOutput}
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

export default function VoiceGenPage() {
  return (
    <AuthGuard>
      <VoiceGenPageContent />
    </AuthGuard>
  );
}
