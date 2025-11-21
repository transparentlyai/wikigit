# WikiGit Implementation Plan (SYP)

**Document Version:** 1.0
**Date:** November 21, 2025
**Status:** Awaiting Approval

---

## Overview

This document outlines the complete implementation plan for WikiGit based on the SRS v1.1. The implementation is divided into 8 phases, each building on the previous phase.

**Estimated Total Tasks:** ~120 tasks
**Implementation Order:** Sequential phases (some tasks within phases can be parallel)

---

## Phase 1: Project Setup & Infrastructure

**Goal:** Set up the monorepo structure, install dependencies, and create configuration files.

### 1.1 Root Workspace Setup
- [ ] Create root `package.json` with workspaces
- [ ] Create `turbo.json` for Turborepo configuration
- [ ] Create `.gitignore` (comprehensive)
- [ ] Create `README.md` with project overview
- [ ] Create `config.yaml.example` template

### 1.2 Backend Setup (apps/api)
- [ ] Create FastAPI project structure
  - [ ] `app/main.py` - FastAPI application entry point
  - [ ] `app/__init__.py`
  - [ ] `app/routers/__init__.py`
  - [ ] `app/services/__init__.py`
  - [ ] `app/middleware/__init__.py`
  - [ ] `app/models/__init__.py`
  - [ ] `app/config/__init__.py`
- [ ] Create `pyproject.toml` with all dependencies
- [ ] Install Python dependencies via `uv`:
  - fastapi
  - uvicorn[standard]
  - gitpython
  - pydantic
  - pydantic-settings
  - pydantic-settings-yaml
  - whoosh
  - python-frontmatter
  - aiofiles
  - python-multipart
  - pyyaml
- [ ] Create `.env.example`

### 1.3 Frontend Setup (apps/web)
- [ ] Initialize Next.js 15.5 project with TypeScript
- [ ] Create `package.json` with all dependencies
- [ ] Configure `next.config.js` with API rewrites
- [ ] Configure `tsconfig.json`
- [ ] Install dependencies via `pnpm`:
  - next@^15.5.0
  - react@^19.0.0
  - react-dom@^19.0.0
  - @mdxeditor/editor
  - react-markdown
  - remark-gfm
  - remark-mermaid
  - shiki
  - zustand
  - lucide-react
- [ ] Verify `styles/wiki.css` exists (already created)

### 1.4 Directory Structure
- [ ] Create `wiki-content/` directory
- [ ] Initialize Git repository in `wiki-content/`
- [ ] Create initial `wiki-content/README.md` with frontmatter
- [ ] Create `data/` directory
- [ ] Create `data/whoosh_index/` directory
- [ ] Create `logs/` directory

### 1.5 Scripts
- [ ] Create `start.sh` - Start both services
- [ ] Create `stop.sh` - Stop services
- [ ] Create `dev.sh` - Development mode
- [ ] Make scripts executable

### 1.6 Configuration
- [ ] Create `config.yaml` from template
- [ ] Set up default admin user
- [ ] Configure Git repository settings

**Phase 1 Deliverable:** Complete project structure with all dependencies installed

---

## Phase 2: Backend Core Implementation

**Goal:** Implement authentication, configuration management, and basic Git operations.

### 2.1 Configuration Management (app/config/settings.py)
- [ ] Create Pydantic settings model for `config.yaml`
- [ ] Implement YAML loading with `pydantic-settings-yaml`
- [ ] Add environment variable support (`${VAR}` syntax)
- [ ] Create config singleton instance
- [ ] Add config validation logic

### 2.2 Authentication Middleware (app/middleware/auth.py)
- [ ] Create `AuthMiddleware` class
- [ ] Extract user email from `X-Goog-Authenticated-User-Email` header
- [ ] Parse email from IAP format (`accounts.google.com:email`)
- [ ] Add user email to `request.state.user_email`
- [ ] Handle missing/invalid headers (401 error)
- [ ] Skip auth for `/health` endpoint

