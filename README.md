# WikiGit

A git-based wiki application with a Wikipedia-inspired interface. WikiGit stores articles as markdown files in a git repository, providing version control, full-text search, and an intuitive editing experience.

## Features

- **Git-Backed Storage**: All articles stored as markdown files with automatic git commits
- **Full-Text Search**: Powered by Whoosh for fast, relevant search results
- **Rich Markdown Editor**: MDXEditor with syntax highlighting, tables, and more
- **Hierarchical Organization**: Organize articles into directories and subdirectories
- **Metadata Tracking**: Automatic frontmatter with author, timestamps, and version info
- **Wikipedia-Inspired UI**: Clean, familiar interface optimized for reading and navigation
- **GCP IAP Authentication**: Seamless integration with Google Cloud Identity-Aware Proxy
- **Admin Panel**: Manage directories, search index, and configuration
- **Optional Remote Sync**: Push changes to GitHub or other git remotes

## Tech Stack

### Frontend
- Next.js 15.5 (App Router)
- React 19
- TypeScript
- Zustand (state management)
- MDXEditor (markdown editing)
- react-markdown + remark-gfm (markdown rendering)
- Shiki (syntax highlighting)

### Backend
- FastAPI
- Python 3.11+
- GitPython (git operations)
- Whoosh (search engine)
- Pydantic v2 (validation)
- python-frontmatter (metadata)

## Prerequisites

- Node.js 18+ and pnpm
- Python 3.11+
- uv (Python package installer)
- Git

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd wikigit
```

### 2. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all dependencies (frontend + backend)
pnpm install
cd apps/api && uv sync && cd ../..
```

### 3. Configure the Application

```bash
# Copy example config
cp config.yaml.example config.yaml

# Edit config.yaml with your settings
nano config.yaml
```

**Important Configuration Fields:**

- `app.admins`: List of admin user emails (from GCP IAP)
- `repository.repo_path`: Path where wiki content will be stored
- `repository.auto_push`: Enable automatic push to remote
- `repository.remote_url`: GitHub repository URL (optional)
- `repository.remote_token`: GitHub personal access token (optional)
- `search.index_dir`: Path for search index files

### 4. Initialize the Repository

The application will automatically initialize the git repository on first run, but you can also do it manually:

```bash
mkdir -p wiki-content
cd wiki-content
git init
cd ..
```

## Usage

### Development Mode

Start both frontend and backend in development mode with hot reload:

```bash
# Start with default ports
wikigit dev

# Start with custom ports
wikigit dev --frontend-port 3005 --backend-port 8001
```

This starts:
- Frontend: http://localhost:3000 (default) with Next.js fast refresh
- Backend API: http://localhost:8000 (default) with FastAPI auto-reload
- API Docs: http://localhost:8000/docs

**Port Configuration:**
You can configure ports via:
1. Command line options: `--frontend-port` and `--backend-port`
2. Environment variables: `WIKIGIT_FRONTEND_PORT` and `WIKIGIT_BACKEND_PORT`

```bash
# Using environment variables
WIKIGIT_FRONTEND_PORT=3005 wikigit dev

# Using CLI options (takes precedence)
wikigit dev --frontend-port 3005 --backend-port 8080

# Custom logs directory
wikigit dev --logs /var/log/wikigit
```

### Production Mode

**Start WikiGit:**

```bash
# Start with default ports (builds automatically if needed)
wikigit start

# Start with custom ports
wikigit start --frontend-port 3005 --backend-port 8001

# Start with custom logs directory
wikigit start --logs /var/log/wikigit

# Force rebuild frontend before starting
wikigit start --rebuild
```

**Stop WikiGit:**

```bash
wikigit stop
```

**Check status:**

```bash
wikigit status
```

**View logs:**

```bash
# View backend logs
wikigit logs backend

# Follow frontend logs
wikigit logs frontend -f
```

**CLI Options:**
- `wikigit start --frontend-port <port>`: Set custom frontend port (default: 3000)
- `wikigit start --backend-port <port>`: Set custom backend port (default: 8000)
- `wikigit start --logs <path>`: Set custom logs directory (default: /tmp/wikigit)
- `wikigit start --rebuild`: Force rebuild the frontend before starting
- `wikigit dev`: Development mode with hot reload
- `wikigit restart`: Restart WikiGit (accepts same options as start)
- `wikigit status`: Check running status
- `wikigit stop`: Stop WikiGit (automatically finds correct ports)
- `wikigit logs <backend|frontend> [-f]`: View logs

**Environment Variables:**
- `WIKIGIT_FRONTEND_PORT`: Override default frontend port
- `WIKIGIT_BACKEND_PORT`: Override default backend port
- `WIKIGIT_LOGS_DIR`: Override default logs directory

See `wikigit help` for all commands or check [CLI.md](CLI.md) for detailed documentation.

