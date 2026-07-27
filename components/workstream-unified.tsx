"use client";

import { useEffect, useState } from "react";

type SourceKey = "google" | "slack" | "microsoft";

interface SourceStatus {
  connected: boolean;
  linked: boolean;
  label: string;
}

type Statuses = Record<SourceKey, SourceStatus>;

interface WorkstreamItem {
  source: SourceKey;
  label: string;
  name: string;
  modifiedTime: string;
  link: string;
}

const SOURCE_META: Record<SourceKey, {
  name: string;
  color: string;
  connectPath: string;
  pickPath: string;
  pickKey: "folderId" | "channelId";
  nameKey: "folderName" | "channelName";
  pickVerb: string;
}> = {
  google: { name: "Google Drive", color: "#4285F4", connectPath: "/api/integrations/google/connect", pickPath: "/api/integrations/google/folders", pickKey: "folderId", nameKey: "folderName", pickVerb: "Choose a folder" },
  microsoft: { name: "OneDrive", color: "#0078D4", connectPath: "/api/integrations/microsoft/connect", pickPath: "/api/integrations/microsoft/folders", pickKey: "folderId", nameKey: "folderName", pickVerb: "Choose a folder" },
  slack: { name: "Slack", color: "#611f69", connectPath: "/api/integrations/slack/connect", pickPath: "/api/integrations/slack/channels", pickKey: "channelId", nameKey: "channelName", pickVerb: "Choose a channel" }
};

function SourceDot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function SourceCard({ source, status, roomId, onLinked }: { source: SourceKey; status: SourceStatus; roomId: string; onLinked: () => void }) {
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; name: string }> | null>(null);
  const [linking, setLinking] = useState(false);
  const meta = SOURCE_META[source];

  async function openPicker() {
    setPicking((v) => !v);
    if (options) return;
    const res = await fetch(`${meta.pickPath}?roomId=${roomId}`, { credentials: "include" });
    const data = await res.json();
    setOptions((data.folders ?? data.channels ?? []).map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
  }

  async function pick(option: { id: string; name: string }) {
    setLinking(true);
    await fetch(meta.pickPath, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, [meta.pickKey]: option.id, [meta.nameKey]: option.name })
    });
    setLinking(false);
    setPicking(false);
    onLinked();
  }

  const baseStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 6, padding: "12px 16px", borderRadius: 14,
    border: "1px solid var(--line)", background: "var(--surface-raised)", minWidth: 168, position: "relative"
  };

  if (status.linked) {
    return (
      <div style={baseStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <SourceDot color={meta.color} /> {meta.name}
        </span>
        <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-strong)" }}>{status.label}</span>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div style={baseStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <SourceDot color={meta.color} /> {meta.name}
        </span>
        <button
          onClick={openPicker}
          style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.88rem", fontWeight: 600, color: "var(--accent)" }}
        >
          {meta.pickVerb} →
        </button>
        {picking && (
          <div style={{
            position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 10, background: "white",
            border: "1px solid var(--line)", borderRadius: 12, padding: 6, minWidth: 220,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "grid", gap: 2, maxHeight: 240, overflowY: "auto"
          }}>
            {options === null && <span style={{ fontSize: "0.8rem", color: "var(--subtle)", padding: 8 }}>Loading…</span>}
            {options?.length === 0 && <span style={{ fontSize: "0.8rem", color: "var(--subtle)", padding: 8 }}>Nothing found</span>}
            {options?.map((o) => (
              <button key={o.id} onClick={() => pick(o)} disabled={linking} style={{
                textAlign: "left", background: "none", border: "none", padding: "8px 10px",
                borderRadius: 8, cursor: linking ? "wait" : "pointer", fontSize: "0.85rem", color: "var(--text-strong)"
              }}>
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <a href={`${meta.connectPath}?roomId=${roomId}`} style={{ ...baseStyle, textDecoration: "none" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", color: "var(--subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <SourceDot color={meta.color} /> {meta.name}
      </span>
      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-strong)" }}>Connect →</span>
    </a>
  );
}

export function WorkstreamUnified({ roomId }: { roomId: string }) {
  const [statuses, setStatuses] = useState<Statuses | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [items, setItems] = useState<WorkstreamItem[]>([]);
  const [loading, setLoading] = useState(true);

  function loadStatuses() {
    fetch(`/api/workstream/status?roomId=${roomId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setStatuses)
      .finally(() => setLoading(false));
  }

  useEffect(loadStatuses, [roomId]);

  const anyLinked = statuses && Object.values(statuses).some((s) => s.linked);

  useEffect(() => {
    if (!anyLinked) return;
    fetch(`/api/workstream?roomId=${roomId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary ?? null);
        setItems(data.items ?? []);
      });
  }, [anyLinked, roomId]);

  if (loading || !statuses) return null;

  return (
    <section data-reveal style={{
      background: "white", borderRadius: 20, border: "1px solid var(--line)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
        Workstream
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--subtle)", marginBottom: 20, maxWidth: 480 }}>
        Connect the tools this team already uses — FOMO reads only what&apos;s explicitly linked below.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        {(Object.keys(statuses) as SourceKey[]).map((key) => (
          <SourceCard key={key} source={key} status={statuses[key]} roomId={roomId} onLinked={loadStatuses} />
        ))}
      </div>

      {!anyLinked ? (
        <p style={{ maxWidth: 480, color: "var(--subtle)" }}>
          Connect at least one tool above to see a live picture of this team&apos;s work — what&apos;s active, what overlaps, what&apos;s stalled.
        </p>
      ) : summary ? (
        <>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontStyle: "italic", lineHeight: 1.7, marginBottom: 24, color: "var(--text)" }}>
            {summary}
          </p>
          {items.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {items.slice(0, 8).map((item, i) => (
                <a key={i} href={item.link} target="_blank" rel="noreferrer" style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem",
                  padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", color: "var(--text-strong)", textDecoration: "none"
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SourceDot color={SOURCE_META[item.source].color} />
                    <span style={{ color: "var(--subtle)" }}>{item.label}</span>
                    {item.name}
                  </span>
                  <span style={{ color: "var(--subtle)" }}>{new Date(item.modifiedTime).toLocaleDateString()}</span>
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <p style={{ color: "var(--subtle)" }}>No recent activity found yet in the connected sources.</p>
      )}
    </section>
  );
}
