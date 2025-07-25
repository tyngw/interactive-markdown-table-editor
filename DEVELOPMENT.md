# Development Quick Start

## TL;DR - Fast Development Setup

```bash
npm run dev        # Start development server
# Open http://localhost:3000/dev/ in browser
# Edit files in webview/ folder and refresh to see changes
```

## Why Use Development Mode?

- ❌ **Before**: Edit CSS → Run `vsce package` → Install VSIX → Test in VSCode → Repeat
- ✅ **After**: Edit CSS → Refresh browser → See changes instantly

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run dev:watch` | Start with file change monitoring |
| `npm run compile` | Compile TypeScript |
| `npm test` | Run tests |

## What You Get

- 🔄 **Instant refresh** - No extension rebuilding needed
- 🎯 **Sample data** - Pre-loaded test tables
- 🐛 **Debug tools** - Console logging and state inspection  
- 🎨 **VSCode theming** - Accurate visual simulation
- 👀 **File watching** - Notifications when files change

## File Structure

```
webview/
├── style.css              # Edit and refresh to see CSS changes
├── js/
│   ├── core.js            # Main table editor logic
│   ├── table-renderer.js  # Table rendering
│   └── ...                # Other modules
dev/
├── index.html             # Development page (rarely needs editing)
└── start-dev-server.js    # Server logic
```

## Tips

- Use browser DevTools for debugging JavaScript
- Check console for operation logs (with helpful emojis!)
- Use \"Debug State\" button to inspect table state
- Test CSV export directly in browser
- All keyboard shortcuts work in development mode

## Need Help?

See full documentation in:
- `README.md` - User documentation with development section
- `DEVELOPMENT.md` - Comprehensive development guide