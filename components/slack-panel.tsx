"use client";

import { useEffect, useState } from "react";

interface Channel {
  id: string;
  name: string;
}

interface ChannelsResponse {
  connected: boolean;
  teamName?: string;
  linkedChannelId?: string | null;
  channels?: Channel[];
  error?: string;
}

interface SummaryResponse {
  connected: boolean;
  linked?: boolean;
  channelName?: string;
  summary?: string | null;
  error?: string;
}

export function SlackPanel({ roomId }: { roomId: string }) {
  const [channels, setChannels] = useState<ChannelsResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetch(`/api/integrations/slack/channels?roomId=${roomId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(setChannels)
      .catch(() => setChannels({ connected: false }))
      .finally(() => setLoading(false));
  }, [roomId]);

  useEffect(() => {
    if (channels?.linkedChannelId) {
      fetch(`/api/integrations/slack/summary?roomId=${roomId}`, { credentials: "include" })
        .then((r) => r.json())
        .then(setSummary)
        .catch(() => setSummary(null));
    }
  }, [channels?.linkedChannelId, roomId]);

  async function linkChannel(channel: Channel) {
    setLinking(true);
    await fetch("/api/integrations/slack/channels", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, channelId: channel.id, channelName: channel.name })
    });
    setChannels((prev) => (prev ? { ...prev, linkedChannelId: channel.id } : prev));
    setLinking(false);
  }

  if (loading) return null;

  return (
    <section data-reveal style={{
      background: "white", borderRadius: 20, border: "1px solid var(--line)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.07)", padding: "40px", marginBottom: 24
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, color: "var(--subtle)", fontSize: "0.75rem", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 500 }}>
        <span style={{ display: "block", width: 32, height: 1, background: "var(--line-strong)" }} />
        Slack (beta)
      </div>

      {!channels?.connected ? (
        <>
          <h2 style={{ marginBottom: 8 }}>Connect this team&apos;s Slack.</h2>
          <p style={{ maxWidth: 480, marginBottom: 20 }}>
            Once installed, pick one channel this whole room already shares — FOMO only ever reads a
            channel every member of this room has already agreed to be in, never DMs or channels
            outside this team.
          </p>
          <a href={`/api/integrations/slack/connect?roomId=${roomId}`} className="button-secondary" style={{ display: "inline-flex" }}>
            Connect Slack workspace →
          </a>
        </>
      ) : !channels.linkedChannelId ? (
        <>
          <h2 style={{ marginBottom: 8 }}>Connected to {channels.teamName}.</h2>
          <p style={{ maxWidth: 480, marginBottom: 20 }}>
            Pick the channel this room uses — everyone in it should already be a member of this FOMO team.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {channels.channels?.map((c) => (
              <button
                key={c.id}
                onClick={() => linkChannel(c)}
                disabled={linking}
                className="button-secondary"
                style={{ justifyContent: "flex-start", cursor: linking ? "wait" : "pointer" }}
              >
                #{c.name}
              </button>
            ))}
            {channels.channels?.length === 0 && (
              <p style={{ color: "var(--subtle)", fontSize: "0.9rem" }}>
                No public channels found in this workspace yet.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: "0.85rem", color: "var(--subtle)", marginBottom: 12 }}>
            Reading #{channels.channels?.find((c) => c.id === channels.linkedChannelId)?.name ?? summary?.channelName}
          </p>
          {summary?.summary ? (
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.1rem", fontStyle: "italic", lineHeight: 1.7, color: "var(--text)" }}>
              {summary.summary}
            </p>
          ) : (
            <p>No recent activity found in this channel yet.</p>
          )}
        </>
      )}
    </section>
  );
}
