"use client";

import { useEffect, useState } from "react";

interface SummaryResponse {
  connected: boolean;
  summary?: string | null;
  files?: Array<{ name: string; modifiedTime: string; webViewLink: string }>;
  error?: string;
}

export function WorkstreamPanel({ roomId }: { roomId: string }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/integrations/google/summary?roomId=${roomId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ connected: false }))
      .finally(() => setLoading(false));
  }, [roomId]);

  if (loading) return null;

  if (!data?.connected) {
    return (
      <section data-reveal style={{
        background: "white", borderRadius: 20, border: "1px solid var(--line)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
          Workstream (beta)
        </div>
        <h2 style={{ marginBottom: 8 }}>Connect Google Drive.</h2>
        <p style={{ maxWidth: 480, marginBottom: 20 }}>
          See a live summary of what&apos;s been worked on and by whom, pulled from recent file activity. Read-only — FOMO never edits or deletes anything in your Drive.
        </p>
        <a href={`/api/integrations/google/connect?roomId=${roomId}`} className="button-secondary" style={{ display: "inline-flex" }}>
          Connect Google Drive →
        </a>
      </section>
    );
  }

  return (
    <section data-reveal style={{
      background: "white", borderRadius: 20, border: "1px solid var(--line)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
        Workstream (beta)
      </div>
      {data.summary ? (
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontStyle: "italic", lineHeight: 1.7, marginBottom: 24, color: "var(--text)" }}>
          {data.summary}
        </p>
      ) : (
        <p style={{ marginBottom: 20 }}>Connected, but no recent Drive activity found yet.</p>
      )}
      {data.files && data.files.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {data.files.slice(0, 5).map((f, i) => (
            <a key={i} href={f.webViewLink} target="_blank" rel="noreferrer" style={{
              display: "flex", justifyContent: "space-between", fontSize: "0.85rem",
              padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", color: "var(--text-strong)"
            }}>
              <span>{f.name}</span>
              <span style={{ color: "var(--subtle)" }}>{new Date(f.modifiedTime).toLocaleDateString()}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
