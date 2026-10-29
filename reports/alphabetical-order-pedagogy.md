# Alphabetical Order: contextual explanation and typography

Date: 2026-10-29.

The Alphabetical Order step now explains the actual substituent groups, their quantities and positions, the base-name comparison, and why writing order is separate from choosing the numbering direction. Its summary is prominent static text, using the same typography as the existing reasoning fragments.

## Modified files

- `app/reasoning-alphabetical-order.ts`: pure ES/EN narrative formatter. Receives groups already ordered by the nomenclature formatter; describes repeated positions, multiplicity, distinguishing letters, a single substituent type, and higher-priority numbering decisions. Complex-group and conventional-qualifier explanations are included only when relevant.
- `app/page.tsx`: adapts the existing grouped substituent data and existing Spanish/English prefix formatters into that presentation. Verified top-level prefix spans keep the narrative aligned with the name displayed by the selected language/profile, including English locant changes. Adds a noninteractive `ReasoningAlphabeticalContent` component. A single substituent type now receives the explanatory step; no-substituent cases keep their prior behavior.
- `app/globals.css`: adds paragraph spacing and width constraints for the static summary. Reuses `.reasoning-name-fragment-text` unchanged for font size, weight, line height and responsive wrapping.
- `tests/alphabetical-order-reasoning.test.mjs`: 12 new regressions covering chemistry-derived explanations, quantity/locant independence, common initial letters, language/profile changes, single/absent substituents, complex groups, contextual conventional forms, shared typography, static semantics and unchanged Canvas targets.
- `tests/reasoning-hierarchy.test.mjs`: updates the expected step list for a molecule with a single substituent type; functional priority still comes first.
- This report.

No alphabetical-order engine was introduced. Citation order and multiplicative forms come from the existing formatters and selected output. The presentation does not select or renumber a parent, mutate analysis, or change molecular highlighting. The new summary has no name role, atom IDs, Canvas target, event handlers, button semantics or interactive hover styles.

## Example behavior

For the requested dichlorinated enone, the Spanish presentation identifies two cloro groups at C4/C5 and two metil groups, both at C6. It explains c before m, dicloro before dimetil, and the role of di- as quantity. It explicitly preserves the ketone's C2 preference over C6 in the opposite direction. The English presentation explains the corresponding chloro/methyl comparison.

Other molecules use their own groups and locants. For example, methoxy/methyl requires comparison beyond their shared initial letters in English, whereas the Spanish metil/metoxi comparison differs. A single type explains that no comparison of different names is necessary. The displayed arrow appears once, as prominent noninteractive text.

The complex-substituent explanation distinguishes a complete group name and its internal prefixes from an outside multiplicative prefix. sec-/tert- forms are not listed as universal exceptions: a conventional qualifier is discussed only when that actual citation form is present. The terminology follows [IUPAC Blue Book P-14.5](https://iupac.qmul.ac.uk/BlueBook/P1.html).

## Validation

The final regression run passed **142 tests, 0 failures, 0 skipped**, including all 12 new tests. It covers reasoning hierarchy, nomenclature ordering, halogen names, legacy English naming, current English prefix regressions, fragment highlighting, numbered-step interactions, name fragments and profile-specific reasoning:

```text
node --test --test-concurrency=1 tests/alphabetical-order-reasoning.test.mjs tests/reasoning-hierarchy.test.mjs tests/nomenclature-order.test.mjs tests/halogen-nomenclature.test.mjs tests/legacy-english-nomenclature.test.mjs tests/ether-current-profile-regressions.test.mjs tests/reasoning-fragment-highlighting.test.mjs tests/orgorush-reasoning-interaction-016.test.mjs tests/reasoning-name-fragments.test.mjs tests/reasoning-nom004-profile.test.mjs
```

- `npm run typecheck`: passed.
- `npm run build:pages`: passed, with existing bundle-size/dynamic-import warnings.
- `npm run validate:pages`: artifact validation and 4 additional tests passed (**146 passing tests in total**).
- `git diff --check`: passed.

## Verification limits

An integrated-browser smoke test was attempted against the local Pages preview, but the browser could not reach `127.0.0.1` and returned `ERR_CONNECTION_TIMED_OUT`. The temporary preview process was stopped. Visual consistency and wrapping are checked through production-component HTML and shared CSS contracts; no desktop/mobile viewport screenshot verification is claimed.

The change retains the chemical coverage and citation choices of the existing naming profiles. Specialized reasoning paths that do not supply ordinary substituent groups keep their existing presentation.
