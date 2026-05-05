"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import Sidebar from "@/components/Sidebar";
import MessageBubble from "@/components/MessageBubble";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function ChatPageContent() {
  const { user, authHeaders } = useAuth();
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // CHAT mode state
  const [activeChatConversationId, setActiveChatConversationId] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef(null);
  const messagesRef = useRef(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatModel, setChatModel] = useState("gemini-2.5-flash");
  // Speech recognition (Web Speech API) state
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // No need to load conversations here - Sidebar component handles this

  // Handlers
  function updateUrlParams(partial) {
    try {
      const usp = new URLSearchParams(window.location.search);
      Object.entries(partial).forEach(([k, v]) => {
        if (v) usp.set(k, v);
        else usp.delete(k);
      });
      const qs = usp.toString();
      const newUrl = qs ? `/chat?${qs}` : "/chat";
      window.history.replaceState({}, "", newUrl);
    } catch (_) {}
  }

  function selectChatConversation(convId) {
    setActiveChatConversationId(convId);
    try { localStorage.setItem("lastChatConversationId", convId); } catch {}
    updateUrlParams({ c: convId });
    fetch(`${API_BASE}/conversations/${convId}/messages`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((msgs) => setChatMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setChatMessages([]));
  }

  function handleNewChat() {
    setActiveChatConversationId("");
    setChatMessages([]);
    updateUrlParams({ c: null });
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return;
    const content = chatInput.trim();
    setChatInput("");
    const tempId = `temp-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: tempId, role: "user", content, timestamp: new Date().toISOString() }]);
    setSendingChat(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ conversation_id: activeChatConversationId || "", message: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      const newConvId = data.conversation_id;
      if (!activeChatConversationId && newConvId) {
        setActiveChatConversationId(newConvId);
        try { localStorage.setItem("lastChatConversationId", newConvId); } catch {}
        updateUrlParams({ c: newConvId });
      }
      // Messages will be refreshed below
      const convIdToFetch = newConvId || activeChatConversationId;
      if (convIdToFetch) {
        const full = await fetch(`${API_BASE}/conversations/${convIdToFetch}/messages`, { headers: { ...authHeaders() } }).then((r) => r.json());
        setChatMessages(Array.isArray(full) ? full : []);
      } else {
        // fallback append if no id
        setChatMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, role: "model", content: data.reply || "", timestamp: new Date().toISOString() },
        ]);
      }
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "model", content: `Error: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setSendingChat(false);
    }
  }

  async function sendTranscribedMessage(transcript) {
    if (!transcript || !transcript.trim()) return;
    const content = transcript.trim();
    setChatInput("");
    const tempId = `temp-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: tempId, role: "user", content, timestamp: new Date().toISOString() }]);
    setSendingChat(true);
    try {
      const res = await fetch(`${API_BASE}/speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ conversation_id: activeChatConversationId || "", transcript: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speech request failed");
      const newConvId = data.conversation_id;
      if (!activeChatConversationId && newConvId) {
        setActiveChatConversationId(newConvId);
        try { localStorage.setItem("lastChatConversationId", newConvId); } catch {}
        updateUrlParams({ c: newConvId });
      }
      const convIdToFetch = newConvId || activeChatConversationId;
      if (convIdToFetch) {
        const full = await fetch(`${API_BASE}/conversations/${convIdToFetch}/messages`, { headers: { ...authHeaders() } }).then((r) => r.json());
        setChatMessages(Array.isArray(full) ? full : []);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, role: "model", content: data.reply || "", timestamp: new Date().toISOString() },
        ]);
      }
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "model", content: `Error: ${e.message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setSendingChat(false);
    }
  }
  function renderMain() {
    return (
      <section className="flex h-full flex-1">
        {/* Messages column: scrollable independently */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 pb-28" style={{ height: 'calc(100vh - 96px)' }}>
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {chatMessages.length === 0 && (
              <div className="mt-16 rounded-2xl border border-slate-800/60 bg-black/30 p-8 text-center text-slate-400">
                Start a conversation with the neon assistant
              </div>
            )}
            {chatMessages.map((m) => (
              <MessageBubble key={m.id || m.timestamp} msg={m} />
            ))}
          </div>
        </div>

        {/* Fixed chat composer - positioned at viewport bottom */}
        <div className="fixed left-0 right-0 bottom-0 z-40 px-4 py-3 bg-transparent">
          <div className="mx-auto flex w-full max-w-4xl items-end gap-2 px-0">
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
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
                  sendChatMessage();
                }
              }}
              rows={1}
              placeholder="Message Neon Assistant..."
              className="card-glow glass w-full rounded-xl border px-3 py-3 text-slate-100 outline-none"
            />

            <button
              onClick={() => {
                if (recording) {
                  try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) {}
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
                    setChatInput((finalTranscript + interim).trimStart());
                  };
                  rec.onend = () => {
                    setRecording(false);
                    recognitionRef.current = null;
                    if ((finalTranscript || "").trim()) {
                      sendTranscribedMessage(finalTranscript.trim());
                    }
                  };
                  rec.onerror = () => {
                    setRecording(false);
                    recognitionRef.current = null;
                  };
                  recognitionRef.current = rec;
                  try {
                    rec.start();
                    setRecording(true);
                  } catch (e) {
                    setRecording(false);
                    recognitionRef.current = null;
                  }
                }
              }}
              disabled={sendingChat}
              className={`btn-neon h-[48px] min-w-[48px] ${recording ? "bg-red-600" : ""}`}
              aria-pressed={recording}
              title={recording ? "Stop recording" : "Start recording"}
            >
              <span className="relative flex items-center justify-center w-5 h-5">
                <svg className={`w-5 h-5 ${recording ? "text-red-400" : "text-slate-200"}`} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
                  <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V19a1 1 0 0 0 2 0v-3.1A5 5 0 0 0 19 11z" />
                </svg>
                {recording && (
                  <span className="absolute -right-0 -top-0 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                  </span>
                )}
              </span>
            </button>

            <button onClick={sendChatMessage} disabled={sendingChat} className="btn-neon h-[48px] min-w-[90px]">
              {sendingChat ? "Sending" : "Send"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    // delay slightly to ensure DOM updated
    const id = setTimeout(() => {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } catch (e) {
        el.scrollTop = el.scrollHeight;
      }
    }, 30);
    return () => clearTimeout(id);
  }, [chatMessages]);

  // Restore last conversation via URL or localStorage once user is loaded
  useEffect(() => {
    if (!user) return;
    let urlChat = null;
    try {
      const usp = new URLSearchParams(window.location.search);
      urlChat = usp.get("c") || usp.get("conversation_id");
    } catch (_) {}
    
    const storedChat = typeof window !== "undefined" ? localStorage.getItem("lastChatConversationId") : null;
    const defaultChat = urlChat || storedChat;
    
    if (defaultChat && !activeChatConversationId) {
      selectChatConversation(defaultChat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="flex min-h-[100svh]">
      <NavBar 
        user={user} 
        currentPage="chat" 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <div className="flex flex-1 pt-16">
        <Sidebar 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          authHeaders={authHeaders}
          mode="chat"
          activeChatConversationId={activeChatConversationId}
          activeRagConversationId={""}
          onSelectChatConversation={selectChatConversation}
          onNewChat={handleNewChat}
        />
        {renderMain()}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatPageContent />
    </AuthGuard>
  );
}

