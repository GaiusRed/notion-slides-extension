# Presentation Mode for Notion — Product Requirements (Engineering)

## 1) Problem / Context (Technical)
Notion pages are excellent for authoring, but a poor live-presentation surface:
- The browser chrome + Notion top bar and nav elements create visual noise.
- “Scroll-only” presenting lacks a slide semantic and breaks presenter flow.
- Lecturers/presenters need deterministic navigation (next/prev slide), quick full-screen, and the ability to edit live without leaving the presentation context.

This extension adds a **Presentation Mode** to Notion pages with:
- A clean, distraction-free view (hide Notion chrome)
- Deterministic navigation by content structure
- Fullscreen support
- Live editing while presenting

## 2) Goals / Non-Goals
### Goals
- Provide a **toggleable Presentation Mode** on Notion pages.
- Define “slides” from document structure:
  - Each **Heading 1 (H1)** starts a new slide.
  - **Divider blocks** act as explicit slide/page breaks.
- Enable **next/prev** navigation via keyboard and optional on-screen controls.
- Support **fullscreen**.
- Keep Notion fully interactive (editing still works).
- Must be implementable as a **Chrome/Edge MV3 extension** in an **8-hour hackathon**.

### Non-Goals (MVP)
- No exporting to PDF/PPT.
- No presenter notes / second-screen presenter view.
- No remote control / multi-device sync.
- No theming beyond basic clean-mode CSS.
- No deep Notion API integration (assume we can do it with DOM-level content scripts).

## 3) Target Environment / Constraints
- Browser: Chromium-based (Chrome, Edge). Manifest V3.
- Notion: Web app (notion.so + possible custom domains). DOM is dynamic, virtualized, and subject to change.
- Must tolerate Notion DOM changes via defensive selectors and multiple heuristics.
- Performance must remain smooth on large pages (avoid heavy DOM scanning each keypress).

## 4) Definitions
### Presentation Mode
A UI state within the current Notion page where:
- Notion chrome is hidden (top bar, side nav where possible).
- Document content is constrained to a slide viewport.
- Navigation is by “slide boundaries” (H1 or divider).

### Slide Boundary
A boundary index computed from the page DOM:
- Start boundary at first content block (slide 1)
- Additional boundaries at each H1
- Additional boundaries at each divider

### Slide
A contiguous range of blocks between boundary[i] and boundary[i+1].

## 5) User Stories (MVP)
1. As a presenter, I can toggle presentation mode on/off without losing my scroll position.
2. As a presenter, I can use keyboard shortcuts to move to the next/previous slide.
3. As a presenter, I can enter fullscreen and present without browser/Notion distractions.
4. As a presenter, I can edit content during presentation mode and slide navigation continues to work.

## 6) Functional Requirements
### FR-1 Toggle Presentation Mode
- Trigger: toolbar button (extension action) and keyboard shortcut.
- Behavior:
  - Adds a root CSS class to `document.documentElement` (e.g., `.ns-presenting`).
  - Injects minimal CSS to hide Notion chrome.
  - Initializes slide index from current scroll position.
  - Persists state per-tab (not global) and resets on reload.

### FR-2 Compute Slide Boundaries
- On entering presentation mode, compute slide boundaries using a DOM scan of the Notion content root.
- Boundary rules:
  - Find blocks corresponding to Heading 1.
  - Find divider blocks.
- Must be robust to Notion rendering:
  - Prefer stable attributes when available.
  - Fall back to heuristics (role, data-block-id patterns, class name patterns).
- Recompute boundaries on content changes while presenting (throttled) to preserve edit-while-presenting.

### FR-3 Slide Navigation
- Shortcuts (MVP defaults):
  - Next slide: `ArrowRight`, `PageDown`, `Space`
  - Previous slide: `ArrowLeft`, `PageUp`, `Shift+Space`
  - Exit presentation mode: `Escape`
  - Fullscreen toggle: `F`
- Behavior:
  - When navigating, scroll the content container so that the boundary block is aligned to the top of the viewport.
  - Use smooth scrolling by default; allow instant scrolling if smooth causes issues.
  - Maintain internal `currentSlideIndex`.

### FR-4 Fullscreen
- Toggle fullscreen using the standard Fullscreen API.
- Prefer fullscreen on the document element or a presentation wrapper.
- Must gracefully fail if browser policy blocks it (no crash; show a brief toast or console log in MVP).

### FR-5 Minimal On-Screen UI (MVP)
- Optional but recommended if time permits:
  - A small unobtrusive overlay showing `current/total`.
  - Next/Prev click targets (tiny) only if it doesn’t risk interfering with Notion editing.

