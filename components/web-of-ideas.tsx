"use client";

import { useMemo, useState } from "react";

interface IdeaConnection {
  from: string;
  to: string;
  explanation: string;
  peopleCount: number;
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

const WIDTH = 840;
const HEIGHT = 520;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const PADDING = 110;

/**
 * Tiny force-directed layout (Fruchterman-Reingold style) run synchronously — these graphs
 * are small (a handful of nodes for a pilot room), so a few dozen iterations settles instantly
 * and gives real, connectivity-driven spacing instead of an evenly-spaced circle that ignores
 * which nodes actually relate to each other.
 */
function seededJitter(label: string): number {
  // Deterministic pseudo-random offset from the label so server and client render identically
  // (avoids a hydration mismatch from Math.random()) while still breaking perfect symmetry.
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * 20;
}

function layoutNodes(labels: string[], edges: Array<[string, string]>): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const n = labels.length;
  labels.forEach((label, i) => {
    const angle = (i / n) * Math.PI * 2;
    const jitter = seededJitter(label);
    positions.set(label, {
      x: CENTER_X + (Math.min(WIDTH, HEIGHT) / 2 - PADDING) * 0.6 * Math.cos(angle) + jitter,
      y: CENTER_Y + (Math.min(WIDTH, HEIGHT) / 2 - PADDING) * 0.6 * Math.sin(angle) + jitter
    });
  });

  const area = (WIDTH - PADDING * 2) * (HEIGHT - PADDING * 2);
  const k = Math.sqrt(area / Math.max(n, 1)) * 0.9;

  for (let iter = 0; iter < 300; iter++) {
    const disp = new Map<string, { x: number; y: number }>();
    labels.forEach((l) => disp.set(l, { x: 0, y: 0 }));

    // Repulsion between every pair
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = positions.get(labels[i])!;
        const b = positions.get(labels[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const da = disp.get(labels[i])!;
        const db = disp.get(labels[j])!;
        da.x += dx; da.y += dy;
        db.x -= dx; db.y -= dy;
      }
    }

    // Attraction along edges
    for (const [from, to] of edges) {
      const a = positions.get(from);
      const b = positions.get(to);
      if (!a || !b) continue;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      disp.get(from)!.x -= dx; disp.get(from)!.y -= dy;
      disp.get(to)!.x += dx; disp.get(to)!.y += dy;
    }

    // Pull toward center — strong enough that chains/paths settle centered in the canvas
    // instead of drifting into a corner, regardless of graph shape.
    for (const label of labels) {
      const p = positions.get(label)!;
      const d = disp.get(label)!;
      d.x += (CENTER_X - p.x) * 0.06;
      d.y += (CENTER_Y - p.y) * 0.06;
    }

    const temp = Math.max(1 - iter / 300, 0.05) * k * 0.15;
    for (const label of labels) {
      const p = positions.get(label)!;
      const d = disp.get(label)!;
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const capped = Math.min(dist, temp);
      p.x = Math.min(WIDTH - PADDING, Math.max(PADDING, p.x + (d.x / dist) * capped));
      p.y = Math.min(HEIGHT - PADDING, Math.max(PADDING, p.y + (d.y / dist) * capped));
    }
  }

  return positions;
}

export function WebOfIdeas({ connections, soloHighlights }: WebOfIdeasProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const nodes = useMemo(() => {
    const labels = Array.from(new Set(connections.flatMap((c) => [c.from, c.to])));
    const edges: Array<[string, string]> = connections.map((c) => [c.from, c.to]);
    const positions = layoutNodes(labels, edges);

    const degreeMap = new Map<string, number>();
    for (const label of labels) {
      degreeMap.set(label, connections.filter((c) => c.from === label || c.to === label).length);
    }

    return labels.map((label): Node => {
      const pos = positions.get(label)!;
      return { label, x: pos.x, y: pos.y, degree: degreeMap.get(label) ?? 1 };
    });
  }, [connections]);

  const nodeByLabel = new Map(nodes.map((n) => [n.label, n]));

  if (connections.length === 0 && soloHighlights.length === 0) return null;

  return (
    <div>
      {connections.length > 0 && (
        <div style={{ width: "100%", marginBottom: 28 }}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: "block", width: "100%", height: "auto" }}>
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
              const labelOffset = nodeRadius + 8;

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
                    x={node.x}
                    y={node.y - labelOffset}
                    textAnchor="middle"
                    fontSize={12.5}
                    fontFamily="var(--font-sans)"
                    fontWeight={isActive ? 600 : 500}
                    fill={isDimmed ? "var(--subtle)" : "var(--text)"}
                    style={{ transition: "fill 0.2s" }}
                  >
                    {node.label.length > 36 ? node.label.slice(0, 34) + "…" : node.label}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                  {conn.from} <span style={{ color: "var(--accent)", fontWeight: 400 }}>↔</span> {conn.to}
                </div>
                <span className="chip" style={{ flexShrink: 0, fontSize: "0.7rem" }}>
                  {conn.peopleCount} people, independently
                </span>
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
