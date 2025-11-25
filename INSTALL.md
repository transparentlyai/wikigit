# WikiGit Installation Guide

This guide provides detailed instructions for installing WikiGit on Linux systems, with a focus on Debian/Ubuntu-based distributions.

## System Requirements

Before starting, ensure your system meets the following requirements:

- **Operating System**: Linux (Debian, Ubuntu, Fedora, CentOS, etc.)
- **Memory**: 4GB RAM recommended (2GB minimum)
- **Disk Space**: 1GB+ for repository and index
- **Node.js**: Version 20.0.0 or higher
- **Python**: Version 3.11 or higher
- **Git**: Version 2.20 or higher

## 1. Install System Dependencies

### Debian / Ubuntu (Recommended)

Run the following commands to install the required system packages.

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Git and Build Tools
```bash
sudo apt install -y git build-essential curl
```

#### Install Python 3.11+
Most modern distributions come with Python 3.11+. Check your version:
```bash
python3 --version
```
If you need a newer version, you can use the deadsnakes PPA:
```bash
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev
```

#### Install Node.js 20+
Using NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Install pnpm (Node Package Manager)
```bash
sudo npm install -g pnpm
```

#### Install uv (Python Package Installer)
WikiGit uses `uv` for extremely fast Python package management.
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```
*Ensure `uv` is in your PATH (restart your shell or follow the installer's instructions).*

---

### Other Linux Distributions

- **Fedora/RHEL**: `sudo dnf install git python3.11 nodejs`
- **Arch Linux**: `sudo pacman -S git python nodejs`

Ensure you install `pnpm` and `uv` as shown in the Debian steps above, as they are platform-agnostic.

## 2. Clone the Repository

Clone the WikiGit repository to your desired location.

```bash
git clone <repository-url> wikigit
cd wikigit
```

## 3. Install Application Dependencies

WikiGit is a monorepo containing both the frontend and backend.

### Install Node.js Dependencies
```bash
pnpm install
```

### Install Python Dependencies
```bash
cd apps/api
uv sync
cd ../..
```

## 4. Configuration

Copy the example configuration file and customize it for your environment.

```bash
cp config.yaml.example config.yaml
nano config.yaml
```

### Key Configuration Settings

- **`app.admins`**: Add your email address (if using GCP IAP) or the default test email for development.
- **`repository.repo_path`**: The local path where wiki content (markdown files) will be stored. Defaults to `wiki-content`.
- **`repository.remote_url`**: (Optional) Git URL to sync content with (e.g., GitHub).
- **`search.index_dir`**: Path for the search index. Defaults to `data/whoosh_index`.

### 4.1 Git Repository Authentication (Important)

WikiGit requires a GitHub Personal Access Token (PAT) or similar git credential to:
1.  Clone and sync private repositories.
2.  Push changes back to the remote repository.
3.  Avoid rate limits when interacting with the GitHub API.

**How to set it up:**

1.  **Generate a Token**: Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic). Create a new token with `repo` scope.
2.  **Expose it to WikiGit**: The application looks for an environment variable named `GITHUB_TOKEN` (default) or whatever you configured in `config.yaml` under `multi_repository.github.token_env_var`.

**For CLI Users:**
Add it to your shell profile or export it before running:
```bash
export GITHUB_TOKEN=ghp_your_secret_token_here
wikigit start
```

**For Systemd Users:**
You will need to add this token to your service configuration (see section 7 below).

## 5. Setup the CLI

WikiGit comes with a convenience CLI script named `wikigit` in the root directory.

Make it executable (it should be already):
```bash
chmod +x wikigit
```

To use the `wikigit` command globally, you can link it to your user's bin directory:

```bash
mkdir -p ~/bin
ln -s $(pwd)/wikigit ~/bin/wikigit
```

Ensure `~/bin` is in your `PATH`. Add this to your `~/.bashrc` or `~/.zshrc` if needed:
```bash
export PATH="$HOME/bin:$PATH"
```
*Then restart your shell or run `source ~/.bashrc`.*

## 6. Running WikiGit

### Development Mode
Starts both frontend and backend with hot-reloading enabled.

```bash
wikigit dev
```
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

### Production Mode
Builds the frontend and starts the application optimized for performance.

```bash
wikigit start --rebuild
```
*The `--rebuild` flag ensures the latest frontend code is built.*

### Management Commands

- **Stop**: `wikigit stop`
- **Status**: `wikigit status`
- **Logs**: `wikigit logs backend -f` or `wikigit logs frontend -f`

## 7. Setting up a Systemd Service (Recommended)

For production environments, it is recommended to run WikiGit as a systemd service. This ensures the application starts automatically on boot and can be managed with standard system tools.

### 1. Create an Environment File (for Secrets)

To securely store your `GITHUB_TOKEN` and other sensitive variables, create a file that is readable only by the service user.

```bash
nano /home/ubuntu/wikigit/.env
```

Add your token:
```bash
GITHUB_TOKEN=ghp_your_secret_token_here
```

Secure the file:
```bash
chmod 600 /home/ubuntu/wikigit/.env
```

### 2. Create the Service File

Create a new service file at `/etc/systemd/system/wikigit.service`:

```bash
sudo nano /etc/systemd/system/wikigit.service
```

Paste the following configuration:

```ini
[Unit]
Description=WikiGit Service
After=network.target

