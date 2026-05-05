"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function parseFilename(header) {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || "deep-research-result.pdf";
}

function DeepResearchPageContent() {
  const { user, authHeaders } = useAuth();
  
  // Deep Research state
  const [researchTopic, setResearchTopic] = useState("");
  const [runningResearch, setRunningResearch] = useState(false);
  const [researchOutput, setResearchOutput] = useState("");
  const [researchFile, setResearchFile] = useState(null);

  useEffect(() => {
    return () => {
      if (researchFile?.url) {
        URL.revokeObjectURL(researchFile.url);
      }
    };
  }, [researchFile]);

  async function runDeepResearch() {
    if (!researchTopic.trim()) return;
    
    setRunningResearch(true);
    setResearchOutput("");
    if (researchFile?.url) {
      URL.revokeObjectURL(researchFile.url);
    }
    setResearchFile(null);
    try {
      const res = await fetch(`${API_BASE}/integrations/deep-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ "Search Topic": researchTopic }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/pdf") || contentType.includes("application/octet-stream")) {
        const blob = await res.blob();
        const fileUrl = URL.createObjectURL(blob);
        setResearchFile({
          url: fileUrl,
          name: parseFilename(res.headers.get("content-disposition")),
          type: blob.type || contentType,
        });
      } else {
        const text = await res.text();
        setResearchOutput(text);
      }
    } catch (e) {
      setResearchOutput("Error: " + e.message);
    } finally {
      setRunningResearch(false);
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <NavBar user={user} currentPage="deep-research" />
      
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-4xl p-6">
          <div className="mb-6">
            <h1 className="neon-text text-2xl font-bold text-sky-300">Deep Research</h1>
            <p className="mt-2 text-slate-300/80">Conduct comprehensive research on any topic using AI agents.</p>
          </div>

          <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Research Topic</label>
                <input
                  value={researchTopic}
                  onChange={(e) => setResearchTopic(e.target.value)}
                  placeholder="Enter a topic to research in depth..."
                  className="card-glow glass w-full rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <button 
                onClick={runDeepResearch} 
                disabled={runningResearch || !researchTopic.trim()} 
                className="btn-neon w-full"
              >
                {runningResearch ? "Researching..." : "Start Deep Research"}
              </button>
            </div>
          </div>

          {researchFile && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Research File</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
                  <span className="truncate">{researchFile.name}</span>
                  <a
                    href={researchFile.url}
                    download={researchFile.name}
                    className="btn-neon inline-flex w-auto px-4 py-2"
                  >
                    Download PDF
                  </a>
                </div>
                <iframe
                  src={researchFile.url}
                  title="Deep research file preview"
                  className="h-[70vh] w-full rounded-lg border border-slate-800/60 bg-white"
                />
              </div>
            </div>
          )}

          {researchOutput && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-sky-300 mb-3">Research Results</h3>
              <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
                <pre className="max-h-96 overflow-auto text-sm text-slate-200 whitespace-pre-wrap">
                  {researchOutput}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DeepResearchPage() {
  return (
    <AuthGuard>
      <DeepResearchPageContent />
    </AuthGuard>
  );
}
