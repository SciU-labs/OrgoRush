# Interactive reasoning fragments

Date: 2026-10-29.

Prominent fragments in “How it is derived” now activate the existing molecular highlight. The numbered buttons keep their existing behavior, with the requested correction to Reasoned Numbering: its section target is the union of the valid fragment targets.

## Modified files and architecture

- `app/reasoning-visual-targets.ts`: extends the existing projector with `buildReasoningVisualReferences`, returning step and fragment targets in the same `ReasoningVisualTarget` format. An optional fragment identity distinguishes a fragment activation from its section. The original step API delegates to this shared projector.
- `app/page.tsx`: makes validated fragments native buttons and sends both section and fragment activations through one callback and the existing `useReasoningVisualInteraction` hook. Clears competing name-link selections and pending navigation timers. Binds the older semantic name-link selection to the molecule object so reconstruction cannot reuse stale references.
- `tests/reasoning-fragment-highlighting.test.mjs`: adds 16 focused regressions, using production name analysis, components, callbacks, target projection and fake timers.
- `tests/orgorush-reasoning-interaction-016.test.mjs`: updates the old principal-function-only expectations to include other accepted numbering fragments. Keeps the existing graph-reference, timer, accessibility and SVG/condensed-overlay checks.
- This report.

Reasoning generation and nomenclature rules remain unchanged. The projector consumes their existing typed evidence: atom IDs, functional contributions, exact bonds and the accepted parent-numbering map. Complete, verified locant fragments are mapped through that numbering map; explanatory prose and rejected-orientation locants are never parsed. Older numbering fragments containing an unsaturation morpheme borrow its existing typed bond provenance and select the relevant parent carbon, without highlighting the bond.

Functional fragments use their existing group atoms and bonds. Substituent fragments use their own group provenance and analyzed attachment bonds. A single broad fragment without finer provenance may share its existing step target; invalid explicit references and ambiguous fragments remain plain text.

## Accepted interaction

For `4,5-dichloro-6,6-dimethylhept-4-en-2-one`:

| Control | Highlight |
| --- | --- |
| `01` or `2-one` | Same ketone carbonyl atoms and C=O bond |
| `2` in Reasoned Numbering | C2 only |
| `6,6` | C6 once |
| `4,5` | C4 and C5 |
| `03` | C2, C4, C5 and C6; no bonds |

Each activation replaces the previous target and restarts the existing two-second timer. A fragment click stops propagation and does not navigate or scroll to its parent section. Buttons use native Enter/Space behavior, localized accessible labels, `aria-pressed`, and the existing focus/active styles. No CSS redesign, renderer replacement or editing-selection changes were needed.

The existing context/molecule checks mask obsolete highlights immediately when the graph, name, profile, language, reasoning or visibility changes. Fragment identities include their written span and semantic evidence, so disjoint fragments remain independently selectable.

## Validation

The final targeted run passed **100 tests, 0 failures, 0 skipped**, including the 16 new fragment regressions and the existing reasoning interaction, fragment derivation, name navigation, nomenclature-profile, cyclic-ketone, double-bond stereo and cis/trans suites:

```text
node --test --test-concurrency=1 tests/reasoning-fragment-highlighting.test.mjs tests/orgorush-reasoning-interaction-016.test.mjs tests/reasoning-name-fragments.test.mjs tests/reasoning-name-navigation.test.mjs tests/reasoning-nom004-profile.test.mjs tests/iupac-nom002b-polyunsaturated-ketones.test.mjs tests/double-bond-stereochemistry.test.mjs tests/cis-trans-name-builder.test.mjs
```

- `npm run typecheck`: passed after the final source change.
- `npm run build:pages`: passed after the final source change; bundle-size/dynamic-import warnings remain.
- `npm run validate:pages`: artifact validation and 4 additional tests passed.
- `git diff --check`: passed.
- `npm run build` is blocked because Bash is not on PATH. Direct `node node_modules/vinext/dist/cli.js build` compiles its client-reference phase, then fails in the existing Sites packaging hook with Windows `EPERM` removing `dist/.openai/drizzle`. This environment/output-directory failure is separate from functional test results.

## Remaining boundaries

Fragments without trustworthy molecular evidence remain noninteractive. Existing unsupported/external-name and hidden-reasoning policies still apply. No new chemical naming coverage or stereochemistry engine is introduced.

UI validation uses the project's production-component callback, hook-host and server-rendered SVG conventions; it does not include a live browser click-through.
