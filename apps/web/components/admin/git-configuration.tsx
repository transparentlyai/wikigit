"use client";

interface GitConfigurationProps {
  authorName: string;
  setAuthorName: (value: string) => void;
  authorEmail: string;
  setAuthorEmail: (value: string) => void;
  defaultBranch: string;
  setDefaultBranch: (value: string) => void;
}

export function GitConfiguration({
  authorName,
  setAuthorName,
  authorEmail,
  setAuthorEmail,
  defaultBranch,
  setDefaultBranch,
}: GitConfigurationProps) {
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
        Git Configuration
      </h3>
      <p
        style={{ marginBottom: "1rem", color: "#54595d", fontSize: "0.875rem" }}
      >
        Settings for automated Git commits. Changes take effect immediately.
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="author-name"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
            fontSize: "0.875rem",
          }}
        >
          Author Name
        </label>
        <input
          id="author-name"
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          required
          placeholder="WikiGit Bot"
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
          Name used for automated commits (e.g., content updates, file
          operations).
        </small>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="author-email"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
            fontSize: "0.875rem",
          }}
        >
          Author Email
        </label>
        <input
          id="author-email"
          type="email"
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          required
          placeholder="bot@wikigit.app"
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
          Email used for automated commits.
        </small>
      </div>

      <div style={{ marginBottom: 0 }}>
        <label
          htmlFor="default-branch"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
            fontSize: "0.875rem",
          }}
        >
          Default Branch for New Repositories
        </label>
        <input
          id="default-branch"
          type="text"
          value={defaultBranch}
          onChange={(e) => setDefaultBranch(e.target.value)}
          required
          placeholder="main"
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
          Default branch name when cloning new repositories.
        </small>
      </div>
    </div>
  );
}
