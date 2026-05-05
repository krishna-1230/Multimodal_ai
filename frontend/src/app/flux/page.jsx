"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { resolveMediaUrl } from "@/lib/media";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function FluxPageContent() {
  const { user, authHeaders } = useAuth();
  
  // FLUX state
  const [fluxPrompt, setFluxPrompt] = useState("");
  const [fluxModel, setFluxModel] = useState("normal");
  const [runningFlux, setRunningFlux] = useState(false);
  const [fluxOutput, setFluxOutput] = useState("");

  async function runFlux() {
    if (!fluxPrompt.trim()) return;
    
    setRunningFlux(true);
    setFluxOutput("");
    try {
      const res = await fetch(`${API_BASE}/integrations/flux`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ prompt: fluxPrompt, userid: user?.id || "", model: fluxModel }),
      });
      const text = await res.text();
      
      // Try to parse as JSON to extract image URL
      try {
        const parsed = JSON.parse(text);
        if (parsed.img) {
          // Clean the URL by trimming whitespace and removing leading comma
          const cleanUrl = parsed.img.trim().replace(/^,+/, '').trim();
          setFluxOutput(resolveMediaUrl(cleanUrl));
        } else {
          setFluxOutput(text); // Store raw response if no img field
        }
      } catch {
        setFluxOutput(text); // Store raw response if not valid JSON
      }
    } catch (e) {
      setFluxOutput("Error: " + e.message);
    } finally {
      setRunningFlux(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <NavBar user={user} currentPage="flux" />
      
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-4xl p-6">
          <div className="mb-6">
            <h1 className="neon-text text-2xl font-bold text-sky-300">FLUX Image Generation</h1>
            <p className="mt-2 text-slate-300/80">Generate high-quality images using FLUX models.</p>
          </div>

          <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
                <select 
                  value={fluxModel} 
                  onChange={(e) => setFluxModel(e.target.value)} 
                  className="neon-select w-full"
                >
                  <option value="normal">Normal</option>
                  <option value="realism">Realism</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Prompt</label>
                <textarea
                  value={fluxPrompt}
                  onChange={(e) => setFluxPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  rows={3}
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none resize-none"
                />
              </div>

              <button 
                onClick={runFlux} 
                disabled={runningFlux || !fluxPrompt.trim()} 
                className="btn-neon w-full"
              >
                {runningFlux ? "Generating..." : "Generate FLUX Image"}
              </button>
            </div>
          </div>

          {fluxOutput && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Generated Image</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
                <div className="mb-2 text-xs text-slate-400">
                  Debug: URL detected as {(fluxOutput.startsWith('http') || fluxOutput.includes('://')) ? 'IMAGE' : 'TEXT'}
                </div>
                {(fluxOutput.startsWith('http') || fluxOutput.includes('://')) ? (
                  <div className="text-center">
                    <img 
                      src={fluxOutput} 
                      alt="Generated FLUX image" 
                      className="mx-auto max-w-full h-auto rounded-lg shadow-lg"
                      onLoad={() => console.log('Image loaded successfully:', fluxOutput)}
                      onError={(e) => {
                        console.log('Image failed to load:', fluxOutput);
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{display: 'none'}} className="text-slate-400">
                      <p>Failed to load image. URL:</p>
                      <pre className="whitespace-pre-wrap text-slate-200 mt-2">{fluxOutput}</pre>
                    </div>
                  </div>
                ) : (
                  <pre className="max-h-96 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">
                    {fluxOutput}
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

export default function FluxPage() {
  return (
    <AuthGuard>
      <FluxPageContent />
    </AuthGuard>
  );
}
