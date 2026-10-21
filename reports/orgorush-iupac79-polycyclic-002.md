# ORGORUSH-IUPAC79-POLYCYCLIC-002

## Normative acceptance before modifying the generator

The reference is the 17-cycle 1–2–…–17–1 plus edges 1–10, 3–8 and 12–16.
It has V=17, E=20, rank=4, elementary ring sizes 5/6/6/6 and C17H28.
The coordinate-free fixture is `tests/fixtures/iupac79-polycyclic-002.json`.

Expected ES: **tetraciclo[8.7.0.0^{3,8}.0^{12,16}]heptadecano**.
Expected EN: **tetracyclo[8.7.0.0^{3,8}.0^{12,16}]heptadecane**.

Justification: [1979 A-31.2](https://www.acdlabs.com/iupac/nomenclature/79/r79_163.htm)
and [A-32.11–13, .21–23, .31(a–d)](https://www.acdlabs.com/iupac/nomenclature/79/r79_164.htm).
The Hamiltonian perimeter is a provably maximal main ring. All three omitted
edges have zero internal carbons. Edge 1–10 gives the most symmetric division,
8/7 internal carbons, whereas the other choices are less symmetric. Numbering
starts at a bridgehead along the longer branch. The two admissible orientations
tie on secondary bridges 3,8 and 12,16. The descriptor contains 8+7+2=17 atoms
and three bridges besides the main ring, hence four independent rings.

The graph is **not gonane**: its two internal six-membered rings have opposite
fusion edges (linear junctions). The gonane constitution has the angular
cyclopenta[a]phenanthrene skeleton; equal formulas and ring-size lists do not
establish identity. The comparison uses the explicit numbered steroid graph
already in `app/fused-ring-nomenclature.ts`, and canonical graph identity in tests.
[A-22.5's cyclopenta[a]phenanthrene figure](https://www.acdlabs.com/iupac/nomenclature/79/r79_72.htm)
provides the 1979 fused-parent comparison. The [1989 steroid description](https://iupac.qmul.ac.uk/steroid/3S01.html)
is structural corroboration only, not the authority for a 1979 name.

[A-21](https://www.acdlabs.com/iupac/nomenclature/79/r79_63.htm) and
[A-23](https://www.acdlabs.com/iupac/nomenclature/79/r79_73.htm) provide the
alternative fusion/hydrogenation route. A-23 allows perhydro- for complete
hydrogenation, but does not justify calling every C17H28 tetracycle gonane or
reusing steroid numbering. This change selects the independently justified
A-31/A-32 constitutional name, without stereochemical assumptions.

## Audit

The existing tetracyclic recognizer already names the exact graph when correct
ring records are supplied. It is not rejected because it has four rings.
The Spanish Legacy spelling layer only admits three saturated bicycles and
therefore rejects a valid tetracyclic descriptor. Missing ring records cause a
second failure: the older bi/tri/tetracyclic recognizers require stored rings.
True gonane topology also has a specialised path which names testosterone but
does not name the bare saturated graph, suppressing the generic tetracyclic path.
Those are distinct boundaries, not a formula-recognition problem.

The reproduction test is added and run before generator changes. It asserts
the actual bilingual Legacy display, formula, exact descriptor and non-gonane
identity, not just absence of an unavailable message.

## Algorithm and integration

The existing zero-length bridge generator is reused. Its new optional validated
Hamiltonian-cycle input avoids exhaustive simple-cycle enumeration when the
peripheral cycle already contains every vertex: no larger main ring can exist.
Its choice criteria are explicitly tied to A-32.31 and A-2.2, rather than assumed
from the modern P-23 numbering rules.

`app/iupac1979-saturated-fused.ts` perceives rings from the actual edges, requires
a connected neutral bare saturated carbon parent, and obtains the boundary from
edges belonging to exactly one elementary ring. Each boundary vertex must have
degree two and the walk must cover every atom in a single closed cycle. All
remaining edges are zero-length bridges. Every main-bridge choice, orientation
and equal-length path ordering is compared by the normative criteria. Output
includes the descriptor, complete numbering and tied equivalent numberings.
No atom count, formula, SMILES or structure ID selects a name.

Within this ortho-only domain no vertex belongs to three rings, the elementary
cycles form a complete basis, and their edge-fusion graph is connected. With
rank R there are R−1 shared edges, so that adjacency graph is a tree. Gluing
these cycles along their disjoint shared edges yields the single peripheral
Hamiltonian cycle checked above. The fast path therefore does not discard a
competing larger ring or an unexamined alternative Hamiltonian circuit. The
tests additionally enumerate all Hamilton cycles independently on their fixtures.

This supports chains and branched ring-adjacency trees with 5/6-membered rings,
not just three hardcoded bi/tri/tetracyclic families. The explicit current domain
has multiplicative prefixes bi through deca, the existing carbon-root table,
and the graph-enumeration safety limits of `fused-topology.ts`. No support for
peri-fused cores, nonzero bridges, decorated parents or stereochemical naming is
claimed by the new route. Existing naming of supported decorated/unsaturated
structures is preserved separately. A-32.23 introduces no new atom numbering
here because every secondary bridge contains zero atoms.

For supported bare parents, `analyzeMolecule` uses perceived ring records for
the older recognizers without mutating the molecule. Existing specialised
analysis objects and their visual numbering remain available. A generic fallback
handles the newly supported topologies, including the bare gonane constitution
and a four-ring star, using a constitutional von Baeyer name, not an implicit
stereochemical steroid name. Legacy ES spelling admission requires the new
graph-derived proof; a valid-looking external string cannot replace it. Legacy
EN uses the same proven parent. The retained aromatic route remains first.

The source SMILES emitted by the existing adapter for the exact graph is:

`C(C1)CC(C2)C1CC1C2CC(CCCC2)C2C1`

It is a verification/export artifact, never a lookup key in the generator.
The expected name above is derived from 1979 rules, not from a PubChem name.

## Tests and compatibility

The new test file verifies literal ES/EN expected names, real Legacy display,
independent OCL identities/formulas, descriptor-to-graph reconstruction, and an
independent exhaustive Hamilton-cycle/main-bridge/numbering oracle on the small
fixtures. It covers saturated 5+5, 5+6 and 6+6 bicycles; linear/angular 6+6+6 and
5+5+5 tricycles; the exact capture; a C17H28 mixed isomer; an independently
constructed gonane graph; a star of four six-membered rings; and five fused
six-membered rings. SMILES roundtrips, IDs/order, geometric transformations,
missing ring metadata, ring construction and supported name reconstruction are
checked. The old gonane specialisation remains distinct from the generic route.

An additional exhaustive construction sweep fuses five- or six-membered rings
onto every eligible peripheral edge and deduplicates by independent canonical
graph identity. It checks **47 distinct constitutions** (3 bicycles, 9 tricycles,
35 tetracycles); all are supported by the new bare-parent algorithm, and all
**20 names** also produced by the old specialised recognizers are unchanged
(`outputs/iupac79-polycyclic-002/topology-sweep.log`). This includes alternative
ring arrangements beyond a single stored scaffold.

One existing AUD-NOM-011 negative-control test intentionally expected all bare
tri/tetracycles to be unavailable in Spanish. Only those two expected values
are updated to their exact graph-verified names, with English assertions added;
the other negative cases and the anti-forgery assertion are preserved.
No old assertion is weakened to hide a regression.

## Validation

- Before implementation: the reproduction failed with actual ES `-` versus the
  exact expected tetracyclic name (`outputs/iupac79-polycyclic-002/red.log`).
- After implementation: the reproduction passed, then all 14 new chemical tests
  passed in the targeted run. That initial multi-file run also contained the
  older AUD-NOM-011 expectation already described above; it was updated before
  the full run, which has passed that file with its new exact-name assertions.
- `npm run build:pages` and `npm run validate:pages`: PASS.
- Official `scripts/build-verified.sh` under Git Bash: PASS, including Sites
  artifact verification. The initial sandbox MSYS startup failure was resolved
  by the required execution approval.
- ESLint on changed source/tests: 0 errors, 6 existing page warnings.
- Tracked-source TypeScript comparison with HEAD: 49 baseline diagnostics,
  49 current, **0 introduced**. The repository's pre-existing typing errors are
  not hidden by changing tsconfig or unrelated source files. The compiler-host
  comparison substitutes HEAD versions of modified files for the baseline and
  adds the new module only to the current program.
- The initial sequential full sweep passed its early files but was stopped to
  reduce wall time. It is not counted as a completed green run. Final validation
  partitions **all 160 test files** into 148 ordinary files (concurrency 4) and
  12 files which spawn fresh processes (concurrency 1, run after the first batch).
  `test-manifest.json` verifies disjoint complete coverage; `run-test-batch.mjs`
  runs the ordinary Node test runner without changing test contents. Both are in
  the ignored validation directory. Both batches exited successfully:

  | Batch | Files | Tests | Pass | Fail | Skip |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | Ordinary, concurrency 4 | 148 | 2664 | 2659 | 0 | 5 |
  | Subprocess, concurrency 1 | 12 | 177 | 177 | 0 | 0 |
  | **Complete suite** | **160** | **2841** | **2836** | **0** | **5** |

  The five skips are the existing silver ester records ESTER-0007, ESTER-0012,
  ESTER-0014, ESTER-0015 and ESTER-0016, explicitly marked as not exact naming
  oracles; no new test is skipped. The
  final runs report no cancellations. Logs: `full-parallel.log` (471 seconds)
  and `full-serial.log` (631 seconds).
  No test timeout or chemical fixture was relaxed to obtain a pass.
- The concurrent batch logs shared Vite HMR port 24678 collisions between helper
  servers. The test runner nevertheless exited 0 with the complete passing
  counts above; no port settings or test assertions were changed. The verified
  builds ran separately and passed.

Validation logs and the comparison script are ignored working artifacts under
`outputs/iupac79-polycyclic-002/`.

## Changed files and boundaries

- `app/fused-ring-nomenclature.ts`: reuse and validate a proven Hamiltonian main
  ring in the existing descriptor/numbering algorithm.
- `app/iupac1979-saturated-fused.ts` (new): topology-driven bare saturated parent
  recognition, descriptor proof and historical Spanish spelling validation.
- `app/page.tsx`: graph perception, proof propagation, generic fallback,
  Legacy ES/EN integration and bilingual explanation; no interface redesign.
- `app/nomenclature-conventions.ts`: admit the verified higher-polycycle spelling.
- `tests/iupac79-polycyclic-002.test.mjs` and its JSON fixture (new): reproduction,
  independent structural/numbering checks and metamorphic/negative coverage.
- `tests/aud-nom-011-legacy-fused-bicycles.test.mjs`: the two intentional scope
  corrections described above.
- This report (new).

The new generic route supports bare saturated ortho-fused 5/6-membered carbocycles
whose entire connected graph has one Hamiltonian peripheral cycle and only
zero-length omitted edges. It does not certify arbitrary cages, peri systems,
nonzero bridges, new functional/alkyl/stereo derivatives, or ring sizes outside
5/6. Those inputs retain the pre-existing routes where implemented, otherwise
remain unsupported. Prefixes beyond deca, unknown carbon roots and enumeration
safety limits return typed `UNSUPPORTED` with a reason. This is not complete
IUPAC 1979 coverage.

The existing root library is reused; the [1979 prefix note for twenty](https://www.acdlabs.com/iupac/nomenclature/79/r79_35.htm)
explicitly uses icosa rather than eicosa. No later naming standard is inferred
merely from a database's preferred spelling.

Import/export and molecular history schema are unchanged. Analysis recomputes
the proof from the graph rather than persisting new molecule metadata. The new
five-ring name can be constructed with existing ring-fusion tools and imported
by SMILES; extending the local text-name constructor beyond its existing
bi/tri/tetracyclic parser is outside this naming-only change.

No commit or push is authorised or performed.

The acceptance criteria are met for the explicitly documented family: the
reference has a justified bilingual 1979 name; the algorithm handles other
constitutions without structure-specific lookup; representation changes and
unsupported graphs are checked; the complete available regression suite and
both builds pass. The broader naming limitations above remain explicit.
