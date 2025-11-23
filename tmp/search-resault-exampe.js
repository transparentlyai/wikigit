import React, { useState } from "react";
import {
  Search,
  FileText,
  Terminal,
  Hash,
  Settings,
  Menu,
  ChevronRight,
  Clock,
  Database,
  MoreHorizontal,
} from "lucide-react";

export default function App() {
  const [searchTerm, setSearchTerm] = useState("ssh");

  // Mock Data matching the user's screenshot but "cleaned up" structure
  const results = [
    {
      id: 1,
      title: "Connect to Refinitiv SQL Server with DBeaver",
      path: ["tech", "DBeaver-Refinitiv"],
      type: "database",
      relevance: 100,
      updated: "2 days ago",
      snippet:
        "Press the SSH tab. Add Host rstudio.transparently.ai... and your password. This allows for secure tunneling through the bastion host directly into the DB instance.",
    },
    {
      id: 2,
      title: "Gcloud CLI Configuration",
      path: ["tech", "gcloud"],
      type: "terminal",
      relevance: 99,
      updated: "1 week ago",
      snippet:
        "Install connect ssh $ gcloud compute ssh &lt;instace&gt; create tunnel... gcloud compute ssh <instance> --NL <localport>... Ensure your local port forwarding is active.",
    },
    {
      id: 3,
      title: "GCP Inter-Project VPC Connectivity Guide",
      path: ["tech", "GCP_VPC_Connectivity"],
      type: "doc",
      relevance: 90,
      updated: "3 weeks ago",
      snippet:
        "SSH into machine-a: gcloud compute ssh machine-a --project=celeritas... if standard SSH keys are not set up. ssh $TARGET_VM_IP.",
    },
    {
      id: 4,
      title: "Troubleshooting SSH Timeouts",
      path: ["ops", "troubleshooting"],
      type: "doc",
      relevance: 85,
      updated: "1 month ago",
      snippet:
        "If you experience timeouts while attempting to ssh into the production cluster, check your VPN connection status first.",
    },
    {
      id: 5,
      title: "Legacy Authentication Protocols",
      path: ["archive", "auth-v1"],
      type: "doc",
      relevance: 60,
      updated: "2 years ago",
      snippet:
        "Historical reference for old ssh-dss keys. Do not use for new implementations. Kept for audit logs only.",
    },
  ];

  // Helper to choose icon based on type
  const getIcon = (type) => {
    switch (type) {
      case "terminal":
        return <Terminal className="w-5 h-5 text-purple-500" />;
      case "database":
        return <Database className="w-5 h-5 text-blue-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  // Helper to highlight the search term in the snippet
  const HighlightedText = ({ text, highlight }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span
              key={i}
              className="bg-yellow-100 text-gray-900 font-medium rounded px-0.5 border border-yellow-200"
            >
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-white font-sans text-gray-900 overflow-hidden">
      {/* Sidebar - Simplified & Modernized */}
      <aside className="w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0 flex flex-col hidden md:flex">
        <div className="p-5 flex items-center space-x-3 border-b border-gray-100 bg-white">
          <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold text-xs">
            TW
          </div>
          <span className="font-semibold text-gray-800 tracking-tight">
            Transparently Wiki
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className="px-3 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Workspace
          </div>
          <a
            href="#"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-200/50 hover:text-gray-900 group transition-colors"
          >
            <FileText className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
            Home
          </a>
          <a
            href="#"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-200/50 hover:text-gray-900 group transition-colors"
          >
            <Hash className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
            AppSmith
          </a>
          <a
            href="#"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-200/50 hover:text-gray-900 group transition-colors"
          >
            <Hash className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
            Luca
          </a>
          <a
            href="#"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-900 bg-white shadow-sm border border-gray-200 rounded-md group"
          >
            <Hash className="mr-3 h-4 w-4 text-blue-500" />
            Tech
          </a>
          <a
            href="#"
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-200/50 hover:text-gray-900 group transition-colors"
          >
            <Hash className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
            Portal Docs
          </a>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-medium">
              N
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">Nathan M.</p>
              <p className="text-xs text-gray-500">Viewer</p>
            </div>
            <Settings className="ml-auto h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-200">
          <Menu className="w-6 h-6 text-gray-600" />
          <span className="font-bold">Wiki</span>
          <div className="w-6" />
        </div>

        {/* Sticky Search Header */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 pt-6 pb-4 px-6 md:px-12">
          <div className="max-w-3xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-sm text-base"
                placeholder="Search documentation..."
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <span className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                  ⌘K
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <p className="text-gray-500">
                Found{" "}
                <span className="font-medium text-gray-900">
                  {results.length} results
                </span>{" "}
                for{" "}
                <span className="font-medium text-gray-900">
                  "{searchTerm}"
                </span>
              </p>
              <p className="text-gray-400 text-xs">Search took 0.12s</p>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 pb-12">
          <div className="max-w-3xl mx-auto mt-2">
            <ul className="divide-y divide-gray-100">
              {results.map((result) => (
                <li
                  key={result.id}
                  className="group py-5 first:pt-2 hover:bg-gray-50/50 -mx-4 px-4 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon Column */}
                    <div className="mt-1.5 flex-shrink-0 p-2 bg-gray-50 rounded-lg border border-gray-100 group-hover:bg-white group-hover:shadow-sm transition-all">
                      {getIcon(result.type)}
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0">
                      {/* Meta / Breadcrumbs */}
                      <div className="flex items-center text-xs text-gray-500 mb-1 space-x-1">
                        {result.path.map((crumb, index) => (
                          <React.Fragment key={index}>
                            <span className="uppercase tracking-wide font-medium hover:text-gray-800 hover:underline cursor-pointer">
                              {crumb}
                            </span>
                            {index < result.path.length - 1 && (
                              <ChevronRight className="w-3 h-3 text-gray-300" />
                            )}
                          </React.Fragment>
                        ))}
                        <span className="text-gray-300 px-1">•</span>
                        <span className="flex items-center text-gray-400">
                          <Clock className="w-3 h-3 mr-1" /> {result.updated}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug mb-1">
                        {result.title}
                      </h3>

                      {/* Snippet */}
                      <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                        <HighlightedText
                          text={result.snippet}
                          highlight={searchTerm}
                        />
                      </p>
                    </div>

                    {/* Action / Relevance Column */}
                    <div className="flex-shrink-0 flex flex-col items-end space-y-2 pl-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          result.relevance >= 90
                            ? "bg-green-100 text-green-800"
                            : result.relevance >= 70
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {result.relevance}% match
                      </span>

                      <button className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination / Footer loader */}
            <div className="mt-8 text-center">
              <button className="text-sm text-gray-500 hover:text-gray-900 font-medium px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Load more results
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
