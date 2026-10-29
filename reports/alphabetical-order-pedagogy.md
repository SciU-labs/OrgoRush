# Alphabetical Order: concise explanations

Date: 2026-10-29.

The explanation contains at most two short sentences: the rule, then an application to the molecule's actual substituents. A single substituent type receives one shorter sentence. The example uses 30 words in Spanish and 30 in English, with no repeated quantities, carbon positions or justification of numbering orientation.

## Modified files

- `app/reasoning-alphabetical-order.ts`: replaces the extended narrative with the short ES/EN rule and application. Retains internal prefixes for complex groups and identifies the comparison key of a conventional form when relevant. For many substituent types, uses one representative comparison while preserving the complete arrow.
- `app/page.tsx`: removes the unused numbering context and the duplicate arrow from the explanation string. The existing static arrow component and styles are preserved.
- `tests/alphabetical-order-reasoning.test.mjs`: updates the pedagogical assertions and adds length, sentence-count, nonrepetition and many-substituent checks.
- `tests/reasoning-hierarchy.test.mjs` and `tests/reasoning-name-fragments.test.mjs`: check the arrow in its presentation field, separately from the short explanation.
- This report.

Chemical ordering, grouping, locants, numbering priorities and Canvas highlighting remain governed by the existing logic. No stylesheet or highlighting implementation was changed.

## Example behavior

> Los sustituyentes se ordenan alfabéticamente por su nombre base, sin considerar prefijos multiplicativos externos ni sus localizadores. Aquí, «cloro» (c) precede a «metil» (m); se cita «dicloro» antes de «dimetil».

The example is generated from the existing molecular naming data. Other groups, language-specific comparisons and multiplicative forms use their own names. The arrow remains prominent, complete and noninteractive.

The existing distinction between internal complex-group prefixes and outside multipliers is retained; conventional qualifiers are treated contextually rather than listed as universal exceptions.

## Validation

The focused run passed **62 tests, 0 failures, 0 skipped**, covering short explanations, reasoning hierarchy, existing name fragments and interactive highlighting:

```text
node --test --test-concurrency=1 tests/alphabetical-order-reasoning.test.mjs tests/reasoning-hierarchy.test.mjs tests/reasoning-name-fragments.test.mjs tests/reasoning-fragment-highlighting.test.mjs
```

- `npm run typecheck`: passed.
- `npm run build:pages`: passed; existing bundle-size/dynamic-import warnings remain.
- `npm run validate:pages`: artifact validation and 4 additional tests passed (**66 passing tests total**).
- `git diff --check`: passed.

## Verification limits

The 30–50-word target is checked for the example; representative cases stay within 50 words and at most two sentences, with single-type cases below 25 words. Exceptionally long chemical names retain their actual spelling. Validation uses the existing production-component, CSS-contract and chemistry/hook test conventions; no new live-browser viewport review is claimed for this text-only update.