### 2.3 Authorization Helpers (app/middleware/auth.py)
- [ ] Create `require_admin()` dependency
- [ ] Check if user email is in admin list from config
- [ ] Return 403 if not admin
- [ ] Create `get_current_user()` dependency

### 2.4 Pydantic Models (app/models/schemas.py)
- [ ] `Article` model (with frontmatter fields)
- [ ] `ArticleCreate` model
- [ ] `ArticleUpdate` model
- [ ] `Directory` model
- [ ] `DirectoryNode` model (recursive)
- [ ] `SearchResult` model
- [ ] `ConfigUpdate` model

### 2.5 Git Service (app/services/git_service.py)
- [ ] Create `GitService` class
- [ ] `initialize_repo()` - Initialize Git repo if not exists
- [ ] `add_and_commit()` - Stage and commit changes
  - [ ] Format commit message with user, timestamp, action
- [ ] `push_to_remote()` - Push to remote if configured
- [ ] `get_file_history()` - Get commit history for file
- [ ] Error handling for Git operations

### 2.6 Frontmatter Service (app/services/frontmatter_service.py)
- [ ] Create `FrontmatterService` class
- [ ] `parse_article()` - Parse markdown file, extract frontmatter
- [ ] `create_frontmatter()` - Generate frontmatter for new articles
- [ ] `update_frontmatter()` - Update metadata fields
- [ ] `serialize_article()` - Combine frontmatter + content
- [ ] Handle missing frontmatter (add it to existing files)

### 2.7 Health Check (app/routers/health.py)
- [ ] Create health check endpoint `GET /health`
- [ ] Return system status, version info

### 2.8 FastAPI Main Application (app/main.py)
- [ ] Initialize FastAPI app
- [ ] Add CORS middleware (allow frontend origin)
- [ ] Add AuthMiddleware
- [ ] Include all routers
- [ ] Add startup event to initialize Git repo
- [ ] Add error handlers

**Phase 2 Deliverable:** Working backend with auth, config, and Git integration

---

## Phase 3: Frontend Foundation

**Goal:** Build the basic UI structure, layout, and routing.

### 3.1 App Structure (apps/web/app/)
- [ ] Create `layout.tsx` - Root layout with wiki.css import
- [ ] Create `page.tsx` - Home/article list page
- [ ] Create `article/[...slug]/page.tsx` - Article view/edit
- [ ] Create `admin/page.tsx` - Admin panel

### 3.2 Layout Components (apps/web/components/layout/)
- [ ] `header.tsx` - Header with logo, search, actions
  - [ ] Logo/title (links to home)
  - [ ] Search input
  - [ ] "New Article" button
  - [ ] "Admin" button (conditional)
- [ ] `sidebar.tsx` - Sidebar with file tree
  - [ ] Recursive tree rendering
  - [ ] Directory expand/collapse
  - [ ] Article links
  - [ ] Icons for files/folders
- [ ] `main-layout.tsx` - Complete layout wrapper

### 3.3 API Client (apps/web/lib/api.ts)
- [ ] Create API client with fetch wrapper
- [ ] `getArticles()` - List all articles
- [ ] `getArticle(path)` - Get single article
- [ ] `createArticle(data)` - Create article
- [ ] `updateArticle(path, data)` - Update article
- [ ] `deleteArticle(path)` - Delete article
- [ ] `getDirectories()` - Get directory tree
- [ ] `createDirectory(path)` - Create directory
- [ ] `deleteDirectory(path)` - Delete directory
- [ ] `search(query)` - Search articles
- [ ] `getConfig()` - Get config (admin)
- [ ] `updateConfig(data)` - Update config (admin)
- [ ] Error handling with proper messages

### 3.4 State Management (apps/web/lib/store.ts)
- [ ] Create Zustand store
- [ ] `articles` - List of articles
- [ ] `currentArticle` - Currently viewed article
- [ ] `directories` - Directory tree
- [ ] `searchResults` - Search results
- [ ] `isLoading` - Loading state
- [ ] `error` - Error messages
- [ ] Actions for updating state