### FR-6 Disable Interference with Editing
- Keyboard shortcuts must not break editing:
  - If the active element is an input/textarea/contenteditable within Notion, suppress navigation keys except when a modifier is used.
  - Exception: `Escape` to exit presentation mode should still work.

## 7) UX / Visual Requirements (MVP)
- Hide Notion top bar and other chrome elements when in presentation mode.
- Center content and provide consistent margins.
- Use the existing Notion typography (do not override fonts/colors).
- No new “theme” design language; keep CSS minimal and reversible.

## 8) Edge Cases / Behavior Details
- Page with no H1 and no dividers: treat entire page as a single slide.
- Multiple H1 in a row: each H1 starts a slide (including empty slides). Optionally merge empty slides later.
- Divider at top: divider starts a new slide boundary.
- Notion virtualization:
  - When scrolling to a boundary far away, Notion may not have rendered the destination block. Strategy:
    - Attempt to locate destination element; if missing, do a progressive scroll (binary search-ish) or call `scrollIntoView` on an anchor if available.
  - MVP: accept best-effort `element.scrollIntoView({block:'start'})`; if the element isn’t present, fall back to `window.scrollTo(0, yApprox)` if we can compute offsets.

## 9) Telemetry / Logging (MVP)
- No analytics.
- Console logging behind a debug flag in extension storage (optional).

## 10) Security / Privacy
- No data exfiltration.
- No network calls required.
- Permissions:
  - `activeTab` or `scripting` (MV3) to inject content scripts/CSS.
  - Host permissions limited to `https://www.notion.so/*` and optional custom domains via user opt-in later.

## 11) Technical Architecture (MV3)
### High-Level
- **Service worker** (background) for extension action and command handling.
- **Content script** injected on matching Notion pages.
- **CSS injection** for presentation mode styling.
- **MutationObserver** in content script to detect edits and update slide boundaries.

### Suggested Module Breakdown
- `content/`
  - `presenter.ts` — state machine (on/off, slide index, boundary list)
  - `notionDom.ts` — content root discovery + boundary detection heuristics
  - `shortcuts.ts` — key handling + focus/editable detection
  - `overlay.ts` — optional slide counter UI
  - `styles.css` — minimal CSS for clean view
- `background/`
  - `serviceWorker.ts` — handles action click + commands, sends messages to content script
- `shared/`
  - `types.ts`

### State Model
- `isPresenting: boolean`
- `boundaries: HTMLElement[]` (or `{id, elementRef, y}`)
- `currentIndex: number`
- `isFullscreen: boolean`

### Notion DOM Strategy (Heuristics)
Because Notion’s DOM is not a stable public API:
- Identify the main scroll container/root:
  - Try common patterns: a central “page content” container with overflow scroll.
  - Fallback to `document.scrollingElement`.
- Boundary detection:
  - H1: locate blocks that render as heading level 1 (e.g., `role="heading"` with `aria-level="1"` or heading-like class patterns).
  - Divider: locate horizontal rule or divider block elements.
- Keep selectors isolated in `notionDom.ts` so changes are localized.

### Handling Updates While Editing
- Use `MutationObserver` on the content root.
- Throttle recompute (e.g., 250–500ms) and keep the current slide anchored by nearest boundary above current scroll.

## 12) MVP Scope (8-Hour Hackathon)
### Must-Have
- Toggle presentation mode (action + shortcut).
- Hide Notion chrome via CSS class.
- Slide boundary detection (H1 + divider).
- Next/prev slide navigation.
- Fullscreen toggle.
- Basic editable-safe key handling.

### Nice-to-Have (only if time remains)
- Small `x/y` slide counter overlay.
- Basic toast for “recomputed slides” or fullscreen failure.

### Explicitly Out of Scope
- Presenter view, notes, timers.
- Custom slide transitions.
- Export.
- Multi-page “deck”.

### Timeboxed Implementation Plan (Pragmatic)
- Hour 1: MV3 skeleton, action button, content script injection
- Hour 2: CSS clean mode + toggle plumbing
- Hours 3–4: DOM root detection + boundary detection (H1/divider)
- Hour 5: Navigation + shortcuts + editable guard
- Hour 6: Fullscreen + exit handling
- Hour 7: MutationObserver + throttled recompute
- Hour 8: Polish, manual testing on 2–3 real Notion pages

## 13) Future Features (2-Week Sprint)
Prioritize resilience, usability, and quality.

