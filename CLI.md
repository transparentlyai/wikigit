# WikiGit CLI

The `wikigit` command provides a simple interface for managing your WikiGit instance.

## Quick Start

```bash
# Development mode (hot reload)
wikigit dev

# Production mode
wikigit start

# Check status
wikigit status

# View logs
wikigit logs backend
wikigit logs frontend -f

# Stop WikiGit
wikigit stop
```

## Commands

### `wikigit dev`

**Options:**
- `--frontend-port PORT` - Frontend port (default: 8008)
- `--backend-port PORT` - Backend port (default: 9009)
- `--logs PATH` - Log directory (default: /tmp/wikigit)

**Environment Variables:**
You can set defaults using environment variables:
- `WIKIGIT_FRONTEND_PORT` - Override default frontend port
- `WIKIGIT_BACKEND_PORT` - Override default backend port
- `WIKIGIT_LOGS_DIR` - Override default logs directory

**Examples:**
```bash
# Start in dev mode with defaults
wikigit dev

# Start on custom ports
wikigit dev --frontend-port 8008 --backend-port 9010

# Start with custom logs directory
wikigit dev --logs /var/log/wikigit
```

**Features:**
- Frontend hot reload (Next.js fast refresh)
- Backend hot reload (FastAPI auto-reload)
- Runs in foreground (Ctrl+C to stop)
- No build step required

### `wikigit start`

Start both backend and frontend services in production mode.

**Options:**
- `--frontend-port PORT` - Frontend port (default: 8008)
- `--backend-port PORT` - Backend port (default: 9009)
- `--logs PATH` - Log directory (default: /tmp/wikigit)
- `--rebuild` - Rebuild frontend before starting

**Environment Variables:**
You can set defaults using environment variables:
- `WIKIGIT_FRONTEND_PORT` - Override default frontend port
- `WIKIGIT_BACKEND_PORT` - Override default backend port
- `WIKIGIT_LOGS_DIR` - Override default logs directory

Priority: CLI options > Environment variables > Defaults

**Examples:**
```bash
# Start with defaults
wikigit start

# Start on custom ports
wikigit start --frontend-port 8008 --backend-port 9010

# Start with custom logs directory
wikigit start --logs /var/log/wikigit

# Start with frontend rebuild
wikigit start --rebuild
```

### `wikigit stop`

Stop both backend and frontend services.

```bash
wikigit stop
```

The stop command automatically discovers which ports the services are running on (saved from when they were started), so you don't need to specify ports.

### `wikigit restart`

Restart WikiGit. Accepts the same options as `start`.

```bash
# Restart with defaults
wikigit restart

# Restart on different ports
wikigit restart --frontend-port 8008

# Restart and rebuild
wikigit restart --rebuild
```

### `wikigit status`

Check if WikiGit is running and display service information.

```bash
wikigit status
```

Output shows:
- Backend status, PID, and port
- Frontend status, PID, and port
- Access URLs

### `wikigit logs`

View service logs.

**Usage:**
```bash
wikigit logs [backend|frontend] [-f|--follow]
```

**Examples:**
```bash
# View last 50 lines of backend logs
wikigit logs backend

# View last 50 lines of frontend logs
wikigit logs frontend

# Follow backend logs (live updates)
wikigit logs backend -f

# Follow frontend logs
wikigit logs frontend --follow
```

### `wikigit help`

Show help message with all available commands.

```bash
wikigit help
```

## Installation

The `wikigit` command is located in your project root and linked to `~/bin/wikigit`.

If you want to use it from anywhere, ensure `~/bin` is in your PATH:

```bash
export PATH="$HOME/bin:$PATH"
```

Add this to your `~/.bashrc` or `~/.zshrc` to make it permanent.

## Workflow Examples

### Development Workflow

```bash
# Start in development mode with hot reload
wikigit dev

# Make code changes - they auto-reload!
# Press Ctrl+C when done

# Or run on custom ports
wikigit dev --frontend-port 8008 --backend-port 9010
```

### Production Workflow

```bash
# Start WikiGit in production
wikigit start

# Check if everything is running
wikigit status

# Monitor backend logs
wikigit logs backend -f

# Restart with rebuild
wikigit restart --rebuild
```

### Troubleshooting

```bash
# Check status
wikigit status

# View recent logs
wikigit logs backend
wikigit logs frontend

# Restart if something is stuck
wikigit restart

# Force stop and clean restart
wikigit stop
sleep 2
wikigit start --rebuild
```

## Log Files

By default, logs are stored in `/tmp/wikigit/`:
- `/tmp/wikigit/api.log` - Backend logs
- `/tmp/wikigit/web.log` - Frontend logs

You can customize the log directory using:
- The `--logs` option: `wikigit start --logs /var/log/wikigit`
- Environment variable: `WIKIGIT_LOGS_DIR=/var/log/wikigit wikigit start`

The `wikigit logs` command automatically finds the correct log location:
```bash
# View logs (discovers location automatically)
wikigit logs backend
wikigit logs frontend -f
```

You can also view them directly if you know the location:
```bash
tail -f /tmp/wikigit/api.log
tail -f /tmp/wikigit/web.log
```
