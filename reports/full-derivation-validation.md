# Validated compositional name derivation — phase 3

## Implementation

`app/validated-name-derivation.ts` implements a bounded, literal English name grammar for aryl-substituted alkanoic acids, N-aryl alkanamides (including retained acetamide), and acyloxy-substituted benzoic acids. It reuses `legacyPrefixTerm` for rooted alkyl/functional substituents and `mapStructuralRegions` for aromatic-normalized graph correspondence. There are no common-drug-name conditions or molecular identity lookup tables in the implementation.

A parsed name builds an entire expected graph. Atom identity, charge, implicit hydrogen count, all edges/nonedges, normalized aromatic orders, and component invariance across graph isomorphisms must match the editor graph. A mismatch returns no FULL model and leaves the structural PARTIAL route intact. Symmetry-equivalent ring positions are not assigned speculative labels. Only unambiguous parent numbering and attachment locants are exposed. This grammar rejects explicit stereo rather than ignoring or inventing it.

Each name component records its literal span, semantic ID, role, parent component, attachment locant, atom/edge sets, verified numbering and explanation. Nested alkyl/hydroxy prefixes point to their aryl component; N substitution records locant `N`. The same model supplies the explanation cards, fragment buttons, temporary overlays, parent colours and rendered parent numbering. Attachment edges belong to substituent targets; overlapping functional suffixes remain selectable independently. The most recent selection owns the overlay.

The reconciler uses a bounded per-molecule cache. Editor molecular objects are treated as immutable, following existing editor conventions. Existing molecule-object/context guards prevent a selected target surviving molecule replacement. The panel explicitly prints the systematic name actually reconciled when it differs from the localized main name. A common input name is never parsed as a systematic name. Neither PubChem attribution nor FULL status implies PIN status.

## Chemical coverage

| Molecule | Systematic name tested | Engine status | Parent | Substituents and exact highlighting |
|---|---|---|---|---|
| Ibuprofen, stereo unspecified | 2-[4-(2-methylpropyl)phenyl]propanoic acid | FULL | Propanoic acid, C1 carboxyl, C2 aryl | Complete aryl region, para attachment, nested 2-methylpropyl, acid suffix and attachment edges |
| Paracetamol / acetaminophen | N-(4-hydroxyphenyl)acetamide | FULL | Acetamide with N substitution | N-aryl edge, ring attachment position 1, hydroxy at 4, separate hydroxyl and amide targets |
| Aspirin / acetylsalicylic acid | 2-(acetyloxy)benzoic acid | FULL | Benzoic acid | Ring position 2, complete O-acetyl region including attachment edge, distinct principal carboxyl |
| Open/cyclic glucose connectivity | No complete name reconciliation | PARTIAL | Not assigned | Existing structural components retained |
| Testosterone | No complete name reconciliation | PARTIAL | No artificial acyclic parent | Existing fused-system/stereo evidence retained |
| Caffeine | Existing importer rejects this fusion | UNSUPPORTED in Build by Name | Not assigned | Import guard retained |

FULL in this table describes the reconciled engine output. Browser appearance and live common-name resolution remain unvalidated in this environment.

Independent references: [ChEBI ibuprofen definition and synonyms](https://www.ebi.ac.uk/chebi/CHEBI:5855), [ChEBI nomenclature lesson naming paracetamol](https://www.ebi.ac.uk/training/online/courses/chebi-the-online-chemical-dictionary-for-small-molecules/why-do-we-need-chebi/examples-of-why-we-need-chebi/), and [NIST aspirin synonyms](https://webbook.nist.gov/cgi/cbook.cgi?ID=C50782&Mask=FFFF). Tests freeze reference SMILES, atom sets, numbering and important attachment edges independently of the reconciler.

## Verification

- Structural and FULL suites: 20/20, exit 0. Include exact parent/function/substituent sets, edges, spans, nested fragments, N substitution, permutations, alternative SMILES, positional mismatches, explicit stereo rejection, graph edits and five common-name aliases through the real resolver with deterministic HTTP fixtures.
- Existing name-builder, fragment-highlighting and tetrahedral suites with the initial new tests: 56/56, exit 0. This is a selected regression run, not the entire repository suite.
- Windows Sites packaging regression: 1/1, exit 0. Repeated packaging after making output migration directories read-only succeeds.
- Final typecheck after engine and numbering integration: exit 0.
- Changed page and name-engine lint: exit 0, six existing page warnings. The sound initialization violation exists in HEAD; its React state update now runs in a cancellable animation-frame callback after mount. New engine/tests have zero lint errors.
- Production build directly through Node: exit 0 twice after packaging fix. All five Vinext phases complete. Existing warnings about SSR Node imports, route classification and large chunks remain.
- Equivalent artifact validation through Node: exit 0; packaged hosting manifest parses and Worker exports `default.fetch`.
- `git diff --check`: exit 0.
- Final structural/FULL/packaging run: 21/21, exit 0; final FULL suite after adding explicit aryl-locant assertions: 12/12, exit 0.
- Final production build after the grammar guard and numbering integration: exit 0. Artifact validation was repeated successfully, exit 0.

## Infrastructure findings and limits

Git Bash is not required for the direct Node checks. The Sites EPERM was reproduced after a clean metadata directory: each Vite environment copies migration directory modes, and a later `closeBundle` invocation attempts to delete those read-only directories. The plugin now clears read-only modes only in its generated metadata output on Windows, then removes it with bounded retries. Production configuration is unchanged.

The Pages development server started successfully. In-app browser navigation to localhost failed with `ERR_CONNECTION_TIMED_OUT`. The native Brave fallback failed with `Computer Use app approval timed out`. No screenshot, browser click path, browser console check or live end-to-end success is claimed. Direct live OPSIN/PubChem calls also returned `serviceReached: false` for all three common names. Mocked HTTP integration does not validate network availability.

The name grammar is intentionally finite and English-only. Names outside it, unsupported punctuation variants, explicit stereo, ambiguous mappings and unmatched structures keep their previous safe states. Successful common-name construction without an available systematic name still needs provider metadata or a supported systematic name before FULL can be displayed. Translations, general PIN selection and broad arbitrary nested nomenclature remain future work.

## Additional lint corrections

Source-wide lint (417 files, generated `outputs` excluded) initially completed with two additional existing errors: synchronous state reset in `reasoning-visual-interaction.tsx`, and a test harness variable named `module`. Both were present before this iteration. The hook now clears the controller/selection in effect cleanup while its existing render guards immediately reject a changed molecule/context; this also prevents resurrection after hiding/reopening. The test harness variable was renamed without changing assertions. The initial unrestricted lint traversed historical generated snapshots and was interrupted; it is not counted as a passing check.

Files changed in this phase: `app/validated-name-derivation.ts`, `app/page.tsx`, `app/reasoning-visual-interaction.tsx`, `build/sites-vite-plugin.ts`, `tests/validated-name-derivation.test.mjs`, `tests/sites-packaging-windows.test.mjs`, `tests/orgorush-reasoning-interaction-016.test.mjs`, and this report. Earlier structural-analysis files remain in the workspace.

Final interaction/highlighting/structural/FULL/packaging regression run after the cleanup corrections: **52/52 pass, exit 0**, 74.8 seconds. Final typecheck, production build and packaged Worker validation after those corrections also finish with exit 0.

Final source-wide lint, excluding generated build directories and historical `outputs` snapshots: **exit 0**, no errors. Existing warnings are retained; the JSON record is `.sites-runtime/source-repository-lint.json`.