[Service]
# Use "oneshot" with "RemainAfterExit" because the wikigit start command 
# spawns background processes and exits.
Type=oneshot
RemainAfterExit=yes

# REPLACE with your actual user and group
User=ubuntu
Group=ubuntu

# REPLACE with your actual installation path
WorkingDirectory=/home/ubuntu/wikigit

# Load environment variables (including GITHUB_TOKEN)
EnvironmentFile=/home/ubuntu/wikigit/.env

# IMPORTANT: Ensure PATH includes location of node, pnpm, uv, and python
# You can find your path by running `echo $PATH`
Environment="PATH=/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin:/home/ubuntu/.cargo/bin"

# Start and Stop commands
ExecStart=/home/ubuntu/wikigit/wikigit start --logs /home/ubuntu/wikigit/logs
ExecStop=/home/ubuntu/wikigit/wikigit stop

[Install]
WantedBy=multi-user.target
```

**Key Adjustments:**
1.  **User/Group**: Change `ubuntu` to your Linux username.
2.  **WorkingDirectory**: Set to the absolute path of your WikiGit directory.
3.  **EnvironmentFile**: Point to the `.env` file you created in step 1.
4.  **Environment**: Update `PATH` to include where `uv` and `pnpm` are installed.
    *   `uv` is typically in `~/.cargo/bin` or `~/.local/bin`.
    *   `pnpm` is typically in `/usr/local/bin` or `~/.local/share/pnpm`.
5.  **ExecStart/ExecStop**: Use absolute paths to the `wikigit` script.

### 3. Enable and Start the Service

Reload the systemd daemon to recognize the new service:
```bash
sudo systemctl daemon-reload
```

Enable the service to start on boot:
```bash
sudo systemctl enable wikigit
```

Start the service immediately:
```bash
sudo systemctl start wikigit
```

### 3. Verify Status

Check if the service is running correctly:
```bash
sudo systemctl status wikigit
```

You can also use the internal CLI status command:
```bash
/path/to/wikigit/wikigit status
```

### 4. Viewing Logs via Systemd

Since the service redirects logs to files (specified in `ExecStart`), use the `wikigit logs` command or `tail`:

```bash
tail -f /home/ubuntu/wikigit/logs/api.log
```

Systemd's own journal will mostly show the startup/shutdown events:
```bash
journalctl -u wikigit -f
```

## Troubleshooting

### "Command not found: uv"
Ensure `uv` is installed and in your PATH. If you installed it via the script, it's usually in `~/.cargo/bin`.

### "EADDRINUSE" / Port Conflicts
If ports 3000 or 8000 are taken, use different ports:
```bash
wikigit start --frontend-port 3005 --backend-port 8005
```
Or set environment variables in your shell config:
```bash
export WIKIGIT_FRONTEND_PORT=3005
export WIKIGIT_BACKEND_PORT=8005
```

### Permission Errors
Ensure the user running `wikigit` has write permissions to:
- The `wikigit` directory
- The `wiki-content` directory (or your configured repo path)
- The `data` directory
- The logs directory (default `/tmp/wikigit`)

### CORS Errors (Load Balancer)
If you are running WikiGit behind a load balancer and see CORS errors in the browser console:
1.  Verify that you provided the correct **Deployment Domain** during installation.
2.  Check your `.env` file (e.g., `/opt/wikigit/.env` or inside your installation directory).
3.  Ensure `CORS_ALLOWED_ORIGINS` is uncommented and set to your load balancer's domain:
    ```bash
    CORS_ALLOWED_ORIGINS=https://wiki.your-domain.com
    ```
4.  Restart the service: `sudo systemctl restart wikigit`
