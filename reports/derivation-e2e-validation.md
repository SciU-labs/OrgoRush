# Structural derivation — phase 4

## Fixes

1. A single acyloxy prefix of benzoic acid now accepts paired parentheses or no parentheses. `2-(acetyloxy)benzoic acid` and `2-acetyloxybenzoic acid` build the same expected graph and must pass the same correspondence proof. Prefix spans retain their exact positions in the original input. Unpaired/nested punctuation, incorrect locants and extra text are rejected. A propanoyloxy homologue tests the syntax as a general production.
2. Live systematic-name testing exposed `N-(4-hidroxiphenyl)acetamide`: the UI translated an English morpheme while the reconciler's reused bilingual prefix vocabulary accepted the hybrid. FULL now requires the English spelling of the prefix. A successfully reconciled provider/input name is preserved literally before localization; invalid hybrid spellings are regression-tested as rejected.
3. The visual selection context includes the FULL model, so changes in the reconciled name/regions invalidate old selections even when the localized display context happens to be unchanged. Editor atom IDs are exposed as stable DOM attributes for exact region assertions.

No chemical families, parent-selection rules or stereo claims were added. Common names remain inputs to resolution, never direct systematic-name proofs. FULL does not imply PIN.

## Browser execution

`tests/e2e/derivation.e2e.mjs` starts the existing Pages Vite configuration, checks HTTP 200 before launching Chromium, reads the bound port, and closes both browser and server in teardown. Every run creates isolated browser pages. The tutorial is marked skipped using its existing preference key; timers run normally. Captures repeat the user selection immediately before screenshotting to retain the two-second overlay. The suite does not alter deployment configuration.

Two explicitly separate modes:

- Deterministic: intercepts HTTP, exercises real client resolution/import/layout/rendering/reasoning code, and checks loading, errors, molecule replacement, parent atom classes and exact highlighted atom/edge sets frozen independently of production analysis. Checks common names, three systematic names and the parenthesized aspirin variant. **Final run: 3/3 passed, exit 0, 70.4 seconds.**
- Live: no interception. Runs common-name and systematic-name browser journeys against the actual services. Checks FULL, displayed reconciled name, selectable overlays, molecule replacement and no uncaught application exceptions. **Final live run: 2/2 passed, exit 0, 59.3 seconds.** Exact provider atom-order expectations are asserted in deterministic mode, not imposed on the live response.

The real PubChem property responses observed in the browser were:

| Input | Received systematic name | Unit FULL | Mocked E2E FULL | Real E2E FULL | Highlighting |
|---|---|---|---|---|---|
| ibuprofen | 2-[4-(2-methylpropyl)phenyl]propanoic acid | Pass | Pass | Pass | Exact atom/edge sets, correct parent and nested branch; screenshot inspected |
| paracetamol | N-(4-hydroxyphenyl)acetamide | Pass | Pass | Pass | Exact parent/N-aryl/hydroxyl components; screenshot inspected |
| aspirin | 2-acetyloxybenzoic acid | Pass, both punctuation variants | Pass | Pass | Exact acetyl-O region distinct from carboxyl; screenshot inspected |

Raw received names, panel text, uncaught errors and console messages are recorded in `outputs/derivation-e2e/{deterministic,live}/*.json`. All three live common-name records have empty uncaught-error arrays. The live aspirin record includes one HTTP 404 console message; resolution recovered and FULL rendered. This is disclosed rather than counted as a completely clean network log. Deterministic common-name records have no console errors.

Screenshots (final deterministic run):

- [Ibuprofen](../outputs/derivation-e2e/deterministic/ibuprofen.png)
- [Paracetamol](../outputs/derivation-e2e/deterministic/paracetamol.png)
- [Aspirin](../outputs/derivation-e2e/deterministic/aspirin.png)

The screenshots were visually inspected together with structural assertions. The ibuprofen branch consists of four carbons with the correct ring attachment; paracetamol selects the para hydroxyl oxygen and its ring bond; aspirin selects the O-acetyl group without selecting the principal carboxyl oxygens. Parent/substituent palette and existing overlay styles are preserved.

## Reproduction

Run `npm run test:derivation:e2e`. It uses an installed `playwright` package by default. To reuse another existing Playwright installation, set `ORGORUSH_PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. If required, set `ORGORUSH_CHROMIUM_EXECUTABLE` to the installed headless Chromium executable. No automatic package/browser installation occurs.

For live integration, also set `ORGORUSH_E2E_LIVE=1` and run the same command. Absence of a browser, failed HTTP readiness and network failures cause test failures, not silent skips. The before hook is bounded to 45 seconds and each journey to 60 or 120 seconds. Artifact directories separate live and mocked runs. Earlier `*-failure.*` files, if present, document development failures and are not final passing artifacts.

This machine had Playwright Core and Chromium already installed outside this repository. Chromium full-browser launch failed with `spawn UNKNOWN`; the installed headless-shell executable succeeded outside the sandbox. Sandboxed loopback probes failed with EACCES and another probe timed out. Running the Vite server and headless shell in the same non-sandboxed execution context provided HTTP 200 and successful browser journeys. No Brave/UI approval was needed. Temporary servers were stopped after testing.

## Verification and limits

- The previous 52-case regression selection was retained, with one additional grammar-variant case: **53/53 passed, exit 0**, 79.6 seconds, on the final source files.
- Final production build through `node node_modules/vinext/dist/cli.js build`: exit 0. Existing Vinext SSR-import, large-chunk and route-classification warnings remain.
- Final typecheck: exit 0.
- Packaged artifact verification: exit 0; hosting manifest parses and Worker provides `default.fetch`.
- Final source-wide lint: **exit 0**, 418 files, **0 errors**, 36 existing warnings (generated output directories excluded). An earlier lint parse error occurred during file editing and did not reproduce against the stable final files; focused and final source-wide lint passed.
- The browser suite validates the existing Pages client build. Production Worker packaging is checked separately; no deployment or Worker-hosted browser run was performed.
- Glucose and testosterone retain PARTIAL and caffeine its importer limitation. Explicit stereochemistry outside the FULL grammar still fails closed. English-only finite name grammar and source availability remain limits.

Phase-4 files: `app/validated-name-derivation.ts`, `app/page.tsx`, `tests/validated-name-derivation.test.mjs`, `tests/e2e/derivation.e2e.mjs`, `package.json`, and this report. Earlier-phase workspace changes are retained.
