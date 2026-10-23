import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { VALIDATION_CASES } from "../tests/fixtures/orgorush-validation-008.mjs";

const path = new URL("../tests/fixtures/orgorush-validation-008.opsin.json", import.meta.url);
const cache = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { schemaVersion: 1, purpose: "Independent name-to-constitution witness; not a nomenclature authority", responses: [] };
const names = new Set(VALIDATION_CASES.flatMap(row => [row.modernEnglishWitness, row.expected["1979-en"]]));
if (process.argv.includes("--observed")) {
  const matrix = JSON.parse(readFileSync(new URL("../reports/orgorush-validation-008.matrix.json", import.meta.url), "utf8"));
  for (const row of matrix.records) for (const variant of row.variants) {
    const name = variant.profiles["1979-en"].observed;
    if (name) names.add(name);
  }
}
const pending = [...names].filter(name => !cache.responses.some(item => item.name === name && item.httpStatus === 200));
let index = 0;
async function worker() {
  while (index < pending.length) {
    const name = pending[index++], url = `https://www.ebi.ac.uk/opsin/ws/${encodeURIComponent(name)}.json`;
    let entry;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const body = await response.text();
      entry = { name, url, retrievedAt: new Date().toISOString(), httpStatus: response.status,
        sha256: createHash("sha256").update(body).digest("hex"), body };
    } catch (error) { entry = { name, url, retrievedAt: new Date().toISOString(), httpStatus: null, error: String(error) }; }
    cache.responses = cache.responses.filter(item => item.name !== name); cache.responses.push(entry);
    writeFileSync(path, JSON.stringify(cache, null, 2) + "\n");
    console.log(`${entry.httpStatus ?? "NETWORK-UNAVAILABLE"} ${name}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(JSON.stringify({ requested: names.size, cached: cache.responses.filter(item => item.httpStatus === 200).length, failed: cache.responses.filter(item => item.httpStatus !== 200).length }));
