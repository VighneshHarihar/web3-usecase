import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { findBannedWords } from '@loyallink/shared/core';
import en from './en';
import hi from './hi';

function flatten(o: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v as Record<string, unknown>, key));
  }
  return out;
}

const EN = flatten(en);
const HI = flatten(hi);

describe('Invisible Chain step 3: no jargon in the default UI', () => {
  for (const [name, dict] of [['en', EN], ['hi', HI]] as const) {
    it(`${name}: no banned words outside the public proof pages`, () => {
      const offenders = Object.entries(dict)
        .filter(([k]) => !k.startsWith('proofp.'))
        .map(([k, v]) => [k, findBannedWords(v)] as const)
        .filter(([, w]) => w.length);
      expect(offenders).toEqual([]);
    });
  }
});

describe('Dayadhvam: Hindi is complete', () => {
  it('has every English key', () => {
    expect(Object.keys(EN).filter((k) => !(k in HI))).toEqual([]);
  });
  it('every static key used in the source exists', () => {
    const files: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && files.push(path.join(d, e.name))));
    walk(path.resolve(__dirname, '..'));
    const used = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
    const missing = [...used].filter((k) => !(k in EN) && !(`${k}_one` in EN) && !Object.keys(EN).some((x) => x.startsWith(`${k}.`)));
    expect(missing).toEqual([]);
  });
});
