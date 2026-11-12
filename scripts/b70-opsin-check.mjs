import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {structuralIdentity} from '../tests/helpers/reference-corpus.mjs';
import {inspectSmilesStructure} from '../app/openchemlib-adapter.ts';
import {sameComposition} from './b61-evidence.mjs';

const java='C:\\Dev\\Tools\\OPSIN\\runtime\\jdk-21.0.13+9-jre\\bin\\java.exe';
const jar='C:\\Dev\\Tools\\OPSIN\\opsin-cli-2.9.0.jar';
const records=['b61-independent-reference.json','b62-independent-reference.json']
  .flatMap(f=>JSON.parse(readFileSync(`tests/fixtures/${f}`,'utf8')).records);
for(const id of ['B61-I20','B61-I06','B62-I17']) {
  const r=records.find(record=>record.id===id);
  const result=spawnSync(java,['-jar',jar,'-osmi','-f'],{input:`${r.referenceName}\n`,encoding:'utf8',timeout:30000,windowsHide:true});
  assert.equal(result.status,0,result.error?.message??result.stderr);
  const smiles=result.stdout.trim().split(/\r?\n/).at(-1);assert.ok(smiles);
  const inspection=inspectSmilesStructure(smiles);assert.ok(inspection.ok);
  assert.ok(sameComposition(inspection.formula,r.formula),`${inspection.formula} vs ${r.formula}`);
  assert.equal(structuralIdentity(smiles),structuralIdentity(r.smiles));
  console.log(JSON.stringify({id,name:r.referenceName,version:'2.9.0',smiles,formula:inspection.formula,equivalent:true,stderr:result.stderr.trim()}));
}