### 3.5 Type Definitions (apps/web/types/)
- [ ] `article.ts` - Article types
- [ ] `directory.ts` - Directory types
- [ ] `config.ts` - Config types

**Phase 3 Deliverable:** Working frontend structure with routing and API integration

---

## Phase 4: Article Management Features

**Goal:** Implement complete article CRUD with frontmatter handling.

### 4.1 Backend - Article Router (app/routers/articles.py)
- [ ] `GET /articles` - List all articles
  - [ ] Scan wiki-content directory
  - [ ] Parse frontmatter from each file
  - [ ] Return article list with metadata
- [ ] `GET /articles/{path}` - Get single article
  - [ ] Read file from wiki-content
  - [ ] Parse frontmatter
  - [ ] Return content WITHOUT frontmatter
  - [ ] Return metadata separately
- [ ] `POST /articles` - Create article
  - [ ] Validate input (path, content)
  - [ ] Extract user email from request.state
  - [ ] Create frontmatter with author, timestamps
  - [ ] Combine frontmatter + content
  - [ ] Write file to wiki-content
  - [ ] Git commit with message
  - [ ] Push if configured
  - [ ] Return created article
- [ ] `PUT /articles/{path}` - Update article
  - [ ] Read existing file
  - [ ] Parse existing frontmatter
  - [ ] Update `updated_at` and `updated_by`
  - [ ] Preserve `author` and `created_at`
  - [ ] Write updated file
  - [ ] Git commit
  - [ ] Push if configured
- [ ] `DELETE /articles/{path}` - Delete article
  - [ ] Delete file
  - [ ] Git commit
  - [ ] Push if configured

### 4.2 Frontend - Markdown Viewer (apps/web/components/viewer/)
- [ ] `markdown-viewer.tsx` - Render markdown
  - [ ] Use react-markdown
  - [ ] Configure remark-gfm plugin
  - [ ] Configure remark-mermaid plugin
  - [ ] Add Shiki for syntax highlighting
  - [ ] Apply `.markdown-content` CSS class
- [ ] `article-metadata.tsx` - Display metadata
  - [ ] Show author, created date, updated date, updated by
  - [ ] Format dates nicely
  - [ ] Use Wikipedia-style subtle formatting
- [ ] `table-of-contents.tsx` - Generate TOC from headings
  - [ ] Extract h1-h3 headings
  - [ ] Create anchor links
  - [ ] Apply `.toc` CSS class

### 4.3 Frontend - Markdown Editor (apps/web/components/editor/)
- [ ] `markdown-editor.tsx` - MDXEditor integration
  - [ ] Configure MDXEditor with GitHub-compatible features
  - [ ] Add toolbar for common operations
  - [ ] Handle value changes
  - [ ] Apply `.editor-container` CSS class
- [ ] `editor-toolbar.tsx` - Custom toolbar buttons
  - [ ] Save button
  - [ ] Cancel button
  - [ ] Preview toggle (optional)

### 4.4 Frontend - Article View Page (apps/web/app/article/[...slug]/page.tsx)
- [ ] Fetch article from API
- [ ] Display article title
- [ ] Display article metadata (below title)
- [ ] Render markdown content
- [ ] Show table of contents
- [ ] "Edit" button to switch to edit mode
- [ ] Handle loading states
- [ ] Handle errors (404, etc.)

### 4.5 Frontend - Article Edit Mode
- [ ] Toggle between view/edit mode
- [ ] Load article content into editor (WITHOUT frontmatter)
- [ ] Handle save action
  - [ ] Call updateArticle API
  - [ ] Show success message
  - [ ] Switch back to view mode
- [ ] Handle cancel action
- [ ] Show unsaved changes warning

### 4.6 Frontend - New Article Page
- [ ] Modal or page for creating articles
- [ ] Input for article title/path
- [ ] Directory selector
- [ ] Markdown editor
- [ ] Save button
- [ ] Call createArticle API

