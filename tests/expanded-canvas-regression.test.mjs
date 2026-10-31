import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("expanded viewport refits current geometry on open, edits, undo/redo, and representation changes", () => {
  const fitBounds = page.match(/const expandedFitBounds =([\s\S]*?)const readExpandedFitBounds/);
  assert.ok(fitBounds, "expanded bounds are derived from the current render geometry");
  assert.match(fitBounds[1], /displayPositions\.values\(\)/);
  assert.match(fitBounds[1], /visualExtents/);
  assert.match(fitBounds[1], /viewMode === "semi-developed"/);
  assert.match(fitBounds[1], /viewMode === "condensed"/);

  const sync = page.match(/useEffect\(\(\) => \{\s*if \(!canvasExpanded\) return;([\s\S]*?)\}, \[canvasExpanded, molecule, viewMode\]\);/);
  assert.ok(sync, "fit synchronization runs only for open state, molecule changes, or view changes");
  assert.match(sync[1], /setExpandedViewFrame\(\{ \.\.\.readExpandedFitBounds\(\) \}\)/);
  assert.match(sync[1], /setExpandedZoom\(1\)/, "a geometric change returns to the complete fitted structure");
  assert.match(page, /setExpandedZoom\(\(zoom\) => Math\.max\(0\.6/);
  assert.match(page, /setExpandedZoom\(\(zoom\) => Math\.min\(2\.4/);
  assert.match(page, /const activeViewBounds = canvasExpanded[\s\S]*?expandedViewFrame \?\? expandedFitBounds/);
});

test("expanded chrome uses OrgoRush tokens and retains accessible state styling", () => {
  const chrome = css.slice(css.indexOf(".canvas-expand-scrim {"), css.indexOf("@media (max-width: 640px)", css.indexOf(".canvas-expand-scrim {")));
  for (const token of ["--brand-border", "--brand-surface", "--brand-primary-soft", "--brand-ink", "--brand-primary", "--brand-primary-hover"]) {
    assert.ok(chrome.includes(`var(${token})`), `${token} is used in expanded chrome`);
  }
  assert.match(chrome, /button:hover:not\(:disabled\)/);
  assert.match(chrome, /button:focus-visible/);
  assert.match(chrome, /button:active:not\(:disabled\)/);
  assert.match(chrome, /button:disabled/);
  assert.match(css, /html\[data-theme="dark"\] \.expanded-workspace-header/);
  assert.doesNotMatch(chrome, /#(?:294a43|286b5b|bcd7cf|e6f4ef|dbe7e3)/i);
  assert.match(css, /--brand-primary: #3563ff/);
  assert.match(css, /--brand-primary-hover: #284fe0/);
  assert.match(css, /--brand-primary-soft: #eef2ff/);
  assert.match(css, /--brand-accent: #c7f36b/);
});
