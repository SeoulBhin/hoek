// 폰트 표 읽기 시험. 폰트 파일을 저장소에 넣지 않으려고 표 바이트를 코드로 직접 만든다.
// protects: 한글 글자 수·글자 있음/없음·한국어 가족 이름·TTC 면 고르기·굵기 축 읽기
// fails_when: 글리프 0(.notdef)으로 매핑된 글자를 있는 글자로 셈 / 형식 12 구간을 잘못 합침 / TTC 에서 엉뚱한 면을 고름 /
//             한국어 이름 대신 영어 이름을 줌 / 기호 폰트를 빈 글자 목록 폰트와 구분 못 함
// no_claim: 실제 설치 폰트에서 맞는지(그건 real-fonts.test.mjs 와 tools/crosscheck.py)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFontInfo, parseCmap, hasChar, countInRange, HANGUL_FIRST, HANGUL_LAST, HANGUL_TOTAL } from '../src/fonts/sfnt.js';

class W {
  constructor() { this.a = []; }
  u8(v) { this.a.push(v & 255); return this; }
  u16(v) { this.a.push((v >> 8) & 255, v & 255); return this; }
  i16(v) { return this.u16(v & 0xffff); }
  u32(v) { this.a.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; }
  tag(s) { for (const c of s) this.a.push(c.charCodeAt(0)); return this; }
  bytes(b) { this.a.push(...b); return this; }
  get length() { return this.a.length; }
  out() { return Uint8Array.from(this.a); }
}

function utf16be(s) {
  const w = new W();
  for (const ch of s) w.u16(ch.charCodeAt(0));
  return w.out();
}

function nameTable(records) {
  // records: [{nameID, lang, text}] (platform 3, encoding 1)
  const strs = records.map((r) => utf16be(r.text));
  const w = new W().u16(0).u16(records.length).u16(6 + records.length * 12);
  let off = 0;
  records.forEach((r, i) => {
    w.u16(3).u16(1).u16(r.lang).u16(r.nameID).u16(strs[i].length).u16(off);
    off += strs[i].length;
  });
  strs.forEach((s) => w.bytes(s));
  return w.out();
}

// 형식 4: 구간마다 [start, end, delta] (idRangeOffset 0), 마지막 0xFFFF 구간은 자동
function cmap4(segs) {
  const all = [...segs, [0xffff, 0xffff, 1]];
  const n = all.length;
  const sub = new W().u16(4).u16(16 + n * 8).u16(0).u16(n * 2).u16(0).u16(0).u16(0);
  all.forEach((s) => sub.u16(s[1]));
  sub.u16(0);
  all.forEach((s) => sub.u16(s[0]));
  all.forEach((s) => sub.i16(s[2]));
  all.forEach(() => sub.u16(0));
  return new W().u16(0).u16(1).u16(3).u16(1).u32(12).bytes(sub.out()).out();
}

function cmap12(groups) {
  const sub = new W().u16(12).u16(0).u32(16 + groups.length * 12).u32(0).u32(groups.length);
  groups.forEach(([s, e, g]) => sub.u32(s).u32(e).u32(g));
  return new W().u16(0).u16(1).u16(3).u16(10).u32(12).bytes(sub.out()).out();
}

function cmapSymbol() {
  const sub = new W().u16(4).u16(24).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0xffff).u16(0).u16(0xffff).i16(1).u16(0);
  return new W().u16(0).u16(1).u16(3).u16(0).u32(12).bytes(sub.out()).out();
}

function fvar(min, def, max) {
  return new W().u16(1).u16(0).u16(16).u16(2).u16(1).u16(20).u16(0).u16(0)
    .tag('wght').u32(min * 65536).u32(def * 65536).u32(max * 65536).u16(0).u16(256).out();
}

// 표 여러 개를 sfnt 한 면으로. base = 이 면이 파일 안에서 시작하는 위치(TTC 용)
function face(tables, base = 0) {
  const tags = Object.keys(tables);
  const dirLen = 12 + tags.length * 16;
  const w = new W().u32(0x00010000).u16(tags.length).u16(0).u16(0).u16(0);
  let off = base + dirLen;
  const body = [];
  for (const t of tags) {
    w.tag(t).u32(0).u32(off).u32(tables[t].length);
    body.push(tables[t]);
    off += tables[t].length;
  }
  body.forEach((b) => w.bytes(b));
  return w.out();
}

