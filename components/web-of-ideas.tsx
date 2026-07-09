type InsightType = "implication" | "tension" | "question" | "opportunity" | "blind_spot";

interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
  insightType: InsightType;
  peopleCount: number;
  isNew?: boolean;
}

interface WebOfIdeasProps {
  connections: IdeaConnection[];
  soloHighlights: string[];
}

const INSIGHT_LABELS: Record<InsightType, string> = {
  implication: "Implication",
  tension: "Tension",
  question: "Open question",
  opportunity: "Opportunity",
  blind_spot: "Blind spot"
};

const INSIGHT_COLORS: Record<InsightType, { color: string; background: string }> = {
  implication: { color: "var(--implication)", background: "var(--implication-soft)" },
  tension: { color: "var(--tension)", background: "var(--tension-soft)" },
  question: { color: "var(--question)", background: "var(--question-soft)" },
  opportunity: { color: "var(--opportunity)", background: "var(--opportunity-soft)" },
  blind_spot: { color: "var(--blindspot)", background: "var(--blindspot-soft)" }
};

export function WebOfIdeas({ connections, soloHighlights }: WebOfIdeasProps) {
  if (connections.length === 0 && soloHighlights.length === 0) return null;

  return (
    <div>
      {connections.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: soloHighlights.length > 0 ? 28 : 0 }}>
          {connections.map((conn, i) => {
            const insightColor = INSIGHT_COLORS[conn.insightType];
            return (
              <div key={i} style={{
                background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14,
                padding: "14px 18px", borderLeft: `3px solid ${insightColor.color}`
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text)" }}>
                    {conn.from} <span style={{ color: "var(--accent)", fontWeight: 400 }}>↔</span> {conn.to}
                  </div>
                  <span className="chip" style={{ flexShrink: 0, fontSize: "0.7rem" }}>
                    {conn.peopleCount} people, independently
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <span className="pill" style={{
                    fontSize: "0.68rem", fontWeight: 600, display: "inline-flex",
                    color: insightColor.color, background: insightColor.background,
                    border: `1px solid ${insightColor.color}`
                  }}>
                    {INSIGHT_LABELS[conn.insightType] ?? "Insight"}
                  </span>
                  {conn.isNew && (
                    <span className="pill" style={{ fontSize: "0.68rem", display: "inline-flex", background: "var(--accent)", color: "white" }}>
                      New
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.6, color: "var(--text-strong)" }}>{conn.explanation}</p>
              </div>
            );
          })}
        </div>
      )}

      {soloHighlights.length > 0 && (
        <div>
          <span className="kicker" style={{ marginBottom: 10 }}>Also worth watching</span>
          <div className="tag-row">
            {soloHighlights.map((topic) => (
              <span key={topic} className="chip">{topic}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
