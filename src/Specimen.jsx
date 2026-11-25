// 폰트 견본 글자: 그 폰트로 그려야 해서 font-family 를 직접 넣는다(테마 글꼴을 쓰는 Text 대신 일반 요소).
// 등록(local())에 실패한 면은 브라우저 기본 글꼴로 그려지지 않게 흐리게 표시한다.
import { useEffect, useState } from 'react';
import { faceName, faceStatus, onFaceStatus } from './fonts/faces.js';
import { hasChar } from './fonts/sfnt.js';

export function useFaceStatus(ps) {
  const [status, setStatus] = useState(() => (ps ? faceStatus(ps) : 'none'));
  useEffect(() => {
    if (!ps) return undefined;
    faceName(ps);
    setStatus(faceStatus(ps));
    return onFaceStatus((p, s) => { if (p === ps) setStatus(s); });
  }, [ps]);
  return status;
}

// 문장을 '이 폰트에 있는 글자' / '없는 글자(브라우저가 다른 글꼴로 대신 그림)' 구간으로 나눈다
export function splitRuns(text, ranges) {
  if (!ranges) return [{ text, has: true }];
  const runs = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const has = cp <= 0x20 || hasChar(ranges, cp);
    const last = runs[runs.length - 1];
    if (last && last.has === has) last.text += ch;
    else runs.push({ text: ch, has });
  }
  return runs;
}

export function Specimen({ ps, text, size, weight, oneLine = false, testId, style, ranges, placeholder = false }) {
  const status = useFaceStatus(ps);
  const family = faceName(ps);
  const runs = splitRuns(text || ' ', ranges);
  return (
    <p
      data-testid={testId}
      data-face={ps}
      data-status={status}
      lang="ko"
      style={{
        margin: 0,
        fontFamily: `"${family}"`,
        fontSize: size,
        lineHeight: 1.3,
        color: placeholder ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
        opacity: status === 'error' ? 0.25 : 1,
        whiteSpace: oneLine ? 'nowrap' : 'pre-wrap',
        overflow: oneLine ? 'hidden' : 'visible',
        textOverflow: oneLine ? 'ellipsis' : 'clip',
        overflowWrap: 'anywhere',
        fontSynthesis: 'none',
        ...(weight ? { fontVariationSettings: `'wght' ${weight}` } : null),
        ...style,
      }}
    >
      {runs.map((r, i) => (r.has ? r.text : (
        <span key={i} data-missing="1" title="이 폰트에 없는 글자라 다른 글꼴로 대신 그려요" style={{ opacity: 0.28 }}>{r.text}</span>
      )))}
    </p>
  );
}