### Sprint Themes
- Better boundary detection and stability across Notion changes
- Presenter ergonomics (UI + feedback)
- Performance on large pages

### Backlog (Candidate)
1. **Robust Notion DOM adapters**
   - Multiple selector strategies with runtime detection + fallback.
   - Automated “DOM contract” checks.
2. **Slide overlay controls**
   - Minimal overlay: next/prev buttons, slide counter, fullscreen indicator.
   - Hide overlay when typing.
3. **Configurable shortcuts**
   - Options page to customize keys.
4. **Custom domains support**
   - Allow users to add host patterns (with clear permission prompts).
5. **Better virtualization navigation**
   - Preload nearby slides, progressive scroll to render targets.
6. **Slide-level zoom / fit-to-screen**
   - Compute scale so slide content fits viewport height.
7. **“Start presentation from here”**
   - Derive slide index based on cursor position / selected block.
8. **Divider semantics options**
   - Treat divider as boundary-only vs “blank slide after divider”.
9. **Lightweight E2E tests**
   - Playwright-based smoke checks on a static HTML fixture that mimics Notion-ish structure.
10. **Performance profiling & caching**
   - Cache boundaries by block id; incremental updates instead of full rescan.

## 14) Developer Workflow (VS Code + Fast Iteration)
The team should not need to “build → upload → publish” for testing. The expected inner loop is:

### Local Manual Loop (Primary)
- Run a watch build that outputs an unpacked extension directory (e.g., `dist/`).
- Load the extension as **unpacked** in Chrome/Edge (Developer mode).
- After changes:
  - The watch build updates `dist/` automatically.
  - Click **Reload** on the extension card.
  - Refresh the Notion tab (or navigate) to re-inject content scripts.

This gets iteration time to ~seconds and works well for content scripts + injected CSS.

### VS Code Tasks (Recommended)
- Provide a VS Code task to run the watch build.
- Provide a VS Code task to launch a dedicated browser profile with the extension preloaded:
  - Chrome: `chrome.exe --user-data-dir=<temp-profile> --load-extension=<abs-path-to-dist>`
  - Edge: `msedge.exe --user-data-dir=<temp-profile> --load-extension=<abs-path-to-dist>`

Using a separate profile avoids polluting the developer’s main profile and makes testing repeatable.

### Debugging
- Content script debugging: use DevTools on the Notion tab.
- Service worker debugging (MV3): open the extension page and “Inspect” the service worker.
- Source maps should be enabled in development builds to make debugging realistic.

### Hot Reload Reality (MV3)
- Content scripts generally require a tab refresh after extension reload.
- Service worker changes require extension reload.
- Aim for “watch build + one-click reload” rather than true hot module replacement.

## 15) Technical Stack
### Language / Framework
- TypeScript
- No framework required for MVP.
  - Optional for Options UI later: lightweight vanilla TS or React (only if already standard in team tooling).

### Build Tooling
- Vite (or esbuild) for fast MV3 bundling.
- ESLint + Prettier.

### Extension Platform
- Chrome Extension Manifest V3
- `chrome.scripting` for injection
- `chrome.commands` for shortcuts
- `chrome.storage` (optional) for settings

### Testing
- Unit tests: Vitest (for boundary detection / heuristics using DOM fixtures).
- Manual smoke tests: real Notion pages (required due to DOM churn and virtualization).
- E2E regression (2-week sprint): Playwright launching Chromium with the unpacked extension loaded.
  - Prefer a local static HTML “Notion-ish fixture” for deterministic tests.
  - Keep a small set of real-Notion smoke checks as non-blocking (prone to auth/network flake).

## 16) Acceptance Criteria (MVP)
- On any Notion page, clicking the extension action toggles clean presentation mode.
- Notion top bar is hidden in presentation mode and restored on exit.
- Navigation works:
  - Next/prev advances between H1/divider-defined slides.
  - Scroll lands with slide start at top.
- Fullscreen toggles with `F` in presentation mode.
- Editing remains possible:
  - Typing in Notion doesn’t trigger slide navigation.
- Escape exits presentation mode (and fullscreen if active).

## 17) Risks / Mitigations
- **Notion DOM churn** → isolate selectors, provide multiple heuristics.
- **Virtualization** → best-effort scrollIntoView in MVP; improve with progressive rendering in sprint.
- **Keyboard conflicts** → strict editable detection; configurable shortcuts later.
- **CSS collisions** → scope everything under `.ns-presenting`.

