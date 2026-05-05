"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import Sidebar from "@/components/Sidebar";
import MessageBubble from "@/components/MessageBubble";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function RagPageContent() {
  const { user, authHeaders } = useAuth();
  // Guard to ensure we fetch collections only once per user session
  const hasFetchedCollections = useRef(false);
  // Guard to ensure we only restore once
  const hasRestoredRag = useRef(false);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // RAG state
  const [activeRagConversationId, setActiveRagConversationId] = useState("");
  const [ragMessages, setRagMessages] = useState([]);
  const [ragQuery, setRagQuery] = useState("");
  // Speech recognition state for RAG
  const [ragRecording, setRagRecording] = useState(false);
  const ragRecognitionRef = useRef(null);
  const [ragCollectionName, setRagCollectionName] = useState("");
  const [ragTopK, setRagTopK] = useState(5);
  const [sendingRag, setSendingRag] = useState(false);
  
  // RAG collections and upload
  const [ragCollections, setRagCollections] = useState([]);
  const [ragNewCollection, setRagNewCollection] = useState("");
  const [ragUploadFiles, setRagUploadFiles] = useState([]);
  const [ragUploading, setRagUploading] = useState(false);
  const [ragUploadMsg, setRagUploadMsg] = useState("");

  // File input ref for upload
  const fileInputRef = useRef(null);
  const ragInputRef = useRef(null);
  const messagesRef = useRef(null);

  // Load RAG collections when user is available (once per session)
  useEffect(() => {
    if (!user) return;
    if (hasFetchedCollections.current) return;
    hasFetchedCollections.current = true;
    fetch(`${API_BASE}/rag/collections`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        const cols = Array.isArray(data?.collections) ? data.collections : [];
        setRagCollections(cols);
        if (!ragCollectionName && cols.length > 0) setRagCollectionName(cols[0]);
      })
      .catch(() => {});
  }, [user]);

  // Handlers
  function updateUrlParams(partial) {
    try {
      const usp = new URLSearchParams(window.location.search);
      Object.entries(partial).forEach(([k, v]) => {
        if (v) usp.set(k, v);
        else usp.delete(k);
      });
      const qs = usp.toString();
      const newUrl = qs ? `/rag?${qs}` : "/rag";
      window.history.replaceState({}, "", newUrl);
    } catch (_) {}
  }

  function selectRagConversation(convId) {
    setActiveRagConversationId(convId);
    try { localStorage.setItem("lastRagConversationId", convId); } catch {}
    updateUrlParams({ rc: convId });
    fetch(`${API_BASE}/rag/conversations/${convId}/messages`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((msgs) => setRagMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setRagMessages([]));
  }

  function handleNewRag() {
    setActiveRagConversationId("");
    setRagMessages([]);
    updateUrlParams({ rc: null });
  }
  
  async function sendRagQuery() {
    if (!ragQuery.trim() || !ragCollectionName) return;
    const content = ragQuery.trim();
    setRagQuery("");
    setRagMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content, timestamp: new Date().toISOString() }]);
    setSendingRag(true);
    try {
      const body = {
        query: content,
        collection_name: ragCollectionName,
        top_k: ragTopK,
        conversation_id: activeRagConversationId || null,
      };
      const res = await fetch(`${API_BASE}/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "RAG failed");
      if (!activeRagConversationId && data.conversation_id) {
        setActiveRagConversationId(data.conversation_id);
        updateUrlParams({ rc: data.conversation_id });
      }
      setRagMessages((prev) => [
        ...prev,
        { id: `sys-${Date.now()}`, role: "system", content: data.answer || "", timestamp: new Date().toISOString() },
      ]);
    } catch (e) {
      setRagMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "system", content: `Error: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setSendingRag(false);
    }
  }

  async function sendTranscribedRag(transcript) {
    if (!transcript || !transcript.trim() || !ragCollectionName) return;
    const content = transcript.trim();
    setRagQuery("");
    setRagMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content, timestamp: new Date().toISOString() }]);
    setSendingRag(true);
    try {
      const body = {
        transcript: content,
        collection_name: ragCollectionName,
        top_k: ragTopK,
        conversation_id: activeRagConversationId || null,
      };
      const res = await fetch(`${API_BASE}/rag/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "RAG speech failed");
      if (!activeRagConversationId && data.conversation_id) {
        setActiveRagConversationId(data.conversation_id);
        updateUrlParams({ rc: data.conversation_id });
      }
      setRagMessages((prev) => [
        ...prev,
        { id: `sys-${Date.now()}`, role: "system", content: data.answer || "", timestamp: new Date().toISOString() },
      ]);
    } catch (e) {
      setRagMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "system", content: `Error: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setSendingRag(false);
    }
  }

  async function uploadRagDocs() {
    if (ragUploadFiles.length === 0) return;
    const name = (ragNewCollection || ragCollectionName || "").trim();
    if (!name) return;
    setRagUploading(true);
    setRagUploadMsg("");
    try {
      const fd = new FormData();
      fd.append("collection_name", name);
      for (const f of ragUploadFiles) fd.append("files", f);
      const res = await fetch(`${API_BASE}/rag/upload`, { method: "POST", headers: { ...authHeaders() }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      setRagUploadMsg("Uploaded successfully");
      setRagUploadFiles([]);
      if (ragNewCollection) {
        setRagCollectionName(ragNewCollection);
        setRagNewCollection("");
      }
      // refresh collection list
      fetch(`${API_BASE}/rag/collections`, { headers: { ...authHeaders() } })
        .then((r) => r.json())
        .then((d) => Array.isArray(d?.collections) && setRagCollections(d.collections))
        .catch(() => {});
    } catch (e) {
      setRagUploadMsg(e.message);
    } finally {
      setRagUploading(false);
    }
  }

  function renderMain() {
    return (
      <section className="flex h-full flex-1">
        <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 pb-28" style={{ height: 'calc(100vh - 96px)' }}>
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {/* RAG Upload Section */}
            <div className="card-glow glass rounded-2xl border border-slate-800/60 bg-black/30 p-4">
              <div className="mb-3 text-sm text-slate-300">Select a collection to chat with, or upload documents.</div>
              {ragCollections.length === 0 && !ragNewCollection && !ragCollectionName && (
                <div className="mt-2 text-xs text-slate-400">No collections found. Create a new collection name and upload documents to start chatting.</div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select value={ragCollectionName} onChange={(e)=> setRagCollectionName(e.target.value)} className="neon-select max-w-xs">
                  <option value="">Select collection</option>
                  {ragCollections.map((c)=> (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input value={ragNewCollection} onChange={(e)=> setRagNewCollection(e.target.value)} placeholder="New collection name" className="card-glow glass rounded-lg border border-slate-800/60 bg-black/30 px-3 py-2 text-slate-100 outline-none" />
                <input type="file" multiple ref={fileInputRef} onChange={(e)=> setRagUploadFiles(Array.from(e.target.files||[]))} className="text-sm text-slate-300 hidden" />
                <button className="btn-neon px-3 py-2 text-sm" onClick={() => fileInputRef.current?.click()}>
                  Upload files
                </button>
                <button disabled={ragUploading || (!ragCollectionName && !ragNewCollection) || ragUploadFiles.length===0} onClick={uploadRagDocs} className="btn-neon px-3 py-2 text-sm">{ragUploading? "Uploading..." : "Upload"}</button>
                {ragUploadMsg && <span className="text-sm text-slate-400">{ragUploadMsg}</span>}
              </div>
            </div>

            {ragMessages.length === 0 && (
              <div className="mt-16 rounded-2xl border border-slate-800/60 bg-black/30 p-8 text-center text-slate-400">
                Ask about your collections with RAG
              </div>
            )}
            {ragMessages.map((m) => (
              <MessageBubble key={m.id || m.timestamp} msg={m} />
            ))}
          </div>
        </div>

        {/* Fixed RAG Composer - positioned at viewport bottom */}
        <div className="fixed left-0 right-0 bottom-0 z-40 px-4 py-3 bg-transparent">
          <div className="mx-auto flex w-full max-w-4xl items-end gap-2 px-0">
            <textarea
              ref={ragInputRef}
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
              onInput={(e) => {
                const el = e.target;
                el.style.height = "auto";
                const max = 240;
                const newH = Math.min(el.scrollHeight, max);
                el.style.height = newH + "px";
                el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendRagQuery();
                }
              }}
              rows={1}
              placeholder="Ask about your collection..."
              className="card-glow glass w-full rounded-xl border border-slate-800/60 bg-black/30 px-3 py-3 text-slate-100 outline-none"
            />
            {/* Microphone button for RAG */}
            <button
              onClick={() => {
                if (ragRecording) {
                  try { ragRecognitionRef.current && ragRecognitionRef.current.stop(); } catch (e) {}
                } else {
                  if (typeof window === "undefined") return;
                  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                  if (!SpeechRecognition) return;
                  const rec = new SpeechRecognition();
                  rec.continuous = false;
                  rec.interimResults = true;
                  rec.lang = "en-US";
                  let finalTranscript = "";
                  rec.onresult = (ev) => {
                    let interim = "";
                    for (let i = ev.resultIndex; i < ev.results.length; ++i) {
                      const t = ev.results[i][0].transcript;
                      if (ev.results[i].isFinal) finalTranscript += t;
                      else interim += t;
                    }
                    setRagQuery((finalTranscript + interim).trimStart());
                  };
                  rec.onend = () => {
                    setRagRecording(false);
                    ragRecognitionRef.current = null;
                    if ((finalTranscript || "").trim()) {
                      sendTranscribedRag(finalTranscript.trim());
                    }
                  };
                  rec.onerror = () => {
                    setRagRecording(false);
                    ragRecognitionRef.current = null;
                  };
                  ragRecognitionRef.current = rec;
                  try {
                    rec.start();
                    setRagRecording(true);
                  } catch (e) {
                    setRagRecording(false);
                    ragRecognitionRef.current = null;
                  }
                }
              }}
              disabled={sendingRag}
              className={`btn-neon h-[48px] min-w-[48px] ${ragRecording ? "bg-red-600" : ""}`}
              aria-pressed={ragRecording}
              title={ragRecording ? "Stop recording" : "Start recording"}
            >
              <span className="relative flex items-center justify-center w-5 h-5">
                <svg className={`w-5 h-5 ${ragRecording ? "text-red-400" : "text-slate-200"}`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
                  <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V19a1 1 0 0 0 2 0v-3.1A5 5 0 0 0 19 11z" />
                </svg>
                {ragRecording && (
                  <span className="absolute -right-0 -top-0 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                  </span>
                )}
              </span>
            </button>

            <button onClick={sendRagQuery} disabled={sendingRag || !ragCollectionName} className="btn-neon h-[48px] min-w-[90px]">
              {sendingRag ? "Running" : "Ask"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Auto-scroll to bottom when new RAG messages arrive
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const id = setTimeout(() => {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } catch (e) {
        el.scrollTop = el.scrollHeight;
      }
    }, 30);
    return () => clearTimeout(id);
  }, [ragMessages]);

  // Restore last conversation via URL or localStorage once user is loaded
  useEffect(() => {
    if (!user) return;
    if (hasRestoredRag.current) return;
    let urlRag = null;
    try {
      const usp = new URLSearchParams(window.location.search);
      urlRag = usp.get("rc") || usp.get("rag_conversation_id");
    } catch (_) {}
    
    const storedRag = typeof window !== "undefined" ? localStorage.getItem("lastRagConversationId") : null;
    const defaultRag = urlRag || storedRag;
    
    if (defaultRag && !activeRagConversationId) {
      selectRagConversation(defaultRag);
      hasRestoredRag.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="flex min-h-[100svh]">
      <NavBar 
        user={user} 
        currentPage="rag" 
        ragCollectionName={ragCollectionName}
        setRagCollectionName={setRagCollectionName}
        ragCollections={ragCollections}
        ragTopK={ragTopK}
        setRagTopK={setRagTopK}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <div className="flex flex-1 pt-16">
        <Sidebar 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          authHeaders={authHeaders}
          mode="rag"
          activeChatConversationId=""
          activeRagConversationId={activeRagConversationId}
          onSelectRagConversation={selectRagConversation}
          onNewRag={handleNewRag}
        />
        {renderMain()}
      </div>
    </div>
  );
}

export default function RagPage() {
  return (
    <AuthGuard>
      <RagPageContent />
    </AuthGuard>
  );
}
