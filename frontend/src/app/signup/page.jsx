"use client";

import { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      localStorage.setItem("token", data.token);
      window.location.href = "/chat";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(800px_200px_at_50%_0%,rgba(14,165,233,0.10),transparent)]" />
      {/* Cursor glow handled globally by layout */}

      <div className="card-glow glass w-full max-w-md rounded-2xl p-6 sm:p-8">
        <h1 className="neon-text text-center text-2xl font-bold text-electric-300">Create account</h1>
        <p className="mt-2 text-center text-slate-300/80">Join the neon grid</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="card-glow w-full rounded-lg border border-slate-800/60 bg-black/40 px-3 py-2 text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-electric-500/40 focus:shadow-[0_0_0_2px_rgba(14,165,233,0.25)]"
              placeholder="neo_user"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="card-glow w-full rounded-lg border border-slate-800/60 bg-black/40 px-3 py-2 text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-electric-500/40 focus:shadow-[0_0_0_2px_rgba(14,165,233,0.25)]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="card-glow w-full rounded-lg border border-slate-800/60 bg-black/40 px-3 py-2 text-slate-100 outline-none ring-0 transition placeholder:text-slate-500 focus:border-electric-500/40 focus:shadow-[0_0_0_2px_rgba(14,165,233,0.25)]"
              placeholder="••••••••"
            />
          </div>

          <button disabled={loading} className="btn-neon w-full">
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account? <Link className="text-electric-300 hover:underline" href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