## 18) Open Questions (Engineering)
- Which exact Notion chrome elements should be hidden (top bar only vs also left nav)? Prefer only the page as a slide (no other chrome).
- How strict should “Heading 1” mapping be (Notion heading types vs semantic aria headings)?
- Should dividers create a new slide before or after divider, or both? Prefer after divider.
- Do we need per-page persisted settings (e.g., “treat H2 as slides”)? (Out of scope MVP)
---

## 19) Post-MVP Enhancements (Implemented)

The following features were implemented after the initial MVP release to improve presenter experience and visual feedback.

### Extension Branding
- **Extension icon**: Added visual identity to extension action button and browser toolbar.
- **Implementation**: Icon asset (`NotionSlides.png`) placed in `public/` directory and referenced in manifest at 16px, 48px, and 128px sizes.
- **Rationale**: Improves discoverability in crowded toolbars and provides professional polish in extension marketplace.

### Directional Slide Transitions
- **Feature**: Animated slide transitions that provide visual continuity and directional feedback during navigation.
- **Behavior**:
  - **Next slide**: Content slides up from below (200px translateY offset → 0).
  - **Previous slide**: Content slides down from above (-200px translateY offset → 0).
  - Duration: 450ms with `cubic-bezier(0.25, 0.1, 0.25, 1)` easing.
  - Scroll position changes instantly; only the content transform animates.
- **Implementation**:
  - `gotoIndex()` accepts optional `direction: 'next' | 'prev'` parameter.
  - Animation uses CSS transforms with transition suppression during setup, then reflow trigger + smooth transition to final position.
  - Transform respects current zoom level: `translateY(offset) scale(zoomLevel)`.
  - Timeout cleanup ensures transition property is removed after animation completes.
- **UX Goal**: Reduce cognitive load by making navigation direction visually obvious. Pronounced motion (200px travel) ensures animation is noticeable without being jarring.
- **Edge Cases**:
  - Navigation without direction parameter (e.g., initial enter or recompute) falls back to smooth scroll without animation.
  - Animation coordinate system works for both window and element scroll targets.

### Presentation Zoom
- **Feature**: Built-in zoom control for presentations, eliminating dependency on browser-level zoom.
- **Default Behavior**: Presentation mode auto-starts at **150% zoom (1.5x scale)** for improved readability on large screens and projectors.
- **Manual Control**:
  - **Zoom In**: `+` or `=` key (increases by 10%, max 300%).
  - **Zoom Out**: `-` key (decreases by 10%, min 50%).
  - **Reset**: `0` key (returns to 150% default).
- **UI Feedback**: Overlay displays current zoom percentage alongside slide counter (e.g., "3/12 · 150%").
- **Implementation**:
  - State: Added `zoomLevel: number` to `PresenterState`, initialized to 1.5.
  - Transform: Applied via `root.style.transform = scale(${zoomLevel})` with `transform-origin: top center`.
  - Smooth transitions: 200ms ease-out on zoom changes.
  - Coordination: Zoom transform stacks with slide animation transforms using compound `translateY() scale()` syntax.
  - Cleanup: Zoom transform cleared on exit; zoom level reset to 1.5 (not 1.0) for next session.
- **Shortcuts**: Added `zoom-in`, `zoom-out`, `zoom-reset` to `Shortcut` union type; wired through `interpretKey()` and `contentScript.ts` event handler.
- **Rationale**: 
  - Browser zoom affects entire viewport including chrome/UI; extension zoom targets only content root.
  - 150% default addresses common presenter pain point of "too small to read from back of room" without manual intervention.
  - Granular 10% increments provide fine-tuned control for varying display sizes and distances.

### Technical Notes
- **CSS Transform Stacking**: Both zoom and slide animations manipulate `transform` property on content root. Implementation ensures they compose correctly via compound transform string.
- **Transition Management**: Careful use of `transition: none` → reflow → `transition: ...` pattern prevents unwanted initial animation flashes.
- **State Persistence**: Zoom level persists across slide navigation within a session but resets between enter/exit cycles (intentional; prevents unexpected zoom on re-entry).
- **Performance**: Transform-based zoom leverages GPU compositing; no performance degradation observed on pages with 100+ blocks.

### Future Considerations
- **Configurable default zoom**: Allow users to set preferred starting zoom via extension options page.
- **Zoom persistence**: Store zoom preference in `chrome.storage` across sessions.
- **Animation toggle**: Provide option to disable slide transitions for users who prefer instant navigation.
- **Mouse/touchpad zoom**: Support pinch-to-zoom or scroll+modifier gestures (requires pointer event handling).
