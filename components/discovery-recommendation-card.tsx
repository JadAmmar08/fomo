"use client";

import { useState } from "react";
import { PinButton } from "@/components/pin-button";

interface GuidanceRecommendation {
  type: "direction" | "question" | "team_signal";
  text: string;
  sourceTopics: string[];
  hasResource?: boolean;
  conflictKind?: "duplicate" | "contradiction" | "none";
}

const GUIDANCE_LABELS: Record<GuidanceRecommendation["type"], string> = {
  direction: "Direction",
  question: "Open question",
  team_signal: "Team signal"
};

const CONFLICT_LABELS: Record<"duplicate" | "contradiction", string> = {
  duplicate: "Duplicate work",
  contradiction: "Conflicting data"
};

interface ArtifactResult {
  source: string;
  name: string;
  link: string;
  content: string | null;
}

export function DiscoveryRecommendationCard({ rec, roomSlug }: { rec: GuidanceRecommendation; roomSlug: string }) {
  const [artifact, setArtifact] = useState<ArtifactResult | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<"useful" | "not_relevant" | null>(null);

  const isTeamSignal = rec.type === "team_signal";
  const conflict = rec.conflictKind === "duplicate" || rec.conflictKind === "contradiction" ? rec.conflictKind : null;
  const typeColor = rec.type === "question" ? "var(--question)" : rec.type === "direction" ? "var(--direction)" : "var(--accent)";
  const typeBg = rec.type === "question" ? "var(--question-soft)" : rec.type === "direction" ? "var(--direction-soft)" : "var(--accent-soft)";

  async function requestIt() {
    setRequesting(true);
    setRequestFailed(false);
    try {
      const res = await fetch("/api/discovery/handoff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomSlug, recommendationText: rec.text })
      });
      if (!res.ok) throw new Error("failed");
      setArtifact(await res.json());
    } catch {
      setRequestFailed(true);
    } finally {
      setRequesting(false);
    }
  }

  function sendFeedback(feedback: "useful" | "not_relevant") {
    setFeedbackGiven(feedback);
    fetch("/api/discovery/feedback", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomSlug, recommendationText: rec.text, feedback })
    }).catch(() => {});
  }

  return (
    <div style={{
      background: isTeamSignal ? "var(--accent-soft)" : "var(--surface-raised)",
      border: isTeamSignal ? "1px solid var(--accent)" : "1px solid var(--line)",
      borderLeft: `3px solid ${typeColor}`,
      borderRadius: 12, padding: "12px 16px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="pill" style={{
            fontSize: "0.68rem", marginBottom: 6, display: "inline-flex", fontWeight: 600,
            background: isTeamSignal ? "var(--accent)" : typeBg,
            color: isTeamSignal ? "white" : typeColor,
            border: isTeamSignal ? "none" : `1px solid ${typeColor}`
          }}>
            {isTeamSignal ? "◆ " : ""}{GUIDANCE_LABELS[rec.type]}
          </span>
          {conflict && (
            <span className="pill" style={{
              fontSize: "0.68rem", marginBottom: 6, display: "inline-flex", fontWeight: 600,
              background: "var(--negative-soft, #fde2e2)", color: "var(--negative, #b42318)", border: "1px solid var(--negative, #b42318)"
            }}>
              ⚑ {CONFLICT_LABELS[conflict]}
            </span>
          )}
        </div>
        <PinButton roomSlug={roomSlug} cardType="discovery" cardKey={`${rec.type}:${rec.text}`} cardData={rec} />
      </div>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: 0, color: "var(--text-strong)" }}>{rec.text}</p>
      {rec.sourceTopics?.length > 0 && (
        <p style={{ fontSize: "0.76rem", margin: "6px 0 0", lineHeight: 1.5, color: "var(--subtle)" }}>
          Based on: {rec.sourceTopics.map((t) => `"${t}"`).join(", ")}
        </p>
      )}

      {isTeamSignal && rec.hasResource && (
        <div style={{ marginTop: 10 }}>
          {artifact ? (
            <div style={{ background: "white", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ fontSize: "0.8rem", color: "var(--subtle)", margin: "0 0 4px" }}>Shared with you:</p>
              <a href={artifact.link} target="_blank" rel="noreferrer" style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-strong)" }}>
                {artifact.name}
              </a>
            </div>
          ) : (
            <button
              onClick={requestIt}
              disabled={requesting}
              className="button-secondary"
              style={{ fontSize: "0.8rem", padding: "6px 14px" }}
            >
              {requesting ? "Requesting…" : "Request it"}
            </button>
          )}
          {requestFailed && <p style={{ fontSize: "0.76rem", color: "var(--subtle)", marginTop: 6 }}>Couldn&apos;t fetch it, try again.</p>}
        </div>
      )}

      {isTeamSignal && !feedbackGiven && (
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={() => sendFeedback("useful")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.76rem", color: "var(--subtle)", padding: 0 }}>
            Useful
          </button>
          <button onClick={() => sendFeedback("not_relevant")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.76rem", color: "var(--subtle)", padding: 0 }}>
            Not relevant
          </button>
        </div>
      )}
      {feedbackGiven && (
        <p style={{ fontSize: "0.76rem", color: "var(--subtle)", marginTop: 8 }}>Thanks, noted.</p>
      )}
    </div>
  );
}
