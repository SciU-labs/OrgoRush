import {pathToFileURL} from 'node:url';

// Offline commands never import the production engine or its UI adapters.
export async function runAuditCommand(command){
 if(['--verify','--replay','--adjudicate','--report'].includes(command)){
  const reference=await import('./validation-014-reference.mjs');
  return reference[{'--verify':'verifyMatrix','--replay':'replayMatrix','--adjudicate':'adjudicate','--report':'writeReport'}[command]]();
 }
 if(command==='--check-source')return(await import('./validation-014-integrity.mjs')).assertCaptureSource();
 if(['--collect','--roundtrip','--reproduce'].includes(command)){
  (await import('./validation-014-integrity.mjs')).assertCaptureSource();
  const capture=await import('./validation-014-capture.mjs');
  return capture[{'--collect':'collect','--roundtrip':'roundtrips','--reproduce':'reproduce'}[command]]();
 }
 throw new Error('Usage: node scripts/validation-014-audit.mjs --verify|--replay|--check-source|--collect|--roundtrip|--adjudicate|--report|--reproduce');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await runAuditCommand(process.argv[2]);if(result!==undefined)console.log(JSON.stringify(result));}
 catch(error){console.error(error.stack??String(error));process.exitCode=1;}
}
