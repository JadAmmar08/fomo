"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function EnableNotifications() {
  const [status, setStatus] = useState<"idle" | "enabling" | "enabled" | "denied" | "unsupported">("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    // Permission alone doesn't mean a subscription actually exists — check for a
    // real, active push subscription rather than trusting the permission state.
    navigator.serviceWorker.getRegistration().then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      setStatus(subscription ? "enabled" : "idle");
    });
  }, []);

  async function enable() {
    setStatus("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      // Wait for the service worker to actually become active — registering alone
      // doesn't guarantee that, and subscribing too early fails with
      // "no active Service Worker."
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription)
      });

      setStatus("enabled");
    } catch (err) {
      console.error("[EnableNotifications] failed:", err);
      setStatus("idle");
    }
  }

  if (status === "unsupported") return null;

  if (status === "enabled") {
    return <span style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>Notifications on</span>;
  }

  if (status === "denied") {
    return (
      <span style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>
        Notifications blocked — enable in browser settings
      </span>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={status === "enabling"}
      className="button-secondary"
      style={{ fontSize: "0.85rem", cursor: status === "enabling" ? "wait" : "pointer" }}
    >
      {status === "enabling" ? "Enabling…" : "Enable notifications"}
    </button>
  );
}
