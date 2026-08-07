"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Thesis { statement: string; isNew: boolean; }
interface StaleAssumption { statement: string; note: string; }
interface Disagreement { statement: string; }
interface Decision { decision: string; rationale: string; }
interface OpenQuestion { question: string; }
interface BeliefShift { description: string; detectedAt: string; }

interface MirrorDirectoryProps {
  slug: string;
  roomId: string;
  viewerUid: string;
  theses: Thesis[];
  activeDisagreements: Disagreement[];
  openQuestions: OpenQuestion[];
  staleAssumptions: StaleAssumption[] | null;
  decisions: Decision[];
  shifts: BeliefShift[];
}

type FileId = "decisions" | "beliefs" | "questions" | "disagreements" | "stale" | "timeline" | "facts" | "memory";

const cardStyle = {
  background: "var(--surface)",
  borderRadius: 16,
  border: "1px solid var(--line)"
} as const;

function FileTile({
  label, count, description, color, active, onClick
}: { label: string; count: string; description: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...cardStyle,
        textAlign: "left",
        padding: "20px 22px",
        cursor: "pointer",
        borderColor: active ? color : "var(--line)",
        boxShadow: active ? `0 0 0 2px ${color}` : "none",
        transition: "box-shadow 0.15s, border-color 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: 6
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color }}>{label}</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "var(--subtle)" }}>{count}</span>
      </div>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.5 }}>{description}</p>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "18px 0", color: "var(--subtle)", fontSize: "0.85rem", fontStyle: "italic" }}>{children}</div>;
}

function ListPanel({ items }: { items: string[] }) {
  if (items.length === 0) return <Empty>Nothing here yet.</Empty>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ padding: "14px 0", borderTop: i > 0 ? "1px solid var(--line)" : "none" }}>
          <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text-strong)" }}>{item}</p>
        </div>
      ))}
    </div>
  );
}

interface EntitySummary { entity: string; factCount: number; lastUpdated: string; }
interface FactHistoryEntry { subject: string; value: string; fileName: string; location: string; extractedAt: string; isCurrent: boolean; }

