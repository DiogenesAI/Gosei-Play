# Gosei Play Documentation

Welcome to the Gosei Play documentation! This directory contains comprehensive documentation for the Gosei Play Go game platform.

## 📚 Documentation Structure

```
docs/
├── getting-started/          # Quick start and installation guides
├── features/                 # Feature documentation
│   ├── time-controls/       # Time control systems
│   ├── game-types/          # Game modes and board sizes
│   ├── ai-integration/      # KataGo AI integration
│   └── scoring/             # Scoring rules and Ko implementation
├── deployment/              # Deployment guides for various platforms
├── development/             # Development documentation
├── troubleshooting/         # Common issues and solutions
├── archive/                 # Historical documentation
│   └── bug-fixes/          # Bug fix documentation
└── change_logs/            # Change logs and migration notes
    └── restructure/        # Repository restructuring docs
```

---

## 🚀 Quick Links

### For New Users
- **[Quick Start Guide](getting-started/QUICK_START.md)** - Get started in minutes
- **[Main README](getting-started/README.md)** - Project overview and features

### For Developers
- **[Project Status](development/PROJECT_STATUS.md)** - Current development status
- **[Planning](development/PLANNING.md)** - Development roadmap
- **[Version History](development/VERSION.md)** - Detailed version changelog
- **[Security](development/SECURITY.md)** - Security guidelines

### For Deployment
- **[VPS Deployment](deployment/VPS_DEPLOYMENT.md)** - Deploy to VPS
- **[Production VPS](deployment/PRODUCTION_VPS_DEPLOYMENT.md)** - Production setup
- **[Heroku Setup](deployment/HEROKU_SETUP.md)** - Deploy to Heroku
- **[Netlify Deploy](deployment/NETLIFY_DEPLOY.md)** - Deploy to Netlify

---

## 📖 Documentation by Topic

### ⏱️ Time Controls
Learn about Gosei Play's professional-grade time control system:
- [Time Control Flexibility](features/time-controls/TIME_CONTROL_FLEXIBILITY.md)
- [Byo-yomi Implementation](features/time-controls/BYO_YOMI_IMPLEMENTATION_SUMMARY.md)
- [Time Tracking System](features/time-controls/TIME_TRACKING_SYSTEM.md)
- [Time per Move Behavior](features/time-controls/TIME_PER_MOVE_BEHAVIOR.md)

### 🎮 Game Types & Features
- [Board Sizes](features/game-types/BOARD_SIZES.md) - 9×9 to 21×21
- [Game Type Behaviors](features/game-types/GAME_TYPE_TIME_CONTROL_BEHAVIOR.md)
- [Blitz Game Rules](features/game-types/BLITZ_GAME_BYO_YOMI_BEHAVIOR.md)
- [Play Again Feature](features/PLAY_AGAIN_FEATURE.md)
- [Game Review](features/GAME_REVIEW_FEATURE.md)
- [Spectator Mode](features/SPECTATOR_IMPLEMENTATION.md)

### 🤖 AI Integration
- [AI Integration Guide](features/ai-integration/AI_INTEGRATION_GUIDE.md)
- [KataGo Setup Guide](features/ai-integration/KATAGO_SETUP_GUIDE.md)
- [KataGo Windows Setup](features/ai-integration/KATAGO_WINDOWS_SETUP_GUIDE.md)
- [AI Network Selection](features/ai-integration/DIRECT_AI_NETWORK_SELECTION_FEATURE.md)

### 🎯 Scoring & Rules
- [Ko Rule Implementation](features/scoring/KO_RULE_IMPLEMENTATION.md)
- [Ko Rule Quick Reference](features/scoring/KO_RULE_QUICK_REFERENCE.md)
- [Ko Rule Details](features/scoring/KO_RULE.md)

### 🚀 Deployment
- [VPS Deployment Guide](deployment/VPS_DEPLOYMENT.md)
- [Ubuntu VPS Setup](deployment/UBUNTU_VPS_SETUP_GUIDE.md)
- [Nginx SSL Setup](deployment/NGINX_SSL_INSTRUCTIONS.md)
- [Redis Deployment](deployment/REDIS-DEPLOYMENT-GUIDE.md)
- [PM2 Configuration](deployment/PM2_ECOSYSTEM_CONFIG.md)

### 🛠️ Development
- [Project Planning](development/PLANNING.md)
- [Project Status](development/PROJECT_STATUS.md)
- [Version History](development/VERSION.md)
- [Changelog](development/CHANGELOG.md)
- [Move Storage System](development/MOVE_STORAGE_SYSTEM.md)

### 🐛 Troubleshooting
- [Troubleshooting Guide](troubleshooting/TROUBLESHOOTING.md)
- [Immediate Fix Instructions](troubleshooting/IMMEDIATE_FIX_INSTRUCTIONS.md)

---

## 📂 Archive

Historical documentation and bug fixes are archived for reference:
- **[Bug Fixes Archive](archive/bug-fixes/)** - Historical bug fix documentation
  - Timer fixes, AI fixes, UI fixes, and more

---

## 📝 Change Logs

Repository restructuring and migration documentation:
- **[Change Logs](change_logs/)** - All change logs and migration notes
- **[Restructure Docs](change_logs/restructure/)** - Repository cleanup documentation

---

## 🎯 Documentation Standards

### File Naming
- Use `SCREAMING_SNAKE_CASE.md` for documentation files
- Be descriptive and specific
- Group related docs in subdirectories

### Content Structure
Each documentation file should include:
1. **Title** - Clear, descriptive title
2. **Overview** - Brief summary of the topic
3. **Details** - Comprehensive information
4. **Examples** - Code examples where applicable
5. **References** - Links to related documentation

### Updating Documentation
When updating docs:
1. Keep information current and accurate
2. Update related documentation
3. Add to changelog if significant
4. Follow existing formatting conventions

---

## 🔍 Finding Documentation

### By Feature
Look in `features/` subdirectories for feature-specific documentation.

### By Task
- **Getting Started** → `getting-started/`
- **Deploying** → `deployment/`
- **Developing** → `development/`
- **Troubleshooting** → `troubleshooting/`

### By Topic
Use the table of contents above or browse the directory structure.

---

## 🤝 Contributing

To contribute to documentation:
1. Follow the documentation standards above
2. Place files in appropriate directories
3. Update this README if adding new categories
4. Submit a pull request with clear description

---

## 📞 Need Help?

- **Issues?** → Check [Troubleshooting](troubleshooting/TROUBLESHOOTING.md)
- **Questions?** → Review [Quick Start](getting-started/QUICK_START.md)
- **Deployment?** → See [Deployment Guides](deployment/)

---

## 📊 Documentation Statistics

- **Total Files:** 77 documentation files
- **Categories:** 9 main categories
- **Last Reorganized:** 2025-12-04
- **Maintained by:** Gosei Play Team

---

**Happy Reading! 📖**

For the latest updates, check [VERSION.md](development/VERSION.md) and [CHANGELOG.md](development/CHANGELOG.md).
