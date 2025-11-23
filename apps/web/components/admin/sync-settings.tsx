"use client";

interface SyncSettingsProps {
  autoSyncInterval: number;
  setAutoSyncInterval: (value: number) => void;
}

export function SyncSettings({
  autoSyncInterval,
  setAutoSyncInterval,
}: SyncSettingsProps) {
  return (
    <div
      style={{
        padding: "1.5rem",
        backgroundColor: "#f8f9fa",
        border: "1px solid #a2a9b1",
        borderRadius: "2px",
        marginBottom: "2rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.125rem" }}>
        Repository Sync Settings
      </h3>
      <p
        style={{ marginBottom: "1rem", color: "#54595d", fontSize: "0.875rem" }}
      >
        Configure automatic synchronization behavior. Changes take effect
        immediately.
      </p>

      <div style={{ marginBottom: 0 }}>
        <label
          htmlFor="auto-sync-interval"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
            fontSize: "0.875rem",
          }}
        >
          Auto-Sync Interval (minutes)
        </label>
        <input
          id="auto-sync-interval"
          type="number"
          value={autoSyncInterval}
          onChange={(e) => setAutoSyncInterval(parseInt(e.target.value, 10))}
          required
          min={1}
          max={1440}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #a2a9b1",
            borderRadius: "2px",
            fontSize: "1rem",
            fontFamily: "monospace",
          }}
        />
        <small
          style={{ display: "block", marginTop: "0.25rem", color: "#54595d" }}
        >
          How often repositories automatically sync with remote (1-1440 minutes,
          max 24 hours).
        </small>
      </div>
    </div>
  );
}
