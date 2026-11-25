// 면 하나를 CSS 에서 쓸 이름으로 등록한다: FontFace("hoek-N", local("포스트스크립트 이름")).
// 설치된 폰트를 이름으로 가리키기만 해서 파일을 옮기지 않는다. local() 이 정확히 그 굵기 면을 고르는 건
// 2026-11-25 Chrome 에서 실측(맑은 고딕 보통·굵게·세미라이트 폭이 서로 다름).
// 화면에 보이는 줄만 등록하고, 한 번 등록한 건 다시 안 한다. 등록 실패(그 이름의 면을 못 찾음)는 'error'.
const registry = new Map(); // ps → { name, status, promise }
let seq = 0;
const listeners = new Set();

function cssEscape(s) {
  return s.replace(/["\\]/g, '\\$&');
}

export function onFaceStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ps → CSS font-family 이름(등록은 비동기로 시작)
export function faceName(ps) {
  let r = registry.get(ps);
  if (r) return r.name;
  const name = `hoek-${++seq}`;
  r = { name, status: 'loading' };
  registry.set(ps, r);
  try {
    const ff = new FontFace(name, `local("${cssEscape(ps)}")`);
    document.fonts.add(ff);
    r.promise = ff.load().then(
      () => { r.status = 'loaded'; },
      () => { r.status = 'error'; },
    ).then(() => listeners.forEach((fn) => fn(ps, r.status)));
  } catch {
    r.status = 'error';
  }
  return name;
}

export function faceStatus(ps) {
  return registry.get(ps)?.status ?? 'none';
}

// 다음 단계(직접 만든 폰트): 파일 바이트로 등록할 때 같은 표를 쓴다
export function registerBuffer(key, buffer) {
  const name = `hoek-${++seq}`;
  const ff = new FontFace(name, buffer);
  document.fonts.add(ff);
  const r = { name, status: 'loading' };
  registry.set(key, r);
  r.promise = ff.load().then(() => { r.status = 'loaded'; }, () => { r.status = 'error'; });
  return name;
}

// CSS font-family 값. 마지막에 아무것도 안 붙여서 빈 글자는 브라우저 기본 글꼴로 대신 그려진다
// (그래서 목록에 '이 문장 N자 없음'을 따로 보여 준다)
export function fontStack(ps) {
  return `"${faceName(ps)}"`;
}
