import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export const AUDIT_ROOT = new URL('../', import.meta.url);
export const INTEGRITY_PATH = 'tests/fixtures/orgorush-validation-014.integrity.json';
// Reviewed fingerprint of the published snapshot and Git-blob source manifest.
// Updating audit code does not update this historical data automatically.
const MANIFEST_SHA256 = '353f53dd95636163c0073c41ce04102c3bd91ead50df401497f5c6194fc6cadc';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonicalJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function textBytes(bytes) {
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  assert.ok(!text.includes('\0'), 'Text integrity does not accept NUL bytes');
  return Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8');
}
function rootURL(root) {
  if (root instanceof URL) return root;
  throw new TypeError('Snapshot/source root must be a directory URL');
}
function safePath(path) {
  assert.ok(typeof path === 'string' && path.length && !path.includes('\\') &&
    !path.startsWith('/') && !path.includes(':') && !path.split('/').some(p => p === '..' || p === '.' || !p),
  `Invalid manifest path: ${path}`);
  return path;
}
const freeze = value => {
  if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);}
  return value;
};
export function loadIntegrityManifest({root = AUDIT_ROOT, read = readFileSync} = {}) {
  const manifest = JSON.parse(textBytes(read(new URL(INTEGRITY_PATH, rootURL(root)))));
  assert.equal(sha256(canonicalJSON(manifest)), MANIFEST_SHA256, 'Historical integrity manifest changed');
  assert.equal(manifest.schema, 'orgorush-validation-014-integrity/v1');
  for (const list of [manifest.artifacts, manifest.sourceFiles]) {
    assert.equal(new Set(list.map(f => f.path)).size, list.length, 'Duplicate manifest path');
    for (const file of list) {safePath(file.path); assert.match(file.sha256, /^[a-f0-9]{64}$/);}
  }
  return freeze(manifest);
}
/** Reads only published audit artifacts. No Git, production files, outputs,
 * network, HEAD, installed compiler, or historical Git object is consulted. */
export function loadHistoricalSnapshot(options = {}) {
  const {root = AUDIT_ROOT, read = readFileSync} = options, manifest = loadIntegrityManifest(options), data = {};
  for (const file of manifest.artifacts) {
    const bytes = textBytes(read(new URL(file.path, rootURL(root))));
    assert.equal(sha256(bytes), file.sha256, `Historical artifact changed: ${file.path}`);
    if (file.format === 'json') {
      data[file.key] = JSON.parse(bytes);
      assert.equal(sha256(canonicalJSON(data[file.key])), file.semanticSha256, `Historical JSON changed: ${file.path}`);
    }
  }
  return freeze({...data, manifest});
}
/** Generic comparator used by the strict capture guard and its fault tests.
 * UTF-8 text permits CRLF/LF representation only. Binary bytes are exact. */
export function compareSourceFiles(files, {root = AUDIT_ROOT, read = readFileSync} = {}) {
  for (const file of files) {
    const bytes = read(new URL(safePath(file.path), rootURL(root)));
    const actual = file.kind === 'utf8-lf' ? textBytes(bytes) : bytes;
    assert.equal(sha256(actual), file.sha256, `Capture source changed: ${file.path}`);
  }
  return files.length;
}
/** This check deliberately remains strict when FIX-015 changes production.
 * It protects capture of the original baseline, never historical replay. */
export function assertCaptureSource(options = {}) {
  const manifest = loadIntegrityManifest(options);
  const filesChecked = compareSourceFiles(manifest.sourceFiles, options);
  return {baseline: manifest.baselineCommit, filesChecked, comparison: 'git-blob/utf8-lf-or-exact-binary/v1',
    sourceManifestHash: sha256(canonicalJSON(manifest.sourceFiles)),
    legacyProductionHash: manifest.legacyProductionHash, headRequired: false};
}
