"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import { resolveMediaUrl } from "@/lib/media";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function VideoGenPageContent() {
  const { user, authHeaders } = useAuth();
  
  // Video Gen state
  const [videoModel, setVideoModel] = useState("veo3");
  const [videoScript, setVideoScript] = useState("");
  const [runningVideo, setRunningVideo] = useState(false);
  const [videoOutput, setVideoOutput] = useState("");

  async function runVideoGen() {
    if (!videoScript.trim()) return;
    
    setRunningVideo(true);
    setVideoOutput("");
    try {
      const res = await fetch(`${API_BASE}/integrations/video-gen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ 
          user_id: user?.id || "", 
          model: videoModel, 
          script: videoScript 
        }),
      });
      const text = await res.text();
      
      // Try to parse JSON response for video URL
      try {
        const parsed = JSON.parse(text);
        console.log('Video generation response:', parsed);
        
        if (parsed.video) {
          // Clean the URL (remove any leading commas or whitespace)
          const cleanVideoUrl = parsed.video.trim().replace(/^,+/, '').trim();
          console.log('Original video URL:', parsed.video);
          console.log('Cleaned video URL:', cleanVideoUrl);
          setVideoOutput({ type: 'video', url: resolveMediaUrl(cleanVideoUrl) });
        } else {
          console.log('No video field found in response');
          setVideoOutput({ type: 'text', content: text });
        }
      } catch (parseError) {
        console.log('Failed to parse JSON response:', parseError);
        // If not JSON, treat as plain text
        setVideoOutput({ type: 'text', content: text });
      }
    } catch (e) {
      setVideoOutput({ type: 'error', content: "Error: " + e.message });
    } finally {
      setRunningVideo(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <NavBar user={user} currentPage="video-gen" />
      
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-4xl p-6">
          <div className="mb-6">
            <h1 className="neon-text text-2xl font-bold text-sky-300">Video Generation</h1>
            <p className="mt-2 text-slate-300/80">Generate videos from scripts using AI models.</p>
          </div>

          <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
                <select 
                  value={videoModel} 
                  onChange={(e) => setVideoModel(e.target.value)} 
                  className="neon-select w-full"
                >
                  <option value="veo3">VEO3</option>
                 
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Script</label>
                <textarea
                  value={videoScript}
                  onChange={(e) => setVideoScript(e.target.value)}
                  placeholder="Enter your video script or description..."
                  rows={6}
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none resize-none"
                />
              </div>

              <button 
                onClick={runVideoGen} 
                disabled={runningVideo || !videoScript.trim()} 
                className="btn-neon w-full"
              >
                {runningVideo ? "Generating..." : "Generate Video"}
              </button>
            </div>
          </div>

          {videoOutput && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Output</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
                {videoOutput.type === 'video' ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <video 
                        src={videoOutput.url} 
                        controls 
                        className="w-full rounded-lg"
                        preload="metadata"
                        onError={(e) => console.error('Video loading error:', e)}
                        onLoadStart={() => console.log('Video loading started')}
                        onCanPlay={() => {
                          console.log('Video can play');
                          const loadingEl = document.getElementById('video-loading');
                          if (loadingEl) loadingEl.style.display = 'none';
                        }}
                        onLoadedData={() => console.log('Video data loaded')}
                      >
                        Your browser does not support the video tag.
                      </video>
                      
                      {/* Video loading indicator */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg" id="video-loading">
                        <div className="text-white text-sm">Loading video...</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      {/*<div className="text-sm text-slate-400">
                        Video URL: {videoOutput.url}
                      </div> */}
                      <div className="flex gap-2">

                        <a 
                          href={videoOutput.url} 
                          download
                          className="btn-neon px-3 py-1 text-sm"
                        >
                          Download Video
                        </a>
                      </div>
                    </div>
                    
                    {/* Debug info */}
                    <div className="text-xs text-slate-500 bg-slate-900/50 p-2 rounded">
                      Debug: Video URL detected and loaded successfully
                    </div>
                  </div>
                ) : videoOutput.type === 'error' ? (
                  <div className="text-red-400 text-sm">
                    {videoOutput.content}
                  </div>
                ) : (
                  <pre className="max-h-96 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">
                    {videoOutput.content}
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

export default function VideoGenPage() {
  return (
    <AuthGuard>
      <VideoGenPageContent />
    </AuthGuard>
  );
}
