# MD Viewer

A minimal macOS Markdown viewer built with Tauri and vanilla JavaScript. Opens local `.md` files via Finder **Open With**, renders markdown in-memory with [markdown-it](https://github.com/markdown-it/markdown-it) and [highlight.js](https://highlightjs.org/).

## Features

- Native macOS `.app` (no Electron)
- File association for `.md` and `.markdown`
- In-memory rendering (no temp HTML files)
- Light and dark themes (follows system appearance by default; toggle persists in `localStorage`)
- Syntax highlighting for common languages

## Prerequisites

- macOS 10.15+
- [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/)
- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/) 18+

## Install dependencies

```bash
cd md-viewer
npm install
```

## Development

```bash
npm run dev
```

**Note:** macOS **Open With** file association is registered in the built `.app` bundle, not always during `tauri dev`. Use a release build to test file opening from Finder.

## Build macOS app bundle

```bash
npm run build
```

The app bundle is created at:

```
src-tauri/target/release/bundle/macos/MD Viewer.app
```

## Install and use

```bash
cp -R "src-tauri/target/release/bundle/macos/MD Viewer.app" /Applications/
open /Applications/MD\ Viewer.app
```

### Open a Markdown file

1. Right-click any `.md` file in Finder
2. Choose **Open With** → **MD Viewer**
3. Optionally enable **Always Open With**

Or from Terminal:

```bash
open -a "MD Viewer" ~/path/to/file.md
```

## Themes

- **Default:** matches macOS light/dark mode (`prefers-color-scheme`)
- **Toggle:** use the **Light** / **Dark** button in the header
- **Persistence:** manual choice is saved in `localStorage`

## Project structure

```
md-viewer/
├── public/
│   ├── index.html      # Shell UI
│   ├── app.js          # Bundled viewer (esbuild, generated)
│   ├── styles.css      # Light/dark typography and layout
│   └── src/viewer.js   # Source for app.js
├── package.json
└── src-tauri/          # Rust backend (file open, read)
    ├── tauri.conf.json # File associations, bundle config
    └── src/lib.rs      # RunEvent::Opened, read_markdown_file
```

## Tech stack

- Tauri 2
- Vanilla JavaScript (no React/Vue/Angular)
- markdown-it
- highlight.js

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App greyed out in **Open With** | Build and install the `.app`; associations are not active in dev mode only |
| App missing from **Open With** list | Rebuild after install; the app must declare `net.daringfireball.markdown` in `contentTypes` (macOS standard UTI for `.md`) |
| File does not open | Rebuild after changing `fileAssociations` in `tauri.conf.json` |
| Blank window | Open a file via **Open With** or `open -a "MD Viewer" file.md` |
