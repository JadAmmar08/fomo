type InsightType = "implication" | "tension" | "question" | "opportunity" | "blind_spot";

interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
  insightType: InsightType;
  peopleCount: number;
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

export function WebOfIdeas({ connections, soloHighlights }: WebOfIdeasProps) {
  if (connections.length === 0 && soloHighlights.length === 0) return null;

  return (
    <div>
      {connections.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: soloHighlights.length > 0 ? 28 : 0 }}>
          {connections.map((conn, i) => (
            <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                  {conn.from} <span style={{ color: "var(--accent)", fontWeight: 400 }}>↔</span> {conn.to}
                </div>
                <span className="chip" style={{ flexShrink: 0, fontSize: "0.7rem" }}>
                  {conn.peopleCount} people, independently
                </span>
              </div>
              <span className="pill" style={{ fontSize: "0.68rem", marginBottom: 8, display: "inline-flex" }}>
                {INSIGHT_LABELS[conn.insightType] ?? "Insight"}
              </span>
              <p style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.6 }}>{conn.explanation}</p>
            </div>
          ))}
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
