"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const cardStyle = {
  background: "var(--surface)",
  borderRadius: 16,
  border: "1px solid var(--line)"
} as const;

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "18px 0", color: "var(--subtle)", fontSize: "0.85rem", fontStyle: "italic" }}>{children}</div>;
}

interface Memory { content: string; updatedAt: string; }
interface MemMessage { role: "user" | "assistant"; content: string; createdAt: string; }

type Scope = "personal" | "team";

// Two memory files, same chat-driven pattern: your own private file (only you
// can ever see it) and the team's shared one (anyone in the room can see and
// edit it). No insight tiles, no team-wide synthesis, just AI memory and ways
// it can help, per Jad's explicit call to cut the directory down to this.
export function MirrorDirectory({ roomId, viewerUid }: { roomId: string; viewerUid: string }) {
  const [scope, setScope] = useState<Scope>("personal");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {(["personal", "team"] as Scope[]).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={scope === s ? "button-secondary" : ""}
            style={{
              padding: "8px 20px",
              borderRadius: 999,
              border: scope === s ? undefined : "1px solid var(--line)",
              background: scope === s ? undefined : "transparent",
              color: scope === s ? undefined : "var(--muted)",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            {s === "personal" ? "🔒 Your memory" : "Team memory"}
          </button>
        ))}
      </div>
      {scope === "personal" ? <PersonalMemoryPanel roomId={roomId} viewerUid={viewerUid} /> : <TeamMemoryPanel roomId={roomId} viewerUid={viewerUid} />}
    </div>
  );
}

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
    <div style={{ ...cardStyle, padding: "32px 36px" }}>
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

function TeamMemoryPanel({ roomId, viewerUid }: { roomId: string; viewerUid: string }) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [messages, setMessages] = useState<MemMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch(`/api/team-memory?room=${encodeURIComponent(roomId)}`)
      .then((r) => r.json())
      .then((d) => { setMemory(d.memory); setMessages(d.messages ?? []); });
  }, [roomId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending || !viewerUid) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text, createdAt: new Date().toISOString() }]);
    try {
      const res = await fetch("/api/team-memory/chat", {
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

  return (
    <div style={{ ...cardStyle, padding: "32px 36px" }}>
      <p style={{ fontSize: "0.8rem", color: "var(--subtle)", marginBottom: 20 }}>
        Shared with everyone in this room. Anyone can see and add to it through chat, same as this one.
      </p>

      <div style={{ ...cardStyle, padding: "18px 20px", marginBottom: 20, background: "var(--surface-muted)" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--subtle)" }}>What FOMO currently understands about this team</span>
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
          placeholder={viewerUid ? "Tell it something, or ask what it thinks..." : "Sign in to chat"}
          disabled={!viewerUid}
          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line-strong)", fontSize: "0.9rem" }}
        />
        <button onClick={sendMessage} disabled={sending || !viewerUid} className="button-secondary" style={{ padding: "10px 18px" }}>
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
