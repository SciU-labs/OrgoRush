// Audit evidence only; never imported by the production generator or verifier.
import { structuralIdentity } from '../tests/helpers/reference-corpus.mjs';

export function formulaComposition(formula) {
  const counts=new Map();let cursor=0;
  for(const match of formula.matchAll(/([A-Z][a-z]?)([1-9]\d*)?/g)) {
    if(match.index!==cursor)throw new Error(`Unsupported formula syntax: ${formula}`);
    counts.set(match[1],(counts.get(match[1])??0)+Number(match[2]??1));cursor+=match[0].length;
  }
  if(!cursor||cursor!==formula.length)throw new Error(`Unsupported formula syntax: ${formula}`);
  return Object.fromEntries([...counts].sort(([a],[b])=>a.localeCompare(b,'en')));
}
export const sameComposition=(a,b)=>JSON.stringify(formulaComposition(a))===JSON.stringify(formulaComposition(b));

// Explicit counterinterpretations of the observed saturated names. Their graphs
// are hand specified from basic radical semantics, not produced by OrgoRush.
// These are normative/manual witnesses, not OPSIN outputs or PubChem records.
export const manualNameWitnesses=[
  {id:'B61-NAME-01',names:{es:'hexanoato de propilo',en:'propyl hexanoate'},smiles:'CCCCCC(=O)OCCC',formula:'C9H18O2',
    rule:'The propyl alcohol-derived radical is saturated; it cannot denote prop-2-enyl'},
  {id:'B61-NAME-02',names:{es:'3-metil-6-(1-metiletil)ciclohex-1-eno',en:'3-methyl-6-(1-methylethyl)cyclohex-1-ene'},
    smiles:'C1=CC(C)CCC1C(C)C',formula:'C10H18',rule:'A methyl prefix cannot denote an exocyclic =CH2 (methylidene)'},
  {id:'B61-NAME-03',names:{es:'1-metoxi-4-propilbenceno',en:'1-methoxy-4-propylbenzene'},smiles:'COc1ccc(CCC)cc1',formula:'C10H14O',
    rule:'A propyl prefix cannot denote a stereospecified propenyl radical'},
];
export function assessManualName(name,language,sourceSmiles) {
  const witness=manualNameWitnesses.find(item=>item.names[language]===name);
  if(witness && structuralIdentity(witness.smiles)!==structuralIdentity(sourceSmiles))return {
    status:'FAIL-NAME',witnessId:witness.id,rule:witness.rule,interpretedSmiles:witness.smiles,interpretedFormula:witness.formula,
    origin:'manual-independent-semantic-counterinterpretation; not an independent parser run',
    source:'https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf',sections:['5.4','8']};
  // A citation-order error differs from a constitutional mismatch. Limit this
  // witness to two independently recognized simple prefix words.
  const prefixes=language==='en'?/^(\d+)-(phenyl|hydroxy)-(\d+)-(phenyl|hydroxy)([a-z].+)$/.exec(name??''):null;
  if(prefixes && prefixes[2].localeCompare(prefixes[4],'en')>0)return {status:'FAIL-NAME',witnessId:'B61-NAME-04',
    rule:'English detachable prefixes must be cited in alphabetical order: hydroxy precedes phenyl',
    origin:'independent lexical rule check; no claim that connectivity differs',
    source:'https://rseq.org/wp-content/uploads/2018/05/2021-Guia-Breve-para-la-Nomenclatura-en-Quimica-Organica.pdf',sections:['3e']};
  return null;
}
