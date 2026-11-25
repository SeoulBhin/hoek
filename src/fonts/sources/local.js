// 출처 1: 방문자 PC 에 깔린 폰트(Local Font Access). Chrome·Edge 데스크톱만 된다.
// 폰트 파일은 이 브라우저 안에서만 조각으로 읽고 어디로도 보내지 않는다.
// 다음 단계의 '직접 만든 폰트' 출처(made.js)도 같은 모양 — groupFamilies 결과 + inspect(family) — 을 낸다.
import { groupFamilies } from '../../logic.js';
import { readFontInfo, blobReader } from '../sfnt.js';

export function isSupported() {
  return typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function';
}

// 'granted' | 'prompt' | 'denied' | 'unknown'
export async function permissionState() {
  try {
    const s = await navigator.permissions.query({ name: 'local-fonts' });
    return s.state;
  } catch {
    return 'unknown';
  }
}

// 성공: { families, faceCount, ms }. 실패: Error(code = 'denied' | 'empty' | 'failed')
// 허락이 안 되면 Chrome 은 오류 대신 빈 배열을 준다(2026-11-25 실측) → 빈 배열도 'denied' 로 본다
let fontData = new Map();
export async function loadLocal() {
  const t0 = performance.now();
  let list;
  try {
    list = await window.queryLocalFonts();
  } catch (e) {
    const err = new Error(e?.message || 'queryLocalFonts failed');
    err.code = e?.name === 'SecurityError' || e?.name === 'NotAllowedError' ? 'denied' : 'failed';
    throw err;
  }
  if (!list.length) {
    const err = new Error('no fonts returned');
    err.code = (await permissionState()) === 'granted' ? 'empty' : 'denied';
    throw err;
  }
  fontData = new Map(list.map((f) => [f.postscriptName, f]));
  const families = groupFamilies(list, 'local');
  return { families, faceCount: list.length, ms: Math.round(performance.now() - t0) };
}

// 가족의 대표 면 파일을 조각으로 읽어 한글 글자 수·한국어 이름·글자 목록·굵기 축
export async function inspect(family) {
  const fd = fontData.get(family.rep.ps);
  if (!fd) return null;
  const blob = await fd.blob();
  return readFontInfo(blobReader(blob), family.rep.ps);
}
