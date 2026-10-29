# Name Builder: cis/trans input

Date: 2026-10-28.

Implemented cis/trans aliases with graph-based reference selection and the existing E/Z editor. The requested dichlorinated enone builds as 4Z for cis and 4E for trans. There is no global cis→Z or trans→E substitution; the regression cases also include cis→E and trans→Z.

## Architecture and changed files

- `app/name-to-molecule.ts`: reads cis/trans and explicit E/Z descriptors before parsing the base name, then assigns stereo after connectivity and valence validation. English alkene, ketone, halogen and linear alkyl vocabulary enters the existing compact grammar. Reports whether unsupported connectivity needs the advanced resolver.
- `app/double-bond-stereochemistry.ts`: shares attached-substituent inspection with the existing CIP implementation. Chooses the sole stereogenic C=C, uses the conventional hydrogen pair when both ends carry H, or requires a unique constitutionally identical substituent pair. Reuses `legacyGraphsIdentical` with forced root correspondence to verify whole-branch identity. Compares reference groups with CIP priorities and calls the existing `setDoubleBondGeometry`.
- `app/name-structure-resolver.ts`: resolves advanced names without the cis/trans prefix, then validates and assigns the requested relationship using the same utility. Both browser and API callers get configured isomeric SMILES. Does not reuse a constitutional PubChem CID/InChIKey as the identity of the newly assigned isomer.
- `app/page.tsx`: commits supported local stereochemical names directly and preserves authoritative validation errors. Advanced cis/trans requests use the shared resolver. Enables the existing stereo controls for explicitly configured bonds; an unspecified bond retains an E/Z prompt instead of claiming E or Z. Retained source-name output uses the interpreted E/Z descriptor.
- `app/i18n.ts`: English translations for the new validation messages.
- `tests/cis-trans-name-builder.test.mjs`: 15 tests covering English/Spanish inputs, all requested examples, inverted CIP relationships, explicit/absent descriptors, rejection cases, advanced resolution, actual SVG generation, both display layouts, E/Z toggling, canonical naming and name/SMILES round trips.

The graph contract is unchanged: bond tuple index 3 records an explicit configuration; coordinates carry its E/Z geometry. Existing inspection, geometry editing, naming, layouts and SMILES serialization consume that same state. No independent stereochemistry engine or UI redesign was introduced.

## Verification

129 targeted tests passed, with no remaining test failures:

| Check | Result |
| --- | --- |
| `node --test tests/cis-trans-name-builder.test.mjs` | 15 passed |
| Existing Name Builder, advanced builder, fused builder, double-bond and tetrahedral stereo suites | 70 passed |
| Existing common-name resolver, AUDNOM stereo and chemistry regression suites | 40 passed |
| `npm run validate:pages` | Artifact validation and 4 tests passed |
| `npm run typecheck` | Passed |
| `npm run build:pages` | Passed; bundle-size and dynamic-import warnings |
| `git diff --check` | Passed |

The first new-suite run encountered a Vite SSR module-fetch timeout while other cold SSR tests were running. Two subsequent isolated runs passed, including the production naming and SVG/layout checks. Browser clicks were not exercised; UI wiring is covered by source-contract checks and the real chemistry/edit/layout functions.

The full Sites/Vinext build remains blocked by the existing Windows output-packaging path: `sites.closeBundle` fails with `EPERM` removing `dist/.openai/drizzle`, whose copied directory has read-only/OneDrive reparse attributes. `npm run build` also requires Bash on PATH. Invoking Vinext directly, including after clearing only the verified generated metadata directory with native PowerShell, reached compilation but reproduced the packaging failure on its next phase. No build configuration was changed. The complete Pages production build and artifact validation passed.

## Chemistry boundaries

- Accepts unqualified cis/trans only for a single stereogenic acyclic C=C. Multiple eligible double bonds require locanted E/Z; cyclic cis/trans is outside the existing geometry editor's support.
- For substituted alkenes without H at both ends, zero or multiple matching reference pairs produce validation feedback. Even two potentially equivalent reference choices are conservatively rejected; users can specify E/Z explicitly.
- Retains the existing CIP engine's element/model coverage and bounded recursive comparison, including its current limitations for more complex stereochemical priority rules. No isotope or new cumulene stereochemistry support is added.
- Advanced connectivity still depends on the existing OPSIN/PubChem capabilities. When their atom IDs do not supply a name-numbering map, retained interpreted input uses unlocanted `(E)` or `(Z)` for the unique eligible C=C; normal graph-generated names retain the engine's parent locants.

Terminology checked against the [IUPAC cis/trans definition](https://goldbook.iupac.org/terms/view/C01092) and [IUPAC E/Z definition](https://goldbook.iupac.org/terms/view/E01882).
