"use client";

import { useEffect, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:1234";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Stable getter for token and headers to avoid changing function identities
  const getToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }, []);

  const authHeaders = useCallback(() => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthError("Not signed in");
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/me`, { headers: { ...authHeaders() } })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Auth failed");
        return r.json();
      })
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch((e) => {
        setAuthError(e.message);
        setLoading(false);
      });
  // authHeaders and getToken are stable via useCallback
  }, [authHeaders, getToken]);

  return { user, loading, authError, getToken, authHeaders };
}