**Phase 4 Deliverable:** Complete article management with frontmatter

---

## Phase 5: Directory Management

**Goal:** Implement directory creation, deletion, and tree navigation.

### 5.1 Backend - Directory Router (app/routers/directories.py)
- [ ] `GET /directories` - Get directory tree
  - [ ] Recursively scan wiki-content
  - [ ] Build tree structure
  - [ ] Return DirectoryNode hierarchy
- [ ] `POST /directories` - Create directory
  - [ ] Validate path
  - [ ] Create directory
  - [ ] Git commit
  - [ ] Push if configured
- [ ] `DELETE /directories/{path}` - Delete directory
  - [ ] Check if empty (or allow with confirmation)
  - [ ] Delete directory
  - [ ] Git commit
  - [ ] Push if configured
- [ ] `PUT /directories/{path}` - Rename directory
  - [ ] Rename directory
  - [ ] Update all article paths
  - [ ] Git commit

### 5.2 Frontend - Sidebar Navigation (apps/web/components/layout/sidebar.tsx)
- [ ] Fetch directory tree from API
- [ ] Render recursive tree component
- [ ] `tree-node.tsx` - Recursive tree node
  - [ ] Display folder icon or file icon
  - [ ] Handle expand/collapse for folders
  - [ ] Handle click to navigate to article
  - [ ] Highlight current article
- [ ] "New Folder" button
- [ ] Context menu for directories (right-click)
  - [ ] Rename
  - [ ] Delete

### 5.3 Frontend - Directory Operations
- [ ] `new-directory-modal.tsx` - Create directory dialog
  - [ ] Input for directory name
  - [ ] Parent directory selector
  - [ ] Save button
- [ ] `rename-directory-modal.tsx` - Rename dialog
- [ ] Delete confirmation dialog

**Phase 5 Deliverable:** Complete directory management with tree navigation

---

## Phase 6: Search Functionality

**Goal:** Implement full-text search with Whoosh.

### 6.1 Backend - Search Service (app/services/search_service.py)
- [ ] Create `SearchService` class
- [ ] `initialize_index()` - Create Whoosh index
  - [ ] Define schema (title, content, path)
  - [ ] Create index in data/whoosh_index
- [ ] `rebuild_index()` - Index all articles
  - [ ] Scan all markdown files
  - [ ] Parse content (exclude frontmatter)
  - [ ] Add to index
- [ ] `update_document()` - Update single article in index
- [ ] `delete_document()` - Remove article from index
- [ ] `search_query()` - Perform search
  - [ ] Parse query
  - [ ] Search index
  - [ ] Return results with snippets
  - [ ] Highlight matching terms

### 6.2 Backend - Search Router (app/routers/search.py)
- [ ] `GET /search?q={query}` - Search endpoint
  - [ ] Call SearchService.search_query()
  - [ ] Return formatted results
- [ ] `POST /search/reindex` - Rebuild index (admin only)
  - [ ] Call SearchService.rebuild_index()
  - [ ] Return success

### 6.3 Backend - Integration
- [ ] Call `rebuild_index()` on application startup
- [ ] Call `update_document()` after article create/update
- [ ] Call `delete_document()` after article delete

### 6.4 Frontend - Search Box (apps/web/components/search/search-box.tsx)
- [ ] Input in header
- [ ] Handle search submission
- [ ] Navigate to search results page or show dropdown
- [ ] Show loading indicator

### 6.5 Frontend - Search Results (apps/web/app/search/page.tsx)
- [ ] Fetch results from API
- [ ] Display results list
  - [ ] Article title (link)
  - [ ] Snippet with highlighted terms
  - [ ] Relevance score (optional)
- [ ] Handle empty results
- [ ] Show query in search box

**Phase 6 Deliverable:** Working full-text search

---

## Phase 7: Admin Panel

**Goal:** Implement admin configuration interface.

