import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sites } from '../build/sites-vite-plugin.ts';

test('Sites metadata can be repackaged after read-only directories are copied', async()=>{
  const root=await mkdtemp(join(tmpdir(),'orgorush-sites-'));
  const makeWritable=async path=>{
    await chmod(path,0o777);
    for(const entry of await readdir(path,{withFileTypes:true})) {
      const child=join(path,entry.name);
      if(entry.isDirectory())await makeWritable(child); else await chmod(child,0o666);
    }
  };
  try {
    await mkdir(join(root,'.openai'),{recursive:true});
    await mkdir(join(root,'drizzle','meta'),{recursive:true});
    await writeFile(join(root,'.openai','hosting.json'),'{}');
    await writeFile(join(root,'drizzle','meta','snapshot.json'),'{}');
    const plugin=sites(); plugin.configResolved({root});
    await plugin.closeBundle();
    await chmod(join(root,'dist','.openai','drizzle','meta'),0o555);
    await chmod(join(root,'dist','.openai','drizzle'),0o555);
    await plugin.closeBundle();
    assert.equal(await readFile(join(root,'dist','.openai','drizzle','meta','snapshot.json'),'utf8'),'{}');
  } finally { await makeWritable(root); await rm(root,{recursive:true,force:true}); }
});
