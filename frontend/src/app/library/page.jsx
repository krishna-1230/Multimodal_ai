"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE, resolveMediaUrl } from "@/lib/media";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "";
  }
}

export default function LibraryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const token = useMemo(() => (typeof window !== "undefined" ? localStorage.getItem("token") : null), []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        let url = `${API_BASE}/library/content`;
        if (filter !== "all") {
          url += `?type=${filter}`;
        }
        
        let res = await fetch(url, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        let data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load library");
        const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (active) setItems(arr);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [filter, token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      (it.prompt || "").toLowerCase().includes(q) ||
      (it.model || "").toLowerCase().includes(q) ||
      (it.variant || "").toLowerCase().includes(q) ||
      (it.title || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  function mediaURL(it) {
    // Use direct_url for library content, fallback to old fields for backward compatibility
    if (it.direct_url) return resolveMediaUrl(it.direct_url);
    if (it.url) return resolveMediaUrl(it.url);
    if (it.local_path) return resolveMediaUrl(`/media/${it.local_path.replace(/^\\+|^\/+/, "")}`);
    return "#";
  }

  function renderThumb(it) {
    const src = mediaURL(it);
    const contentType = it.content_type || it.type; // Handle both old and new structure
    
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

  function copyLink(url) {
    try {
      navigator.clipboard.writeText(url);
    } catch {}
  }

  return (
    <div className="relative mx-auto min-h-[100svh] w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="neon-text text-2xl font-bold text-sky-300">Library</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-slate-800/60 bg-black/40 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
            <option value="text">Text</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompt/model..."
            className="card-glow glass rounded-md border px-3 py-2 text-sm"
          />
          <Link className="btn-neon" href="/chat">Back to Chat</Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800/60 bg-black/30 p-8 text-slate-400">
          No items found.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => {
            const url = mediaURL(it);
            return (
              <div key={it.id} className="card-glow glass group rounded-2xl p-3">
                {renderThumb(it)}
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sky-300">{it.content_type || it.type}</span>
                    <span className="text-slate-400">{formatDate(it.created_at)}</span>
                  </div>
                  <div className="truncate text-slate-300/90" title={it.title || it.prompt}>
                    {it.title || it.prompt}
                  </div>
                  {it.model && (
                    <div className="text-xs text-slate-400">
                      {it.model} {it.variant && `• ${it.variant}`}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <a className="btn-neon px-3 py-1 text-sm" href={url} target="_blank" rel="noreferrer">Open</a>
                    <a className="btn-neon px-3 py-1 text-sm" href={url} download>Download</a>
                    <button className="btn-neon px-3 py-1 text-sm" onClick={() => copyLink(url)}>Copy Link</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


