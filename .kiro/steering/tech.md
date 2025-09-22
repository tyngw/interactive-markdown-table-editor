# Technology Stack

## Backend (VS Code Extension)
- **Language**: TypeScript
- **Target**: ES2020, CommonJS modules
- **Framework**: VS Code Extension API (^1.74.0)
- **Dependencies**: 
  - `markdown-it` for Markdown parsing
  - `iconv-lite` for character encoding

## Frontend (Webview)
- **Framework**: React 18.2.0 with TypeScript
- **Build Tool**: Vite 4.4.0 with Terser minification
- **Testing**: Jest with React Testing Library
- **Styling**: CSS with VS Code theme integration

## Development Tools
- **Linting**: ESLint with TypeScript parser
- **Testing**: Mocha for extension tests, Jest for React components
- **Packaging**: VSCE for extension packaging

## Build Commands

### Extension Development
```bash
# Compile TypeScript and build webview
npm run compile

# Watch mode for TypeScript
npm run watch

# Run all tests
npm run test:all

# Package extension
vsce package
```

### Webview Development
```bash
# Start development server (recommended for UI work)
npm run dev
# Opens http://localhost:3000/dev/ for live development

# Build webview for production
npm run build-webview

# Webview-specific development
npm run dev:webview
cd webview-react && npm run dev
```

### Testing
```bash
# Extension tests
npm run test

# Integration tests
npm run test:integration

# Webview tests
cd webview-react && npm test
```

## Environment Variables
- `MTE_KEEP_CONSOLE=1`: Preserve console logs in production build