function ttc(faceTables) {
  const head = 12 + faceTables.length * 4;
  const parts = [];
  const offs = [];
  let off = head;
  for (const t of faceTables) {
    const f = face(t, off);
    offs.push(off);
    parts.push(f);
    off += f.length;
  }
  const w = new W().tag('ttcf').u32(0x00010000).u32(faceTables.length);
  offs.forEach((o) => w.u32(o));
  parts.forEach((p) => w.bytes(p));
  return w.out();
}

const reader = (bytes) => async (o, l) => bytes.subarray(o, o + l);

test('형식 4: 글리프 0 으로 가는 글자는 없는 글자', () => {
  // 'A'~'C' 는 글리프 1~3, 'D' 는 delta 로 0 이 됨 → 없음
  const { ranges } = parseCmap(cmap4([[0x41, 0x43, -0x40], [0x44, 0x44, -0x44]]));
  assert.equal(hasChar(ranges, 0x41), true);
  assert.equal(hasChar(ranges, 0x43), true);
  assert.equal(hasChar(ranges, 0x44), false);
  assert.equal(hasChar(ranges, 0x45), false);
});

test('형식 12: 가~힣 전부면 11,172자, 하나 빠지면 11,171자', () => {
  const full = parseCmap(cmap12([[HANGUL_FIRST, HANGUL_LAST, 10]])).ranges;
  assert.equal(countInRange(full, HANGUL_FIRST, HANGUL_LAST), HANGUL_TOTAL);
  const hole = parseCmap(cmap12([[HANGUL_FIRST, 0xb000, 10], [0xb002, HANGUL_LAST, 2000]])).ranges;
  assert.equal(countInRange(hole, HANGUL_FIRST, HANGUL_LAST), HANGUL_TOTAL - 1);
  assert.equal(hasChar(hole, 0xb001), false);
});

test('형식 12: 첫 글자가 .notdef 인 구간은 그 글자만 뺀다', () => {
  const r = parseCmap(cmap12([[0x30, 0x39, 0]])).ranges;
  assert.equal(hasChar(r, 0x30), false);
  assert.equal(hasChar(r, 0x31), true);
});

test('기호 폰트(유니코드 표 없음)는 symbol 로 따로 표시', () => {
  const r = parseCmap(cmapSymbol());
  assert.equal(r.ranges, null);
  assert.equal(r.symbol, true);
});

test('이름 표: 한국어 가족 이름과 영어 이름을 둘 다 준다', async () => {
  const bytes = face({
    name: nameTable([
      { nameID: 1, lang: 0x0409, text: 'Malgun Gothic' },
      { nameID: 1, lang: 0x0412, text: '맑은 고딕' },
      { nameID: 6, lang: 0x0409, text: 'MalgunGothic' },
    ]),
    cmap: cmap12([[HANGUL_FIRST, HANGUL_LAST, 10], [0x41, 0x5a, 1]]),
  });
  const info = await readFontInfo(reader(bytes), 'MalgunGothic');
  assert.equal(info.family, 'Malgun Gothic');
  assert.equal(info.familyKo, '맑은 고딕');
  assert.equal(info.ps, 'MalgunGothic');
  assert.equal(info.hangul, HANGUL_TOTAL);
  assert.equal(info.wght, null);
});

test('TTC: 포스트스크립트 이름이 같은 면을 고른다(못 찾으면 첫 면)', async () => {
  const a = { name: nameTable([{ nameID: 6, lang: 0x0409, text: 'FaceA' }]), cmap: cmap12([[0x41, 0x41, 1]]) };
  const b = { name: nameTable([{ nameID: 6, lang: 0x0409, text: 'FaceB' }]), cmap: cmap12([[HANGUL_FIRST, HANGUL_LAST, 5]]) };
  const bytes = ttc([a, b]);
  const got = await readFontInfo(reader(bytes), 'FaceB');
  assert.equal(got.ps, 'FaceB');
  assert.equal(got.hangul, HANGUL_TOTAL);
  assert.equal(got.faces, 2);
  const miss = await readFontInfo(reader(bytes), 'Nope');
  assert.equal(miss.ps, 'FaceA');
});

