"use client";

import { useEffect, useState } from "react";

export function WorkstreamNoteEditor({ roomSlug }: { roomSlug: string }) {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/rooms/workstream-note?roomSlug=${roomSlug}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const value = data.note ?? "";
        setNote(value);
        setSaved(value);
        setEditing(!value);
      })
      .finally(() => setLoaded(true));
  }, [roomSlug]);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/rooms/workstream-note", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomSlug, note })
      });
      setSaved(note);
      setEditing(false);
      // Discovery's recommendations are fetched server-side on page load, and the save
      // above just forced a fresh recompute behind it, reload so this page actually shows
      // it instead of the pre-note guidance sitting there until the next visit.
      window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  const isThin = note.trim().length > 0 && note.trim().length < 40;

  return (
    <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
      <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--accent)", margin: "0 0 4px" }}>
        What are you actually working on?
      </p>
      {!editing && saved ? (
        <div>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 8px", color: "var(--text-strong)" }}>{saved}</p>
          <button onClick={() => setEditing(true)} className="button-secondary" style={{ fontSize: "0.76rem", padding: "5px 12px" }}>
            Edit
          </button>
        </div>
      ) : (
        <div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Building the pricing model for the Q3 renewal, focused on usage-based tiers and how they compare to the current flat-fee contracts."
            rows={3}
            style={{
              width: "100%", padding: "10px 14px", marginBottom: 8,
              background: "white", border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-md)", color: "var(--text)", fontSize: "0.9rem",
              fontFamily: "inherit", resize: "vertical"
            }}
          />
          <p style={{ fontSize: "0.76rem", color: "var(--muted)", lineHeight: 1.5, margin: "0 0 10px" }}>
            This is the single biggest input into how good your Discovery and Pulse results are.
            {isThin && " A sentence like that gets thin results, be specific: what, for whom, and what you're actually trying to figure out."}
            {" "}FOMO relies on this to tell what's actually relevant to you from everything else in your connected files and browsing.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} className="button-secondary" style={{ fontSize: "0.8rem", padding: "6px 16px" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && (
              <button onClick={() => { setNote(saved); setEditing(false); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "var(--subtle)" }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
