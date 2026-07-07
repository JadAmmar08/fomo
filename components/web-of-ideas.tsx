"use client";

import { useMemo, useState } from "react";

interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
}

interface WebOfIdeasProps {
  connections: IdeaConnection[];
  soloHighlights: string[];
}

interface Node {
  label: string;
  x: number;
  y: number;
  degree: number;
}

const WIDTH = 720;
const HEIGHT = 460;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

export function WebOfIdeas({ connections, soloHighlights }: WebOfIdeasProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, radius } = useMemo(() => {
    const labels = Array.from(new Set(connections.flatMap((c) => [c.from, c.to])));
    const degreeMap = new Map<string, number>();
    for (const label of labels) {
      const degree = connections.filter((c) => c.from === label || c.to === label).length;
      degreeMap.set(label, degree);
    }

    const r = Math.min(WIDTH, HEIGHT) / 2 - 100;
    const nodeList: Node[] = labels.map((label, i) => {
      const angle = (i / Math.max(labels.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        label,
        x: CENTER_X + r * Math.cos(angle),
        y: CENTER_Y + r * Math.sin(angle),
        degree: degreeMap.get(label) ?? 1
      };
    });

    return { nodes: nodeList, radius: r };
  }, [connections]);

  const nodeByLabel = new Map(nodes.map((n) => [n.label, n]));

  if (connections.length === 0 && soloHighlights.length === 0) return null;

  return (
    <div>
      {connections.length > 0 && (
        <div style={{ width: "100%", overflowX: "auto", marginBottom: 28 }}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: "auto", minWidth: 480 }}>
            {connections.map((conn, i) => {
              const a = nodeByLabel.get(conn.from);
              const b = nodeByLabel.get(conn.to);
              if (!a || !b) return null;
              const isActive = hovered === conn.from || hovered === conn.to;
              const isDimmed = hovered !== null && !isActive;
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="var(--accent)"
                  strokeWidth={isActive ? 2 : 1.2}
                  opacity={isDimmed ? 0.12 : isActive ? 0.85 : 0.35}
                  style={{ transition: "opacity 0.2s, stroke-width 0.2s" }}
                >
                  <title>{conn.explanation}</title>
                </line>
              );
            })}

            {nodes.map((node) => {
              const isActive = hovered === node.label;
              const isDimmed = hovered !== null && !isActive;
              const nodeRadius = 6 + Math.min(node.degree, 4) * 2.5;
              const labelOffset = node.x > CENTER_X + 4 ? 12 : node.x < CENTER_X - 4 ? -12 : 0;
              const anchor = node.x > CENTER_X + 4 ? "start" : node.x < CENTER_X - 4 ? "end" : "middle";
              const vOffset = node.y < CENTER_Y - radius + 40 ? -14 : node.y > CENTER_Y + radius - 40 ? 20 : 5;

              return (
                <g
                  key={node.label}
                  onMouseEnter={() => setHovered(node.label)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={node.x} cy={node.y} r={nodeRadius}
                    fill={isActive ? "var(--accent)" : "white"}
                    stroke="var(--accent)"
                    strokeWidth={1.5}
                    opacity={isDimmed ? 0.3 : 1}
                    style={{ transition: "fill 0.2s, opacity 0.2s" }}
                  />
                  <text
                    x={node.x + labelOffset}
                    y={node.y + vOffset}
                    textAnchor={anchor}
                    fontSize={12.5}
                    fontFamily="var(--font-sans)"
                    fontWeight={isActive ? 600 : 500}
                    fill={isDimmed ? "var(--subtle)" : "var(--text)"}
                    style={{ transition: "fill 0.2s" }}
                  >
                    {node.label.length > 28 ? node.label.slice(0, 26) + "…" : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {connections.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: soloHighlights.length > 0 ? 28 : 0 }}>
          {connections.map((conn, i) => (
            <div key={i} style={{ background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 18px" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 4 }}>
                {conn.from} <span style={{ color: "var(--accent)", fontWeight: 400 }}>↔</span> {conn.to}
              </div>
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
