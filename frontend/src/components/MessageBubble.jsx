"use client";

import { useState } from "react";
import { resolveMediaUrl } from "@/lib/media";

/* ── Copy button ─────────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    try { navigator.clipboard.writeText(text); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="rounded px-2 py-0.5 font-mono text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/* ── Inline markdown: **bold**, *italic*, `code`, [link](url) ── */
function InlineContent({ text }) {
  if (!text) return null;
  // Order matters: ** before *, backtick first
  const re = /(`[^`\n]+`|\*\*[^\n]+?\*\*|\*[^*\n]+\*|\[([^\]]+)\]\(([^)]+)\))/g;
  const parts = [];
  let last = 0, idx = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={idx++}>{text.slice(last, m.index)}</span>);
    const raw = m[0];
    if (raw[0] === "`") {
      parts.push(
        <code key={idx++} className="rounded bg-slate-700/80 px-1 py-0.5 font-mono text-[0.82em] text-sky-200">
          {raw.slice(1, -1)}
        </code>
      );
    } else if (raw.startsWith("**")) {
      parts.push(<strong key={idx++} className="font-semibold text-slate-100">{raw.slice(2, -2)}</strong>);
    } else if (raw[0] === "*") {
      parts.push(<em key={idx++} className="italic text-slate-200">{raw.slice(1, -1)}</em>);
    } else if (raw[0] === "[") {
      parts.push(
        <a key={idx++} href={m[3]} target="_blank" rel="noreferrer" className="text-sky-300 underline hover:text-sky-200">
          {m[2]}
        </a>
      );
    }
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(<span key={idx}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

/* ── Fenced code block with language label + copy ─────────── */
function CodeBlock({ lang, code }) {
  const display = code.replace(/\n$/, "");
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-slate-700/80">
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5">
        <span className="font-mono text-xs text-slate-400">{lang || "code"}</span>
        <CopyButton text={display} />
      </div>
      <pre className="overflow-x-auto bg-[#0d1117] p-4 text-sm leading-relaxed">
        <code className="font-mono text-slate-200">{display}</code>
      </pre>
    </div>
  );
}

/* ── Block-level markdown renderer ────────────────────────── */
function TextBlocks({ text }) {
  const lines = text.split("\n");
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trim = line.trim();

    // blank line
    if (!trim) { i++; continue; }

    // Headings  # ## ### etc.
    const hm = trim.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      const lvl = hm[1].length;
      const cls = [
        "text-2xl font-bold", "text-xl font-bold", "text-lg font-semibold",
        "text-base font-semibold", "text-sm font-semibold", "text-sm font-semibold",
      ][lvl - 1] || "text-base font-semibold";
      result.push(
        <div key={`h-${i}`} className={`mt-3 mb-1 text-sky-300 ${cls}`}>
          <InlineContent text={hm[2]} />
        </div>
      );
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trim)) {
      result.push(<hr key={`hr-${i}`} className="my-3 border-slate-700" />);
      i++; continue;
    }

    // Blockquote
    if (trim.startsWith("> ")) {
      const bqLines = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        bqLines.push(lines[i].trim().slice(2));
        i++;
      }
      result.push(
        <blockquote key={`bq-${i}`} className="my-2 border-l-2 border-sky-500/60 pl-3 italic text-slate-300/80">
          {bqLines.map((l, j) => <div key={j}><InlineContent text={l} /></div>)}
        </blockquote>
      );
      continue;
    }

    // Unordered list  - * +
    if (/^\s*[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} className="my-2 list-disc space-y-0.5 pl-5 text-slate-200">
          {items.map((it, j) => <li key={j}><InlineContent text={it} /></li>)}
        </ul>
      );
      continue;
    }

    // Ordered list  1. 2. etc.
    if (/^\s*\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      result.push(
        <ol key={`ol-${i}`} className="my-2 list-decimal space-y-0.5 pl-5 text-slate-200">
          {items.map((it, j) => <li key={j}><InlineContent text={it} /></li>)}
        </ol>
      );
      continue;
    }

    // Paragraph — collect consecutive non-special lines
    const paraLines = [];
    while (i < lines.length) {
      const l = lines[i];
      const lt = l.trim();
      if (!lt) break;
      if (/^#{1,6}\s/.test(lt)) break;
      if (/^[-*_]{3,}$/.test(lt)) break;
      if (lt.startsWith("> ")) break;
      if (/^\s*[-*+]\s/.test(l)) break;
      if (/^\s*\d+\.\s/.test(l)) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      result.push(
        <p key={`p-${i}`} className="my-1 leading-relaxed text-slate-200">
          <InlineContent text={paraLines.join(" ")} />
        </p>
      );
    }
  }
  return <>{result}</>;
}

/* ── Split raw text into code-fence vs plain-text blocks ──── */
function parseBlocks(text) {
  const parts = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, m;
  while ((m = fenceRe.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: "text", s: text.slice(last, m.index) });
    parts.push({ t: "code", lang: m[1] || "", s: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ t: "text", s: text.slice(last) });
  return parts;
}

function MarkdownContent({ text }) {
  const blocks = parseBlocks(text || "");
  return (
    <div className="space-y-0.5">
      {blocks.map((b, i) =>
        b.t === "code"
          ? <CodeBlock key={i} lang={b.lang} code={b.s} />
          : <TextBlocks key={i} text={b.s} />
      )}
    </div>
  );
}

/* ── Main bubble ─────────────────────────────────────────── */
export default function MessageBubble({ msg }) {
  const isUser = msg.role === "user";

  const renderContent = () => {
    const rawUrl = msg.url || msg.content;
    const url = resolveMediaUrl(rawUrl);
    const typ = (msg.type || "").toLowerCase();
    if (typ === "image" || (rawUrl && /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(rawUrl))) {
      return <img src={url} alt="image" className="max-w-full rounded" />;
    }
    if (typ === "video" || (rawUrl && /\.(mp4|webm|ogg)(\?.*)?$/i.test(rawUrl))) {
      return <video controls src={url} className="max-w-full rounded" />;
    }
    return <MarkdownContent text={msg.content} />;
  };

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
          isUser
            ? "bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(14,165,233,0.18))] border border-sky-500/30"
            : "bg-black/30 border border-slate-800/60"
        }`}
      >
        {renderContent()}
      </div>
    </div>
  );
}
