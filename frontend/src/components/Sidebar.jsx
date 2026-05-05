"use client";

import { useState, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

export default function Sidebar({ 
  sidebarOpen, 
  setSidebarOpen, 
  user, 
  authHeaders, 
  mode,
  activeChatConversationId,
  activeRagConversationId,
  activeAgentConversationId,
  onSelectChatConversation,
  onSelectRagConversation,
  onSelectAgentConversation,
  onNewChat,
  onNewRag,
  onNewAgent
}) {
  const [chatConversations, setChatConversations] = useState([]);
  const [ragConversations, setRagConversations] = useState([]);
  const [agentConversations, setAgentConversations] = useState([]);
  const lastFetchedUserRef = useRef(null);

  // Load conversations when user changes
  useEffect(() => {
    if (!user) return;
    // avoid refetching repeatedly when parent re-renders rapidly
    if (lastFetchedUserRef.current === user.id) return;
    lastFetchedUserRef.current = user.id;

    // Load chat conversations
    fetch(`${API_BASE}/conversations/${user.id}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChatConversations(data);
      })
      .catch(() => {});

    // Load RAG conversations
    fetch(`${API_BASE}/rag/conversations/${user.id}`, { headers: { ...authHeaders() } })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRagConversations(data);
      })
      .catch(() => {});
    // only depend on `user`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Update chat conversations list when a new conversation is created
  useEffect(() => {
    if (activeChatConversationId && user) {
      fetch(`${API_BASE}/conversations/${user.id}`, { headers: { ...authHeaders() } })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setChatConversations(data);
        })
        .catch(() => {});
    }
  }, [activeChatConversationId, user, authHeaders]);

  // Update RAG conversations list when a new conversation is created
  useEffect(() => {
    if (activeRagConversationId && user) {
      fetch(`${API_BASE}/rag/conversations/${user.id}`, { headers: { ...authHeaders() } })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setRagConversations(data);
        })
        .catch(() => {});
    }
  }, [activeRagConversationId, user, authHeaders]);

  // Update agent conversations list when mode=agent or activeAgentConversationId changes
  useEffect(() => {
    if ((mode === "agent" || activeAgentConversationId) && user) {
      fetch(`${API_BASE}/agent-conversations/${user.id}`, { headers: { ...authHeaders() } })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setAgentConversations(data);
        })
        .catch(() => {});
    }
  }, [activeAgentConversationId, mode, user]);

  return (
    <aside className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden border-r border-slate-800/60 bg-black/70`}>
      <div className="p-3">
        <div className="mb-3 flex gap-2">
          {(mode === "chat" || !mode) && (
            <button 
              className="btn-neon flex-1" 
              onClick={() => onNewChat && onNewChat()}
            >
              New Chat
            </button>
          )}

          {mode === "agent" && (
            <button 
              className="btn-neon flex-1" 
              onClick={() => onNewAgent && onNewAgent()}
            >
              New Agent
            </button>
          )}

          {mode === "rag" && (
            <button 
              className="btn-neon flex-1" 
              onClick={() => onNewRag && onNewRag()}
            >
              New RAG
            </button>
          )}


        </div>
        
        {(mode === "chat" || !mode) && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-300">Chats</h3>
            <div className="space-y-2">
              {chatConversations.map((c) => (
                <button 
                  key={c.id} 
                  onClick={() => onSelectChatConversation && onSelectChatConversation(c.id)} 
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    activeChatConversationId === c.id 
                      ? "border-sky-500/40 bg-sky-500/10" 
                      : "border-sky-500/20 bg-black/30 hover:border-sky-500/30"
                  }`}
                >
                  <div className="truncate text-slate-200">{c.title || "(untitled)"}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {mode === "rag" && (
          <div>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-300">RAG Conversations</h3>
            <div className="space-y-2">
              {ragConversations.map((c) => (
                <button 
                  key={c.id} 
                  onClick={() => onSelectRagConversation && onSelectRagConversation(c.id)} 
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    activeRagConversationId === c.id 
                      ? "border-sky-500/40 bg-sky-500/10" 
                      : "border-sky-500/20 bg-black/30 hover:border-sky-500/30"
                  }`}
                >
                  <div className="truncate text-slate-200">{c.title || "(untitled)"}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "agent" && (
          <div>
            <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-300">Agent Conversations</h3>
            <div className="space-y-2">
              {agentConversations.map((c) => (
                <button 
                  key={c.id} 
                  onClick={() => onSelectAgentConversation && onSelectAgentConversation(c.id)} 
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    activeAgentConversationId === c.id 
                      ? "border-sky-500/40 bg-sky-500/10" 
                      : "border-sky-500/20 bg-black/30 hover:border-sky-500/30"
                  }`}
                >
                  <div className="truncate text-slate-200">{c.title || "(untitled)"}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
