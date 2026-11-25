// protects: 면 → 가족 묶기, 대표 면(보통 굵기·바로 선 글자) 고르기, 영어·한국어 이름 검색, 한글·즐겨찾기 거르기,
//           내 문장 중 빠진 글자 세기, 비교 4개 제한, 저장소가 막혀도 동작
// fails_when: "맑은"으로 검색해도 Malgun Gothic 이 안 나옴 / 한글 11,171자 폰트가 한글로 걸러짐 / 5번째 비교가 들어감 /
//             localStorage 가 throw 하면 앱이 죽음 / 저장된 이상한 값이 그대로 들어옴
// no_claim: 화면에 실제로 그려지는지(그건 e2e)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFamilies, filterFamilies, missingChars, toggleCompare, styleInfo, weightSteps, glyphList } from '../src/logic.js';
import { createStore, DEFAULTS } from '../src/store.js';

const FACES = [
  { family: 'Malgun Gothic', fullName: 'Malgun Gothic Bold', postscriptName: 'MalgunGothicBold', style: 'Bold' },
  { family: 'Malgun Gothic', fullName: 'Malgun Gothic', postscriptName: 'MalgunGothic', style: 'Regular' },
  { family: 'Malgun Gothic', fullName: 'Malgun Gothic Semilight', postscriptName: 'MalgunGothic-Semilight', style: 'Semilight' },
  { family: 'Arial', fullName: 'Arial Cursiva', postscriptName: 'Arial-ItalicMT', style: 'Italic' },
  { family: 'Arial', fullName: 'Arial', postscriptName: 'ArialMT', style: 'Regular' },
  { family: 'Cafe24 Shiningstar', fullName: 'Cafe24 Shiningstar', postscriptName: 'Cafe24Shiningstar', style: 'Regular' },
];

test('면을 가족으로 묶고 굵기 순으로, 대표 면은 보통 굵기', () => {
  const fams = groupFamilies(FACES);
  assert.deepEqual(fams.map((f) => f.family), ['Arial', 'Cafe24 Shiningstar', 'Malgun Gothic']);
  const malgun = fams[2];
  assert.deepEqual(malgun.faces.map((x) => x.ps), ['MalgunGothic-Semilight', 'MalgunGothic', 'MalgunGothicBold']);
  assert.equal(malgun.rep.ps, 'MalgunGothic');
  assert.equal(fams[0].rep.ps, 'ArialMT');
  assert.equal(malgun.key, 'local:Malgun Gothic');
});

test('스타일 이름에서 굵기·기울기', () => {
  assert.deepEqual(styleInfo('Semibold Italic'), { weight: 600, italic: true });
  assert.deepEqual(styleInfo('ExtraLight'), { weight: 200, italic: false });
  assert.deepEqual(styleInfo('Bold'), { weight: 700, italic: false });
  assert.deepEqual(styleInfo('Black'), { weight: 900, italic: false });
  assert.deepEqual(styleInfo('Regular'), { weight: 400, italic: false });
});

test('검색은 영어 이름과 한국어 이름 둘 다, 띄어쓰기·대소문자 무시', () => {
  const fams = groupFamilies(FACES);
  const info = { 'local:Malgun Gothic': { familyKo: '맑은 고딕', hangul: 11172 } };
  assert.deepEqual(filterFamilies(fams, { query: '맑은', info }).map((f) => f.family), ['Malgun Gothic']);
  assert.deepEqual(filterFamilies(fams, { query: 'malgungoth', info }).map((f) => f.family), ['Malgun Gothic']);
  assert.equal(filterFamilies(fams, { query: '', info }).length, 3);
});

test('한글 거르기는 11,172자 전부만, 아직 판별 안 된 건 빠짐', () => {
  const fams = groupFamilies(FACES);
  const info = {
    'local:Malgun Gothic': { hangul: 11172 },
    'local:Cafe24 Shiningstar': { hangul: 11154 },
  };
  assert.deepEqual(filterFamilies(fams, { filter: 'hangul', info }).map((f) => f.family), ['Malgun Gothic']);
});

test('즐겨찾기 거르기', () => {
  const fams = groupFamilies(FACES);
  const favorites = new Set(['local:Arial']);
  assert.deepEqual(filterFamilies(fams, { filter: 'fav', favorites }).map((f) => f.family), ['Arial']);
});

test('내 문장 중 없는 글자 수(공백 제외, 같은 글자는 한 번)', () => {
  const latin = Uint32Array.from([0x41, 0x5a, 0x61, 0x7a]);
  assert.equal(missingChars('Hello 안녕 안녕', latin), 2);
  assert.equal(missingChars('Hello', latin), 0);
  assert.equal(missingChars('abc', null), null);
});

test('비교는 4개까지, 5번째는 full', () => {
  let r = { list: [] };
  for (const k of ['a', 'b', 'c', 'd']) r = toggleCompare(r.list, k);
  assert.deepEqual(r.list, ['a', 'b', 'c', 'd']);
  const five = toggleCompare(r.list, 'e');
  assert.equal(five.full, true);
  assert.equal(five.list.length, 4);
  assert.deepEqual(toggleCompare(r.list, 'b').list, ['a', 'c', 'd']);
});

test('가변 폰트 굵기 단계, 글자표 묶음', () => {
  assert.deepEqual(weightSteps({ min: 250, def: 400, max: 700 }), [300, 400, 500, 600, 700]);
  assert.deepEqual(weightSteps(null), []);
  assert.equal(glyphList('hangul').length, 11172);
  assert.equal(glyphList('hangul')[0], '가');
  assert.equal(glyphList('latin').length, 52);
});

test('저장소: 남기고 다시 읽기, 이상한 값은 기본값', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  createStore(storage).set({ favorites: ['local:Arial'], sample: '안녕', size: 72, filter: 'hangul' });
  const again = createStore(storage).get();
  assert.deepEqual(again, { favorites: ['local:Arial'], sample: '안녕', size: 72, filter: 'hangul' });
  mem.set('hoek:v1', JSON.stringify({ favorites: 'x', size: 9999, filter: 'evil' }));
  const bad = createStore(storage).get();
  assert.deepEqual(bad.favorites, DEFAULTS.favorites);
  assert.equal(bad.size, 160);
  assert.equal(bad.filter, 'all');
});

test('저장소가 막혀도(throw) 이 창에서는 기억하고 ok=false', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createStore(storage);
  assert.equal(s.ok, false);
  s.set({ favorites: ['local:Arial'] });
  assert.deepEqual(s.get().favorites, ['local:Arial']);
});
