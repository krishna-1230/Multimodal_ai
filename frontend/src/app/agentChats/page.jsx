"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import NavBar from "@/components/NavBar";
import Sidebar from "@/components/Sidebar";
import MessageBubble from "@/components/MessageBubble";
import { resolveMediaUrl } from "@/lib/media";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

function pickAgentImages(fileList) {
  return Array.from(fileList || [])
    .filter((file) => file.type && file.type.startsWith("image/"))
    .slice(0, 2);
}

function ChatPageContent() {
  const { user, authHeaders } = useAuth();
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentConversations, setAgentConversations] = useState([]);
  const [activeAgentConversationId, setActiveAgentConversationId] = useState("");
  const [agentMessages, setAgentMessages] = useState([]);

  // CHAT mode state
  const [activeChatConversationId, setActiveChatConversationId] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef(null);
  const messagesRef = useRef(null);
  const fileInputRef = useRef(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatModel, setChatModel] = useState("gemini-2.5-flash");
  // Agent Chat state
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentFiles, setAgentFiles] = useState(null);
  const [agentOutputs, setAgentOutputs] = useState([]);
  const [sendingAgent, setSendingAgent] = useState(false);
  const [agentChatId, setAgentChatId] = useState(null);
  const [agentFilePreviews, setAgentFilePreviews] = useState([]);
  // Speech recognition (Web Speech API) state
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // Load agent conversations for sidebar when user loads
  useEffect(() => {
    if (!user) return;
    fetch(`${API_BASE}/agent-conversations/${user.id}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAgentConversations(data);
      })
      .catch(() => {});
    // Only depends on `user` — authHeaders is stable via hook memoization
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  function selectAgentConversation(convId) {
    setActiveAgentConversationId(convId);
    try { localStorage.setItem("lastAgentConversationId", convId); } catch {}
    // fetch messages
    fetch(`${API_BASE}/agent-conversations/${convId}/messages`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((msgs) => setAgentMessages(Array.isArray(msgs) ? msgs : []))
      .catch(() => setAgentMessages([]));
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

  async function sendAgentChat() {
    if (!agentPrompt.trim()) return;
    const content = agentPrompt.trim();
    // immediate UI feedback: clear input and show user message
    setAgentPrompt("");
    const tempId = `temp-${Date.now()}`;
    setAgentMessages((prev) => [...prev, { id: tempId, role: "user", content, created_at: new Date().toISOString() }]);
    setSendingAgent(true);
    try {
      // ensure we have an agent conversation id (create if missing)
      if (!activeAgentConversationId) {
        const resNew = await fetch(`${API_BASE}/agent-conversations/new`, { method: 'POST', headers: { ...authHeaders() } });
        const dataNew = await resNew.json();
        if (resNew.ok && dataNew.agent_conversation_id) {
          setActiveAgentConversationId(dataNew.agent_conversation_id);
          try { localStorage.setItem('lastAgentConversationId', dataNew.agent_conversation_id); } catch {}
        }
      }

      const form = new FormData();
      form.append("prompt", agentPrompt.trim());
      if (typeof window !== "undefined") {
		// attach up to 2 images only
        if (agentFiles) {
          for (let i = 0; i < agentFiles.length && i < 2; i++) {
            const f = agentFiles[i];
            if (f.type && f.type.startsWith("image/")) {
              form.append("image", f);
            }
          }
        }
      }
      setAgentFiles(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Attach agent conversation id (should exist now)
      if (activeAgentConversationId) {
        form.append("agent_conversation_id", activeAgentConversationId);
      }

      const res = await fetch(`${API_BASE}/agent-chat`, {
        method: "POST",
        headers: { ...authHeaders() },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent chat failed");
      const id = data.agent_chat_id;
      setAgentChatId(id);
      // optimistic placeholder + start polling until outputs are available
      setAgentOutputs([{ id: `pending-${Date.now()}`, type: "text", content: "Agent running..." }]);
      // Poll outputs endpoint until we get results or timeout
      const maxAttempts = 60; // ~60s
      let attempts = 0;
      let finalOuts = [];
      while (attempts < maxAttempts) {
        try {
          // wait a bit between attempts (1s)
          // first attempt should check immediately
          if (attempts > 0) await new Promise((res) => setTimeout(res, 1000));
          const resp = await fetch(`${API_BASE}/agent-chat/${id}/outputs`, { headers: { ...authHeaders() } });
          if (!resp.ok) {
            attempts++;
            continue;
          }
          const outs = await resp.json();
          if (Array.isArray(outs) && outs.length > 0) {
            finalOuts = outs;
            break;
          }
        } catch (err) {
          // ignore and retry
        }
        attempts++;
      }
      if (finalOuts.length > 0) {
        setAgentOutputs(finalOuts);
        // refresh agent messages for the conversation to show model messages saved server-side
        if (activeAgentConversationId) {
          try {
            const msgs = await fetch(`${API_BASE}/agent-conversations/${activeAgentConversationId}/messages`, { headers: { ...authHeaders() } }).then((r) => r.json());
            setAgentMessages(Array.isArray(msgs) ? msgs : []);
          } catch (_) {}
        }
      } else {
        // timeout, show helpful message
        setAgentOutputs([{ id: `timeout-${Date.now()}`, type: "text", content: "No response yet — please check server or try again." }]);
      }
    } catch (e) {
      setAgentOutputs([{ id: `err-${Date.now()}`, type: "text", content: `Error: ${e.message}` }]);
    } finally {
      setSendingAgent(false);
    }
  }
  
  function renderAgentOutputs() {
    if (!agentOutputs || agentOutputs.length === 0) return null;
    return (
      <div className="mx-auto mt-4 w-full max-w-4xl">
        <h3 className="text-sm text-slate-300 mb-2">Agent Outputs</h3>
        <div className="grid grid-cols-1 gap-3">
          {agentOutputs.map((o, idx) => (
            <div key={o.id || idx} className="rounded-lg border p-3 bg-black/30">
              {o.type === 'image' || (o.url && o.url.match(/\.(png|jpe?g|webp|gif)(\?.*)?$/i)) ? (
                <img src={resolveMediaUrl(o.url)} alt={o.content || 'image'} className="max-h-64 w-auto rounded" />
              ) : o.type === 'video' || (o.url && o.url.match(/\.(mp4|webm)(\?.*)?$/i)) ? (
                <video controls src={resolveMediaUrl(o.url)} className="max-h-64 w-full rounded" />
              ) : o.type === 'text' || o.content ? (
                <div className="whitespace-pre-wrap text-slate-200">{o.content || o.url}</div>
              ) : o.url ? (
                <a href={resolveMediaUrl(o.url)} target="_blank" rel="noreferrer" className="text-sky-400">Open</a>
              ) : (
                <pre className="text-slate-200">{JSON.stringify(o)}</pre>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  function renderMain() {
    return (
      <section className="flex h-full flex-1">
        {/* Agent messages column: scrollable independently */}
        <div className="flex-1 overflow-y-auto p-4 pb-28" style={{ height: 'calc(100vh - 96px)' }}>
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {agentMessages.length === 0 && (
              <div className="mt-16 rounded-2xl border border-slate-800/60 bg-black/30 p-8 text-center text-slate-400">
                Start an Agent conversation
              </div>
            )}
            {(() => {
              // Deduplicate model messages that are also present in agentOutputs to avoid showing the same text twice
              const outputContents = new Set((agentOutputs || []).map((o) => ((o.content || o.url) + "").trim()));
              const dedupedAgentMessages = (agentMessages || []).filter((m) => {
                if (m.role === "model") {
                  const c = ((m.content || m.url) + "").trim();
                  return !outputContents.has(c);
                }
                return true;
              });
              return dedupedAgentMessages.map((m) => (
                <MessageBubble key={m.id || m.created_at} msg={{ role: m.role, content: m.content, url: m.url, type: m.type }} />
              ));
            })()}
            {renderAgentOutputs()}
          </div>
        </div>
        {/* Fixed agent composer - positioned at viewport bottom */}
        <div className="fixed left-0 right-0 bottom-0 z-40 px-4 py-3 bg-transparent">
          <div className="mx-auto w-full max-w-4xl px-0">
            {agentFilePreviews.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-slate-800/60 bg-black/30 p-2">
                {agentFilePreviews.map((preview) => (
                  <div key={preview.url} className="overflow-hidden rounded-lg border border-slate-700/70 bg-slate-900/60">
                    <img src={preview.url} alt={preview.name} className="h-16 w-16 object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={chatInputRef}
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
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
                    sendAgentChat();
                  }
                }}
                rows={1}
                placeholder="Message Agent..."
                className="card-glow glass w-full rounded-xl border px-3 py-3 text-slate-100 outline-none"
              />

              <div className="flex items-center gap-2">
                <button className="btn-neon h-[48px] min-w-[48px]" onClick={() => fileInputRef.current?.click()} title="Attach image">📎</button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => setAgentFiles(pickAgentImages(e.target.files))} className="hidden" />
                <button onClick={sendAgentChat} disabled={sendingAgent} className="btn-neon h-[48px] min-w-[90px]">{sendingAgent ? "Sending" : "Send"}</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Auto-scroll to bottom when new agent messages arrive
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
  }, [agentMessages]);

  useEffect(() => {
    if (!agentFiles || agentFiles.length === 0) {
      setAgentFilePreviews([]);
      return;
    }

    const nextPreviews = Array.from(agentFiles)
      .filter((file) => file.type && file.type.startsWith("image/"))
      .slice(0, 2)
      .map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));

    setAgentFilePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [agentFiles]);

  // Restore last agent conversation via URL or localStorage once user is loaded
  useEffect(() => {
    if (!user) return;
    let urlConv = null;
    try {
      const usp = new URLSearchParams(window.location.search);
      urlConv = usp.get("a") || usp.get("agent_conversation_id");
    } catch (_) {}

    const stored = typeof window !== "undefined" ? localStorage.getItem("lastAgentConversationId") : null;
    const defaultConv = urlConv || stored;

    if (defaultConv && !activeAgentConversationId) {
      selectAgentConversation(defaultConv);
      // update URL to include agent conversation param 'a' like /agentChats?a=<id>
      try {
        const usp = new URLSearchParams(window.location.search);
        usp.set('a', defaultConv);
        const qs = usp.toString();
        const newUrl = qs ? `/agentChats?${qs}` : '/agentChats';
        window.history.replaceState({}, '', newUrl);
      } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="flex min-h-[100svh]">
      <NavBar 
        user={user} 
        currentPage="agent-chats" 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <div className="flex flex-1 pt-16">
        <Sidebar 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          authHeaders={authHeaders}
          mode="agent"
          activeAgentConversationId={activeAgentConversationId}
          onSelectAgentConversation={selectAgentConversation}
          onNewAgent={async () => {
            const res = await fetch(`${API_BASE}/agent-conversations/new`, { method: 'POST', headers: { ...authHeaders() } });
            const data = await res.json();
            if (res.ok && data.agent_conversation_id) {
              selectAgentConversation(data.agent_conversation_id);
              // refresh sidebar list
              const list = await fetch(`${API_BASE}/agent-conversations/${user.id}`, { headers: { ...authHeaders() } }).then(r=>r.json());
              setAgentConversations(Array.isArray(list)?list:[]);
            }
          }}
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

