"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { resolveMediaUrl } from "@/lib/media";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function FluxKontextPageContent() {
  const { user, authHeaders } = useAuth();
  
  // FLUX Kontext state
  const [fluxCtxPrompt, setFluxCtxPrompt] = useState("");
  const [fluxCtxFiles, setFluxCtxFiles] = useState([]);
  const [fluxCtxModel, setFluxCtxModel] = useState("quality");
  const [runningFluxCtx, setRunningFluxCtx] = useState(false);
  const [fluxCtxOutput, setFluxCtxOutput] = useState("");
  const [kontextMode, setKontextMode] = useState("1"); // "1" or "2"

  async function runFluxKontext() {
    if (!fluxCtxPrompt.trim()) return;
    if (kontextMode === "1" && fluxCtxFiles.length !== 1) return;
    if (kontextMode === "2" && fluxCtxFiles.length !== 2) return;
    
    setRunningFluxCtx(true);
    setFluxCtxOutput("");
    try {
      const fd = new FormData();
      fd.append("prompt", fluxCtxPrompt);
      fd.append("userid", user?.id || "");
      fd.append("model", fluxCtxModel);
      for (const f of fluxCtxFiles) fd.append("image", f);
      
      const endpoint = kontextMode === "1" ? "fluxkontext-1" : "fluxkontext-2";
      const res = await fetch(`${API_BASE}/integrations/${endpoint}`, {
        method: "POST",
        headers: { ...authHeaders() },
        body: fd,
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
          setFluxCtxOutput(resolveMediaUrl(cleanUrl));
        } else {
          setFluxCtxOutput(text); // Store raw response if no img field
        }
      } catch {
        setFluxCtxOutput(text); // Store raw response if not valid JSON
      }
    } catch (e) {
      setFluxCtxOutput("Error: " + e.message);
    } finally {
      setRunningFluxCtx(false);
    }
  }

  const expectedFiles = kontextMode === "1" ? 1 : 2;
  const isValid = fluxCtxPrompt.trim() && fluxCtxFiles.length === expectedFiles;

  return (
    <div className="flex min-h-[100svh] flex-col">
      <NavBar user={user} currentPage="flux-kontext" />
      
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-4xl p-6">
          <div className="mb-6">
            <h1 className="neon-text text-2xl font-bold text-sky-300">FLUX Kontext Generation</h1>
            <p className="mt-2 text-slate-300/80">Generate images using FLUX with reference images for kontext.</p>
          </div>

          <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Kontext Mode</label>
                <select 
                  value={kontextMode} 
                  onChange={(e) => {
                    setKontextMode(e.target.value);
                    setFluxCtxFiles([]); // Reset files when mode changes
                  }}
                  className="neon-select w-full"
                >
                  <option value="1">Single Image Kontext</option>
                  <option value="2">Dual Image Kontext</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
                <select 
                  value={fluxCtxModel} 
                  onChange={(e) => setFluxCtxModel(e.target.value)} 
                  className="neon-select w-full"
                >
                  <option value="quality">Quality</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Prompt</label>
                <textarea
                  value={fluxCtxPrompt}
                  onChange={(e) => setFluxCtxPrompt(e.target.value)}
                  placeholder="Describe how you want to transform or use the reference image(s)..."
                  rows={3}
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Reference Images ({expectedFiles} required)
                </label>
                
                {/* Hidden file input */}
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple={kontextMode === "2"}
                  onChange={(e) => setFluxCtxFiles(Array.from(e.target.files || []))} 
                  className="hidden"
                  id="flux-kontext-upload"
                />
                
                {/* Upload button */}
                <button 
                  type="button"
                  onClick={() => document.getElementById('flux-kontext-upload').click()}
                  className="btn-neon w-full mb-4"
                >
                  {fluxCtxFiles.length > 0 ? 'Change Images' : `Upload ${expectedFiles} Image${expectedFiles > 1 ? 's' : ''}`}
                </button>

                {/* Image previews */}
                {fluxCtxFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm text-slate-400">
                      Selected: {fluxCtxFiles.length} file(s)
                    </div>
                    <div className={`grid gap-3 ${kontextMode === "2" ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {fluxCtxFiles.map((file, i) => (
                        <div key={i} className="relative">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={`Preview ${i + 1}`}
                            className="w-full h-20 object-contain rounded-lg border border-slate-700 bg-slate-900/50"
                          />
                          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {fluxCtxFiles.length !== expectedFiles && (
                  <div className="mt-2 text-sm text-red-400">
                    Please select exactly {expectedFiles} image{expectedFiles > 1 ? 's' : ''}.
                  </div>
                )}
              </div>

              <button 
                onClick={runFluxKontext} 
                disabled={runningFluxCtx || !isValid} 
                className="btn-neon w-full"
              >
                {runningFluxCtx ? "Generating..." : `Generate FLUX Kontext ${kontextMode}`}
              </button>
            </div>
          </div>

          {fluxCtxOutput && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Generated Image</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
                <div className="mb-2 text-xs text-slate-400">
                  Debug: URL detected as {(fluxCtxOutput.startsWith('http') || fluxCtxOutput.includes('://')) ? 'IMAGE' : 'TEXT'}
                </div>
                {(fluxCtxOutput.startsWith('http') || fluxCtxOutput.includes('://')) ? (
                  <div className="text-center">
                    <img 
                      src={fluxCtxOutput} 
                      alt="Generated FLUX Kontext image" 
                      className="mx-auto max-w-full h-auto rounded-lg shadow-lg"
                      onLoad={() => console.log('Image loaded successfully:', fluxCtxOutput)}
                      onError={(e) => {
                        console.log('Image failed to load:', fluxCtxOutput);
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                      }}
                    />
                    <div style={{display: 'none'}} className="text-slate-400">
                      <p>Failed to load image. URL:</p>
                      <pre className="whitespace-pre-wrap text-slate-200 mt-2">{fluxCtxOutput}</pre>
                    </div>
                  </div>
                ) : (
                  <pre className="max-h-96 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">
                    {fluxCtxOutput}
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

export default function FluxKontextPage() {
  return (
    <AuthGuard>
      <FluxKontextPageContent />
    </AuthGuard>
  );
}
