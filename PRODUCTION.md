# Mnestic — Production Deployment Guide

## Post-Pull Checklist

After pulling a rename or major change on the production server, follow these steps in order.

### 1. Rename the project directory

```bash
cd ~/Code
mv notes-browser mnestic
cd mnestic
```

### 2. Update the git remote URL

```bash
git remote set-url origin git@github.com:alanzoppa/mnestic.git
```

### 3. Install the new systemd service files

The service files were renamed from `notes-browser-*` to `mnestic-*`:

```bash
# Copy new service files
cp deploy/mnestic-backend.service ~/.config/systemd/user/
cp deploy/mnestic-frontend.service ~/.config/systemd/user/

# Reload systemd and restart services
systemctl --user daemon-reload
systemctl --user restart mnestic-backend mnestic-frontend

# Verify services are running
systemctl --user status mnestic-backend
systemctl --user status mnestic-frontend

# Remove old service files
rm -f ~/.config/systemd/user/notes-browser-backend.service
rm -f ~/.config/systemd/user/notes-browser-frontend.service
systemctl --user daemon-reload
```

### 4. Update nginx config

```bash
# Copy updated nginx config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/mnestic

# Remove old site config (if it exists under the old name)
sudo rm -f /etc/nginx/sites-available/notes-browser
sudo rm -f /etc/nginx/sites-enabled/notes-browser

# Enable new site
sudo ln -sf /etc/nginx/sites-available/mnestic /etc/nginx/sites-enabled/mnestic

# Test and reload
sudo nginx -t && sudo nginx -s reload
```

### 5. Update MCP client configs

If you use Claude Desktop or other MCP clients that connect to Mnestic, update their config:

```json
{
  "mcpServers": {
    "mnestic": {
      "command": "python",
      "args": ["mcp_server.py"],
      "cwd": "/path/to/mnestic/backend"
    }
  }
}
```

### 6. Reinstall frontend dependencies and rebuild

```bash
cd frontend
npm install
npm run build
```

### 7. Verify

- Check the frontend at the usual URL
- Confirm the page title says "Mnestic"
- Check backend health: `curl http://127.0.0.1:8000/api/stats`
- Verify systemd services: `systemctl --user status mnestic-backend mnestic-frontend`

## Quick Deploy (No Rename)

For routine deploys after the rename is complete, use:

```bash
./scripts/deploy.sh
```

This pulls latest, installs deps, runs tests, builds frontend, and restarts the mnestic services.