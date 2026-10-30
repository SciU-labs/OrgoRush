/** The existing editor's valence envelope; importing a topology must never
 * bypass these limits. Charged nitrogen/oxygen retain the nitro conventions. */
export function editableValencesValid(graph: {
  atoms: readonly { id: number; element?: string; charge?: number }[];
  bonds: readonly (readonly [number, number, number?])[];
}) {
  const limits: Record<string, number> = {C:4,N:3,O:2,S:2,F:1,Cl:1,Br:1,I:1};
  return graph.atoms.every(atom=>{
    const element=atom.element??"C", charge=atom.charge??0;
    const limit=element==="N"&&charge===1?4:element==="O"&&charge===-1?1:limits[element];
    const used=graph.bonds.reduce((n,[a,b,o=1])=>n+(a===atom.id||b===atom.id?o:0),0);
    return limit!==undefined && used<=limit;
  });
}
