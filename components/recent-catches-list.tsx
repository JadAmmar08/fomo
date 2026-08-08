"use client";

import { useState } from "react";

interface RoomCatch {
  cardKey: string;
  text: string;
  conflictKind: "contradiction" | "duplicate";
  files: string[];
  pinnedAt: string;
}

const CONFLICT_LABEL: Record<RoomCatch["conflictKind"], string> = {
  contradiction: "Conflicting data",
  duplicate: "Duplicate work"
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const COLLAPSED_COUNT = 3;

export function RecentCatchesList({ catches }: { catches: RoomCatch[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? catches : catches.slice(0, COLLAPSED_COUNT);

  return (
    <div>
      <div style={{ display: "grid", gap: 10 }}>
        {visible.map((c) => (
          <div key={c.cardKey} style={{
            background: "var(--surface-raised)", border: "1px solid var(--line)",
            borderLeft: `3px solid ${c.conflictKind === "contradiction" ? "var(--tension)" : "var(--accent)"}`,
            borderRadius: 14, padding: "16px 18px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 12 }}>
              <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: c.conflictKind === "contradiction" ? "var(--tension)" : "var(--accent)" }}>
                {CONFLICT_LABEL[c.conflictKind]}
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--subtle)", flexShrink: 0 }}>{timeAgo(c.pinnedAt)}</span>
            </div>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 8px", color: "var(--text-strong)" }}>{c.text}</p>
            {c.files.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {c.files.map((f) => <span key={f} className="chip">{f}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
      {catches.length > COLLAPSED_COUNT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="button-secondary"
          style={{ marginTop: 14, fontSize: "0.82rem" }}
        >
          {expanded ? "Show fewer" : `Show all ${catches.length} →`}
        </button>
      )}
    </div>
  );
}
