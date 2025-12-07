# Configuration Files

This directory contains all configuration files for the Gosei Play project, organized by purpose.

## Directory Structure

```
config/
├── build/              # Build-related configurations
│   ├── craco.config.js
│   ├── postcss.config.js
│   └── tailwind.config.js
├── deployment/         # Deployment configurations
│   ├── netlify.config.js
│   └── build-override.env
└── vps/               # VPS-specific configurations
    └── vps-config.example.sh
```

## Build Configuration

### craco.config.js
- Customizes Create React App webpack configuration
- Disables TypeScript and ESLint checks for faster builds
- Used by: `npm start`, `npm run build`

### postcss.config.js
- PostCSS configuration for CSS processing
- Integrates with Tailwind CSS

### tailwind.config.js
- Tailwind CSS configuration
- Defines theme, colors, and custom utilities

## Deployment Configuration

### netlify.config.js
- Netlify deployment settings
- Build commands and redirects
- Socket.io function configuration

### build-override.env
- Environment variable overrides for builds
- Used in CI/CD pipelines

## VPS Configuration

### vps-config.example.sh
- Example VPS configuration script
- Copy and customize for your VPS setup

## Usage

All config files are symlinked to the root directory for compatibility with existing build tools:
- Root symlinks → `config/build/*` and `config/deployment/*`
- This maintains backward compatibility while organizing files

## Migration Notes

**Date:** 2025-12-04  
**Reason:** Repository cleanup and organization  
**Changes:**
- Moved config files from root to organized subdirectories
- Created symlinks for backward compatibility
- No breaking changes to build process

## Future Improvements

- [ ] Migrate to single unified config file where possible
- [ ] Add environment-specific configs (dev, staging, prod)
- [ ] Document all configuration options
