"use client";

import { AlertTriangle } from "lucide-react";

interface DirectoryPathsProps {
  repositoriesRootDir: string;
  setRepositoriesRootDir: (value: string) => void;
  indexDir: string;
  setIndexDir: (value: string) => void;
}

export function DirectoryPaths({
  repositoriesRootDir,
  setRepositoriesRootDir,
  indexDir,
  setIndexDir,
}: DirectoryPathsProps) {
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
        Directory Paths
      </h3>

      {/* Warning banner */}
      <div
        style={{
          padding: "1rem",
          backgroundColor: "#fff3cd",
          border: "1px solid #ffecb5",
          borderRadius: "2px",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
        }}
      >
        <AlertTriangle
          size={20}
          style={{ color: "#856404", flexShrink: 0, marginTop: "2px" }}
        />
        <div>
          <strong
            style={{
              color: "#856404",
              fontSize: "0.875rem",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Restart Required
          </strong>
          <p
            style={{
              margin: 0,
              color: "#856404",
              fontSize: "0.875rem",
              lineHeight: "1.4",
            }}
          >
            Changes to directory paths require restarting both the API and web
            servers to take effect. Directories will be created automatically if
            they don't exist.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label
          htmlFor="repositories-root-dir"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
            fontSize: "0.875rem",
          }}
        >
          Repositories Root Directory
        </label>
        <input
          id="repositories-root-dir"
          type="text"
          value={repositoriesRootDir}
          onChange={(e) => setRepositoriesRootDir(e.target.value)}
          required
          placeholder="/path/to/wiki-repositories"
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
          Directory where all repository clones are stored. Will be created if
          it doesn't exist.
        </small>
      </div>

      <div style={{ marginBottom: 0 }}>
        <label
          htmlFor="index-dir"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
            fontSize: "0.875rem",
          }}
        >
          Search Index Directory
        </label>
        <input
          id="index-dir"
          type="text"
          value={indexDir}
          onChange={(e) => setIndexDir(e.target.value)}
          required
          placeholder="/path/to/search-index"
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
          Directory for Whoosh search index files. Will be created if it doesn't
          exist.
        </small>
      </div>
    </div>
  );
}
