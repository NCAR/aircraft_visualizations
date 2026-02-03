# Deployment Guide

## Overview
This document describes the deployment of the Aircraft Visualizations SPA to the production Apache server at `datavisualization.eol.ucar.edu/aircraft`.

## Architecture
- **Web Server**: Apache HTTP Server
- **Backend**: Node.js/Express (port 3232)
- **Process Manager**: systemd service
- **Base Path**: `/aircraft`
- **Frontend**: SPA with ES modules (no build step)
- **Database**: PostgreSQL on eol-rosetta.eol.ucar.edu

## Server File Locations

### Application Files
- **Deployment Directory**: `/var/www/aircraft_visualizations/`
- **Public Files**: `/var/www/aircraft_visualizations/public/`
- **SPA Routing**: `/var/www/aircraft_visualizations/public/.htaccess`
- **Backend**: `/var/www/aircraft_visualizations/server.js`
- **Node Modules**: `/var/www/aircraft_visualizations/node_modules/`
- **Environment Config**: `/var/www/aircraft_visualizations/.env`

### Configuration Files
- **Apache VHost**: `/etc/httpd/conf/vhosts/datavisualization.conf`
- **Systemd Service**: `/etc/systemd/system/aircraft-visualizations.service`

### Logs
- **Apache Logs**: `/var/log/httpd/datavisualization_access_log` and `datavisualization_error_log`
- **Node Service Logs**: `sudo journalctl -u aircraft-visualizations -f`

## Deployment Steps

### 1. Initial Server Setup

#### Copy application files to server
```bash
ssh flight.eol.ucar.edu
cd /var/www/aircraft_visualizations
git pull
```

#### Install Node.js dependencies
```bash
ssh datavisualization.eol.ucar.edu
cd /var/www/aircraft_visualizations
npm install
```

### 2. Configure Systemd Service

Create systemd service file at `/etc/systemd/system/aircraft-visualizations.service`:

```ini
[Unit]
Description=Aircraft Data Visualizations Node.js Server
After=network.target postgresql.service

[Service]
Type=simple
User=srunkel
Group=eol-data
WorkingDirectory=/var/www/aircraft_visualizations
ExecStart=/usr/bin/node /var/www/aircraft_visualizations/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=PORT=3232

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable aircraft-visualizations
sudo systemctl start aircraft-visualizations
sudo systemctl status aircraft-visualizations
```

### 3. Configure Apache

Edit Apache VHost configuration at `/etc/httpd/conf/vhosts/datavisualization.conf`:

```apache
<VirtualHost *:80>
    ServerName datavisualization.eol.ucar.edu
    DocumentRoot /var/www/html

    # Aircraft Visualizations SPA
    Alias /aircraft /var/www/aircraft_visualizations/public
    <Directory /var/www/aircraft_visualizations/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        
        # SPA fallback - let Node.js handle routing via index.html
        FallbackResource /aircraft/index.html
    </Directory>

    # Proxy API requests to Node.js backend
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3232/api
    ProxyPassReverse /api http://localhost:3232/api

    # Error and access logs
    ErrorLog /var/log/httpd/datavisualization_error_log
    CustomLog /var/log/httpd/datavisualization_access_log combined
</VirtualHost>
```

Restart Apache:
```bash
sudo systemctl restart httpd
```

### 4. Frontend Configuration Changes

#### Update Base Path
Add base tag to `/var/www/aircraft_visualizations/public/index.html`:
```html
<head>
    <base href="/aircraft/">
    <!-- other head content -->
</head>
```

#### Update Module Paths
In `app.js`, use absolute paths for dynamic imports:
```javascript
const pageManager = new PageManager({
  container: '#content-area',
  store,
  pages: {
    home: {
      html: 'pages/dashboard.html',
      module: '/aircraft/pages/DashboardPage.js'  // Absolute path
    },
    // ... other pages
  }
});
```

#### Update Router for Base Path
The Router class in `router/Router.js` was updated to handle the base path:
- Strips base path from incoming routes
- Adds base path when navigating
- Uses History API with full paths including base

#### Navbar Links (SPA Navigation)
In `navbar.html`, links use **relative paths** (not absolute) so they work with the `<base>` tag:
```html
<!-- Correct: relative paths respect <base href="/aircraft/"> -->
<a href="./" data-route="/">Home</a>
<a href="about" data-route="/about">About</a>
<a href="dashboard" data-route="/dashboard">Dashboard</a>
<a href="realtime" data-route="/realtime">Realtime</a>

<!-- Wrong: absolute paths ignore the base tag -->
<a href="/about">About</a>  <!-- Would go to /about, not /aircraft/about -->
```
The `data-route` attribute is used by the SPA router for JavaScript navigation. The `href` is the fallback if JavaScript fails.

#### SPA Fallback with .htaccess
The `public/.htaccess` file provides SPA routing support at the directory level:
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]
    RewriteRule ^ index.html [L]
