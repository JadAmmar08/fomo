"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";

interface Team {
  name: string;
  slug: string;
  role: string;
  type: "room" | "team";
}

interface AccountData {
  email: string | null;
  name: string | null;
  teams: Team[];
}

const MEMBER_KEY = "fomo_is_member";
const NAME_KEY = "fomo_name";

export default function SettingsPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ email: null, name: null, teams: [] }));
  }, []);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.removeItem(MEMBER_KEY);
    localStorage.removeItem(NAME_KEY);
    window.location.href = "/";
  }

  if (!data) {
    return <div style={{ padding: "80px 24px", textAlign: "center", color: "var(--muted)" }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "70px 24px 100px" }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--subtle)", marginBottom: 12 }}>
          Account
        </div>
        <h1 style={{ fontSize: "2.2rem", margin: 0 }}>{data.name ?? "Your account"}</h1>
        {data.email ? (
          <p style={{ color: "var(--muted)", marginTop: 8, fontSize: "1rem" }}>{data.email}</p>
        ) : (
          <p style={{ color: "var(--muted)", marginTop: 8, fontSize: "1rem" }}>
            No email on file yet — <Link href={"/login" as Route}>sign in</Link> to attach one.
          </p>
        )}
      </div>

      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 16 }}>Your teams</h2>
        {data.teams.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Not part of any team yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {data.teams.map((team) => (
              <Link
                key={team.slug}
                href={`/${team.type === "team" ? "teams" : "rooms"}/${team.slug}` as Route}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 18px", borderRadius: "var(--radius-md)",
                  background: "var(--surface-raised)", border: "1px solid var(--line-strong)",
                  color: "var(--text)", textDecoration: "none"
                }}
              >
                <span>{team.name}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--subtle)", textTransform: "capitalize" }}>{team.role}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, borderTop: "1px solid var(--line-strong)", paddingTop: 28 }}>
        <button className="button-secondary" onClick={signOut} disabled={signingOut}>
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
        <Link href="/privacy" className="button-secondary" style={{ display: "inline-flex", alignItems: "center" }}>
          Privacy settings
        </Link>
      </div>
    </div>
  );
}
