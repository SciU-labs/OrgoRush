import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const base = 'https://sciu-labs.github.io/OrgoRush/';
const artifact = (path) => readFile(new URL(`../dist-pages/${path}`, import.meta.url));
const html = async (path) => (await artifact(path)).toString();
function attrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}
function tags(document, name) {
  return [...document.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
}
function one(items, key, value) {
  const matches = items.filter((item) => item[key] === value);
  assert.equal(matches.length, 1, `expected one ${key}=${value}`);
  return matches[0];
}

test('localized built pages have reciprocal links and complete localized social metadata', async () => {
  for (const lang of ['es', 'en']) {
    const doc = await html(`${lang}/index.html`);
    assert.match(doc, new RegExp(`<html lang="${lang}"`));
    const links = tags(doc, 'link');
    assert.equal(one(links, 'rel', 'canonical').href, `${base}${lang}/`);
    const alternatives = links.filter((link) => link.rel === 'alternate');
    assert.equal(alternatives.length, 3);
    for (const [code, path] of [['es','es/'], ['en','en/'], ['x-default','']]) {
      assert.equal(one(alternatives, 'hreflang', code).href, base + path);
    }
    for (const icon of links.filter((link) => /icon/.test(link.rel))) {
      assert.match(icon.href, /^\/OrgoRush\//);
      await artifact(icon.href.slice('/OrgoRush/'.length));
    }
    const metas = tags(doc, 'meta');
    const og = (key) => one(metas, 'property', `og:${key}`).content;
    const tw = (key) => one(metas, 'name', `twitter:${key}`).content;
    const description = one(metas, 'name', 'description').content;
    const title = doc.match(/<title>(.*?)<\/title>/s)[1];
    assert.equal(og('type'), 'website');
    assert.equal(og('title'), title);
    assert.equal(og('description'), description);
    assert.equal(og('url'), `${base}${lang}/`);
    assert.equal(og('site_name'), 'OrgoRush | SciU');
    assert.equal(og('locale'), lang === 'es' ? 'es_ES' : 'en_US');
    assert.equal(og('locale:alternate'), lang === 'es' ? 'en_US' : 'es_ES');
    assert.equal(og('image'), base + 'social-preview.png');
    assert.equal(og('image:width'), '1200'); assert.equal(og('image:height'), '630');
    assert.ok(og('image:alt'));
    assert.equal(tw('card'), 'summary_large_image');
    assert.equal(tw('title'), title); assert.equal(tw('description'), description);
    assert.equal(tw('image'), og('image')); assert.equal(tw('image:alt'), og('image:alt'));
    assert.match(title, lang === 'es' ? /Química orgánica/ : /Organic Chemistry/);
  }
  const png = await artifact('social-preview.png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
});

test('sitemap contains only the two canonical localized URLs', async () => {
  const xml = (await artifact('sitemap.xml')).toString();
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">(?:\s*<url><loc>https:\/\/sciu-labs\.github\.io\/OrgoRush\/(?:es|en)\/<\/loc><\/url>){2}\s*<\/urlset>\s*$/);
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]).sort(), [`${base}en/`, `${base}es/`]);
});

test('root redirect honors saved language and browser fallback', async () => {
  const doc = await html('index.html');
  assert.equal(one(tags(doc, 'meta'), 'name', 'robots').content, 'noindex, follow');
  assert.match(doc, /href="\.\/es\/"/); assert.match(doc, /href="\.\/en\/"/);
  const script = doc.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [saved, browser, expected] of [['en','es-CL','en'],['es','en-US','es'],[null,'es-CL','es'],[null,'fr','en'],['blocked','en-US','en']]) {
    let destination;
    const localStorage = {getItem() { if (saved === 'blocked') throw Error('blocked'); return saved; }};
    runInNewContext(script, {localStorage, navigator: {language: browser}, URL, window: {location: {href: base, replace(url) {destination = url;}}}});
    assert.equal(destination, `${base}${expected}/`);
  }
});

test('language navigation preserves the project base', async () => {
  const source = await readFile(new URL('../app/i18n.ts', import.meta.url), 'utf8');
  const fn = source.match(/export function languagePath\([\s\S]*?\n}/)[0];
  const js = ts.transpile(fn.replace('export ', ''), {module: ts.ModuleKind.None});
  const languagePath = runInNewContext(`${js}\nlanguagePath`);
  assert.equal(languagePath('/OrgoRush/es/', 'en'), '/OrgoRush/en/');
  assert.equal(languagePath('/OrgoRush/en/', 'es'), '/OrgoRush/es/');
});