function FactHistoryPanel({ roomId }: { roomId: string }) {
  const [entities, setEntities] = useState<EntitySummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<FactHistoryEntry[] | null>(null);

  useEffect(() => {
    fetch(`/api/rooms/fact-history?room=${encodeURIComponent(roomId)}`)
      .then((r) => r.json())
      .then((d) => setEntities(d.entities ?? []));
  }, [roomId]);

  useEffect(() => {
    if (!selected) return;
    setHistory(null);
    fetch(`/api/rooms/fact-history?room=${encodeURIComponent(roomId)}&entity=${encodeURIComponent(selected)}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []));
  }, [roomId, selected]);

  if (entities === null) return <Empty>Loading...</Empty>;
  if (entities.length === 0) return <Empty>No tracked entities yet, this fills in as spreadsheet facts get extracted.</Empty>;

  if (selected) {
    const grouped = new Map<string, FactHistoryEntry[]>();
    (history ?? []).forEach((h) => {
      if (!grouped.has(h.subject)) grouped.set(h.subject, []);
      grouped.get(h.subject)!.push(h);
    });
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.82rem", padding: 0, marginBottom: 16 }}>
          ← All entities
        </button>
        <h3 style={{ marginBottom: 16 }}>{selected}</h3>
        {history === null ? (
          <Empty>Loading...</Empty>
        ) : (
          [...grouped.entries()].map(([subject, entries]) => (
            <div key={subject} style={{ marginBottom: 20 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--subtle)" }}>{subject}</span>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {entries.map((e, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", padding: "8px 0", borderTop: "1px solid var(--line)", opacity: e.isCurrent ? 1 : 0.55 }}>
                    <span style={{ color: "var(--text-strong)" }}>{e.value}{e.isCurrent ? "" : " (superseded)"}</span>
                    <span style={{ color: "var(--subtle)", fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>
                      {e.fileName} · {e.location} · {new Date(e.extractedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {entities.map((e) => (
        <button
          key={e.entity}
          onClick={() => setSelected(e.entity)}
          style={{ ...cardStyle, textAlign: "left", padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span style={{ fontSize: "0.92rem", color: "var(--text-strong)" }}>{e.entity}</span>
          <span style={{ fontSize: "0.78rem", color: "var(--subtle)" }}>{e.factCount} fact{e.factCount === 1 ? "" : "s"} · {new Date(e.lastUpdated).toLocaleDateString()}</span>
        </button>
      ))}
    </div>
  );
}

interface Memory { content: string; updatedAt: string; }
interface MemMessage { role: "user" | "assistant"; content: string; createdAt: string; }

function PersonalMemoryPanel({ roomId, viewerUid }: { roomId: string; viewerUid: string }) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [messages, setMessages] = useState<MemMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [shareWith, setShareWith] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!viewerUid) return;
    fetch(`/api/personal-memory?anonymousUserId=${encodeURIComponent(viewerUid)}&room=${encodeURIComponent(roomId)}`)
      .then((r) => r.json())
      .then((d) => { setMemory(d.memory); setMessages(d.messages ?? []); });
  }, [roomId, viewerUid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!viewerUid) return <Empty>Sign in to see your memory file.</Empty>;

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text, createdAt: new Date().toISOString() }]);
    try {
      const res = await fetch("/api/personal-memory/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonymousUserId: viewerUid, roomId, message: text })
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "...", createdAt: new Date().toISOString() }]);
      if (data.memory) setMemory(data.memory);
    } finally {
      setSending(false);
    }
  }

  async function share() {
    if (!shareWith.trim()) return;
    setShareStatus("Sharing...");
    const res = await fetch("/api/personal-memory/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousUserId: viewerUid, roomId, shareWith: shareWith.trim() })
    });
    setShareStatus(res.ok ? "Shared. This is a one-time snapshot, not a live link." : "Couldn't share, check the ID and try again.");
  }

  return (
    <div>
      <p style={{ fontSize: "0.8rem", color: "var(--subtle)", marginBottom: 20 }}>
        Private to you. No one else in this room, including admins, can see this file unless you explicitly share a snapshot below.
      </p>

      <div style={{ ...cardStyle, padding: "18px 20px", marginBottom: 20, background: "var(--surface-muted)" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--subtle)" }}>What FOMO currently understands</span>
        <p style={{ margin: "10px 0 0", fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text-strong)" }}>
          {memory?.content ? memory.content : "Nothing recorded yet, tell it something below."}
        </p>
      </div>

      <div style={{ maxHeight: 320, overflowY: "auto", display: "grid", gap: 10, marginBottom: 14, paddingRight: 4 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%", marginLeft: m.role === "user" ? "auto" : 0 }}>
            <div style={{
              padding: "10px 14px",
              borderRadius: 14,
              background: m.role === "user" ? "var(--accent)" : "var(--surface-muted)",
              color: m.role === "user" ? "white" : "var(--text-strong)",
              fontSize: "0.88rem",
              lineHeight: 1.5
            }}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
          placeholder="Tell it something, or ask what it thinks..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line-strong)", fontSize: "0.9rem" }}
        />
        <button onClick={sendMessage} disabled={sending} className="button-secondary" style={{ padding: "10px 18px" }}>
          {sending ? "..." : "Send"}
        </button>
      </div>

      <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--subtle)" }}>Share for handoff (KT)</span>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "6px 0 10px" }}>
          Sends a one-time snapshot of this file to someone taking over your work. Not a live sync, they see what&apos;s here right now.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={shareWith}
            onChange={(e) => setShareWith(e.target.value)}
            placeholder="Their anonymous ID"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line-strong)", fontSize: "0.88rem" }}
          />
          <button onClick={share} className="button-secondary" style={{ padding: "10px 18px" }}>Share</button>
        </div>
        {shareStatus && <p style={{ fontSize: "0.8rem", color: "var(--subtle)", marginTop: 8 }}>{shareStatus}</p>}
      </div>
    </div>
  );
}

export function MirrorDirectory(props: MirrorDirectoryProps) {
  const [open, setOpen] = useState<FileId | null>(null);

  const files: Array<{ id: FileId; label: string; count: string; description: string; color: string }> = [
    { id: "decisions", label: "Decisions", count: String(props.decisions.length).padStart(2, "0"), description: "What's been decided and why.", color: "var(--direction)" },
    { id: "beliefs", label: "Beliefs", count: String(props.theses.length).padStart(2, "0"), description: "What the team currently thinks is true.", color: "var(--opportunity)" },
    { id: "questions", label: "Open questions", count: String(props.openQuestions.length).padStart(2, "0"), description: "Unresolved, still live.", color: "var(--question)" },
    { id: "disagreements", label: "Disagreements", count: String(props.activeDisagreements.length).padStart(2, "0"), description: "Where current work actually conflicts.", color: "var(--tension)" },
    { id: "stale", label: "Stale assumptions", count: String(props.staleAssumptions?.length ?? 0).padStart(2, "0"), description: "Hasn't been double-checked in a while.", color: "var(--blindspot)" },
    { id: "timeline", label: "Timeline", count: String(props.shifts.length).padStart(2, "0"), description: "How thinking has shifted over time.", color: "var(--implication)" },
    { id: "facts", label: "Fact history", count: "—", description: "Every value a tracked entity has held, and who set it.", color: "var(--accent)" },
    { id: "memory", label: "Your memory", count: "🔒", description: "Private. What FOMO understands about how you work.", color: "var(--gold)" }
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {files.map((f) => (
          <FileTile
            key={f.id}
            label={f.label}
            count={f.count}
            description={f.description}
            color={f.color}
            active={open === f.id}
            onClick={() => setOpen(open === f.id ? null : f.id)}
          />
        ))}
      </div>

      {open && (
        <div style={{ ...cardStyle, padding: "32px 36px" }}>
          {open === "decisions" && <ListPanel items={props.decisions.map((d) => `${d.decision} — ${d.rationale}`)} />}
          {open === "beliefs" && <ListPanel items={props.theses.map((t) => t.statement)} />}
          {open === "questions" && <ListPanel items={props.openQuestions.map((q) => q.question)} />}
          {open === "disagreements" && <ListPanel items={props.activeDisagreements.map((d) => d.statement)} />}
          {open === "stale" && <ListPanel items={(props.staleAssumptions ?? []).map((s) => `${s.statement} — ${s.note}`)} />}
          {open === "timeline" && <ListPanel items={props.shifts.map((s) => `${new Date(s.detectedAt).toLocaleDateString()}: ${s.description}`)} />}
          {open === "facts" && <FactHistoryPanel roomId={props.roomId} />}
          {open === "memory" && <PersonalMemoryPanel roomId={props.roomId} viewerUid={props.viewerUid} />}
        </div>
      )}
    </div>
  );
}
