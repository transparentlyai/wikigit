# Software Requirements Specification (SRS)
# WikiGit - Git-Based Wiki Application

**Version:** 1.1
**Date:** November 21, 2025
**Status:** Draft

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Specifications](#6-technical-specifications)
7. [Data Requirements](#7-data-requirements)
8. [Appendices](#8-appendices)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document describes the functional and non-functional requirements for WikiGit, a Git-based wiki application that stores articles as markdown files in a Git repository. This document is intended for developers, testers, and stakeholders.

### 1.2 Scope
WikiGit is a web-based wiki application that:
- Stores articles as markdown files in a Git repository
- Provides version control for all content through Git
- Supports GitHub Flavored Markdown with Mermaid diagrams
- Offers full-text search across all articles
- Provides a Wikipedia-inspired user interface
- Supports admin configuration through YAML files
- Integrates with GCP Identity-Aware Proxy for authentication

### 1.3 Definitions, Acronyms, and Abbreviations
- **API**: Application Programming Interface
- **CRUD**: Create, Read, Update, Delete
- **GCP**: Google Cloud Platform
- **GFM**: GitHub Flavored Markdown
- **IAP**: Identity-Aware Proxy
- **SPA**: Single Page Application
- **UI**: User Interface
- **YAML**: YAML Ain't Markup Language

### 1.4 References
- GitHub Flavored Markdown Specification
- GCP Identity-Aware Proxy Documentation
- Next.js 15.5 Documentation
- FastAPI Documentation
- GitPython Documentation

### 1.5 Overview
This document is organized into sections covering system description, features, interface requirements, and technical specifications.

---

## 2. Overall Description

### 2.1 Product Perspective
WikiGit is a standalone web application consisting of:
- **Frontend**: Next.js 15.5 application (port 3003)
- **Backend**: FastAPI service (port 8000)
- **Storage**: Local Git repository for content
- **Search**: Whoosh full-text search index

The frontend proxies API requests to the backend, providing a unified interface for users.

### 2.2 Product Functions
Primary functions include:
- Article management (create, read, update, delete)
- Directory/section management
- Full-text search across all articles
- Git-based version control (auto-commit, optional auto-push)
- Admin configuration management
- User authentication via GCP IAP
- Markdown rendering with GitHub compatibility
- Mermaid diagram support

### 2.3 User Classes and Characteristics

#### 2.3.1 Regular Users
- **Characteristics**: Authenticated via GCP IAP
- **Privileges**:
  - View all articles
  - Create new articles and directories
  - Edit existing articles
  - Search content
  - View article history (via Git)
- **Technical Expertise**: Basic web user

#### 2.3.2 Admin Users
- **Characteristics**: Email addresses listed in `config.yaml`
- **Privileges**: All regular user privileges, plus:
  - Access admin configuration panel
  - Modify application settings
  - Manage admin user list
  - Configure domain settings
  - Configure Git remote settings
- **Technical Expertise**: Moderate technical knowledge

### 2.4 Operating Environment
- **Server OS**: Linux
- **Runtime**: Node.js 20+, Python 3.11+
- **Process Manager**: PM2 (optional) or direct execution
- **Port Requirements**: 3003 (frontend), 8000 (backend)
- **Authentication**: Behind GCP Identity-Aware Proxy

### 2.5 Design and Implementation Constraints
- Must use Git for content storage (no database)
- Must support GitHub Flavored Markdown
- Must integrate with GCP IAP for authentication
- Must be deployable on a single server without Docker
- All styling must be in a single CSS file for easy customization
- Port 3003 is required for frontend access

### 2.6 Assumptions and Dependencies
- GCP IAP is configured and provides user email headers
- Git is installed on the server
- Node.js 20+ and Python 3.11+ are available
- Network access for optional GitHub remote push
- Sufficient disk space for wiki content and search index

---

## 3. System Features

### 3.1 Authentication and Authorization

#### 3.1.1 Description
All users must be authenticated via GCP Identity-Aware Proxy. Admin users are identified by email addresses in the configuration file.

#### 3.1.2 Functional Requirements

**REQ-AUTH-001**: The system SHALL extract user email from GCP IAP header `X-Goog-Authenticated-User-Email`.

**REQ-AUTH-002**: The system SHALL deny access if the IAP header is missing or invalid.

**REQ-AUTH-003**: The system SHALL identify admin users by comparing the authenticated email against the `admin_users` list in `config.yaml`.

**REQ-AUTH-004**: The system SHALL restrict access to `/admin` routes to admin users only.

**REQ-AUTH-005**: The system SHALL return HTTP 401 for unauthenticated requests and HTTP 403 for unauthorized requests.

### 3.2 Article Management

#### 3.2.1 Description
Users can create, read, update, and delete wiki articles stored as markdown files.

#### 3.2.2 Functional Requirements

**REQ-ART-001**: The system SHALL display a list of all articles organized by directory structure.

**REQ-ART-002**: The system SHALL allow users to create new articles with:
- Title/filename
- Markdown content
- Directory/section location

**REQ-ART-003**: The system SHALL render articles using GitHub Flavored Markdown, including:
- Headers, lists, tables
- Code blocks with syntax highlighting
- Blockquotes, horizontal rules
- Links and images
- Mermaid diagrams
- Task lists

**REQ-ART-004**: The system SHALL provide an editor for creating and modifying articles with:
- Markdown editing capabilities
- Preview functionality
- Toolbar for common formatting

**REQ-ART-005**: The system SHALL save articles as `.md` files in the Git repository.

**REQ-ART-006**: The system SHALL commit changes to Git automatically on save with a descriptive commit message including:
- User email
- Timestamp
- Action (create/update/delete)
- Filename

**REQ-ART-007**: The system SHALL allow users to delete articles.

**REQ-ART-008**: The system SHALL support articles with spaces and special characters in filenames.

**REQ-ART-009**: The system SHALL generate a table of contents from article headings.

**REQ-ART-010**: The system SHALL validate that article filenames end with `.md` extension.

**REQ-ART-011**: The system SHALL add YAML frontmatter to all markdown files containing metadata.

**REQ-ART-012**: The frontmatter SHALL include the following fields:
- `title`: Article title (derived from filename or H1 heading)
- `author`: Email of the user who created the article
- `created_at`: ISO 8601 timestamp of creation
- `updated_at`: ISO 8601 timestamp of last update
- `updated_by`: Email of the user who last updated the article

**REQ-ART-013**: The system SHALL automatically update the frontmatter `updated_at` and `updated_by` fields on each save.

**REQ-ART-014**: The system SHALL preserve existing frontmatter when updating articles and only modify metadata fields.

**REQ-ART-015**: The system SHALL parse frontmatter when reading articles and exclude it from the rendered content.

**REQ-ART-016**: The system SHALL display article metadata (author, dates) in the article view interface.

### 3.3 Directory Management

#### 3.3.1 Description
Users can organize articles into directories (sections and subsections).

#### 3.3.2 Functional Requirements

**REQ-DIR-001**: The system SHALL allow users to create new directories.

**REQ-DIR-002**: The system SHALL support nested directories (subsections).

**REQ-DIR-003**: The system SHALL display directories in a hierarchical tree structure in the sidebar.

**REQ-DIR-004**: The system SHALL allow users to rename directories.

**REQ-DIR-005**: The system SHALL allow users to delete empty directories.

**REQ-DIR-006**: The system SHALL prevent deletion of directories containing articles without confirmation.

**REQ-DIR-007**: The system SHALL commit directory structure changes to Git.

### 3.4 Search

#### 3.4.1 Description
Users can search for content across all articles using full-text search.

#### 3.4.2 Functional Requirements

**REQ-SEARCH-001**: The system SHALL index all markdown file content using Whoosh.

**REQ-SEARCH-002**: The system SHALL provide a search input in the header.

**REQ-SEARCH-003**: The system SHALL return search results with:
- Article title
- Relevant text snippets
- Highlighted matching terms
- Link to article

**REQ-SEARCH-004**: The system SHALL rebuild the search index on application startup.

**REQ-SEARCH-005**: The system SHALL update the search index when articles are created, modified, or deleted.

**REQ-SEARCH-006**: The system SHALL support multi-word search queries.

**REQ-SEARCH-007**: The system SHALL rank search results by relevance.

### 3.5 Git Integration

#### 3.5.1 Description
All content changes are tracked through Git version control with automatic commits and optional remote push.

#### 3.5.2 Functional Requirements

**REQ-GIT-001**: The system SHALL initialize a Git repository if none exists at startup.

**REQ-GIT-002**: The system SHALL automatically commit changes after every save operation.

**REQ-GIT-003**: The system SHALL format commit messages as:
```
<action>: <filename>

Author: <user-email>
Date: <timestamp>
```

**REQ-GIT-004**: The system SHALL optionally push commits to a remote repository if configured.

**REQ-GIT-005**: The system SHALL use the configured Git author name and email for commits.

**REQ-GIT-006**: The system SHALL handle Git push failures gracefully and log errors.

**REQ-GIT-007**: The system SHALL support authentication for remote repositories via GitHub token.

**REQ-GIT-008**: The system SHALL store Git credentials securely via environment variables.

### 3.6 Admin Configuration

#### 3.6.1 Description
Admin users can view and modify application settings through a web interface.

#### 3.6.2 Functional Requirements

**REQ-ADMIN-001**: The system SHALL provide an admin panel accessible only to admin users.

**REQ-ADMIN-002**: The system SHALL allow admins to view current configuration settings.

**REQ-ADMIN-003**: The system SHALL allow admins to modify:
- Application name and description
- Domain setting
- Admin user list
- Git remote repository URL
- Auto-push setting
- Search index settings
- Maximum file size

**REQ-ADMIN-004**: The system SHALL validate configuration changes before applying.

**REQ-ADMIN-005**: The system SHALL save configuration changes to `config.yaml`.

**REQ-ADMIN-006**: The system SHALL reload configuration without requiring application restart where possible.

**REQ-ADMIN-007**: The system SHALL commit configuration changes to Git.

**REQ-ADMIN-008**: The system SHALL prevent admins from removing themselves from the admin list.

### 3.7 User Interface

#### 3.7.1 Description
The application provides a Wikipedia-inspired web interface.

#### 3.7.2 Functional Requirements

**REQ-UI-001**: The system SHALL display a header with:
- Application logo/name
- Search box
- Action buttons (New Article, Settings)

**REQ-UI-002**: The system SHALL display a collapsible sidebar with:
- Directory tree navigation
- Article links
- Icons for directories and files

**REQ-UI-003**: The system SHALL display article content in a main area with:
- Article title
- Rendered markdown
- Table of contents (optional, floating)

**REQ-UI-004**: The system SHALL provide an edit mode with:
- Markdown editor
- Save and Cancel buttons
- Preview capability

**REQ-UI-005**: The system SHALL use Wikipedia Vector skin styling for visual consistency.

**REQ-UI-006**: The system SHALL be responsive and work on desktop and tablet devices.

**REQ-UI-007**: The system SHALL display loading indicators during operations.

**REQ-UI-008**: The system SHALL display error messages clearly to users.

**REQ-UI-009**: The system SHALL display success confirmations for actions.

---

## 4. External Interface Requirements

### 4.1 User Interfaces

#### 4.1.1 Home Page
- Header with search and actions
- Sidebar with article tree
- Main content area showing welcome page or article list

#### 4.1.2 Article View Page
- Header with search and actions
- Sidebar with article tree (current article highlighted)
- Article metadata display (author, creation date, last updated date, last editor) shown below title
- Main content area with rendered article (without frontmatter)
- Edit button
- Optional table of contents

#### 4.1.3 Article Edit Page
- Header with search and actions
- Main content area with markdown editor
- Save and Cancel buttons
- Optional preview pane

#### 4.1.4 Search Results Page
- Header with search box (pre-filled with query)
- Sidebar with article tree
- Main content area with search results list

#### 4.1.5 Admin Panel
- Header with search and actions
- Main content area with configuration forms
- Section grouping for related settings
- Save buttons per section

### 4.2 Hardware Interfaces
No direct hardware interfaces required.

### 4.3 Software Interfaces

#### 4.3.1 GCP Identity-Aware Proxy
- **Type**: HTTP Header-based Authentication
- **Interface**: HTTP headers `X-Goog-Authenticated-User-Email` and `X-Goog-Authenticated-User-Id`
- **Purpose**: User authentication
- **Data**: User email address

#### 4.3.2 Git Repository
- **Type**: File system and Git CLI
- **Interface**: GitPython library
- **Purpose**: Content storage and version control
- **Data**: Markdown files, directory structure, commit history

#### 4.3.3 GitHub (Optional)
- **Type**: HTTPS Git Remote
- **Interface**: Git protocol with token authentication
- **Purpose**: Remote backup and synchronization
- **Data**: Repository commits and content

### 4.4 Communication Interfaces

#### 4.4.1 Frontend-Backend Communication
- **Protocol**: HTTP/1.1
- **Format**: JSON (REST API)
- **Port**: Backend on 8000, Frontend proxies `/api/*` requests
- **Authentication**: GCP IAP headers forwarded

#### 4.4.2 API Endpoints

##### Authentication
- `GET /health` - Health check (no auth required)

##### Articles
- `GET /articles` - List all articles
- `GET /articles/{path}` - Get article content
- `POST /articles` - Create new article
- `PUT /articles/{path}` - Update article
- `DELETE /articles/{path}` - Delete article

##### Directories
- `GET /directories` - List directory tree
- `POST /directories` - Create directory
- `PUT /directories/{path}` - Rename directory
- `DELETE /directories/{path}` - Delete directory

##### Search
- `GET /search?q={query}` - Search articles
- `POST /search/reindex` - Rebuild search index (admin only)

##### Configuration (Admin Only)
- `GET /config` - Get current configuration
- `PUT /config` - Update configuration

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

**REQ-PERF-001**: Article page load time SHALL be under 2 seconds for articles up to 100KB.

**REQ-PERF-002**: Search results SHALL be returned within 1 second for a repository with up to 1000 articles.

**REQ-PERF-003**: The sidebar navigation SHALL render within 500ms for up to 500 articles.

**REQ-PERF-004**: Git commit operations SHALL complete within 3 seconds.

**REQ-PERF-005**: The system SHALL support concurrent access by up to 50 users.

### 5.2 Security Requirements

**REQ-SEC-001**: The system SHALL only accept requests with valid GCP IAP headers.

**REQ-SEC-002**: The system SHALL not expose Git credentials in logs or API responses.

**REQ-SEC-003**: The system SHALL validate all user inputs to prevent injection attacks.

**REQ-SEC-004**: The system SHALL sanitize markdown content to prevent XSS attacks.

**REQ-SEC-005**: The system SHALL implement rate limiting on API endpoints.

**REQ-SEC-006**: The system SHALL log all admin configuration changes.

**REQ-SEC-007**: The system SHALL prevent path traversal attacks in file operations.

### 5.3 Reliability Requirements

**REQ-REL-001**: The system SHALL have 99% uptime during business hours.

**REQ-REL-002**: The system SHALL automatically recover from transient Git errors.

**REQ-REL-003**: The system SHALL maintain data consistency even if Git push fails.

**REQ-REL-004**: The system SHALL rebuild the search index if corruption is detected.

**REQ-REL-005**: The system SHALL log all errors with sufficient detail for debugging.

### 5.4 Usability Requirements

**REQ-USE-001**: New users SHALL be able to create and edit articles within 5 minutes without training.

**REQ-USE-002**: The UI SHALL follow Wikipedia design patterns for familiarity.

**REQ-USE-003**: All interactive elements SHALL provide visual feedback on hover/click.

**REQ-USE-004**: Error messages SHALL be clear and actionable.

**REQ-USE-005**: The markdown editor SHALL provide keyboard shortcuts for common operations.

### 5.5 Maintainability Requirements

**REQ-MAINT-001**: All CSS SHALL be contained in a single file (`wiki.css`) for easy customization.

**REQ-MAINT-002**: Configuration SHALL be in YAML format for human readability.

**REQ-MAINT-003**: The codebase SHALL follow consistent coding standards.

**REQ-MAINT-004**: All modules SHALL have clear separation of concerns.

**REQ-MAINT-005**: The system SHALL provide comprehensive logs for troubleshooting.

### 5.6 Portability Requirements

**REQ-PORT-001**: The application SHALL run on any Linux distribution with Node.js 20+ and Python 3.11+.

**REQ-PORT-002**: The application SHALL not require Docker or containerization.

**REQ-PORT-003**: The application SHALL support deployment via simple shell scripts.

**REQ-PORT-004**: The application SHALL work on modern browsers (Chrome, Firefox, Safari, Edge).

### 5.7 Scalability Requirements

**REQ-SCALE-001**: The system SHALL support repositories with up to 10,000 articles without performance degradation.

**REQ-SCALE-002**: The system SHALL handle article sizes up to 10MB (configurable).

**REQ-SCALE-003**: The directory tree SHALL support nesting up to 10 levels deep.

---

## 6. Technical Specifications

### 6.1 Technology Stack

#### 6.1.1 Frontend
- **Framework**: Next.js 15.5
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5+
- **UI Library**: React 19
- **State Management**: Zustand 5.0
- **Markdown Editor**: MDXEditor 3.11
- **Markdown Renderer**: react-markdown 9.0
- **Markdown Plugins**: remark-gfm 4.0, remark-mermaid 1.0
- **Syntax Highlighting**: Shiki 1.0
- **Icons**: Lucide React 0.400
- **Styling**: Custom CSS (single file)
- **Package Manager**: pnpm 9.0

#### 6.1.2 Backend
- **Framework**: FastAPI 0.115+
- **Runtime**: Python 3.11+
- **ASGI Server**: Uvicorn 0.32+
- **Git Library**: GitPython 3.1+
- **Config Management**: pydantic-settings-yaml 0.2+
- **Search Engine**: Whoosh 2.7+
- **Schema Validation**: Pydantic 2.10+
- **Frontmatter Parser**: python-frontmatter 1.1+
- **File Operations**: aiofiles 24.1+
- **Package Manager**: uv

#### 6.1.3 Monorepo
- **Tool**: Turborepo 2.0
- **Workspace Manager**: pnpm workspaces

### 6.2 Architecture

#### 6.2.1 System Architecture
```
┌──────────────────────────────────────┐
│       GCP Identity-Aware Proxy       │
│    (Authentication Layer)            │
└──────────────┬───────────────────────┘
               │
       ┌───────▼────────┐
       │   Next.js      │
       │   Frontend     │
       │   Port 3003    │
       │                │
       │  /api/* proxy  │
       └───────┬────────┘
               │
       ┌───────▼────────┐
       │   FastAPI      │
       │   Backend      │
       │   Port 8000    │
       │                │
       │  ┌──────────┐  │
       │  │ Services │  │
       │  │  - Git   │  │
       │  │  - Search│  │
       │  └──────────┘  │
       └───────┬────────┘
               │
        ┌──────▼──────┐
        │ File System │
        │             │
        │ wiki-content│
        │   (Git)     │
        │             │
        │ data/       │
        │  whoosh_idx │
        └─────────────┘
```

#### 6.2.2 Frontend Architecture
```
apps/web/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── article/           # Article routes
│   └── admin/             # Admin routes
├── components/
│   ├── layout/            # Layout components
│   ├── editor/            # Markdown editor
│   ├── viewer/            # Markdown viewer
│   └── search/            # Search components
├── lib/
│   ├── api.ts            # API client
│   └── store.ts          # Zustand store
└── styles/
    └── wiki.css          # All styles
```

#### 6.2.3 Backend Architecture
```
apps/api/app/
├── main.py                # FastAPI application
├── routers/               # API endpoints
│   ├── articles.py
│   ├── directories.py
│   ├── search.py
│   └── config.py
├── services/              # Business logic
│   ├── git_service.py
│   └── search_service.py
├── middleware/            # Middleware
│   └── auth.py
├── models/                # Pydantic models
│   └── schemas.py
└── config/                # Configuration
    └── settings.py
```

### 6.3 Data Models

#### 6.3.1 Configuration Model (YAML)
```yaml
app:
  name: string
  description: string
  domain: string
  max_file_size_mb: integer

admin_users:
  - string (email)

repository:
  path: string
  remote_url: string (optional)
  auto_push: boolean
  github_token: string (optional)
  author_name: string
  author_email: string

search:
  index_path: string
  rebuild_on_startup: boolean
```

#### 6.3.2 Article Model (API)
```typescript
interface Article {
  path: string;          // Relative path from repo root
  title: string;         // From frontmatter or derived from filename
  content: string;       // Markdown content (without frontmatter)
  author: string;        // From frontmatter - original creator
  created_at: string;    // From frontmatter - ISO timestamp
  updated_at: string;    // From frontmatter - ISO timestamp
  updated_by: string;    // From frontmatter - last editor email
}
```

#### 6.3.2.1 Article Frontmatter (Markdown File Format)
```yaml
---
title: Article Title
author: user@example.com
created_at: 2025-11-21T10:00:00Z
updated_at: 2025-11-21T15:30:00Z
updated_by: another@example.com
---

# Article Title

Article content goes here...
```

**Frontmatter Fields:**
- `title`: Article title (string)
- `author`: Email of original creator (string)
- `created_at`: Creation timestamp in ISO 8601 format (string)
- `updated_at`: Last update timestamp in ISO 8601 format (string)
- `updated_by`: Email of last editor (string)

#### 6.3.3 Directory Model (API)
```typescript
interface Directory {
  path: string;          // Relative path
  name: string;          // Directory name
  children: DirectoryNode[];
}

interface DirectoryNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  children?: DirectoryNode[];  // Only for directories
}
```

#### 6.3.4 Search Result Model (API)
```typescript
interface SearchResult {
  path: string;          // Article path
  title: string;         // Article title
  snippet: string;       // Highlighted excerpt
  score: number;         // Relevance score
}
```

### 6.4 File Structure

#### 6.4.1 Wiki Content Repository
```
wiki-content/
├── .git/                  # Git repository
├── README.md              # Initial article with frontmatter
├── Section-1/
│   ├── article-1.md       # Article with frontmatter
│   └── Subsection-1/
│       └── article-2.md   # Article with frontmatter
└── Section-2/
    └── article-3.md       # Article with frontmatter
```

**Example Article File (article-1.md):**
```markdown
---
title: Getting Started
author: admin@example.com
created_at: 2025-11-21T10:00:00Z
updated_at: 2025-11-21T15:30:00Z
updated_by: editor@example.com
---

# Getting Started

Welcome to the wiki! This article explains how to get started...

## Prerequisites

- Requirement 1
- Requirement 2

## Installation

Follow these steps...
```

#### 6.4.2 Data Directory
```
data/
└── whoosh_index/          # Search index files
    ├── _MAIN_*.toc
    └── *.seg
```

### 6.5 API Specifications

#### 6.5.1 List Articles
```
GET /articles
Response: 200 OK
{
  "articles": [
    {
      "path": "README.md",
      "title": "README",
      "updated_at": "2025-11-21T10:00:00Z"
    }
  ]
}
```

#### 6.5.2 Get Article
```
GET /articles/{path}
Response: 200 OK
{
  "path": "README.md",
  "title": "README",
  "content": "# Wiki Content\n...",
  "author": "user@example.com",
  "created_at": "2025-11-21T09:00:00Z",
  "updated_at": "2025-11-21T10:00:00Z",
  "updated_by": "editor@example.com"
}
```

**Note**: The `content` field contains only the markdown content without frontmatter. Metadata fields are extracted from frontmatter and returned separately. The frontend displays metadata as document information (author, dates) separate from the rendered content.

#### 6.5.3 Create Article
```
POST /articles
Request:
{
  "path": "New-Article.md",
  "content": "# New Article\n\nContent here..."
}
Response: 201 Created
{
  "path": "New-Article.md",
  "title": "New Article",
  "created_at": "2025-11-21T11:00:00Z"
}
```

#### 6.5.4 Update Article
```
PUT /articles/{path}
Request:
{
  "content": "# Updated Content\n..."
}
Response: 200 OK
```

#### 6.5.5 Delete Article
```
DELETE /articles/{path}
Response: 204 No Content
```

#### 6.5.6 Search
```
GET /search?q=query+terms
Response: 200 OK
{
  "query": "query terms",
  "results": [
    {
      "path": "Article.md",
      "title": "Article",
      "snippet": "...matching text with <em>query terms</em>...",
      "score": 0.95
    }
  ],
  "total": 1
}
```

### 6.6 Git Commit Message Format
```
<action>: <filename>

Author: <user-email>
Date: <iso-timestamp>

[Optional: Additional context]
```

**Actions:**
- `Create` - New file created
- `Update` - File modified
- `Delete` - File removed
- `Rename` - File or directory renamed
- `Config` - Configuration change

**Example:**
```
Update: guides/installation.md

Author: user@example.com
Date: 2025-11-21T10:30:00Z
```

---

## 7. Data Requirements

### 7.1 Data Storage

#### 7.1.1 Content Storage
- **Location**: `./wiki-content/` directory
- **Format**: Git repository with markdown files
- **Structure**: Hierarchical directories and files
- **Version Control**: Git commit history
- **Backup**: Optional remote Git repository

#### 7.1.2 Search Index Storage
- **Location**: `./data/whoosh_index/` directory
- **Format**: Whoosh index files
- **Rebuild**: On application startup or on-demand
- **Update**: Real-time on content changes

#### 7.1.3 Configuration Storage
- **Location**: `./config.yaml` file
- **Format**: YAML
- **Version Control**: Tracked in application Git repository
- **Update**: Via admin panel or manual edit

### 7.2 Data Backup and Recovery

**REQ-DATA-001**: Git repository SHALL serve as primary backup mechanism.

**REQ-DATA-002**: Optional remote Git repository SHALL provide offsite backup.

**REQ-DATA-003**: Search index MAY be rebuilt from source files if corrupted.

**REQ-DATA-004**: Configuration file SHOULD be backed up separately.

### 7.3 Data Integrity

**REQ-INT-001**: All file writes SHALL use atomic operations where possible.

**REQ-INT-002**: Git commits SHALL maintain referential integrity.

**REQ-INT-003**: Search index SHALL be consistent with file system state.

**REQ-INT-004**: The system SHALL detect and report file system conflicts.

---

## 8. Appendices

### 8.1 Appendix A: Markdown Support

WikiGit supports GitHub Flavored Markdown (GFM) including:

#### Standard Markdown
- Headers (H1-H6)
- Paragraphs and line breaks
- Emphasis (bold, italic, strikethrough)
- Lists (ordered, unordered, nested)
- Links and images
- Code (inline and blocks)
- Blockquotes
- Horizontal rules

#### GitHub Extensions
- Tables
- Task lists
- Autolinks
- Strikethrough

#### Additional Features
- Mermaid diagrams
- Syntax highlighting (via Shiki)
- Math expressions (future)

#### Frontmatter Handling
- **YAML frontmatter is NOT rendered** as part of the article content
- Frontmatter is parsed and extracted before rendering
- Metadata fields are displayed separately in the UI (below article title)
- Users edit markdown content only; the system manages frontmatter automatically
- The markdown editor does not expose frontmatter to users

### 8.2 Appendix B: Frontmatter Metadata Display

The article view page displays metadata extracted from frontmatter in a subtle, Wikipedia-style format:

**Example Display:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Getting Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created by admin@example.com on November 21, 2025
Last updated by editor@example.com on November 21, 2025, 3:30 PM

[Article content rendered here...]
```

**UI Implementation:**
- Displayed below article title in a smaller, muted text
- Uses subtle color (Wikipedia's --color-text-subtle: #54595d)
- Separated from content with subtle spacing
- Not editable directly by users (managed automatically)

### 8.3 Appendix C: Deployment Checklist

#### Pre-Deployment
- [ ] Linux server with Node.js 20+ and Python 3.11+
- [ ] Port 3003 accessible
- [ ] GCP IAP configured
- [ ] Git installed on server
- [ ] pnpm installed globally
- [ ] uv installed for Python

#### Deployment Steps
1. Clone repository
2. Run `pnpm install` (installs all dependencies)
3. Run `cd apps/api && uv sync`
4. Create and configure `config.yaml`
5. Run `./deploy.sh` or start services manually

#### Post-Deployment
- [ ] Verify frontend accessible at port 3003
- [ ] Verify API accessible at port 8000
- [ ] Test user authentication via IAP
- [ ] Test article creation and editing
- [ ] Test search functionality
- [ ] Configure admin users in `config.yaml`
- [ ] Test admin panel access

### 8.3 Appendix C: Environment Variables

```bash
# GitHub token for private repositories (optional)
GITHUB_TOKEN=ghp_...

# Log level
LOG_LEVEL=info

# Ports (optional, defaults shown)
API_PORT=8000
WEB_PORT=3003
```

### 8.4 Appendix D: Browser Compatibility

**Supported Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Required Features:**
- ES2020 JavaScript support
- CSS Grid and Flexbox
- Fetch API
- Local Storage

### 8.5 Appendix E: Wikipedia Styling Reference

WikiGit uses styling based on Wikipedia's Vector 2022 skin:

**Colors:**
- Text: #202122
- Links: #3366cc
- Background: #ffffff
- Borders: #a2a9b1

**Typography:**
- Headings: Linux Libertine, Georgia, Times, serif
- Body: System sans-serif stack
- Size: 0.875em (14px)
- Line height: 1.6

**Layout:**
- Sidebar: 220px
- Content max-width: 960px
- Header: 60px fixed

### 8.6 Appendix F: Future Enhancements

**Potential features for future versions:**
- Multiple repository support
- User profiles and preferences
- Article comments and discussions
- Real-time collaborative editing
- Article templates
- Import/export functionality
- Advanced diff viewer
- Branch and merge support
- Article analytics
- Dark mode theme
- Mobile responsive improvements
- Internationalization (i18n)
- Plugin system

---

## Document Control

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-21 | System | Initial SRS document |
| 1.1 | 2025-11-21 | System | Added frontmatter metadata requirements (REQ-ART-011 through REQ-ART-016), updated Article model, added python-frontmatter dependency |

**Approval:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Technical Lead | | | |
| QA Lead | | | |

---

**End of Document**
