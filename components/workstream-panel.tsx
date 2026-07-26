"use client";

import { useEffect, useState } from "react";

interface Folder {
  id: string;
  name: string;
}

interface FoldersResponse {
  connected: boolean;
  linkedFolderId?: string | null;
  folders?: Folder[];
  error?: string;
}

interface SummaryResponse {
  connected: boolean;
  linked?: boolean;
  folderName?: string;
  summary?: string | null;
  files?: Array<{ name: string; modifiedTime: string; webViewLink: string }>;
  error?: string;
}

export function WorkstreamPanel({ roomId }: { roomId: string }) {
  const [folders, setFolders] = useState<FoldersResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetch(`/api/integrations/google/folders?roomId=${roomId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setFolders)
      .catch(() => setFolders({ connected: false }))
      .finally(() => setLoading(false));
  }, [roomId]);

  useEffect(() => {
    if (folders?.linkedFolderId) {
      fetch(`/api/integrations/google/summary?roomId=${roomId}`, { credentials: "include" })
        .then((r) => r.json())
        .then(setSummary)
        .catch(() => setSummary(null));
    }
  }, [folders?.linkedFolderId, roomId]);

  async function linkFolder(folder: Folder) {
    setLinking(true);
    await fetch("/api/integrations/google/folders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, folderId: folder.id, folderName: folder.name })
    });
    setFolders((prev) => (prev ? { ...prev, linkedFolderId: folder.id } : prev));
    setLinking(false);
  }

  if (loading) return null;

  return (
    <section data-reveal style={{
      background: "white", borderRadius: 20, border: "1px solid var(--line)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
        Workstream (beta)
      </div>

      {!folders?.connected ? (
        <>
          <h2 style={{ marginBottom: 8 }}>Connect Google Drive.</h2>
          <p style={{ maxWidth: 480, marginBottom: 20 }}>
            Pick one shared folder this team already uses — FOMO only ever reads that folder, never your whole Drive. Read-only, never edits or deletes anything.
          </p>
          <a href={`/api/integrations/google/connect?roomId=${roomId}`} className="button-secondary" style={{ display: "inline-flex" }}>
            Connect Google Drive →
          </a>
        </>
      ) : !folders.linkedFolderId ? (
        <>
          <h2 style={{ marginBottom: 8 }}>Pick this team&apos;s folder.</h2>
          <p style={{ maxWidth: 480, marginBottom: 20 }}>
            Choose the shared folder this team already uses for its work — only files in this folder will ever be read.
          </p>
          <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }}>
            {folders.folders?.map((f) => (
              <button
                key={f.id}
                onClick={() => linkFolder(f)}
                disabled={linking}
                className="button-secondary"
                style={{ justifyContent: "flex-start", cursor: linking ? "wait" : "pointer" }}
              >
                📁 {f.name}
              </button>
            ))}
            {folders.folders?.length === 0 && (
              <p style={{ color: "var(--subtle)", fontSize: "0.9rem" }}>
                No folders found in this Drive account.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: "0.85rem", color: "var(--subtle)", marginBottom: 12 }}>
            Reading 📁 {folders.folders?.find((f) => f.id === folders.linkedFolderId)?.name ?? summary?.folderName}
          </p>
          {summary?.summary ? (
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontStyle: "italic", lineHeight: 1.7, marginBottom: 24, color: "var(--text)" }}>
              {summary.summary}
            </p>
          ) : (
            <p style={{ marginBottom: 20 }}>No recent activity found in this folder yet.</p>
          )}
          {summary?.files && summary.files.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {summary.files.slice(0, 5).map((f, i) => (
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
        </>
      )}
    </section>
  );
}
