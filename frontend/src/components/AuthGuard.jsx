"use client";

import { useAuth } from "@/hooks/useAuth";

export default function AuthGuard({ children }) {
  const { user, loading, authError } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-6">
        <div className="card-glow glass w-full max-w-md rounded-2xl p-6 text-center">
          <div className="animate-pulse text-slate-300">Loading...</div>
        </div>
      </div>
    );
  }

  if (authError || !user) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-6">
        <div className="card-glow glass w-full max-w-md rounded-2xl p-6 text-center">
          <h1 className="neon-text text-xl font-semibold text-sky-300">Authentication required</h1>
          <p className="mt-2 text-slate-300/80">{authError || "Please sign in first."}</p>
          <a href="/login" className="btn-neon mt-6 inline-block">Go to Login</a>
        </div>
      </div>
    );
  }

  return children;
}
