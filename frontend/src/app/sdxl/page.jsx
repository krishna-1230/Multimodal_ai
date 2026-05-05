"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { resolveMediaUrl } from "@/lib/media";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function SdxlPageContent() {
  const { user, authHeaders } = useAuth();
  
  // SDXL state
  const [sdxlPrompt, setSdxlPrompt] = useState("");
  const [sdxlModel, setSdxlModel] = useState("lightning");
  const [runningSdxl, setRunningSdxl] = useState(false);
  const [sdxlOutput, setSdxlOutput] = useState("");

  async function runSdxl() {
    if (!sdxlPrompt.trim()) return;
    
    setRunningSdxl(true);
    setSdxlOutput("");
    try {
      const res = await fetch(`${API_BASE}/integrations/sdxl`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          prompt: sdxlPrompt,
          model: sdxlModel,
          userid: user?.id || "",
        }),
      });
      const text = await res.text();
      
      // Try to parse as JSON to extract image URL
      try {
        const parsed = JSON.parse(text);
        if (parsed.img) {
          // Clean the URL by trimming whitespace and removing leading comma
          const cleanUrl = parsed.img.trim().replace(/^,+/, '').trim();
          console.log('Original URL:', parsed.img);
          console.log('Cleaned URL:', cleanUrl);
          setSdxlOutput(resolveMediaUrl(cleanUrl));
        } else {
          setSdxlOutput(text); // Store raw response if no img field
        }
      } catch {
        setSdxlOutput(text); // Store raw response if not valid JSON
      }
    } catch (e) {
      setSdxlOutput("Error: " + e.message);
    } finally {
      setRunningSdxl(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <NavBar user={user} currentPage="sdxl" />
      
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-4xl p-6">
          <div className="mb-6">
            <h1 className="neon-text text-2xl font-bold text-sky-300">SDXL Image Generation</h1>
            <p className="mt-2 text-slate-300/80">Generate images using Stable Diffusion XL models.</p>
          </div>

          <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Prompt</label>
                <textarea
                  value={sdxlPrompt}
                  onChange={(e) => setSdxlPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  rows={3}
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
                <select 
                  value={sdxlModel} 
                  onChange={(e) => setSdxlModel(e.target.value)} 
                  className="neon-select w-full"
                >
                  <option value="anime">Anime</option>
                  <option value="realvis">RealVis</option>
                  <option value="lightning">Lightning</option>
                </select>
              </div>

              <button 
                onClick={runSdxl} 
                disabled={runningSdxl || !sdxlPrompt.trim()} 
                className="btn-neon w-full"
              >
                {runningSdxl ? "Generating..." : "Generate SDXL Image"}
              </button>
            </div>
          </div>

          {sdxlOutput && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Generated Image</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
                <div className="mb-2 text-xs text-slate-400">
                  Debug: URL detected as {(sdxlOutput.startsWith('http') || sdxlOutput.includes('://')) ? 'IMAGE' : 'TEXT'}
                </div>
                {(sdxlOutput.startsWith('http') || sdxlOutput.includes('://')) ? (
                  <div className="text-center">
                    <img 
                      src={sdxlOutput} 
                      alt="Generated SDXL image" 
                      className="mx-auto max-w-full h-auto rounded-lg shadow-lg"
                      onLoad={() => console.log('Image loaded successfully:', sdxlOutput)}
                      onError={(e) => {
                        console.log('Image failed to load:', sdxlOutput);
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{display: 'none'}} className="text-slate-400">
                      <p>Failed to load image. URL:</p>
                      <pre className="whitespace-pre-wrap text-slate-200 mt-2">{sdxlOutput}</pre>
                    </div>
                  </div>
                ) : (
                  <pre className="max-h-96 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">
                    {sdxlOutput}
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

export default function SdxlPage() {
  return (
    <AuthGuard>
      <SdxlPageContent />
    </AuthGuard>
  );
}
