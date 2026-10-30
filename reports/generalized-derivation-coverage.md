# Phase 5 — bounded generalization coverage

## Before / after

The new reference bank contains **12 molecules**, measured before changing the grammar. The original three FULL cases are a separate regression bank.

| New bank only | FULL | PARTIAL | UNSUPPORTED |
|---|---:|---:|---:|
| Before | 0 (0%) | 12 (100%) | 0 |
| After | 11 (91.67%) | 1 (8.33%) | 0 |

These percentages describe these twelve cases only. They are not an estimate of organic-chemistry coverage. Including the original three cases gives 14 FULL and one PARTIAL out of 15; glucose, testosterone and caffeine are separately retained regressions and are not included in that denominator.

The immutable before measurement is `generalization-before.json`. `generalization-after.json` contains the final expected-graph evidence and atom/edge references. `generalization-live.json` contains independent PubChem property responses, the names and structures actually received, and full-graph comparison with the frozen reference structures. All twelve real property structures matched the references; eleven received names reconciled FULL.

## Per-case engine matrix

The received name below is also the systematic name reconciled for FULL rows. Every row was PARTIAL before expansion. The bank deliberately excludes unspecified stereochemistry from FULL inference.

| Input / reference | Received name | After | Rule / validated parent | Validated substituents and locants |
|---|---|---|---|---|
| [Salicylic acid, CID 338](https://pubchem.ncbi.nlm.nih.gov/compound/338) | 2-hydroxybenzoic acid | FULL | Benzoic acid | Hydroxy at ring C2 |
| [Benzoic acid, CID 243](https://pubchem.ncbi.nlm.nih.gov/compound/243) | benzoic acid | FULL | Unsubstituted aromatic acid | Carboxyl at the ring numbering origin |
| [Vanillin, CID 1183](https://pubchem.ncbi.nlm.nih.gov/compound/1183) | 4-hydroxy-3-methoxybenzaldehyde | FULL | Aromatic aldehyde | Hydroxy C4; methoxy C3; separate prefix targets |
| [Acetanilide, CID 904](https://pubchem.ncbi.nlm.nih.gov/compound/904) | N-phenylacetamide | FULL | Acetamide | N-phenyl and exact N–aryl attachment |
| [Benzophenone, CID 3102](https://pubchem.ncbi.nlm.nih.gov/compound/3102) | diphenylmethanone | FULL | Methanone carbonyl parent | Two phenyls as one multiplicative region; no arbitrary distinction between symmetric rings |
| [Methyl salicylate, CID 4133](https://pubchem.ncbi.nlm.nih.gov/compound/4133) | methyl 2-hydroxybenzoate | FULL | Aromatic ester | O-methyl and ring hydroxy C2 distinguished |
| [Benzocaine, CID 2337](https://pubchem.ncbi.nlm.nih.gov/compound/2337) | ethyl 4-aminobenzoate | FULL | Aromatic ester | O-ethyl and ring amino C4 distinguished |
| [Acetophenone, CID 7410](https://pubchem.ncbi.nlm.nih.gov/compound/7410) | 1-phenylethanone | FULL | Ethanone chain | Phenyl at carbonyl C1 |
| [4-Methylbenzoic acid, CID 7470](https://pubchem.ncbi.nlm.nih.gov/compound/7470) | 4-methylbenzoic acid | FULL | Aromatic acid | Methyl C4 |
| [3-Methylbutanoic acid, CID 10430](https://pubchem.ncbi.nlm.nih.gov/compound/10430) | 3-methylbutanoic acid | PARTIAL | Principal acid detected; exact new parent projection withheld | Two equivalent terminal methyl groups permit different exact parent regions |
| [4-Methoxybenzaldehyde, CID 31244](https://pubchem.ncbi.nlm.nih.gov/compound/31244) | 4-methoxybenzaldehyde | FULL | Aromatic aldehyde | Methoxy C4 |
| [2-Hydroxypropanamide, CID 94220](https://pubchem.ncbi.nlm.nih.gov/compound/94220) | 2-hydroxypropanamide | FULL | Propanamide | Hydroxy C2; no R/S inferred |

Exact parent and selected-prefix atom/edge sets are frozen independently in `tests/fixtures/generalized-derivation.mjs` and asserted by `tests/generalized-derivation.test.mjs`. Literal name spans and the existing visual projector consume the same components. Additional chemical references include [RSC's vanillin profile](https://edu.rsc.org/download?ac=15255) and [WHO's benzocaine monograph](https://cdn.who.int/media/docs/default-source/medicines/pharmacopoeia/omitted-monographs/benzocaine.pdf).

## Implemented general rules

`systematic-family-grammar.ts` extends the existing expected-graph builder; it does not replace the original reconciler or add a colour algorithm. It recognizes bounded benzoic-acid, benzaldehyde, phenol and alkyl-benzoate parents; unsubstituted N-phenyl alkanamides; 1-phenylalkan-1-ones and a diphenyl/methanone multiplicative production; and acyclic acids, amides and aldehydes with simple functional/alkyl prefixes.

Prefix parsing retains paired parentheses, exact source spans, hierarchy and attachments. Hydroxy, amino, alkoxy, linear/branched alkyl prefixes reuse the existing finite chemical-fragment vocabulary. Repeated prefixes support explicit di/tri locants with count checks. Parent numbering checks the lowest aromatic locant sequence, with alphabetical tie-breaking on reflected sequences. Nested radical locants are ignored for alphabetical ordering; internal name content is retained. Acyclic parents must be longest rooted carbon paths containing the principal carbonyl. Tied parent paths currently fail closed rather than asserting a unique region.

Whole-graph isomorphism and invariant component images are still required for FULL. Stereo outside the original proof scope is rejected. Name parsing alone never promotes a case. All original families use the same final mapping validator and visual component contract.

Structural variants test ortho/meta/para substitution, multiple hydroxyl/methoxy prefixes, a nested 2-methylpropyl branch, longer amide/ketone/ester chains, a branched acid with a unique longest path, hydroxy and amino secondary groups, atom-ID permutations, equivalent SMILES, wrong regioisomers, an incorrectly short parent, nonminimal locants, reflected alphabetical ties and explicit stereo rejection. These validate finite productions, not complete chemical families.

## Integration defects exposed by wider coverage

- The local tree-based substituent namer recursed indefinitely on a cyclic component encountered during benzophenone construction. It now detects cycles before traversal, propagates an unsupported flag and withholds a local name. The independent validated graph route can then name/render the supported diaryl carbonyl. A production-engine integration test checks both alternative SMILES.
- PubChem identity verification compared strings advertised as canonical. Vanillin showed a non-idempotent aromatic serialization: equivalent round trips yielded different strings. The resolver now falls back to complete graph isomorphism when strings differ, preserving charges, bond identity and supported stereo. A different graph remains rejected. This fixes the live path without loosening naming rules.
- The expanded HTTP fixtures now match exact name queries instead of substring matching (for example, a substituted benzoic acid must not receive the plain benzoic-acid fixture).
- The first simultaneous cold Vite browser loads exceeded the old 15-second navigation limit. HTTP readiness still precedes browser launch; navigation is now bounded to 45 seconds. These earlier timed-out runs are not counted as successes.

## Pending complex structures

Caffeine fails at the importer, before FULL derivation: OpenChemLib recognizes the fused heterocycle, but the editor gate admits verified retained systems or narrowly defined all-carbon 5/6-membered fused rings. Caffeine is neither. This is an editor/import policy limitation, not failure to parse its SMILES and not evidence of an invalid molecule. The gate was not removed.

Next requirements:

- Fused heterocycles: a validated imported-graph/read-only pathway plus ring/heteroatom metadata and safe editing/valence rules, before extending parent grammar and numbering.
- Polycycles: explicit retained/systematic parent numbering provenance, mapped as a complete fused/bridged system.
- Carbohydrates: distinct open/cyclic identities, anomer/retained-parent grammar and explicit stereo provenance; no inference from “glucose” alone.
- Stereo: verified descriptor AST and E/Z/R/S correspondence, including unspecified versus explicit input. Cross-graph E/Z currently fails closed.
- Symmetric acyclic parents: represent alternative valid numberings/parent choices explicitly rather than colouring a union as a single fictitious chain.

No production deployment was attempted. The recommended next phase is parent-choice equivalence and a safe imported heterocycle boundary, with new independent corpora rather than expanding names by exceptions.

## Execution and reproduction

Engine/source audit: `node scripts/audit-generalized-derivation.mjs`; real provider audit: append `--live`. The live audit is separate from mocked browser testing and records failures instead of silently using fixtures.

For browser tests use `npm run test:derivation:e2e` with the installed Playwright/Chromium environment described in the phase-4 report. Set `ORGORUSH_E2E_GENERALIZED=1` for the eleven new FULL cases; also set `ORGORUSH_E2E_LIVE=1` for actual service calls. Without the generalized flag, the two live journeys cover **all three original common names**, followed by their three systematic names plus the parenthesized aspirin variant. They were two test containers, not two molecules.

Final execution results and per-mode E2E counts are recorded with delivery. Generated evidence lives under `outputs/derivation-e2e/{original,generalized}/{deterministic,live}`. Historical failure artifacts are retained separately by filename and must not be mistaken for passing captures.

## Final validation results

| Check | Result |
|---|---|
| New structural/rule/identity/layout suite | 31/31 pass, exit 0 |
| Serial regression selection (original cases, new cases, context, editor and layouts) | 122/122 pass, exit 0; 123.7 seconds |
| New-bank browser, deterministic | 3/3 test containers pass; all 11 common and all 11 systematic names, plus loading/failure; exit 0 |
| New-bank browser, real services | 2/2 test containers pass; all 11 common and all 11 systematic names; exit 0 |
| Focused browser after non-fused ring geometry correction | 3/3 pass for benzophenone, exact atom/edge sets and visible polygons |
| Original-bank browser, real services after changes | 2/2 pass; all three original common names, their systematic names, and the parenthesized aspirin variant |
| Typecheck | Exit 0 |
| Source-wide lint (generated outputs excluded) | Exit 0; 423 files, 0 errors, 36 existing warnings |
| Production build, direct Node invocation | Exit 0; no production configuration change or deployment |
| Packaged Worker/hosting manifest and whitespace checks | Exit 0 |

All eleven FULL rows in the per-case matrix therefore have independent atom/edge unit assertions, deterministic DOM assertions, and real-service browser journeys. The PARTIAL row has structural/unit validation and a real property/graph identity audit, but no claim of E2E FULL. The earlier parallel regression invocation failed in Vite SSR loading (60-second transport timeouts); the final invocation follows the repository's serial test convention and completes successfully.

The final real-bank common-name JSON contains no uncaught application errors and one HTTP 404 console message, recovered by the existing resolver flow. A clean application-exception log is not represented as a completely clean network log.

The visual review also exposed a separate-ring layout defect: semi-developed placement handled fused polygons but left a second non-fused ring to the fallback rows, flattening it. For valid imported polygons without explicit alkene stereo or manual direction overrides, the layout now retains and scales the coherent imported arrangement. This is independent of name/atom correspondence and does not mutate the graph. A polygon-area/separation regression and the final benzophenone capture verify the correction.

Representative captures: [vanillin](../outputs/derivation-e2e/generalized/deterministic/vanillin.png), [benzocaine](../outputs/derivation-e2e/generalized/deterministic/benzocaine.png), [benzophenone after geometry correction](../outputs/derivation-e2e/generalized/deterministic/benzophenone.png). The symmetry-safe `diphenyl` target contains both rings and both carbonyl attachment edges.

Changed in this phase: `app/systematic-family-grammar.ts`, `app/validated-name-derivation.ts`, `app/compound-context.ts`, `app/page.tsx`, `app/semi-developed-layout.ts`, `tests/fixtures/generalized-derivation.mjs`, `tests/generalized-derivation.test.mjs`, `tests/generalized-editor-integration.test.mjs`, `tests/e2e/derivation.e2e.mjs`, `scripts/audit-generalized-derivation.mjs`, and the generalization reports/JSON evidence. Earlier-phase workspace edits are retained. No new runtime dependency was installed.
