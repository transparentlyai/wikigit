"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { SearchManager } from "@/components/admin/search-manager";
import { ConfigManager } from "@/components/admin/config-manager";
import { GitHubSettings } from "@/components/admin/repositories/github-settings";
import { RepositoryScanner } from "@/components/admin/repositories/repository-scanner";
import { RepositoryList } from "@/components/admin/repositories/repository-list";
import { Database, Search, Settings, Github } from "lucide-react";

type TabId = "config" | "github" | "repositories" | "search";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("config");

  const tabs = [
    { id: "config" as TabId, label: "Configuration", icon: Settings },
    { id: "github" as TabId, label: "GitHub Integration", icon: Github },
    { id: "repositories" as TabId, label: "Repositories", icon: Database },
    { id: "search" as TabId, label: "Search Index", icon: Search },
  ];

  return (
    <MainLayout>
      <div className="wiki-main">
        <div className="wiki-content">
          <h1 className="wiki-page-title">Admin Panel</h1>
          <p style={{ marginBottom: "2rem", color: "#54595d" }}>
            Manage repositories, search index, and configuration settings.
          </p>

          {/* Tabs */}
          <div
            style={{
              borderBottom: "1px solid #a2a9b1",
              marginBottom: "2rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: "0.75rem 1.5rem",
                      backgroundColor:
                        activeTab === tab.id ? "#f8f9fa" : "transparent",
                      color: activeTab === tab.id ? "#202122" : "#54595d",
                      border: "none",
                      borderBottom:
                        activeTab === tab.id
                          ? "2px solid #3366cc"
                          : "2px solid transparent",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: activeTab === tab.id ? "bold" : "normal",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      transition: "all 0.2s",
                    }}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "config" && <ConfigManager />}

          {activeTab === "github" && <GitHubSettings />}

          {activeTab === "repositories" && (
            <div>
              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #a2a9b1",
                  borderRadius: "2px",
                  marginBottom: "2rem",
                }}
              >
                <RepositoryScanner />
              </div>

              <hr
                style={{
                  margin: "3rem 0",
                  border: "none",
                  borderTop: "1px solid #a2a9b1",
                }}
              />

              <RepositoryList />
            </div>
          )}

          {activeTab === "search" && <SearchManager />}
        </div>
      </div>
    </MainLayout>
  );
}
