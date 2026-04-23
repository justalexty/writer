# AGENT_CONTEXT.md — writer

## What It Is

A minimal, beautiful word processor. Japanese design sensibility (negative space, restraint, calm) — no Japanese characters in the UI.

Lives at: https://justalexty.github.io/writer/
Repo: https://github.com/justalexty/writer

## Stack

- Pure HTML/CSS/JS — no framework, no build step
- GitHub Pages (static)
- Auth: GitHub Personal Access Token (gist scope, stored in localStorage)
- Storage: Private GitHub Gists (one gist per document)

## File Structure

```
index.html   — markup (auth screen + main app)
style.css    — all styling + CSS variables
app.js       — all logic (auth, gist CRUD, prefs, editor)
```

## Design Principles

- Japanese aesthetic: wabi-sabi palette, negative space (ma), minimal chrome
- Window-within-desktop: editor is a frosted glass pane on a styled "desktop"
- Typewriter font (Courier Prime) for the writing surface
- Novel formatting: first-line indent, 1.8 line height, paragraph spacing
- No toolbar — writing surface is clean

## Features (v1)

- GitHub PAT auth (gist scope)
- Create / open / autosave documents as private Gists
- 6 background themes: mist, parchment, ink, sakura, bamboo, stone
- Custom background URL
- Font size slider (13–22px)
- Dark glass window toggle
- Focus mode (green dot — hides chrome, shows on hover)
- Word + character count
- Autosave (2.5s debounce) + ⌘S manual save
- ⌘K toggles side panel
- Editable document title in titlebar

## Roadmap

- **v2:** Electron desktop app (same codebase)
- **v3:** Editor features (markdown shortcuts, formatting)

## Key Implementation Notes

- `GIST_PREFIX = 'shoji: '` — used to filter gists belonging to writer (keep as-is for continuity)
- Docs stored as `shoji.html` filename inside gist (legacy from naming)
- `defaultParagraphSeparator` set to `div`
- Prefs stored in localStorage under `shoji_prefs` key
- Token stored under `shoji_pat` key
- CSS vars drive theming — `--font-size`, `--window-bg`, etc.
- Dark glass overrides CSS vars via `.window.dark-glass` class

## No-Vercel Rule

Deploy only to GitHub Pages. Never Vercel.