### 7.1 Backend - Config Router (app/routers/config.py)
- [ ] `GET /config` - Get current config (admin only)
  - [ ] Apply require_admin dependency
  - [ ] Read config.yaml
  - [ ] Return config data
- [ ] `PUT /config` - Update config (admin only)
  - [ ] Validate input
  - [ ] Update config.yaml
  - [ ] Commit to Git
  - [ ] Reload config (if possible)
  - [ ] Return updated config

### 7.2 Frontend - Admin Panel (apps/web/app/admin/page.tsx)
- [ ] Check if current user is admin (redirect if not)
- [ ] Fetch config from API
- [ ] Display admin panel sections:

### 7.3 Admin Sections
- [ ] **Application Settings**
  - [ ] App name input
  - [ ] App description textarea
  - [ ] Domain input
  - [ ] Max file size input
  - [ ] Save button

- [ ] **Admin Users**
  - [ ] List of admin emails
  - [ ] Add admin input + button
  - [ ] Remove admin button (per email)
  - [ ] Prevent removing self
  - [ ] Save button

- [ ] **Git Repository Settings**
  - [ ] Remote URL input
  - [ ] Auto-push checkbox
  - [ ] GitHub token input (password field)
  - [ ] Author name input
  - [ ] Author email input
  - [ ] Save button

- [ ] **Search Settings**
  - [ ] Index path display (read-only)
  - [ ] Rebuild on startup checkbox
  - [ ] "Rebuild Index Now" button
  - [ ] Save button

### 7.4 Admin UI Components
- [ ] `admin-section.tsx` - Section wrapper with title
- [ ] `admin-form.tsx` - Form handling with validation
- [ ] Success/error notifications

**Phase 7 Deliverable:** Complete admin configuration panel

---

## Phase 8: Testing, Polish & Documentation

**Goal:** Test all features, fix bugs, improve UX, and document.

### 8.1 Manual Testing
- [ ] Test user authentication (GCP IAP headers)
- [ ] Test article CRUD operations
  - [ ] Create article with frontmatter
  - [ ] Edit article (frontmatter updates)
  - [ ] Delete article
  - [ ] Verify Git commits
- [ ] Test directory operations
  - [ ] Create nested directories
  - [ ] Rename directory
  - [ ] Delete empty directory
- [ ] Test search
  - [ ] Simple queries
  - [ ] Multi-word queries
  - [ ] Results with highlighting
- [ ] Test admin panel
  - [ ] Update all config sections
  - [ ] Verify YAML changes
  - [ ] Test admin user management
- [ ] Test Git integration
  - [ ] Auto-commit on save
  - [ ] Auto-push (if configured)
  - [ ] Remote sync

### 8.2 Error Handling
- [ ] Add comprehensive error handling in all API endpoints
- [ ] Add user-friendly error messages in UI
- [ ] Add loading states for all async operations
- [ ] Add validation for all inputs

### 8.3 UI Polish
- [ ] Verify Wikipedia-style CSS is applied correctly
- [ ] Add hover states for interactive elements
- [ ] Add focus states for accessibility
- [ ] Add loading skeletons
- [ ] Test responsive design (desktop/tablet)
- [ ] Add success/error toasts or alerts

### 8.4 Performance
- [ ] Optimize article list loading
- [ ] Optimize directory tree rendering
- [ ] Optimize search response time
- [ ] Test with large repositories (100+ articles)

### 8.5 Documentation
- [ ] Update README.md with:
  - [ ] Project overview
  - [ ] Installation instructions
  - [ ] Configuration guide
  - [ ] Usage instructions
  - [ ] Admin guide
- [ ] Create DEPLOYMENT.md with:
  - [ ] Server requirements
  - [ ] Deployment steps
  - [ ] GCP IAP configuration
  - [ ] Troubleshooting
- [ ] Add code comments where needed
- [ ] Document API endpoints (use FastAPI auto-docs)

