# Scripts Directory

Cross-platform Node.js scripts for development and deployment tasks.

## Available Scripts

### Development Scripts

#### `npm run dev`
**File:** `start-dev.js`  
**Purpose:** Start both client and server in development mode  
**Replaces:** `start.bat`, `start.sh`

```bash
npm run dev
```

This will:
- Start React development server on port 3000
- Start Node.js backend server on port 3001
- Handle graceful shutdown with Ctrl+C

#### `npm run check`
**File:** `check-server.js`  
**Purpose:** Check if the backend server is running  
**Replaces:** `check-server.bat`

```bash
npm run check
```

This will:
- Ping the server at http://localhost:3001
- Display server status and response code
- Provide troubleshooting tips if server is offline

### Setup Scripts

#### KataGo Setup
**Directory:** `setup/`  
**Purpose:** Install and configure KataGo AI engine

*Coming soon - will replace Windows-only .bat files*

## Migration from .bat/.sh files

### Old vs New

| Old Command | New Command | Status |
|------------|-------------|--------|
| `start.bat` | `npm run dev` | ✅ Migrated |
| `check-server.bat` | `npm run check` | ✅ Migrated |
| `run-all.bat` | `npm run dev` | ✅ Migrated |
| KataGo .bat files | `npm run setup:katago` | 🚧 Planned |

### Benefits

✅ **Cross-platform:** Works on Windows, Mac, Linux  
✅ **Consistent:** Same commands across all platforms  
✅ **Maintainable:** Single codebase instead of .bat + .sh  
✅ **Better error handling:** Proper error messages and exit codes  
✅ **Modern:** Uses Node.js instead of shell scripts

## Adding New Scripts

1. Create a new `.js` file in this directory
2. Add shebang: `#!/usr/bin/env node`
3. Add script to `package.json`:
   ```json
   "scripts": {
     "your-script": "node scripts/your-script.js"
   }
   ```
4. Document it in this README

## Script Guidelines

- Use Node.js built-in modules when possible
- Handle errors gracefully
- Provide helpful error messages
- Support both Windows and Unix paths
- Add proper logging with emojis for better UX
- Exit with appropriate codes (0 = success, 1 = error)

## Environment Variables

Scripts respect these environment variables:

- `SERVER_URL`: Backend server URL (default: http://localhost:3001)
- `CLIENT_PORT`: React dev server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## Troubleshooting

### Permission Denied (Unix/Mac)
```bash
chmod +x scripts/*.js
```

### Node Not Found
Make sure Node.js is installed and in your PATH:
```bash
node --version
```

### Scripts Not Working
1. Check Node.js version (16+ required)
2. Run `npm install` to ensure dependencies are installed
3. Check file paths are correct
4. Review error messages in console

## Future Improvements

- [ ] Add deployment scripts
- [ ] Add database migration scripts
- [ ] Add backup/restore scripts
- [ ] Add performance monitoring scripts
- [ ] Add automated testing scripts

---

**Last Updated:** 2025-12-04  
**Maintainer:** Gosei Play Team
