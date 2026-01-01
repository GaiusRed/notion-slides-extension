export const PRESENTATION_CSS = `
:root.ns-presenting {
  overscroll-behavior: none;
}

:root.ns-presenting .ns-hidden {
  display: none !important;
}

:root.ns-presenting body {
  overflow: hidden;
}

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

:root.ns-presenting [data-testid="page-content"] {
  width: 100vw !important;
  max-width: none !important;
}

:root.ns-presenting .notion-page-content {
  margin-left: auto !important;
  margin-right: auto !important;
  max-width: 1100px !important;
}

:root.ns-presenting .notion-page-header,
:root.ns-presenting [data-testid="page-header"],
:root.ns-presenting [data-testid="page-properties"],
:root.ns-presenting [data-testid="page-cover"],
:root.ns-presenting [data-testid="page-icon"],
:root.ns-presenting .notion-page-controls {
  display: none !important;
}

:root.ns-presenting [class*="propertyRow"]:not(:has([data-block-id])),
:root.ns-presenting [class*="property-row"]:not(:has([data-block-id])),
:root.ns-presenting [class*="propertyValue"]:not(:has([data-block-id])),
:root.ns-presenting [class*="propertyItem"]:not(:has([data-block-id])) {
  display: none !important;
}

:root.ns-presenting .layout-content.layout-content-with-divider:not(:has([data-block-id])) {
  display: none !important;
}

:root.ns-presenting .notion-peek-renderer,
:root.ns-presenting [data-testid="peek-renderer"],
:root.ns-presenting [data-testid="side-peek"],
:root.ns-presenting [data-testid="right-pane"],
:root.ns-presenting .notion-right-pane,
:root.ns-presenting aside[aria-label],
:root.ns-presenting [role="complementary"] {
  display: none !important;
}

:root.ns-presenting [data-block-id] pre,
:root.ns-presenting [data-block-id] code,
:root.ns-presenting [class*="code"],
:root.ns-presenting [class*="Code"] {
  display: block !important;
  visibility: visible !important;
}

.ns-slide-overlay {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: 2147483647;
  pointer-events: auto;
  user-select: none;
  font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: rgba(255, 255, 255, 0.92);
  background: rgba(0, 0, 0, 0.55);
  padding: 6px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ns-slide-overlay .ns-overlay-btn {
  all: unset;
  cursor: pointer;
  line-height: 1;
  font-size: 14px;
  padding: 2px;
}

.ns-slide-overlay .ns-overlay-text {
  margin-left: 4px;
}
`;
