// 폰트 파일(TrueType·OpenType·TTC)에서 필요한 표만 골라 읽는다.
// read(offset, length) 로 필요한 조각만 꺼내 해석한다. 브라우저의 FontData.blob() 은 파일을 통째로 들고 올 수 있어서
// (CJK 폰트는 한 개가 10MB 넘음) 메모리를 아끼는 건 아니고, 해석할 양을 줄이는 것. 동시에 읽는 수는 useInspect 가 2개로 묶는다.
// 읽는 것: 이름(name: 포스트스크립트 이름·영어/한국어 가족 이름), 글자 목록(cmap), 굵기 축(fvar wght)

export const HANGUL_FIRST = 0xac00;
export const HANGUL_LAST = 0xd7a3;
export const HANGUL_TOTAL = HANGUL_LAST - HANGUL_FIRST + 1; // 11,172

const LANG_EN = 0x0409;
const LANG_KO = 0x0412;

function tagAt(b, o) {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}

function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

async function readTableDir(read, offset) {
  const head = await read(offset, 12);
  const n = view(head).getUint16(4);
  const recs = await read(offset + 12, n * 16);
  const dv = view(recs);
  const tables = {};
  for (let i = 0; i < Math.floor(recs.length / 16); i++) {
    const p = i * 16;
    tables[tagAt(recs, p)] = { offset: dv.getUint32(p + 8), length: dv.getUint32(p + 12) };
  }
  return tables;
}

function decodeName(bytes, platformID) {
  if (platformID === 0 || platformID === 3) {
    let s = '';
    for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    return s;
  }
  // 맥 Roman: 이름에 쓰이는 건 거의 ASCII 라 그대로 옮긴다
  return String.fromCharCode(...bytes);
}

// name 표 → { ps, family, familyKo }
export function parseName(bytes) {
  const dv = view(bytes);
  const count = Math.min(dv.getUint16(2), Math.floor((bytes.length - 6) / 12));
  const strOff = dv.getUint16(4);
  const found = {};
  for (let i = 0; i < count; i++) {
    const p = 6 + i * 12;
    const platformID = dv.getUint16(p);
    const languageID = dv.getUint16(p + 4);
    const nameID = dv.getUint16(p + 6);
    if (nameID !== 1 && nameID !== 6 && nameID !== 16) continue;
    const len = dv.getUint16(p + 8);
    const off = dv.getUint16(p + 10);
    if (strOff + off + len > bytes.length) continue;
    const text = decodeName(bytes.subarray(strOff + off, strOff + off + len), platformID).trim();
    if (!text) continue;
    const lang = platformID === 3 ? languageID : platformID === 1 && languageID === 0 ? LANG_EN : -1;
    const key = `${nameID}:${lang === LANG_KO ? 'ko' : lang === LANG_EN ? 'en' : 'other'}`;
    if (!found[key]) found[key] = text;
  }
  const pick = (id, lang) => found[`${id}:${lang}`];
  return {
    ps: pick(6, 'en') || pick(6, 'other') || null,
    family: pick(16, 'en') || pick(1, 'en') || pick(16, 'other') || pick(1, 'other') || null,
    familyKo: pick(16, 'ko') || pick(1, 'ko') || null,
  };
}

// 구간 목록을 정렬하고 겹치거나 붙은 것을 합친다(규격을 어겨 순서가 뒤섞이거나 겹친 cmap 대비)
export function normalizeRanges(arr) {
  const pairs = [];
  for (let i = 0; i + 1 < arr.length; i += 2) if (arr[i] <= arr[i + 1]) pairs.push([arr[i], arr[i + 1]]);
  pairs.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of pairs) {
    if (out.length && out[out.length - 1] + 1 >= a) out[out.length - 1] = Math.max(out[out.length - 1], b);
    else out.push(a, b);
  }
  return out;
}

// cmap 형식 4(BMP) → 글리프가 있는 글자 구간 [시작, 끝, 시작, 끝 …]. 글리프 0(.notdef)은 없는 글자로 센다
// idRangeOffset 0 인 구간은 글자 하나씩 돌지 않고 구간째 넣는다(delta 때문에 글리프 0 이 되는 한 글자만 뺀다)
function ranges4(dv, base) {
  const segX2 = dv.getUint16(base + 6);
  const endP = base + 14;
  const startP = endP + segX2 + 2;
  const deltaP = startP + segX2;
  const rangeP = deltaP + segX2;
  if (rangeP + segX2 > dv.byteLength) throw new Error('cmap 4: 구간 표가 파일보다 길다');
  const out = [];
  for (let s = 0; s < segX2 / 2; s++) {
    const end = Math.min(dv.getUint16(endP + s * 2), 0xfffe);
    const start = dv.getUint16(startP + s * 2);
    const delta = dv.getInt16(deltaP + s * 2);
    const ro = dv.getUint16(rangeP + s * 2);
    if (start > end) continue;
    if (ro === 0) {
      const zero = (0x10000 - delta) & 0xffff; // (c + delta) & 0xffff === 0 이 되는 글자
      if (zero >= start && zero <= end) {
        if (zero > start) out.push(start, zero - 1);
        if (zero < end) out.push(zero + 1, end);
      } else out.push(start, end);
      continue;
    }
    let runStart = -1;
    for (let c = start; c <= end; c++) {
      const gp = rangeP + s * 2 + ro + (c - start) * 2;
      let g = 0;
      if (gp + 2 <= dv.byteLength) {
        g = dv.getUint16(gp);
        if (g !== 0) g = (g + delta) & 0xffff;
      }
      if (g !== 0 && runStart < 0) runStart = c;
      if (g === 0 && runStart >= 0) { out.push(runStart, c - 1); runStart = -1; }
    }
    if (runStart >= 0) out.push(runStart, end);
  }
  return normalizeRanges(out);
}

