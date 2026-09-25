import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { FetLifeService } from '../src/fetlife/service.js';

function parse(html, selector = '[data-member-card]') {
  const dom = new JSDOM(html, { url: 'https://fetlife.com/ExamplePerson' });
  const service = new FetLifeService();
  const candidate = service.createCandidate(
    dom.window.document.querySelector(selector),
    service.detectRoute(dom.window.location.href),
  );
  dom.window.close();
  return candidate.parsed;
}

test('observed gender abbreviations are facts rather than part of a role', () => {
  for (const token of [
    'AG',
    'Andro',
    'B',
    'BG',
    'CD/TV',
    'Cis',
    'Db',
    'Dg',
    'DemiG',
    'DW',
    'F',
    'FEM',
    'FtM',
    'GF',
    'GN',
    'GNC',
    'GQ',
    'IS',
    'M',
    'Masc',
    'MtF',
    'NB',
    'PG',
    'QG',
    'TG',
    'TM',
    'TW',
    'TwoS',
    'UoG',
    'W',
    'GFae',
  ]) {
    const parsed = parse(
      `<div data-member-card="ExamplePerson"><a href="/users/101">ExamplePerson</a><div><span class="text-sm font-bold text-gray-300">29${token} Service Switch</span></div><div class="text-sm">Example City</div></div>`,
    );
    assert.equal(parsed.metadata.profileFacts.gender, token.toLowerCase(), token);
    assert.deepEqual(parsed.metadata.profileFacts.roles, ['service switch'], token);
  }
});

test('native profile header separates name, facts, linked location, and trailing media counts', () => {
  const parsed = parse(
    `<header data-test-id="profile-header"><div><span> <a href="/ExamplePerson/pictures">view pics</a> <span>(1,234)</span></span><span><a href="/ExamplePerson/videos">view vids</a> <span>(0)</span></span></div><main><div><h1>ExamplePerson <span class="select-none md:hidden"></span><span class="inline-block select-none text-md font-bold text-gray-200 lg:text-xl">29TW Service Switch</span></h1><p class="text-base"><a href="/p/country/region/city">Example City</a><a href="/p/country/region">Example Region</a><a href="/p/country">Example Country</a></p></div></main></header>`,
    '[data-test-id="profile-header"]',
  );
  assert.equal(parsed.displayName, 'ExamplePerson');
  assert.deepEqual(parsed.metadata.profileFacts, {
    age: 29,
    gender: 'tw',
    location: 'Example City, Example Region, Example Country',
    pictures: 1234,
    videos: 0,
    writings: null,
    roles: ['service switch'],
    relationship: null,
    relationships: null,
  });
});

test('missing and unfamiliar genders stay unknown without inventing profile facts', () => {
  const missing = parse(
    '<div data-member-card="ExamplePerson"><span class="text-sm font-bold text-gray-300">29 Service Switch</span></div>',
  );
  assert.equal(missing.metadata.profileFacts.gender, null);
  assert.deepEqual(missing.metadata.profileFacts.roles, ['service switch']);
  const unknown = parse(
    '<div data-member-card="ExamplePerson"><span class="text-sm font-bold text-gray-300">29Unlisted Switch</span></div>',
  );
  assert.equal(unknown.metadata.profileFacts.gender, null);
  assert.equal(unknown.metadata.profileFacts.location, null);
  assert.equal(unknown.metadata.profileFacts.pictures, null);
});

test('Kinktionary is a reference surface with no inferred profile or feed candidate', () => {
  const service = new FetLifeService();
  for (const path of [
    '/kinktionary',
    '/kinktionary/genders-example',
    '/kinktionary/abbreviations-example',
  ]) {
    const route = service.detectRoute(`https://fetlife.com${path}`);
    assert.equal(route.kind, 'reference');
    assert.equal(route.params.view, 'kinktionary');
    const dom = new JSDOM('<main><h1>Reference article</h1><p>Definitions</p></main>');
    assert.equal(service.createCandidate(dom.window.document.querySelector('main'), route), null);
    dom.window.close();
  }
});
