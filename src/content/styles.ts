export const PRESENTATION_CSS = `
/* Scope everything to presentation mode */
:root.ns-presenting {
  /* Avoid Notion overscroll quirks */
  overscroll-behavior: none;
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
:root.ns-presenting .notion-page-content,
:root.ns-presenting [data-testid="page-content"] {
  margin-left: auto !important;
  margin-right: auto !important;
  max-width: 1100px !important;
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
