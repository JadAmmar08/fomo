"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";

export default function JoinCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<"joining" | "error" | "done">("joining");
  const [error, setError] = useState("");

  useEffect(() => {
    join();
  }, []);

  async function join() {
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code }),
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
            <p style={{ color: "var(--danger)", marginBottom: 20 }}>{error}</p>
          </>
        )}
      </section>
    </div>
  );
}
