"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import { API_BASE, resolveMediaUrl } from "@/lib/media";

function formatDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso || ""; }
}

function formatDayLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown Date";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  if (normalized.getTime() === today.getTime()) return "Today";
  if (normalized.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function dayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function isWithinDateRange(iso, range) {
  if (range === "all") return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  const days = Number(range);
  if (!Number.isFinite(days)) return true;
  const threshold = new Date(now);
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - days + 1);
  return date >= threshold;
}

function mediaURL(it) {
  if (!it) return "#";
  const raw = it.direct_url || it.url;
  if (raw) return resolveMediaUrl(raw.startsWith("/") ? raw : raw);
  if (it.local_path) return resolveMediaUrl(`/media/${it.local_path.replace(/^\\+|^\/+/, "")}`);
  return "#";
}

function renderThumb(it) {
  const src = mediaURL(it);
  const contentType = it.content_type || it.type;
  if (contentType === "image") {
    return <img src={src} alt={it.prompt?.slice(0, 40) || "image"} className="h-40 w-full rounded-lg object-cover" />;
  }
  if (contentType === "video") {
    return (
      <video src={src} className="h-40 w-full rounded-lg object-cover" muted playsInline preload="metadata" />
    );
  }
  if (contentType === "audio") {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg bg-black/30">
        <audio src={src} controls className="w-full" />
      </div>
    );
  }
  return (
    <div className="h-40 w-full overflow-hidden rounded-lg bg-black/30 p-3 text-xs text-slate-300">
      {(it.prompt || it.provider || it.model || "").slice(0, 220)}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfilePageContent />
    </AuthGuard>
  );
}

