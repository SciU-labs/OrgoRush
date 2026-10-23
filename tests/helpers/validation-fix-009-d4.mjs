import assert from "node:assert/strict";

/** P-16.7 / RSEQ §§4,6b, independently applied to the unsaturated parents.
 * Preserve the original D4 capture and all Legacy EN/structural expectations. */
export function verifiedD4Fixture009(captured) {
  const names = new Map([
    [10, ["3-metilhept-3-en-2,6-diona", "3-metilhept-3-eno-2,6-diona"]],
    [11, ["5-metilhept-3-in-2,6-diol", "5-metilhept-3-ino-2,6-diol"]],
  ]);
  return { ...captured, fixtures: captured.fixtures.map(row => {
    const corrected = names.get(row.id);
    if (!corrected) return row;
    assert.equal(row.names.es, corrected[0], "preserved historical observation");
    return { ...row, names: { ...row.names, es: corrected[1] } };
  }) };
}