## Architecture

### Monorepo Structure

```
wikigit/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App router pages
│   │   ├── components/   # React components
│   │   ├── lib/          # API client & store
│   │   ├── styles/       # Wikipedia-inspired CSS
│   │   └── types/        # TypeScript types
│   └── api/              # FastAPI backend
│       └── app/
│           ├── config/   # Settings management
│           ├── middleware/ # Auth middleware
│           ├── models/   # Pydantic schemas
│           ├── routers/  # API endpoints
│           └── services/ # Business logic
├── docs/                 # Documentation
├── wiki-content/         # Git repository (articles)
├── data/                 # Search index
└── config.yaml           # Configuration
```

### Key Components

**Backend Services:**
- `GitService`: Handles git operations (commit, push, history)
- `FrontmatterService`: Manages YAML frontmatter in markdown files
- `SearchService`: Whoosh-based full-text search

**Frontend Components:**
- `MainLayout`: Header + Sidebar + Content layout
- `MarkdownViewer`: Article rendering with syntax highlighting
- `MarkdownEditor`: Rich editing experience with MDXEditor
- `DirectoryManager`: Admin UI for directory operations
- `SearchManager`: Admin UI for search index management
- `ConfigManager`: Admin UI for configuration

**API Endpoints:**
- `/articles`: CRUD operations for articles
- `/directories`: Directory management
- `/search`: Full-text search
- `/config`: Configuration management
- `/health`: Health check

## Authentication

WikiGit is designed to work behind **GCP Identity-Aware Proxy (IAP)**. The backend extracts the user email from the `X-Goog-Authenticated-User-Email` header.

For local development without IAP, the middleware will use a default test user.

### Admin Access

Users listed in `config.yaml` under `app.admins` have access to:
- Admin panel (`/admin`)
- Directory deletion
- Search reindexing
- Configuration management

## Article Management

### Creating Articles

1. Click "Create New Article" on the home page
2. Enter a path (e.g., `docs/getting-started`)
3. Enter a title
4. Edit the content in the markdown editor
5. Click "Save" - automatically commits to git

### Editing Articles

1. Navigate to an article
2. Click "Edit"
3. Modify content in the editor
4. Click "Save" - creates a new git commit

### Article Metadata

All articles automatically include YAML frontmatter:

```yaml
---
title: Article Title
author: creator@example.com
created_at: 2025-11-21T10:00:00Z
updated_at: 2025-11-21T15:30:00Z
updated_by: editor@example.com
---
```

This metadata is:
- **Automatically managed** - users never edit it directly
- **Preserved on updates** - immutable fields (title, author, created_at)
- **Tracked in git** - included in all commits

## Search

### Using Search

Use the search bar in the header to search across all articles. Results are ranked by relevance with title matches boosted.

### Reindexing

The search index is automatically updated when articles are created, edited, or deleted. Manual reindexing is available in the admin panel if needed.

## Directory Management

Directories organize articles into hierarchical sections. They can be created and deleted through the admin panel.

**Rules:**
- Directories must be empty (no articles) before deletion
- Parent directories are created automatically
- Empty directories contain a `.gitkeep` file

## Remote Git Sync

To sync with a remote repository (e.g., GitHub):

1. Create a repository on GitHub
2. Generate a personal access token with `repo` scope
3. Update `config.yaml`:
   ```yaml
   repository:
     auto_push: true
     remote_url: https://github.com/username/repo.git
     remote_token: ${GITHUB_TOKEN}  # or paste token directly
   ```
4. Set environment variable (recommended):
   ```bash
   export GITHUB_TOKEN=ghp_your_token_here
   ```
5. Restart the application

## Development

### Code Structure

- **Frontend**: Client-side React components with Next.js App Router
- **Backend**: FastAPI with async/await for all endpoints
- **State Management**: Zustand for React state
- **Styling**: Single `wiki.css` file for easy customization

### Adding New Features

1. Update SRS documentation (`docs/SRS.md`)
2. Implement backend router and services
3. Create frontend components
4. Update API client (`apps/web/lib/api.ts`)
5. Add routes/pages as needed

## Troubleshooting

### Application Won't Start

- Check that config.yaml exists and is valid YAML
- Ensure Python virtual environment is activated
- Verify all dependencies are installed

### Search Not Working

- Rebuild the search index from the admin panel
- Check that `search.index_dir` path is writable

### Git Push Failing

- Verify `remote_url` and `remote_token` are correct
- Check that the token has appropriate permissions
- Ensure the remote repository exists

### Authentication Issues

- In production, ensure GCP IAP is properly configured
- In development, check that the auth middleware is allowing test users
- Verify admin emails are correctly listed in config.yaml

## Documentation

- [Software Requirements Specification (SRS)](docs/SRS.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)

## License

MIT