test('가변 폰트: 굵기 축 범위를 읽는다', async () => {
  const bytes = face({ cmap: cmap12([[0x41, 0x5a, 1]]), fvar: fvar(100, 400, 900) });
  const info = await readFontInfo(reader(bytes));
  assert.deepEqual(info.wght, { min: 100, def: 400, max: 900 });
  assert.equal(info.hangul, 0);
});

// 형식 4, idRangeOffset ≠ 0: 글리프 번호를 배열에서 꺼내는 구간(CI 의 리눅스엔 실제 Windows 폰트가 없어서 여기서 시험)
// segs: [{ start, end, delta, glyphs }] — glyphs 가 있으면 그 구간은 배열을 쓴다
function cmap4ro(segs) {
  const all = [...segs, { start: 0xffff, end: 0xffff, delta: 1 }];
  const n = all.length;
  const arr = [];
  const ro = all.map((s, i) => {
    if (!s.glyphs) return 0;
    // idRangeOffset 은 '자기 자리'에서 배열 시작까지의 바이트 거리
    const off = (n - i) * 2 + arr.length * 2;
    arr.push(...s.glyphs);
    return off;
  });
  const sub = new W().u16(4).u16(16 + n * 8 + arr.length * 2).u16(0).u16(n * 2).u16(0).u16(0).u16(0);
  all.forEach((s) => sub.u16(s.end));
  sub.u16(0);
  all.forEach((s) => sub.u16(s.start));
  all.forEach((s) => sub.i16(s.delta));
  ro.forEach((r) => sub.u16(r));
  arr.forEach((g) => sub.u16(g));
  return new W().u16(0).u16(1).u16(3).u16(1).u32(12).bytes(sub.out()).out();
}

test('형식 4 배열 구간: 배열 값 0 은 없는 글자, 0 아니면 delta 를 더한다', () => {
  // '가'~'가+3': 배열 [5, 0, 7, 0xffff], delta 1 → 6, 없음, 8, (0xffff+1)&0xffff = 0 → 없음
  const { ranges } = parseCmap(cmap4ro([
    { start: 0x41, end: 0x42, delta: -0x40 },
    { start: 0xac00, end: 0xac03, delta: 1, glyphs: [5, 0, 7, 0xffff] },
  ]));
  assert.equal(hasChar(ranges, 0x41), true);
  assert.equal(hasChar(ranges, 0xac00), true);
  assert.equal(hasChar(ranges, 0xac01), false);
  assert.equal(hasChar(ranges, 0xac02), true);
  assert.equal(hasChar(ranges, 0xac03), false);
  assert.equal(countInRange(ranges, HANGUL_FIRST, HANGUL_LAST), 2);
});

test('형식 4 구간째 넣기: delta 로 글리프 0 이 되는 한 글자만 뺀다', () => {
  // 0x30~0x39, delta -0x35 → 0x35 가 글리프 0
  const { ranges } = parseCmap(cmap4([[0x30, 0x39, -0x35]]));
  assert.equal(hasChar(ranges, 0x34), true);
  assert.equal(hasChar(ranges, 0x35), false);
  assert.equal(hasChar(ranges, 0x36), true);
});

test('규격을 어긴 cmap: 순서가 뒤섞이거나 겹쳐도 글자 수가 맞고 11,172 를 넘지 않는다', async () => {
  const messy = parseCmap(cmap12([[HANGUL_FIRST, HANGUL_LAST, 10], [0x41, 0x5a, 1], [0xb000, 0xb100, 3]])).ranges;
  assert.equal(hasChar(messy, 0x41), true);
  assert.equal(countInRange(messy, HANGUL_FIRST, HANGUL_LAST), HANGUL_TOTAL);
  const info = await readFontInfo(reader(face({ cmap: cmap12([[HANGUL_FIRST, HANGUL_LAST, 10], [HANGUL_FIRST, 0xb000, 20]]) })));
  assert.equal(info.hangul, HANGUL_TOTAL);
});

test('면이 0개인 TTC 는 오류(앱은 "못 읽음"으로 표시)', async () => {
  const empty = new W().tag('ttcf').u32(0x00010000).u32(0).out();
  await assert.rejects(readFontInfo(reader(empty)));
});
