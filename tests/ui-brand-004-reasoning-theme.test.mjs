import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import postcss from "postcss";

const css = postcss.parse(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"));
const rules = [];
css.walkRules((rule) => rules.push(rule));
const normalizeSelector = (selector) => selector.replace(/\s+/g, " ").trim();
const declarations = (selector) => Object.assign({}, ...rules.filter((rule) => normalizeSelector(rule.selector) === normalizeSelector(selector))
  .map((rule) => Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map(({ prop, value }) => [prop, value]))));
const variables = (selector) => Object.fromEntries(Object.entries(declarations(selector)).filter(([key]) => key.startsWith("--")));
function palette(dark, highContrast) {
  const inherited = { ...variables(":root"), ...(dark ? variables('html[data-theme="dark"]') : {}),
    ...(highContrast ? variables(".a11y-high-contrast") : {}) };
  const local = { ...inherited, ...variables(".reasoning-section"),
    ...(dark ? variables('html[data-theme="dark"] .reasoning-section,\nhtml[data-theme="dark"] .reasoning-section.collapsed') : {}),
    ...(highContrast ? variables("html .a11y-high-contrast .reasoning-section") : {}) };
  function resolve(value, seen = new Set()) {
    return value.replace(/var\((--[\w-]+)\)/g, (_, key) => {
      assert.ok(!seen.has(key), `cyclic token ${key}`);
      assert.ok(local[key], `undefined token ${key}`);
      return resolve(local[key], new Set([...seen, key]));
    });
  }
  return resolve;
}
function contrast(a, b) {
  const luminance = (hex) => {
    assert.match(hex, /^#[\da-f]{6}$/i);
    return hex.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("all derivation selectors, including theme/state overrides, exclude legacy brand greens", () => {
  // Amber is a chemical contribution/bond cue; the two neutrals predate this fix.
  const retainedLiterals = new Set(["#f8fafc", "#aebbd0", "#d96500", "#a64200", "#ffd166"]);
  const scoped = rules.filter(({ selector }) => /\.reasoning-|\.iupac-name-reference/.test(selector));
  assert.ok(scoped.length > 30, "audit includes responsive and theme overrides");
  for (const rule of scoped) for (const declaration of rule.nodes.filter((node) => node.type === "decl")) {
    const { value } = declaration;
    assert.doesNotMatch(value, /var\(--(?:mint(?:-strong)?|blue)\)/, rule.selector);
    assert.doesNotMatch(value, /\b(?:green|seagreen|teal)\b|\b(?:rgba?|hsla?)\(/i, rule.selector);
    for (const literal of value.match(/#[\da-f]{3,8}\b/gi) ?? [])
      assert.ok(retainedLiterals.has(literal.toLowerCase()), `${rule.selector}: non-token color ${literal}`);
  }
});

for (const [label, dark, highContrast] of [["light", false, false], ["dark", true, false],
  ["high contrast/light", false, true], ["high contrast/dark", true, true]]) {
  test(`${label}: the actual token palette meets text and focus contrast in default/target/hover states`, () => {
    const resolve = palette(dark, highContrast);
    const ink = resolve("var(--ink)"), muted = resolve("var(--muted)");
    const accent = resolve(declarations(".reasoning-name-fragment").color);
    const workspace = resolve(declarations(".reasoning-section").background);
    const surface = resolve(declarations(".reasoning-visibility-button").background);
    const target = resolve(declarations(".reasoning-section li.reasoning-step-target").background);
    assert.equal(declarations(".reasoning-section li.reasoning-step-target")["--muted"], "var(--ink)");
    for (const [foreground, background, role] of [[ink, workspace, "heading"], [muted, workspace, "body/label"],
      [muted, surface, "toggle"], [accent, workspace, "fragment/locant"], [accent, surface, "fragment control"],
      [ink, target, "target body/label"], [accent, target, "target fragment/hover"]]) {
      assert.ok(contrast(foreground, background) >= 4.5, `${role}: ${foreground} on ${background}`);
    }
    for (const selector of [".reasoning-visibility-button:focus-visible", ".reasoning-name-fragment-control:focus-visible"]) {
      const focus = resolve(declarations(selector).outline.split(" ").at(-1));
      assert.ok(contrast(focus, workspace) >= 3, `${selector} vs surrounding surface`);
      assert.ok(contrast(focus, target) >= 3, `${selector} vs selected surface`);
    }
  });
}

test("fragment controls retain the semantic bond cue, keyboard focus and readable high-contrast selection", () => {
  const selected = declarations('.reasoning-name-fragment-control.is-selected,\n.reasoning-name-fragment-control[aria-pressed="true"]');
  assert.equal(selected["border-color"], "#a64200");
  const highContrast = declarations('html .a11y-high-contrast .reasoning-name-fragment-control.is-selected,\nhtml .a11y-high-contrast .reasoning-name-fragment-control[aria-pressed="true"]');
  assert.equal(highContrast["border-color"], "var(--amber)");
  for (const dark of [false, true]) {
    const resolve = palette(dark, true);
    assert.ok(contrast(resolve(highContrast["border-color"]), resolve("var(--paper)")) >= 3);
  }
  assert.equal(declarations(".reasoning-name-fragment-control:hover").background, "var(--brand-primary-soft)");
  assert.equal(declarations(".reasoning-name-fragment-control")["border"], "1px solid var(--brand-selected-ink)");
});

test("linked name navigation uses brand tokens and keeps non-color active/focus cues", () => {
  const reference = declarations(".iupac-name-reference");
  assert.equal(reference["text-decoration-color"], "var(--orgorush-structure-main)");
  const active = declarations(".iupac-name-reference:hover, .iupac-name-reference.is-active");
  assert.equal(active["text-decoration-style"], "solid");
  assert.equal(active.color, "var(--brand-surface)");
  assert.match(declarations(".iupac-name-reference:focus-visible").outline, /var\(--orgorush-structure-main\)/);
});
