# ORGORUSH-IUPAC79-FUSED-001

## Acceptance matrix (before implementation)

Source: IUPAC, *Nomenclature of Organic Chemistry*, 1979. Online facsimile:
[A-21](https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm),
[A-22](https://www.acdlabs.com/iupac/nomenclature/79/r79_72.htm),
[A-23](https://www.acdlabs.com/iupac/nomenclature/79/r79_73.htm),
[A-31](https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm),
[A-32](https://www.acdlabs.com/iupac/nomenclature/79/r79_164.htm).

| Reference constitution | ES / EN target | Rule | Initial status | Acceptance |
|---|---|---|---|---|
| Naphthalene, 6+6, five double bonds | naftaleno / naphthalene | A-21.1(3) | UNSUPPORTED | Exact graph; distinguish reduced and substituted graphs |
| Anthracene, linear 6+6+6 | antraceno / anthracene | A-21.1(13) | UNSUPPORTED | Distinguish angular phenanthrene |
| Phenanthrene, angular 6+6+6 | fenantreno / phenanthrene | A-21.1(12) | UNSUPPORTED | Distinguish linear anthracene |
| Indene, 6+5, one CH2 | indeno / indene | A-21.1(2), A-21.6 | UNSUPPORTED | Exact hydrogen and bond pattern |
| Fluorene, 6+5+6, one CH2 | fluoreno / fluorene | A-21.1(10), A-22.5 | UNSUPPORTED | Exact graph; exceptional numbering |
| Azulene, 5+7 | azuleno / azulene | A-21.1(4), A-22.5 | UNSUPPORTED | Do not infer identity from C10H8 or aromatic ring flags |
| Saturated 5+5, 5+6, 6+6 | biciclo[3.3.0]octano, biciclo[4.3.0]nonano, biciclo[4.4.0]decano / corresponding bicyclo…ane | A-31.1–2 | PASS | Preserve existing exact names and numbering |
| Hydrogenated retained parents | Locanted hydro prefixes; retained exceptions where documented | A-23.1–2 | PARTIAL | Only verified constitutions; no blanket bond-count shortcut |
| Ordinary substitution and fusion-site substitution | Only graph-proved locants; no sp2 fusion carbon with extra bond | A-22, A-23.3 | PARTIAL (aliphatic only) | Implement verified subset or explicit UNSUPPORTED |
| Component fusion names | Base component + prefix + fusion descriptor | A-21.3–5 | UNSUPPORTED | Pending unless fully verified; never substitute von Baeyer indiscriminately |
| Spiro / linked / bridged controls | No retained fused name | Outside simple fusion | PARTIAL | Distinguish topology; preserve existing supported non-fused behavior |
| Invalid graphs / valences / unimplemented parents | No speculative name | Domain boundary | PARTIAL | Typed failure and safe integration |

## Initial audit

The graph is `atoms` + `bonds` with optional `rings` in `app/page.tsx` and
`app/name-to-molecule.ts`. `app/fused-ring.ts` edits shared-edge rings.
`app/fused-ring-nomenclature.ts` recognizes aliphatic bi/tri/tetracycles and
generates von Baeyer descriptors; it deliberately excludes aromatic ring metadata.
`analyzeMolecule` prioritizes those recognizers. The Spanish Legacy profile admits
only three graph-validated saturated bicyclic parents; English uses a polycyclic
name fallback. Neither is an A-21 fusion-name engine. Import in
`app/openchemlib-adapter.ts` also blocks fused aromatics. Ring metadata alone is
therefore insufficient for constitutional recognition or historical coverage.

Existing tests: `fused-ring-nomenclature`, `fused-name-builder`,
`aud-nom-011-legacy-fused-bicycles`, `legacy-english-nomenclature`, reference corpus,
SMILES, editor history and exercise suites. No AGENTS.md was found in the repository.
Existing unrelated untracked files are preserved.

Runtime inspected: Node 24.19.0, npm 11.17.0. Existing dependency OpenChemLib is
already available; no new dependency is planned. Version details and validation
results will be recorded after implementation.

The [1998 introduction](https://iupac.qmul.ac.uk/fusedring/intro.html) is comparative:
it extends 1979 and removes the earlier restriction requiring at least two rings
of five or more members. Its expanded families and the later von Baeyer extensions
are not assumed to be 1979 rules.

## Implemented architecture and normative scope

`app/fused-topology.ts` validates connectivity, IDs, simple edges and neutral
valences, separates cyclic biconnected blocks (linked rings / spiro), and selects
an elementary minimum cycle basis by GF(2) edge elimination. Ring intersections
must share an actual edge for ortho fusion; three-ring atom membership identifies
ortho/peri fusion. Larger induced perimeter cycles in pyrene are not counted as
additional bridges. Genuine bridged and ambiguous cage topologies remain separate.
Enumeration and graph-size limits produce an explicit unsupported boundary.

`app/iupac1979-retained-fused.ts` contains numbered adjacency tables transcribed
from the original figures, not a list of input SMILES. It matches the **whole
core graph**, bond orders after local aromatic normalization, and per-atom
hydrogen counts. Graph isomorphisms transport the published numbering to editor
IDs. The code checks the actual constitution of each parent individually.
OpenChemLib 9.25.0, already installed, supplies aromatic perception; no dependency
or mandatory naming service was added. No drawing coordinates enter recognition.

Implemented rules:

- A-21.1: the six named retained parents in the acceptance table only. Indene's
  C1 hydrogen position and fluorene's C9 position are checked structurally.
- A-22.1–4: numbered structural templates for these constitutions, including
  fusion locants 4a/8a etc.; A-22.5 exceptions for anthracene and phenanthrene are
  represented explicitly. This is not a general orientation/numbering algorithm.
- A-23.1–2: **1,4-dihydronaphthalene only**, exactly the constitution in figure
  bm1790. Reduction degree alone is insufficient for a match.
- A-23.3: one methyl or one F/Cl/Br/I substituent on an ordinary naphthalene CH;
  equivalent numberings select locant 1 or 2. Extra bonding to an aromatic fusion
  carbon fails the valence check. Other substitution/functional suffixes are not
  generated by this new retained-parent route.
- A-31.1–2: preserve the existing three saturated fused bicycles and their
  longest-path numbering. No new A-32 family is claimed; existing aliphatic
  tri/tetracyclic behavior is preserved and tested separately.

Analysis, bilingual historical formatting, suggested-name translation, SMILES
import/export, reasoning and existing number badges consume the result. String
junction locants live in a separate map so the existing `numberedAtoms` numeric
contract remains unchanged. No persisted molecule field was introduced: history,
Undo/Redo and `.quimica` reconstruction recalculate the result from the graph.
Unimplemented aromatic bicycles and fully aromatic larger cores cannot fall
through to an aliphatic name merely because stored ring flags change. The
existing A-32 route for mixed aliphatic/aromatic tricycles remains available;
it is not presented as newly verified hydrogenation nomenclature. Other
unrecognized polycyclic constitutions cannot fall through to an invented
acyclic name. The result is a `SUPPORTED | UNSUPPORTED` discriminated union with
a reason and independently inspectable topology.

## Final chemical acceptance

| Family or example | Result | Practical boundary |
|---|---|---|
| Naphthalene, anthracene, phenanthrene, indene, fluorene, azulene | PASS | Exact parent graphs, ES/EN, numbered junctions, SMILES |
| 1,4-Dihydronaphthalene | PASS | Only the documented reduction constitution |
| 1-/2-Methylnaphthalene; 1-chloronaphthalene | PASS | Tested ordinary-position prefix cases |
| Methyl / monohalogen naphthalene family | PARTIAL | Single substituent; no functional suffix or poly-substitution |
| Hydrogenated fused families overall | PARTIAL | No extrapolation to other reduction positions or degrees |
| Saturated fused 5+5, 5+6, 6+6 | PASS | Existing A-31 names retained; no cis/trans claim |
| Ortho/peri topology (pyrene) | PASS / UNSUPPORTED name | Topology recognized; numbered retained-name registry not expanded |
| Spiro, linked rings, norbornane | PASS boundary | Not mislabeled as retained fused parents; linked-ring naming preserved |
| Invalid graphs, excessive valence, charged/stereo retained inputs | PASS boundary | Typed rejection; no speculative retained name |
| General base-component selection and fusion descriptors | UNSUPPORTED | A-21.3–5 algorithm remains pending |
| Other hydrogenations, fused functional derivatives, fusion-site substitution of reduced parents | UNSUPPORTED | Requires further individually verified rules and fixtures |
| Implemented chemical acceptance cases | No remaining FAIL | This does not certify all of IUPAC 1979 |

The source-linked machine-readable matrix is `tests/fixtures/iupac79-fused.json`.
Its 19 entries include independent reference SMILES, expected ES/EN names (null
for rejected scope), formula where applicable, rule, figure and justification.
Substituent expectations are explicitly rule-derived rather than claimed as
literal examples in the facsimile. Reference figures are available under
`https://www.acdlabs.com/iupac/nomenclature/79/images/` with the listed filenames.

The 36 new tests cover identity/formula, alternative SMILES, aromatic versus
Kekulé representation, ID/array/bond-order permutations, rotation/reflection,
absence of stored rings, ordinary/junction locants, nonmutation, four naming
profiles, reasoning links, import/export, the actual commit/Undo/Redo actions,
and chemistry-document reconstruction. Equivalent atoms in a symmetric parent
can exchange IDs: the invariant is the named constitution and numbered adjacency,
not an arbitrary permanent ID for a symmetry-equivalent position.

## Compatibility and changed files

- Added `app/fused-topology.ts`, `app/iupac1979-retained-fused.ts`.
- Integrated in `app/page.tsx`, `app/openchemlib-adapter.ts`,
  `app/nomenclature-conventions.ts`, `app/iupac-name-normalization.ts`, `app/i18n.ts`.
- Added `tests/fixtures/iupac79-fused.json`, `tests/iupac79-retained-fused.test.mjs`.
- Updated README and this report with bounded coverage.
- Three old tests have intentional coverage corrections: AUD-NOM-011 now asserts
  that naphthalene is admitted; capability-audit uses an unsupported naphthalenol
  as its aromatic boundary; difficulty-hard-structural still rejects methyl-
  naphthalene as an exercise even though it is now importable. No existing
  assertion about a supported non-fused name was weakened.

An intermediate render refactor introduced a new closure variable into expressions
that old tests evaluate in isolation. The production expressions were made
self-contained again; those rendering tests were **not changed** to hide the
regression. Their 33-test rerun passed.

## Validation evidence

Logs and the type-comparison script are in `outputs/iupac79-validation/` (ignored
working artifacts). The initial targeted baseline had **66/66 passing tests**.

- New suite: **36/36 passed** (`new-tests.log`).
  The final rerun, including the actual name-dock coverage predicate for a
  halogenated retained parent, also passed **36/36** in **16.25 s**
  (`final-new-suite.log`).
- Final retained + render regression check: **69/69 passed**
  (`final-focused.log`); the aromatic-guard subset also passed **22/22**.
- Final retained and existing von Baeyer suite: **72/72 passed**
  (`final-retained-and-vonbaeyer.log`), including compound unsaturation of a mixed
  aromatic/aliphatic tricycle. Final existing Legacy, exercise-domain and render
  checks: **104/104 passed** (`final-existing-focus.log`). Intermediate broad
  reruns which loaded an earlier guard version are not treated as final passes.
- Full existing + new suite executed with `node --test --test-concurrency=8
  tests/*.test.mjs`: **2827 tests, 2801 passed, 21 failed, 5 skipped**. Fourteen
  failures were the render-expression regression corrected above; seven were
  `spawnSync … ETIMEDOUT` in fresh-process snapshot tests under concurrent load.
  All seven original timeout cases subsequently passed in sequential reruns:
  easy v2, frozen v3 difficulty plans and frozen v2 plans passed in
  `process-timeouts-recheck.log`; the remaining original cases passed in
  `snapshots-isolated-final.log` (**5/5**, also covering Intermediate plumbing).
  Thus all 21 original failures have passing targeted reruns. The entire
  2827-test suite was not rerun a second time after the final corrections;
  these are separate observations, not a fabricated single green full run.
- A subsequent comparison of the Intermediate snapshot against an archived HEAD
  confirmed identical chemistry and showed substantial timing variation (about
  146 s versus 39 s on that run, under different process load). The new recognizer
  is now bypassed for connected acyclic/monocyclic exercise graphs, and SMILES
  import also bypasses it when topology is not a candidate fusion. Fresh-process
  snapshot tests were rerun after that optimization with competing test jobs
  closed. An instrumented direct optimized capture matched the frozen
  Intermediate fixture: **17.17 s total**, of which **14.10 s** loaded the engine;
  generation itself took about **3.08 s** (`intermediate-profile.log`). No fixture
  or timeout was increased to conceal the issue. Timing alone from concurrently
  loaded runs cannot establish a pre-existing defect or a code regression.
  The isolated v3 Intermediate three-capture ES/EN test subsequently passed
  within its original per-child limit (**57.45 s total**).
- Pages build and `npm run validate:pages`: passed.
- Official Sites `scripts/build-verified.sh` via Git Bash: passed, including
  artifact validation. Sandbox initially blocked MSYS startup; rerunning with
  the required execution approval succeeded.
- Whole-repository ESLint: **0 errors, 32 warnings**. Changed-source lint also
  has 0 errors; existing page warnings remain.
- `tsc --noEmit --incremental false` reports existing errors and also includes
  ignored historical snapshots because the repo config includes `**/*.ts`.
  An independent compiler-API comparison of tracked sources against HEAD,
  substituting the original modified files through the compiler host, found
  **49 baseline diagnostics, 49 current diagnostics, zero introduced**. This
  includes the new modules in the current program. The unmodified project does
  not have a clean typecheck; that limitation is not hidden by changing tsconfig.

No commit or push was made. Proposed commit message:
`feat(nomenclature): add verified IUPAC 1979 retained fused-ring subset`.

## Diffstat

The following total includes the five newly added files and excludes the two
unrelated pre-existing untracked files and ignored validation artifacts.

14 files changed, 816 insertions(+), 14 deletions(-).
