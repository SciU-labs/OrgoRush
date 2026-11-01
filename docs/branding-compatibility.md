# OrgoRush branding compatibility

This document records technical identifiers retained during the public rename
to **OrgoRush by SCIU**. They are not current product names and must not be used
for new interface text, exports, or user-facing documentation.

## Browser preferences

The application continues reading and writing these existing local storage
keys directly:

- `hydrocarbon-lab-language`
- `hydrocarbon-lab-show-stereochemistry`
- `hydrocarbon-theme`
- `hydrocarbonLab.panelPositions.v1`
- `hydrocarbonLab.panelDragEnabled.v2`
- `hydrocarbonLab.skeletalHintDismissed.v1`
- `hydrocarbonLab.bondHintDismissed.v1`
- `hydrocarbonLab.numberingScale.v1`
- `hydrocarbonLab.functionalGroupScale.v1`
- `hydrocarbonLab.semiDevelopedLabelScale.v1`
- `hydrocarbonLab.tetrahedralBadgeScale.v1`
- `hydrocarbonLab.guidedTour.v1`
- `hydrocarbonLab.semiDevelopedStereoDisplay.v1`

These keys are persistent user data. Keeping their names avoids migration and
preserves preferences already stored in browsers. They are internal compatibility
identifiers, not visible branding.

The browser drag-and-drop MIME type `application/x-hydrocarbon-ring` is also an
internal interaction identifier. It remains unchanged to avoid breaking ring
drag behavior between the canvas and its drop target.

## Reproducible seeds and audit contracts

The `hydrocarbon-lab-seed` derivation namespace is retained because changing it
would change generated questions for the same historical seed. Existing corpus
profiles, fixture values, and audit JSON properties such as
`nameHydrocarbonLab` and `hydrocarbonLabName` are also data contracts or frozen
reference material. Their names remain unchanged for reproducibility and
historical traceability. New report headings and output filenames use OrgoRush.

## Historical evidence

Archived release notes, validation reports, workflow URLs, browser captures,
and export proofs preserve the project name and routes that were accurate when
those artifacts were produced. Do not rewrite them as part of the branding
migration. Current documentation and deployment links use the OrgoRush URLs in
the main README.