// cmap 형식 12(전 유니코드) → 구간
function ranges12(dv, base) {
  const n = Math.min(dv.getUint32(base + 12), Math.floor((dv.byteLength - base - 16) / 12));
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = base + 16 + i * 12;
    let start = dv.getUint32(p);
    const end = Math.min(dv.getUint32(p + 4), 0x10ffff);
    const g = dv.getUint32(p + 8);
    if (g === 0) start += 1; // 첫 글자가 .notdef 로 매핑된 구간
    if (start <= end) out.push(start, end);
  }
  return normalizeRanges(out);
}

// cmap 표 → { ranges: Uint32Array | null, symbol: boolean }
// 유니코드 하위 표가 없고 기호(3,0)만 있으면 symbol=true(Wingdings 같은 기호 폰트)
export function parseCmap(bytes) {
  const dv = view(bytes);
  const n = Math.min(dv.getUint16(2), Math.floor((bytes.length - 4) / 8));
  const subs = [];
  for (let i = 0; i < n; i++) {
    const p = 4 + i * 8;
    const platformID = dv.getUint16(p);
    const encodingID = dv.getUint16(p + 2);
    const offset = dv.getUint32(p + 4);
    if (offset + 4 > bytes.length) continue;
    subs.push({ platformID, encodingID, offset, format: dv.getUint16(offset) });
  }
  const rank = (s) => {
    if (s.format === 12 && (s.platformID === 3 && s.encodingID === 10 || s.platformID === 0)) return 0;
    if (s.format === 4 && (s.platformID === 3 && s.encodingID === 1 || s.platformID === 0)) return 1;
    return 9;
  };
  // 좋은 하위 표부터 시도하고, 깨져 있으면 다음 후보로
  for (const sub of subs.filter((x) => rank(x) < 9).sort((x, y) => rank(x) - rank(y))) {
    try {
      const arr = sub.format === 12 ? ranges12(dv, sub.offset) : ranges4(dv, sub.offset);
      return { ranges: Uint32Array.from(arr), symbol: false };
    } catch {
      // 다음 후보
    }
  }
  return { ranges: null, symbol: subs.some((x) => x.platformID === 3 && x.encodingID === 0) };
}

// fvar → 굵기 축 { min, def, max } 또는 null
export function parseFvarWeight(bytes) {
  const dv = view(bytes);
  const axesOff = dv.getUint16(4);
  const count = dv.getUint16(8);
  const size = dv.getUint16(10);
  for (let i = 0; i < count; i++) {
    const p = axesOff + i * size;
    if (p + 16 > bytes.length) break;
    if (tagAt(bytes, p) === 'wght') {
      return { min: dv.getInt32(p + 4) / 65536, def: dv.getInt32(p + 8) / 65536, max: dv.getInt32(p + 12) / 65536 };
    }
  }
  return null;
}

export function hasChar(ranges, cp) {
  if (!ranges) return false;
  let lo = 0;
  let hi = ranges.length / 2 - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < ranges[mid * 2]) hi = mid - 1;
    else if (cp > ranges[mid * 2 + 1]) lo = mid + 1;
    else return true;
  }
  return false;
}

export function countInRange(ranges, first, last) {
  if (!ranges) return 0;
  let n = 0;
  for (let i = 0; i < ranges.length; i += 2) {
    const a = Math.max(ranges[i], first);
    const b = Math.min(ranges[i + 1], last);
    if (b >= a) n += b - a + 1;
  }
  return n;
}

async function faceOffsets(read) {
  const head = await read(0, 12);
  if (tagAt(head, 0) !== 'ttcf') return [0];
  const n = view(head).getUint32(8);
  const list = view(await read(12, n * 4));
  return Array.from({ length: n }, (_, i) => list.getUint32(i * 4));
}

// 파일 안 면들의 포스트스크립트 이름(TTC 면 여러 개, 보통 파일은 하나)
export async function listFaces(read) {
  const out = [];
  for (const off of await faceOffsets(read)) {
    const t = await readTableDir(read, off);
    out.push(t.name ? parseName(await read(t.name.offset, t.name.length)).ps : null);
  }
  return out;
}

// 한 폰트 면의 정보를 읽는다. TTC 면 여러 개 중에선 포스트스크립트 이름(wantPs)이 같은 면.
// read(offset, length) → Promise<Uint8Array>
export async function readFontInfo(read, wantPs) {
  const offsets = await faceOffsets(read);
  if (!offsets.length) throw new Error('면이 없는 TTC');
  let chosen = null;
  for (const off of offsets) {
    const tables = await readTableDir(read, off);
    const names = tables.name ? parseName(await read(tables.name.offset, tables.name.length)) : { ps: null, family: null, familyKo: null };
    const face = { tables, names };
    if (!chosen) chosen = face; // 못 찾으면 첫 면
    if (offsets.length === 1 || !wantPs || names.ps === wantPs) { chosen = face; break; }
  }
  const { tables, names } = chosen;
  const cmap = tables.cmap ? parseCmap(await read(tables.cmap.offset, tables.cmap.length)) : { ranges: null, symbol: false };
  const wght = tables.fvar ? parseFvarWeight(await read(tables.fvar.offset, tables.fvar.length)) : null;
  return {
    ps: names.ps,
    family: names.family,
    familyKo: names.familyKo,
    ranges: cmap.ranges,
    symbol: cmap.symbol,
    hangul: Math.min(HANGUL_TOTAL, countInRange(cmap.ranges, HANGUL_FIRST, HANGUL_LAST)),
    wght,
    faces: offsets.length,
  };
}

// 브라우저: FontData.blob() 을 조각으로 읽는 함수
export function blobReader(blob) {
  return async (offset, length) => new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer());
}