</IfModule>
```
This ensures refreshing `/aircraft/about` serves `index.html` instead of a 404. Works alongside the Apache `FallbackResource` directive as a backup.

### 5. Backend Configuration Changes

#### Update API Routes
All movie endpoints moved under `/api` to work with ProxyPass:
```javascript
// server.js
app.get('/api/movies/:flightID', async (req, res) => { ... });
app.get('/api/movies/:project/:filename', (req, res) => { ... });
```

#### Update Frontend Movie Calls
In `modules/FlightMovieStore.js`:
```javascript
const videoUrl = `/api/movies/${encodeURIComponent(flightId)}`;
```

## Deployment Workflow

### For Code Updates

1. **Update local files** in `/h/eol/srunkel/aircraft_visualizations/`

2. **Copy to deployment directory**:
   ```bash
   cp /h/eol/srunkel/aircraft_visualizations/public/app.js \
      /var/www/aircraft_visualizations/public/app.js
   ```

3. **Restart Node service if backend changed**:
   ```bash
   sudo systemctl restart aircraft-visualizations
   ```

4. **Clear browser cache** or hard refresh (Ctrl+Shift+R)

### For Full Redeployment

```bash
# Sync all files
rsync -av --exclude 'node_modules' --exclude '.git' \
  /h/eol/srunkel/aircraft_visualizations/ \
  /var/www/aircraft_visualizations/

# Restart service
sudo systemctl restart aircraft-visualizations
```

## Testing

### Check Service Status
```bash
sudo systemctl status aircraft-visualizations
sudo journalctl -u aircraft-visualizations -n 50
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:3232/health

# Projects endpoint
curl http://localhost:3232/api/projects

# Through Apache proxy
curl https://datavisualization.eol.ucar.edu/api/projects
```

### Browser Testing
1. Navigate to `https://datavisualization.eol.ucar.edu/aircraft/`
2. Check browser console for errors
3. Test navigation between pages
4. Verify data loads from database
5. Test chart interactions

## Troubleshooting

### Service Won't Start
```bash
# Check logs
sudo journalctl -u aircraft-visualizations -n 100

# Common issues:
# - Port 3232 already in use
# - Missing node_modules
# - Permission issues
```

### 404 Errors on Page Refresh
- Ensure `public/.htaccess` exists with SPA rewrite rules
- Check Apache configuration has `FallbackResource /aircraft/index.html`
- Verify `AllowOverride All` is set in Apache directory config (enables .htaccess)
- Verify base tag in index.html: `<base href="/aircraft/">`
- Check module paths use absolute paths with `/aircraft/` prefix
- Check navbar links use relative paths (no leading `/`) to respect base tag

### Module Loading Errors
- Ensure dynamic imports use absolute paths: `/aircraft/pages/...`
- Check that HTML file paths are relative: `pages/dashboard.html`
- Verify files exist at specified paths

### Database Connection Issues
```bash
# Test database connectivity
psql -h eol-rosetta.eol.ucar.edu -U ads -d aircraft_data

# Check .env file has correct credentials
cat /var/www/aircraft_visualizations/.env
```

### API Not Responding
```bash
# Check if Node service is running
sudo systemctl status aircraft-visualizations

# Test direct connection to Node
curl http://localhost:3232/health

# Test through Apache proxy
curl https://datavisualization.eol.ucar.edu/api/projects
```

## Key Configuration Differences from Local Development

| Aspect | Development | Production |
|--------|-------------|------------|
| Base Path | `/` | `/aircraft/` |
| Module Imports | `./pages/...` | `/aircraft/pages/...` |
| API Endpoint | `http://localhost:3000` | Proxied through Apache |
| Process Management | Manual `node server.js` | systemd service |
| Port | 3000 | 3232 |
| Static Files | Served by Express | Served by Apache |

## Security Notes

- Service runs as user `srunkel` with group `eol-data`
- Database credentials stored in `.env` file
- Apache serves only `/var/www/aircraft_visualizations/public/` directory
- API endpoints proxied through Apache (validates requests)
- No directory listing enabled (`-Indexes`)

## Performance Considerations

- Static files served directly by Apache (faster than Node)
- API calls proxied to Node backend
- No build step required (ES modules loaded directly)
- Consider adding CDN or bundling for production optimization

## Maintenance

### Updating Dependencies
```bash
cd /var/www/aircraft_visualizations
npm update
sudo systemctl restart aircraft-visualizations
```

### Viewing Logs
```bash
# Real-time Node service logs
sudo journalctl -u aircraft-visualizations -f

# Apache access logs
sudo tail -f /var/log/httpd/datavisualization_access_log

# Apache error logs
sudo tail -f /var/log/httpd/datavisualization_error_log
```

### Monitoring
- Check service status: `systemctl status aircraft-visualizations`
- Monitor port: `netstat -tlnp | grep 3232`
- Check Apache: `systemctl status httpd`

## Contact

For issues or questions, contact: srunkel@ucar.edu