### 8.6 Final Checks
- [ ] All SRS requirements implemented
- [ ] No console errors in browser
- [ ] No Python exceptions in logs
- [ ] Git commits are properly formatted
- [ ] Frontmatter is correctly managed
- [ ] Config.yaml is properly validated

**Phase 8 Deliverable:** Production-ready WikiGit application

---

## Dependencies Between Phases

```
Phase 1 (Setup)
    ↓
Phase 2 (Backend Core)
    ↓
Phase 3 (Frontend Foundation)
    ↓
Phase 4 (Articles) ← Phase 5 (Directories)
    ↓                      ↓
Phase 6 (Search) ←───────┘
    ↓
Phase 7 (Admin Panel)
    ↓
Phase 8 (Testing & Polish)
```

**Note:** Phases 4 and 5 have some overlap and can be developed partially in parallel.

---

## Execution Strategy

### Recommended Approach:
1. **Complete Phase 1 fully** before moving to Phase 2
2. **Complete Phase 2 fully** before moving to Phase 3
3. **Complete Phase 3 fully** before moving to Phase 4
4. For **Phases 4-5**, implement backend first, then frontend
5. For **Phase 6**, integrate search into existing article operations
6. **Phase 7** is independent and can be done after Phase 6
7. **Phase 8** is continuous but finalized at the end

### Development Workflow per Phase:
1. Create all necessary files (empty stubs)
2. Implement backend logic
3. Test backend with API client (curl/Postman)
4. Implement frontend components
5. Test full feature end-to-end
6. Fix bugs and refine
7. Move to next phase

---

## Key Files to Create (Summary)

### Backend (apps/api/)
```
app/
├── main.py                       ✓ FastAPI app
├── config/
│   └── settings.py              ✓ Config management
├── middleware/
│   └── auth.py                  ✓ GCP IAP auth
├── models/
│   └── schemas.py               ✓ Pydantic models
├── routers/
│   ├── health.py                ✓ Health check
│   ├── articles.py              ✓ Article CRUD
│   ├── directories.py           ✓ Directory CRUD
│   ├── search.py                ✓ Search
│   └── config.py                ✓ Admin config
└── services/
    ├── git_service.py           ✓ Git operations
    ├── frontmatter_service.py   ✓ Frontmatter handling
    └── search_service.py        ✓ Whoosh indexing
```

### Frontend (apps/web/)
```
app/
├── layout.tsx                   ✓ Root layout
├── page.tsx                     ✓ Home page
├── article/[...slug]/page.tsx   ✓ Article view/edit
├── search/page.tsx              ✓ Search results
└── admin/page.tsx               ✓ Admin panel

components/
├── layout/
│   ├── header.tsx               ✓ Header
│   └── sidebar.tsx              ✓ Sidebar with tree
├── editor/
│   └── markdown-editor.tsx      ✓ MDXEditor
├── viewer/
│   ├── markdown-viewer.tsx      ✓ Markdown renderer
│   ├── article-metadata.tsx     ✓ Metadata display
│   └── table-of-contents.tsx    ✓ TOC
└── search/
    └── search-box.tsx           ✓ Search input

lib/
├── api.ts                       ✓ API client
└── store.ts                     ✓ Zustand store

styles/
└── wiki.css                     ✅ ALREADY EXISTS
```

---

## Questions Before Starting

1. **Priority**: Should I implement all phases sequentially, or would you like to focus on specific features first?
2. **Testing**: Do you want unit tests, or is manual testing sufficient?
3. **Git Workflow**: Should the system create a separate Git branch for development, or work directly on main?
4. **Frontend Framework**: Confirmed using Next.js App Router (not Pages Router), correct?
5. **Port 3003**: Confirmed for frontend, port 8000 for backend?

---

## Approval Required

**Please review this implementation plan and approve before I proceed.**

Once approved, I will:
1. Start with Phase 1 (Project Setup)
2. Show you each file as I create it
3. Test each component as I build it
4. Ask for your feedback at each phase checkpoint

**Ready to start? Please approve this plan or request changes.**
