# Structural derivation audit

- Build by Name resolves names through local parsing, OPSIN and PubChem; OpenChemLib imports the returned SMILES into the editor graph. PubChem's IUPAC name is external evidence, not a derivation or proof of PIN status.
- `analyzeMolecule` has separate supported families and deliberately returns unavailable results for some fused and functional structures. Atom count alone does not determine support. Import can also report tetrahedral stereo that could not be preserved.
- The reasoning panel was hidden when the local name was unavailable. External primary names also explicitly disable reasoning highlights. Consequently successful construction does not imply an explainable name.
- Reasoning targets are projected from the active local analysis onto the editor graph and reject missing atom and bond IDs. They do not perform cross-graph mapping. `legacyGraphsIdentical` checks constitutional identity, returns only a boolean, and does not establish stereo-preserving atom correspondence.
- Ordinary canvas colours derive from `mainChain` even when a locally generated parent is unavailable or the displayed name is external. This can imply an unsupported parent/substituent assignment.
- Existing visual interaction keys include the molecule object and structural SMILES, and reject stale selections. This does not prove correctness of all asynchronous name-resolution paths.

The immediate safe fallback is to expose the limitation and avoid claiming a parent/substituent colour assignment when the displayed name cannot be tied to the local derivation. A complete advanced naming engine and stereo-preserving graph correspondence remain future work; external names must not be decomposed without such evidence.

## Implemented continuation

`app/structural-derivation.ts` now supplies a typed structural evidence model and PARTIAL analysis independent of name reproduction. It uses the same OpenChemLib graph builder as stereo import/export. Neutral carboxylic acids, esters, amides, carbonyls and hydroxyls are identified by connectivity and implicit hydrogens. Ring bonds form connected systems: fused atoms are retained once in the complete system. Explicit R/S is reported without assigning unspecified stereo. The model does not claim a name is systematic, retained or PIN merely from its spelling.

The fallback panel consumes this model and its visual projector. Each component button selects exactly its atom and bond sets, with no invented locants. Component overlaps are intentional (for example phenol's attachment carbon belongs to its ring); the most recent selection owns the overlay. Ordinary parent/substituent colours remain uniform where parent selection is unverified. The graph evidence is memoized per editor molecule, separately from the displayed name. Existing molecule/context guards discard stale selections.

Cross-graph remapping normalizes aromatic bond identity through OCL and compares element, charge, implicit hydrogen, degree, absolute R/S, all edges and nonedges. It enumerates bounded bijections and rejects a fragment if its image differs across valid correspondences. Search is limited to 120 atoms and 20,000 visits; exhaustion returns no mapping. Explicit E/Z currently fails closed instead of applying a connectivity-only mapping. Same-graph rendering uses editor IDs directly; remapping is available for future cross-graph consumers and tested independently.

## Verified scope

| Reference | New structural route | Evidence tested |
|---|---|---|
| Ibuprofen | PARTIAL | Exact carboxyl and aromatic ring atom/edge sets, permutations |
| Paracetamol | PARTIAL | Exact amide, hydroxyl and aromatic ring sets, permutations |
| Aspirin | PARTIAL | Exact acid, ester and ring sets, permutations |
| Open/cyclic glucose connectivity | PARTIAL | Five hydroxyls in open form; cyclic ring; no invented anomer or R/S |
| Testosterone | PARTIAL | One 17-atom fused system, four cycles, carbonyl, hydroxyl, stored stereo |
| Caffeine | UNSUPPORTED in Build by Name import | Existing importer rejects this heterocyclic fusion; no import gate weakened |

No new FULL derivations are claimed. The existing local naming/reasoning route remains in place. Parent selection, external systematic-name parsing, substituent locants, PIN provenance and general E/Z cross-graph remapping remain unresolved. These component tests construct imported SMILES, not live PubChem name queries. They do not establish end-to-end Build by Name or browser coverage.

Independent reference descriptions: [ibuprofen, ChEBI](https://www.ebi.ac.uk/chebi/CHEBI:5855), [paracetamol, ChEBI](https://www.ebi.ac.uk/chebi/CHEBI:46195), [acetylsalicylic acid, ChEBI](https://www.ebi.ac.uk/chebi/CHEBI:15365), [testosterone, PubChem](https://pubchem.ncbi.nlm.nih.gov/compound/Testosterone). Frozen SMILES and exact atom sets are in the tests; the steroid fixture reuses the existing stereo regression reference.

## Execution results

- New structural suite: 8/8 pass, exit 0. Exact atom/edge sets, visual projection, permutations, constitutional mismatch, R/S mismatch and ambiguous automorphisms are checked.
- Existing stereo/visual suites plus the initial seven new tests: 37/37 pass, exit 0 (74.5 seconds).
- Typecheck after the remapping API annotation: exit 0. A previous intermediate typecheck exposed an inferred return type error, which was corrected.
- Direct production build (`node node_modules/vinext/dist/cli.js build`): exit 1. Transformed 277 modules and generated chunks, then the Sites closeBundle hook failed with EPERM removing `dist/.openai/drizzle`. Production deployment is not validated.
- Initial changed-file lint: exit 1, including a new manual-memoization diagnostic and a pre-existing sound-setting effect diagnostic. The new memoization was corrected by caching graph evidence separately from display-name metadata; final lint results are reported with delivery.
- No browser run or full repository test-suite completion is claimed.
- Final typecheck after the UI memoization correction: exit 0.
- Final new-module and new-test lint: exit 0. Final page lint: exit 1, one pre-existing `react-hooks/set-state-in-effect` error at the sound preference initialization and six warnings; the new memoization error is resolved.
- Name-builder, fragment-highlighting and final structural suites: 36/36 pass, exit 0 (30.1 seconds).
- `git diff --check`: exit 0.
