"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type PrivacySettings } from "@/lib/types";
import { titleCase } from "@/lib/utils";

export function PrivacyControls({ initialSettings }: { initialSettings: PrivacySettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState("");

  async function save(next: Partial<PrivacySettings>) {
    const updated = { ...settings, ...next };
    setSettings(updated);
    setStatus("Saving...");

    const response = await fetch("/api/settings/privacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });

    setStatus(response.ok ? "Privacy settings updated" : "Could not update privacy settings");
    router.refresh();
  }

  async function deleteData(scope: "local" | "account") {
    setStatus(`Deleting ${scope} data...`);
    const response = await fetch("/api/user-data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope })
    });
    setStatus(response.ok ? `${scope === "local" ? "Local" : "Account"} data deleted` : "Delete failed");
    router.refresh();
  }

  function toggleCategory(category: (typeof CATEGORIES)[number]) {
    const exists = settings.shareableCategories.includes(category);
    const shareableCategories = exists
      ? settings.shareableCategories.filter((item) => item !== category)
      : [...settings.shareableCategories, category];
    save({ shareableCategories });
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="toggle-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3>Pause tracking</h3>
            <p style={{ marginBottom: 0 }}>Stop collecting new browsing signals until you turn tracking back on.</p>
          </div>
          <button
            type="button"
            className={settings.trackingPaused ? "button-secondary" : "button"}
            onClick={() => save({ trackingPaused: !settings.trackingPaused })}
          >
            {settings.trackingPaused ? "Tracking paused" : "Tracking active"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Anonymous contribution categories</h3>
        <p>Only these categories can contribute to Community Pulse.</p>
        <div className="button-row">
          {CATEGORIES.map((category) => {
            const enabled = settings.shareableCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                className={enabled ? "button" : "button-secondary"}
                onClick={() => toggleCategory(category)}
              >
                {titleCase(category)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Delete local data</h3>
          <p>Clears the local browsing signal history used by this MVP demo.</p>
          <button type="button" className="button-secondary" onClick={() => deleteData("local")}>
            Delete local data
          </button>
        </div>
        <div className="card">
          <h3>Delete account data</h3>
          <p>Deletes the seeded anonymous account and related preference state.</p>
          <button type="button" className="button-secondary danger" onClick={() => deleteData("account")}>
            Delete account data
          </button>
        </div>
      </div>

      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
