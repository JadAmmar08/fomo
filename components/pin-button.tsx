"use client";

import { useEffect, useState } from "react";

interface PinButtonProps {
  roomSlug: string;
  cardType: "pulse" | "discovery" | "mirror";
  cardKey: string;
  cardData: unknown;
}

export function PinButton({ roomSlug, cardType, cardKey, cardData }: PinButtonProps) {
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/pins?roomSlug=${encodeURIComponent(roomSlug)}&cardType=${cardType}&cardKey=${encodeURIComponent(cardKey)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setPinned(Boolean(data.pinned)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSlug, cardType, cardKey]);

  async function toggle() {
    setBusy(true);
    try {
      if (pinned) {
        await fetch("/api/pins", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomSlug, cardType, cardKey })
        });
        setPinned(false);
      } else {
        await fetch("/api/pins", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomSlug, cardType, cardKey, cardData })
        });
        setPinned(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={pinned ? "Unpin" : "Pin so this stays visible"}
      style={{
        background: "none", border: "none", cursor: busy ? "default" : "pointer",
        fontSize: "0.95rem", padding: "2px 4px", lineHeight: 1, flexShrink: 0,
        opacity: busy ? 0.5 : 1, color: pinned ? "var(--accent)" : "var(--subtle)"
      }}
    >
      {pinned ? "📌 Pinned" : "Pin"}
    </button>
  );
}
