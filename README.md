# Notion Slides — Presentation Mode (MV3)

## Dev loop (fast)

1. Install deps:
   - `npm install`
2. Start a watch build:
   - `npm run dev`
3. Load unpacked extension:
   - Chrome/Edge → Extensions → Developer mode → **Load unpacked** → select `dist/`
4. After code changes:
   - Watch build updates `dist/`
   - Click **Reload** on the extension card
   - Refresh the Notion tab

## Controls (MVP)

- Toggle presentation mode: extension action button or `Ctrl+Shift+P`
- Next slide: `ArrowRight`, `PageDown`, `Space`
- Prev slide: `ArrowLeft`, `PageUp`, `Shift+Space`
- Fullscreen: `F`
- Exit presentation mode: `Escape`

Slides are defined by **H1** headings and **divider** blocks.
