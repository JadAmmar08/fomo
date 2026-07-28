"use client";

import { useState } from "react";
import { PinButton } from "@/components/pin-button";

interface Thesis { statement: string; isNew: boolean; }
interface StaleAssumption { statement: string; note: string; }
interface Disagreement { statement: string; }
interface Decision { decision: string; rationale: string; }
interface OpenQuestion { question: string; }

interface MirrorBoardProps {
  slug: string;
  theses: Thesis[];
  activeDisagreements: Disagreement[];
  openQuestions: OpenQuestion[];
  staleAssumptions: StaleAssumption[] | null;
  hasEnoughHistoryForStaleness: boolean;
  decisions: Decision[];
}

const monoStyle = { fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', fontVariantNumeric: "tabular-nums" } as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ColumnHead({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 12px" }}>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color }}>{label}</span>
      <span style={{ ...monoStyle, fontSize: "0.78rem", color: "var(--subtle)" }}>{pad(count)}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "18px 0", color: "var(--subtle)", fontSize: "0.76rem", fontStyle: "italic", borderTop: "1px solid var(--line)" }}>
      {children}
    </div>
  );
}

function Row({
  children, first, onClick
}: { children: React.ReactNode; first?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "13px 0",
        borderTop: `1px solid ${first ? "var(--line-strong)" : "var(--line)"}`,
        cursor: onClick ? "pointer" : "default"
      }}
    >
      {children}
    </div>
  );
}

function PinLink({ roomSlug, cardType, cardKey, cardData }: { roomSlug: string; cardType: "mirror"; cardKey: string; cardData: unknown }) {
  return (
    <span style={{ fontSize: "0.68rem" }}>
      <PinButton roomSlug={roomSlug} cardType={cardType} cardKey={cardKey} cardData={cardData} />
    </span>
  );
}

export function MirrorBoard({ slug, theses, activeDisagreements, openQuestions, staleAssumptions, hasEnoughHistoryForStaleness, decisions }: MirrorBoardProps) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const columns = [
    { key: "live", label: "Live", color: "var(--implication)" },
    { key: "tension", label: "In tension", color: "var(--tension)" },
    { key: "unresolved", label: "Unresolved", color: "var(--question)" },
    { key: "stale", label: "Stale", color: "var(--blindspot)" },
    { key: "settled", label: "Settled", color: "var(--accent)" }
  ] as const;

  return (
    <section data-reveal style={{
      background: "white", borderRadius: 20, border: "1px solid var(--line)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "36px 40px 12px", marginBottom: 24, overflowX: "auto"
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(200px, 1fr))", minWidth: 960 }}>
        {columns.map((col, colIdx) => (
          <div key={col.key} style={{
            padding: colIdx === 0 ? "0 20px 0 0" : "0 20px",
            borderRight: colIdx < columns.length - 1 ? "1px solid var(--line)" : "none"
          }}>
            <ColumnHead
              label={col.label}
              color={col.color}
              count={
                col.key === "live" ? theses.length
                : col.key === "tension" ? activeDisagreements.length
                : col.key === "unresolved" ? openQuestions.length
                : col.key === "stale" ? (staleAssumptions?.length ?? 0)
                : decisions.length
              }
            />

            {col.key === "live" && (
              theses.length > 0 ? theses.map((t, i) => (
                <Row key={i} first={i === 0}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: "0.86rem", lineHeight: 1.5, color: "var(--text-strong)", fontWeight: 450 }}>
                      {t.statement}
                    </span>
                    {t.isNew && (
                      <span style={{
                        flexShrink: 0, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em",
                        textTransform: "uppercase", color: "var(--accent)", border: "1px solid var(--accent)",
                        padding: "1px 5px", borderRadius: 3, marginTop: 1
                      }}>new</span>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <PinLink roomSlug={slug} cardType="mirror" cardKey={`thesis:${t.statement}`} cardData={t} />
                  </div>
                </Row>
              )) : <Empty>Nothing live yet.</Empty>
            )}

            {col.key === "tension" && (
              activeDisagreements.length > 0 ? activeDisagreements.map((d, i) => (
                <Row key={i} first={i === 0}>
                  <span style={{ fontSize: "0.86rem", lineHeight: 1.5, color: "var(--text-strong)", fontWeight: 450 }}>{d.statement}</span>
                  <div style={{ marginTop: 8 }}>
                    <PinLink roomSlug={slug} cardType="mirror" cardKey={`disagreement:${d.statement}`} cardData={d} />
                  </div>
                </Row>
              )) : <Empty>Nothing conflicting right now.</Empty>
            )}

            {col.key === "unresolved" && (
              openQuestions.length > 0 ? openQuestions.map((q, i) => (
                <Row key={i} first={i === 0}>
                  <span style={{ fontSize: "0.86rem", lineHeight: 1.5, color: "var(--text-strong)", fontWeight: 450 }}>{q.question}</span>
                  <div style={{ marginTop: 8 }}>
                    <PinLink roomSlug={slug} cardType="mirror" cardKey={`question:${q.question}`} cardData={q} />
                  </div>
                </Row>
              )) : <Empty>Nothing open right now.</Empty>
            )}

            {col.key === "stale" && (
              !hasEnoughHistoryForStaleness ? (
                <Empty>Not enough history yet to tell what&apos;s gone unchallenged.</Empty>
              ) : staleAssumptions && staleAssumptions.length > 0 ? staleAssumptions.map((a, i) => {
                const key = `stale-${i}`;
                const open = openKeys.has(key);
                return (
                  <Row key={i} first={i === 0} onClick={() => toggle(key)}>
                    <span style={{ fontSize: "0.86rem", lineHeight: 1.5, color: "var(--text-strong)", fontWeight: 450 }}>{a.statement}</span>
                    <div style={{ fontSize: "0.68rem", color: "var(--subtle)", marginTop: 5 }}>
                      {open ? "⌄ " : "› "}why it&apos;s flagged
                    </div>
                    {open && (
                      <div style={{ marginTop: 7, fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid var(--line-strong)" }}>
                        {a.note}
                      </div>
                    )}
                    <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                      <PinLink roomSlug={slug} cardType="mirror" cardKey={`stale:${a.statement}`} cardData={a} />
                    </div>
                  </Row>
                );
              }) : <Empty>Nothing flagged as stale right now.</Empty>
            )}

            {col.key === "settled" && (
              decisions.length > 0 ? decisions.map((d, i) => {
                const key = `decision-${i}`;
                const open = openKeys.has(key);
                return (
                  <Row key={i} first={i === 0} onClick={() => toggle(key)}>
                    <span style={{ fontSize: "0.86rem", lineHeight: 1.5, color: "var(--text-strong)", fontWeight: 450 }}>{d.decision}</span>
                    <div style={{ fontSize: "0.68rem", color: "var(--subtle)", marginTop: 5 }}>
                      {open ? "⌄ " : "› "}rationale
                    </div>
                    {open && (
                      <div style={{ marginTop: 7, fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid var(--line-strong)" }}>
                        {d.rationale}
                      </div>
                    )}
                    <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                      <PinLink roomSlug={slug} cardType="mirror" cardKey={`decision:${d.decision}`} cardData={d} />
                    </div>
                  </Row>
                );
              }) : <Empty>Nothing settled yet.</Empty>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
