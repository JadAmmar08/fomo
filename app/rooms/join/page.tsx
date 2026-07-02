"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function JoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [status, setStatus] = useState<"joining" | "error" | "done">("joining");
  const [error, setError] = useState("");
  const [manual, setManual] = useState(!code);
  const [inputCode, setInputCode] = useState(code);

  useEffect(() => {
    if (code) join(code);
  }, []);

  async function join(inviteCode: string) {
    setStatus("joining");
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setStatus("error");
      return;
    }
    setStatus("done");
    setTimeout(() => router.push(`/rooms/${data.room.slug}` as never), 1200);
  }

  if (manual) {
    return (
      <div className="stack">
        <section className="panel" style={{ padding: "48px 36px" }}>
          <span className="eyebrow">Rooms</span>
          <h1 style={{ fontSize: "2rem" }}>Join a room</h1>
          <p style={{ marginBottom: 24 }}>Enter the invite code you received.</p>
          <div style={{ display: "grid", gap: 12 }}>
            <input
              value={inputCode}
              onChange={e => setInputCode(e.target.value)}
              placeholder="Invite code"
              onKeyDown={e => e.key === "Enter" && join(inputCode)}
              style={{
                width: "100%", padding: "10px 14px",
                background: "var(--surface-raised)", border: "1px solid var(--line-strong)",
                borderRadius: "var(--radius-md)", color: "var(--text)", fontSize: "0.95rem"
              }}
            />
            {error && <p style={{ color: "var(--danger)", fontSize: "0.88rem", margin: 0 }}>{error}</p>}
            <button className="button" onClick={() => join(inputCode)} disabled={!inputCode.trim()}>
              Join room
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel" style={{ padding: "48px 36px", maxWidth: 480 }}>
        <span className="eyebrow">Rooms</span>
        {status === "joining" && (
          <>
            <h1 style={{ fontSize: "2rem" }}>Joining...</h1>
            <p>Just a second.</p>
          </>
        )}
        {status === "done" && (
          <>
            <h1 style={{ fontSize: "2rem" }}>You&apos;re in.</h1>
            <p>Taking you to the room now.</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 style={{ fontSize: "2rem" }}>Couldn&apos;t join.</h1>
            <p style={{ marginBottom: 20 }}>{error}</p>
            <button className="button-secondary" onClick={() => { setManual(true); setError(""); }}>
              Try a different code
            </button>
          </>
        )}
      </section>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinInner />
    </Suspense>
  );
}
