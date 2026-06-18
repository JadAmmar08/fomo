"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const actionLabels = {
  "good-catch": "Good catch",
  "not-relevant": "Not relevant",
  "hide-topic": "Hide topic",
  "this-is-wrong": "This is wrong",
  "more-like-this": "More like this"
} as const;

export function FeedbackActions({
  targetType,
  targetId,
  actions
}: {
  targetType: "mirror" | "pulse";
  targetId: string;
  actions: Array<keyof typeof actionLabels>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [activeAction, setActiveAction] = useState<string>("");

  async function submit(action: keyof typeof actionLabels) {
    setActiveAction(action);
    setStatus("Saving...");

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        targetType,
        targetId,
        action
      })
    });

    setStatus(response.ok ? "Feedback saved and mirror weights updated." : "Could not save feedback");
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="button-row">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className={activeAction === action ? "button" : "button-secondary"}
            onClick={() => submit(action)}
          >
            {actionLabels[action]}
          </button>
        ))}
      </div>
      {status ? <p className="muted" style={{ marginBottom: 0 }}>{status}</p> : null}
    </div>
  );
}
