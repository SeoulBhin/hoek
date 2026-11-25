// 화면과 떨어진 순수 로직: 면 묶기·굵기 추정·검색·거르기·빠진 글자 세기. 시험은 tests/logic.test.mjs
import { hasChar, HANGUL_TOTAL } from './fonts/sfnt.js';

// 내 문장 칸을 비웠을 때 대신 보여 줄 문장(목록·비교·상세 공통)
export const FALLBACK_SAMPLE = '다람쥐 헌 쳇바퀴에 타고파 The quick brown fox 0123';

export const COMPARE_MAX = 4;
export const COMPARE_MIN = 2;

const WEIGHTS = [
  [/hairline|thin/i, 100],
  [/extra\s*light|ultra\s*light/i, 200],
  [/semi\s*light|demi\s*light/i, 350],
  [/light/i, 300],
  [/medium/i, 500],
  [/semi\s*bold|demi\s*bold|demi/i, 600],
  [/extra\s*bold|ultra\s*bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
];

// "Semibold Italic" → { weight: 600, italic: true }
export function styleInfo(style = '') {
  let weight = 400;
  for (const [re, w] of WEIGHTS) {
    if (re.test(style)) { weight = w; break; }
  }
  return { weight, italic: /italic|oblique/i.test(style) };
}

// 면 목록([{family, fullName, postscriptName, style}]) → 가족 목록. 가족 안은 굵기·기울기 순
// source: 'local'(내 PC) — 다음 단계의 직접 만든 폰트는 'made' 로 같은 모양을 쓴다
export function groupFamilies(faces, source = 'local') {
  const map = new Map();
  for (const f of faces) {
    if (!f.family) continue;
    if (!map.has(f.family)) map.set(f.family, []);
    map.get(f.family).push({ ps: f.postscriptName, full: f.fullName, style: f.style || 'Regular', ...styleInfo(f.style) });
  }
  const out = [];
  for (const [family, list] of map) {
    list.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic) || a.style.localeCompare(b.style));
    const upright = list.filter((x) => !x.italic);
    const pool = upright.length ? upright : list;
    const rep = pool.reduce((best, x) => (Math.abs(x.weight - 400) < Math.abs(best.weight - 400) ? x : best), pool[0]);
    out.push({ key: `${source}:${family}`, family, source, faces: list, rep });
  }
  return out.sort((a, b) => a.family.localeCompare(b.family, 'en', { sensitivity: 'base' }));
}

const norm = (s) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');

// info: 가족 key → 판별 결과({hangul, familyKo, ...}), 아직 모르면 없음
export function filterFamilies(families, { query = '', filter = 'all', favorites = new Set(), info = {} } = {}) {
  const q = norm(query);
  return families.filter((f) => {
    if (filter === 'fav' && !favorites.has(f.key)) return false;
    if (filter === 'hangul' && info[f.key]?.hangul !== HANGUL_TOTAL) return false;
    if (!q) return true;
    return norm(f.family).includes(q) || norm(info[f.key]?.familyKo).includes(q);
  });
}

// 내 문장에서 그 폰트에 없는 글자 수(공백·줄바꿈 제외, 같은 글자는 한 번)
export function missingChars(text, ranges) {
  if (!ranges) return null;
  const seen = new Set();
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x20 || seen.has(cp)) continue;
    seen.add(cp);
    if (!hasChar(ranges, cp)) n += 1;
  }
  return n;
}

// 비교에 넣기/빼기. 꽉 차면 그대로 돌려주고 full=true
export function toggleCompare(list, key) {
  if (list.includes(key)) return { list: list.filter((k) => k !== key), full: false };
  if (list.length >= COMPARE_MAX) return { list, full: true };
  return { list: [...list, key], full: false };
}

// 가변 폰트는 local() 로 부르면 기본 굵기만 나와서(11-26 실측) 굵기 축 값을 직접 넣는다. 가변이 아니면 undefined
export function axisWeight(info, weight) {
  const w = info?.wght;
  return w ? Math.min(w.max, Math.max(w.min, weight)) : undefined;
}

// 가변 폰트 굵기 축 → 상세에서 보여 줄 굵기(100 단위, 범위 안)
export function weightSteps(wght) {
  if (!wght) return [];
  const out = [];
  for (let w = Math.ceil(wght.min / 100) * 100; w <= wght.max; w += 100) out.push(w);
  return out;
}

// 글자표에 쓰는 글자 묶음
export const GLYPH_SETS = {
  hangul: { label: '한글 가~힣', from: 0xac00, to: 0xd7a3 },
  latin: { label: '영문', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' },
  digits: { label: '숫자·기호', chars: '0123456789!?.,:;\'"()[]{}<>@#$%&*+-=/\\|~^_`₩·…“”‘’「」『』' },
};

export function glyphList(set) {
  const s = GLYPH_SETS[set];
  if (s.chars) return Array.from(s.chars);
  const out = [];
  for (let c = s.from; c <= s.to; c++) out.push(String.fromCodePoint(c));
  return out;
}
