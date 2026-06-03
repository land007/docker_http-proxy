# HTTP/HTTPS Reverse Proxy with Web-Based Configuration

A modern, manageable HTTP/HTTPS reverse proxy with web-based configuration interface, featuring zero-downtime configuration updates, SSL certificate management, and user authentication.

## Features

- **Web-Based Configuration** - Intuitive web UI for managing all proxy settings
- **Zero-Downtime Updates** - Configuration changes apply immediately without restart
- **Hot-Reload** - Automatic configuration reloading with file watching
- **SSL Certificate Management** - Upload and manage SSL certificates through web UI
- **User Authentication** - Separate admin (bcrypt) and proxy user (MD5) authentication
- **Session Management** - Advanced session control with max session limits per user
- **Backup/Restore** - Automatic configuration backups with manual restore capability
- **WebSocket Support** - Full WebSocket proxying with upgrade handling
- **Pretend Mode** - Host header rewriting for seamless proxying
- **SNI Support** - Multi-domain SSL certificate handling

## Quick Start

### 1. Build the Docker Image

```bash
docker-compose build
```

### 2. Start the Services

```bash
docker-compose up -d
```

### 3. Access the Web Interface

- **Admin UI**: https://your-domain:8443/admin/
- **Default Credentials**: admin / admin123
- **⚠️ Important**: Change the default password immediately!

## Configuration

### Initial Setup

On first startup, if `proxy-config.json` doesn't exist, the system will automatically migrate configuration from environment variables to JSON format.

### Configuration Files

- **proxy-config.json** - Main proxy configuration
- **admin_users.json** - Admin account credentials (bcrypt hashed)
- Proxy client auth accounts are stored on each HTTP/WebSocket rule in `proxy-config.json` as MD5 password hashes.

### Web Interface Sections

1. **Dashboard** - Overview of system status and statistics
2. **Proxy** - Manage HTTP/HTTPS, WS/WSS, upstream targets, and proxy client auth accounts together
3. **Certificates** - Upload and manage SSL certificates
4. **Settings** - Configure max sessions and default authentication
5. **Backups** - Create, restore, and manage configuration backups

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/me` - Get current user

### Configuration
- `GET /api/config` - Get full configuration
- `PUT /api/config` - Update full configuration

### HTTP Proxy Rules
- `GET /api/http-rules` - List all HTTP rules
- `POST /api/http-rules` - Create new HTTP rule
- `PUT /api/http-rules/:id` - Update HTTP rule
- `DELETE /api/http-rules/:id` - Delete HTTP rule

### WebSocket Proxy Rules
- `GET /api/ws-rules` - List all WebSocket rules
- `POST /api/ws-rules` - Create new WebSocket rule
- `PUT /api/ws-rules/:id` - Update WebSocket rule
- `DELETE /api/ws-rules/:id` - Delete WebSocket rule

### SSL Certificates
- `GET /api/certificates` - List all certificates
- `POST /api/certificates` - Upload certificate
- `DELETE /api/certificates/:domain` - Delete certificate

### Admin Users
- `GET /api/admin/users` - List all admin users
- `POST /api/admin/users` - Create new admin user
- `PUT /api/admin/users/:id/password` - Change admin password
- `DELETE /api/admin/users/:id` - Delete admin user

### Backups
- `GET /api/backups` - List all backups
- `POST /api/backups` - Create manual backup
- `POST /api/backups/:name/restore` - Restore from backup
- `DELETE /api/backups/:name` - Delete backup

### System Status
- `GET /api/status` - Get system status and statistics

## Security Features

- **Admin Authentication**: Separate from proxy users, uses bcrypt (more secure)
- **HTTPS Only**: Admin interface served only on port 8443 with HTTPS
- **Session Security**: httpOnly, secure cookies, 30-minute timeout
- **Input Validation**: All inputs validated using express-validator
- **CSRF Protection**: All state-changing operations require CSRF token
- **File Upload Security**: Certificate uploads validated for type and size
- **Configuration Backup**: Automatic backups before every change

## Architecture

### Components

1. **proxy.js** - Main HTTP/HTTPS proxy server with hot-reload support
2. **admin-api.js** - Express.js REST API server (port 8443)
3. **proxy-config-loader.js** - Configuration management with file watching
4. **config-validator.js** - Configuration validation
5. **auth-manager.js** - Admin authentication and session management
6. **web-ui/** - Web interface files

### Data Flow

1. Admin changes configuration via web UI
2. Admin API validates and saves to `proxy-config.json`
3. File watcher detects changes (debounced 500ms)
4. Configuration loader validates and applies new config
5. Active sessions preserved - only new requests use new config

## Existing Features Preserved

The following features from the original `proxy.js` are fully preserved:

- ✅ Session Management with node-session
- ✅ User Session Tracking with max session limits
- ✅ Rule-level proxy client authentication
- ✅ MD5 Password Hashing for proxy user compatibility
- ✅ Session Token Management
- ✅ HTTP Proxying with pretend mode
- ✅ WebSocket Proxying with upgrade handling
- ✅ SNI Support for multi-domain SSL
- ✅ TCP Passthrough on port 8443

## Docker Volumes

The following volumes are mounted for persistence:

- `./cert:/node_/cert` - SSL certificate files
- `./backups:/node_/backups` - Configuration backups
- `./proxy-config.json:/node_/proxy-config.json` - Main configuration
- `./admin_users.json:/node_/admin_users.json` - Admin credentials

## Troubleshooting

### Configuration Not Loading

Check the admin API logs:
```bash
docker-compose logs 724_http-proxy
```

### Default Admin Access

If you can't access the admin interface with default credentials, check `admin_users.json` or reset the admin password through Docker exec.

### Hot-Reload Not Working

Ensure the `proxy-config.json` file is properly mounted as a volume and that the file watcher has permission to read it.

## Migration from Environment Variables

Existing deployments using environment variables will be automatically migrated on first startup:

1. System reads environment variables
2. Creates `proxy-config.json` with equivalent configuration
3. Writes `.env-imported` so the import is not repeated
4. Continues using JSON config thereafter

## Development

To modify the web UI, edit files in `node/web-ui/`:

- `index.html` - Main dashboard
- `login.html` - Admin login page
- `css/tokens.css` and `css/app-design.css` - Admin UI styles
- `js/app-real.jsx` - Application state and routing
- `js/pages-rules.jsx` - Unified proxy management page
- `js/pages-config.jsx` - Certificate, settings, and backup pages

## License

This project is maintained for internal use. Please refer to your organization's licensing terms.

## Support

For issues or questions, please contact your system administrator.
