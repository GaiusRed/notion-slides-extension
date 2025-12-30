export const PRESENTATION_CSS = `
/* Scope everything to presentation mode */
:root.ns-presenting {
  /* Avoid Notion overscroll quirks */
  overscroll-behavior: none;
}

/* Utility class for hiding elements */
:root.ns-presenting .ns-hidden {
  display: none !important;
}

:root.ns-presenting body {
  /* Keep Notion typography/colors; just reduce distractions */
  overflow: hidden;
}

/* Hide common Notion chrome elements (defensive selectors) */
:root.ns-presenting .notion-topbar,
:root.ns-presenting [data-testid="topbar"],
:root.ns-presenting [data-testid="notion-topbar"],
:root.ns-presenting header {
  display: none !important;
}

:root.ns-presenting .notion-sidebar,
:root.ns-presenting [data-testid="app-sidebar"],
:root.ns-presenting [data-testid="sidebar"],
:root.ns-presenting nav {
  display: none !important;
}

/* Give the main page more of a slide-like center lane */
:root.ns-presenting [data-testid="page-content"] {
  /* Keep the scroller full-width so the scrollbar is at the screen edge */
  width: 100vw !important;
  max-width: none !important;
}

:root.ns-presenting .notion-page-content {
  margin-left: auto !important;
  margin-right: auto !important;
  max-width: 1100px !important;
}


/* Hide common page-header / database property chrome */
:root.ns-presenting .notion-page-header,
:root.ns-presenting [data-testid="page-header"],
:root.ns-presenting [data-testid="page-properties"],
:root.ns-presenting [data-testid="page-cover"],
:root.ns-presenting [data-testid="page-icon"],
:root.ns-presenting .notion-page-controls {
  display: none !important;
}

/* Safety-net: DB property/tag strip often lives inside a ContentEditableVoid node */
:root.ns-presenting .layout-content [data-content-editable-void="true"][contenteditable="false"]:not(:has([data-block-id])) {
  display: none !important;
}

/* Some Notion layouts wrap header/properties with these classes */
:root.ns-presenting .layout-content.layout-content-with-divider:not(:has([data-block-id])) {
  display: none !important;
}

/* If the wrapper contains both header + blocks, hide just the non-block children */
:root.ns-presenting .layout-content.layout-content-with-divider > *:not(:has([data-block-id])) {
  display: none !important;
}

/* Hide right-side panels/peek/sidebars that can appear while viewing DB pages */
:root.ns-presenting .notion-peek-renderer,
:root.ns-presenting [data-testid="peek-renderer"],
:root.ns-presenting [data-testid="side-peek"],
:root.ns-presenting [data-testid="right-pane"],
:root.ns-presenting .notion-right-pane,
:root.ns-presenting aside[aria-label],
:root.ns-presenting [role="complementary"] {
  display: none !important;
}

/* Keep Notion AI floating button visible and near the slide overlay */
:root.ns-presenting button[aria-label*="Notion AI" i],
:root.ns-presenting [data-testid*="notion-ai" i],
:root.ns-presenting [aria-label*="Notion AI" i][role="button"] {
  position: fixed !important;
  right: 12px !important;
  bottom: 52px !important;
  z-index: 2147483647 !important;
}

/* Simple overlay counter */
.ns-slide-overlay {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 2147483647;
  pointer-events: none;
  user-select: none;
  font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.55);
  padding: 6px 8px;
  border-radius: 6px;
}
`;
