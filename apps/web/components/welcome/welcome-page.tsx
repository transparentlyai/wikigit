'use client';

import Link from 'next/link';
import { BookOpen, GitBranch, Search, Settings, Users } from 'lucide-react';

export function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="bg-white rounded-lg shadow-xl p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-900 rounded-xl mb-6">
              <span className="text-3xl font-bold text-white">WG</span>
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Welcome to WikiGit
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A Git-powered knowledge base for teams. Store, organize, and collaborate on documentation with the power of version control.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <GitBranch className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Git-Backed Storage
                  </h3>
                  <p className="text-sm text-gray-600">
                    All your content is stored in Git repositories with full version history and branch support.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Search className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Full-Text Search
                  </h3>
                  <p className="text-sm text-gray-600">
                    Quickly find what you need with powerful search across all your documentation.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Markdown Editing
                  </h3>
                  <p className="text-sm text-gray-600">
                    Write and edit documentation in Markdown with live preview and syntax highlighting.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Multi-Repository
                  </h3>
                  <p className="text-sm text-gray-600">
                    Manage multiple repositories in one place, perfect for organizing different projects or teams.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-600" />
              Getting Started
            </h2>
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Configure GitHub Integration
                  </h4>
                  <p className="text-sm text-gray-600">
                    Set up your GitHub user ID and access token to enable repository management.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Add Your Repositories
                  </h4>
                  <p className="text-sm text-gray-600">
                    Connect your existing GitHub repositories or create new ones for your documentation.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Set Your Home Page
                  </h4>
                  <p className="text-sm text-gray-600">
                    Choose an article from your repositories to display as your home page.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/admin"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
              Go to Admin Panel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
