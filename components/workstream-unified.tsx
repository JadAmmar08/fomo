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

const SOURCE_META: Record<SourceKey, { name: string; icon: string; connectPath: string; pickPath: string; pickKey: "folderId" | "channelId"; nameKey: "folderName" | "channelName" }> = {
  google: { name: "Google Drive", icon: "📁", connectPath: "/api/integrations/google/connect", pickPath: "/api/integrations/google/folders", pickKey: "folderId", nameKey: "folderName" },
  microsoft: { name: "OneDrive", icon: "🗂️", connectPath: "/api/integrations/microsoft/connect", pickPath: "/api/integrations/microsoft/folders", pickKey: "folderId", nameKey: "folderName" },
  slack: { name: "Slack", icon: "#", connectPath: "/api/integrations/slack/connect", pickPath: "/api/integrations/slack/channels", pickKey: "channelId", nameKey: "channelName" }
};

function SourceChip({ source, status, roomId, onLinked }: { source: SourceKey; status: SourceStatus; roomId: string; onLinked: () => void }) {
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<Array<{ id: string; name: string }> | null>(null);
  const [linking, setLinking] = useState(false);
  const meta = SOURCE_META[source];

  async function openPicker() {
    setPicking(true);
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

  if (status.linked) {
    return (
      <span className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {meta.icon} {status.label}
      </span>
    );
  }

  if (status.connected) {
    return (
      <div style={{ position: "relative" }}>
        <button onClick={openPicker} className="chip" style={{ border: "1px dashed var(--line-strong)", cursor: "pointer" }}>
          {meta.icon} Pick {meta.name} folder{source === "slack" ? "'s channel" : ""} →
        </button>
        {picking && options && (
          <div style={{
            position: "absolute", top: "110%", left: 0, zIndex: 10, background: "white",
            border: "1px solid var(--line)", borderRadius: 12, padding: 8, minWidth: 220,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "grid", gap: 4, maxHeight: 240, overflowY: "auto"
          }}>
            {options.length === 0 && <span style={{ fontSize: "0.8rem", color: "var(--subtle)", padding: 6 }}>Nothing found</span>}
            {options.map((o) => (
              <button key={o.id} onClick={() => pick(o)} disabled={linking} style={{
                textAlign: "left", background: "none", border: "none", padding: "6px 8px",
                borderRadius: 8, cursor: linking ? "wait" : "pointer", fontSize: "0.85rem"
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
    <a href={`${meta.connectPath}?roomId=${roomId}`} className="chip" style={{ color: "var(--subtle)", border: "1px dashed var(--line)" }}>
      {meta.icon} Connect {meta.name}
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
        Workstream
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {(Object.keys(statuses) as SourceKey[]).map((key) => (
          <SourceChip key={key} source={key} status={statuses[key]} roomId={roomId} onLinked={loadStatuses} />
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
                  padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", color: "var(--text-strong)"
                }}>
                  <span>
                    <span style={{ color: "var(--subtle)", marginRight: 8 }}>{SOURCE_META[item.source].icon} {item.label}</span>
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
