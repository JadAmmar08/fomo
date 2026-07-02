"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

interface Room {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  invite_code: string;
  member_count: number;
  role: string;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rooms")
      .then(r => r.json())
      .then(d => setRooms(d.rooms ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function createRoom() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setCreating(false);
      return;
    }
    setRooms(prev => [{ ...data.room, member_count: 1, role: "admin" }, ...prev]);
    setShowCreate(false);
    setName("");
    setDescription("");
    setCreating(false);
  }

  function copyInvite(room: Room) {
    const link = `${window.location.origin}/rooms/join/${room.invite_code}`; // clean shareable URL
    navigator.clipboard.writeText(link);
    setCopied(room.id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="stack">
      <section style={{ padding: "64px 0 48px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
          Rooms
          <span style={{ display: "block", width: 40, height: 1, background: "var(--line-strong)" }} />
        </div>
        <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 4.6rem)", margin: "0 auto 6px", lineHeight: 1.02 }}>
          Your people. <em style={{ color: "var(--accent)" }}>Your pulse.</em>
        </h1>
        <p style={{ maxWidth: 460, margin: "20px auto 36px", fontSize: "1.05rem", lineHeight: 1.7 }}>
          Invite a group into a private room and see what they&apos;re paying attention to — separate from the public pulse.
        </p>
        <div className="button-row" style={{ justifyContent: "center" }}>
          <button className="button" onClick={() => setShowCreate(true)} style={{ fontSize: "0.95rem", padding: "14px 30px", boxShadow: "0 12px 32px rgba(26,26,24,0.22)" }}>
            Create a room
          </button>
          <Link href={"/rooms/join" as Route} className="button-secondary" style={{ fontSize: "0.95rem", padding: "14px 26px", background: "white" }}>
            Join with a code
          </Link>
        </div>
      </section>

      {showCreate && (
        <section className="panel">
          <h2 style={{ marginBottom: 20 }}>New room</h2>
          <div style={{ display: "grid", gap: 12, maxWidth: 480 }}>
            <div>
              <label className="kicker" style={{ marginBottom: 8, display: "block" }}>Room name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Marshall Class of 2028"
                onKeyDown={e => e.key === "Enter" && createRoom()}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "var(--surface-raised)", border: "1px solid var(--line-strong)",
                  borderRadius: "var(--radius-md)", color: "var(--text)", fontSize: "0.95rem"
                }}
              />
            </div>
            <div>
              <label className="kicker" style={{ marginBottom: 8, display: "block" }}>Description (optional)</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's this room for?"
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "var(--surface-raised)", border: "1px solid var(--line-strong)",
                  borderRadius: "var(--radius-md)", color: "var(--text)", fontSize: "0.95rem"
                }}
              />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: "0.88rem", margin: 0 }}>{error}</p>}
            <div className="button-row">
              <button className="button" onClick={createRoom} disabled={creating || !name.trim()}>
                {creating ? "Creating..." : "Create room"}
              </button>
              <button className="button-secondary" onClick={() => { setShowCreate(false); setError(""); }}>
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {loading ? (
        <section className="panel">
          <p>Loading...</p>
        </section>
      ) : rooms.length === 0 && !showCreate ? (
        <section className="panel" style={{ background: "var(--surface)" }}>
          <h2>No rooms yet</h2>
          <p>Create a room and share the invite link with people you want to see a private pulse with.</p>
        </section>
      ) : (
        <div className="list">
          {rooms.map(room => (
            <div key={room.id} style={{ background: "white", borderRadius: 20, border: "1px solid var(--line)", boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "28px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h3 style={{ marginBottom: 0 }}>{room.name}</h3>
                  {room.role === "admin" && (
                    <span className="pill" style={{ fontSize: "0.72rem", padding: "2px 8px" }}>admin</span>
                  )}
                </div>
                {room.description && (
                  <p style={{ fontSize: "0.85rem", marginBottom: 8 }}>{room.description}</p>
                )}
                <span className="kicker" style={{ display: "inline" }}>{room.member_count} {room.member_count === 1 ? "member" : "members"}</span>
              </div>
              <div className="button-row" style={{ flexShrink: 0 }}>
                <button
                  className="button-secondary"
                  onClick={() => copyInvite(room)}
                  style={{ fontSize: "0.85rem" }}
                >
                  {copied === room.id ? "Copied!" : "Copy invite link"}
                </button>
                <Link href={`/rooms/${room.slug}` as Route} className="button" style={{ fontSize: "0.85rem" }}>
                  See pulse
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