function ProfilePageContent() {
  const { user, authHeaders } = useAuth();

  // Library state
  const [items, setItems] = useState([]);
  const [loadingLib, setLoadingLib] = useState(true);
  const [generationFilter, setGenerationFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // MCP state
  const [mcps, setMcps] = useState([]);
  const [mcpName, setMcpName] = useState("");
  const [mcpEndpoint, setMcpEndpoint] = useState("");
  const [mcpAuth, setMcpAuth] = useState("");
  const [loadingMcps, setLoadingMcps] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function loadLib() {
      setLoadingLib(true);
      try {
        const res = await fetch(`${API_BASE}/library/content`, { headers: { ...authHeaders() } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load library');
        const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (active) setItems(arr);
      } catch (e) {
        console.error(e);
      } finally { if (active) setLoadingLib(false); }
    }
    loadLib();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function loadMcps() {
      setLoadingMcps(true);
      try {
        const res = await fetch(`${API_BASE}/users/${user.id}/mcps`, { headers: { ...authHeaders() } });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load mcps');
        // log raw returned MCPs for debugging unexpected entries
        if (process.env.NODE_ENV === 'development') console.debug('Profile: raw mcps from backend', data);
        if (active) setMcps(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally { if (active) setLoadingMcps(false); }
    }
    loadMcps();
    return () => { active = false; };
  }, [user]);

  async function createMcp(e) {
    e.preventDefault();
    if (!user) return;
    // require name, endpoint and auth token
    if (!mcpName || !mcpName.trim() || !mcpEndpoint || !mcpEndpoint.trim() || !mcpAuth || !mcpAuth.trim()) {
      alert('Please provide Name, Endpoint and Auth token before adding an MCP.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/mcps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: mcpName, endpoint: mcpEndpoint, auth_token: mcpAuth })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create mcp');
      setMcps((s) => [data, ...s]);
      setMcpName(''); setMcpEndpoint(''); setMcpAuth('');
    } catch (e) { console.error(e); alert(e.message); }
  }

  async function deleteMcp(id) {
    if (!user) return;
    if (!confirm('Delete this MCP?')) return;
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/mcps/${id}`, { method: 'DELETE', headers: { ...authHeaders() } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // show backend error without throwing (prevents Next dev overlay)
        alert(data?.error || 'Failed to delete');
        return;
      }
      setMcps((s) => s.filter((m) => m.id !== id));
    } catch (e) { console.error(e); alert(e.message); }
  }

  // helper to validate MCP objects returned by backend
  function isValidMcp(obj) {
    if (!obj) return false;
    // must have an id that looks like a uuid (simple regex) and a non-empty name
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof obj.id !== 'string' || !uuidRe.test(obj.id)) return false;
    if (typeof obj.name !== 'string' || obj.name.trim() === '') return false;
    // endpoint should look like a URL or path
    if (typeof obj.endpoint !== 'string') return false;
    const ep = obj.endpoint.trim();
    if (!(ep.startsWith('/') || ep.startsWith('http') || ep.includes('://') || ep.includes(':'))) return false;
    return true;
  }

  const displayedMcps = (() => {
    const valids = mcps.filter(isValidMcp);
    const invalids = mcps.filter((m) => !isValidMcp(m));
    if (invalids.length > 0) {
      console.warn("Profile: filtered out invalid MCP entries:", invalids);
    }
    return valids;
  })();

  const generationOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((it) => it.model).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesGeneration = generationFilter === "all" || it.model === generationFilter;
      const matchesDate = isWithinDateRange(it.created_at, dateFilter);
      return matchesGeneration && matchesDate;
    });
  }, [dateFilter, generationFilter, items]);

  const groupedItems = useMemo(() => {
    const groups = new Map();
    for (const item of filteredItems) {
      const key = dayKey(item.created_at);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: formatDayLabel(item.created_at),
          items: [],
        });
      }
      groups.get(key).items.push(item);
    }
    return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredItems]);

  return (
    <div className="relative mx-auto min-h-[100svh] w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="neon-text text-2xl font-bold text-sky-300">Profile</h1>
        <Link href="/chat" className="btn-neon">Back to Chat</Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card-glow glass col-span-1 rounded-2xl p-4">
          <h2 className="text-lg font-semibold text-sky-300">Account</h2>
          <div className="mt-3 text-sm text-slate-300 space-y-2">
            <div><strong>Username:</strong> {user?.username}</div>
            <div><strong>Email:</strong> {user?.email}</div>
            <div><strong>Role:</strong> {user?.role}</div>
            <div><strong>ID:</strong> <code className="text-xs">{user?.id}</code></div>
          </div>

          <hr className="my-4 border-slate-800/50" />

          <h2 className="text-lg font-semibold text-sky-300">MCPs</h2>
          <form onSubmit={createMcp} className="mb-4 mt-2 flex flex-wrap items-center gap-2">
            <input value={mcpName} onChange={(e) => setMcpName(e.target.value)} placeholder="Name" className="rounded-md border px-3 py-2 text-sm" />
            <input value={mcpEndpoint} onChange={(e) => setMcpEndpoint(e.target.value)} placeholder="Endpoint URL" className="rounded-md border px-3 py-2 text-sm w-full" />
            <input value={mcpAuth} onChange={(e) => setMcpAuth(e.target.value)} placeholder="Auth token (optional)" className="rounded-md border px-3 py-2 text-sm w-full" />
            <button className="btn-neon px-4 py-2 disabled:opacity-40" type="submit" disabled={!mcpName.trim() || !mcpEndpoint.trim() || !mcpAuth.trim()}>Add MCP</button>
          </form>

          {loadingMcps ? <div className="text-slate-400">Loading MCPs...</div> : (
            <div className="space-y-3">
              {displayedMcps.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border border-slate-800/60 p-2">
                  <div>
                    <div className="text-sm text-sky-300">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.endpoint}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* <Link href={m.endpoint} className="btn-neon px-3 py-1 text-sm" target="_blank">Open</Link> */}
                    <button className="btn-neon px-3 py-1 text-sm" onClick={() => deleteMcp(m.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-glow glass col-span-2 rounded-2xl p-4 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-sky-300">Library</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={generationFilter}
                onChange={(e) => setGenerationFilter(e.target.value)}
                className="rounded-md border border-slate-800/60 bg-black/40 px-3 py-2 text-sm text-slate-200"
              >
                <option value="all">All Generations</option>
                {generationOptions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-md border border-slate-800/60 bg-black/40 px-3 py-2 text-sm text-slate-200"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
              </select>
            </div>
          </div>

          <div className="mt-3 text-sm text-slate-400">
            Showing {filteredItems.length} of {items.length} item{items.length === 1 ? "" : "s"}
          </div>

          {loadingLib ? <div className="text-slate-400">Loading...</div> : groupedItems.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-800/60 bg-black/30 p-6 text-slate-400">
              No library items match the selected filters.
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {groupedItems.map((group) => (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300/90">{group.label}</h3>
                    <span className="text-xs text-slate-500">{group.items.length} item{group.items.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {group.items.map((it) => {
                      const url = mediaURL(it);
                      return (
                        <div key={it.id} className="card-glow glass rounded-2xl p-3">
                          {renderThumb(it)}
                          <div className="mt-3 space-y-1 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sky-300">{it.content_type || it.type}</span>
                              <span className="text-slate-400">{formatDate(it.created_at)}</span>
                            </div>
                            <div className="truncate text-slate-300/90" title={it.title || it.prompt}>{it.title || it.prompt}</div>
                            {it.model && (
                              <div className="text-xs text-slate-400">{it.model} {it.variant && `• ${it.variant}`}</div>
                            )}
                            <div className="flex items-center gap-2 pt-2">
                              <a className="btn-neon px-3 py-1 text-sm" href={url} target="_blank" rel="noreferrer">Open</a>
                              <a className="btn-neon px-3 py-1 text-sm" href={url} download>Download</a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
} 