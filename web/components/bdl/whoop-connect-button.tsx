"use client";

// WhoopConnectButton — renders a "Connect Whoop" link (GET /api/whoop/auth)
// or a "Disconnect" button (POST /api/whoop/disconnect) depending on
// whether the player currently has Whoop connected.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WhoopConnectButton({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch("/api/whoop/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (connected) {
    return (
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[11.5px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:border-[color:var(--down)] transition-colors disabled:opacity-50"
      >
        {loading ? "Disconnecting…" : "Disconnect Whoop"}
      </button>
    );
  }

  return (
    <a
      href="/api/whoop/auth"
      className="inline-flex items-center gap-2 h-8 px-3 rounded-[var(--r-lg)] bg-[#000] hover:bg-[#1a1a1a] text-white text-[11.5px] font-bold tracking-[0.06em] uppercase transition-colors"
    >
      {/* Whoop wordmark W */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
      </svg>
      Connect Whoop
    </a>
  );
}
