// 가족마다 대표 면 파일을 조각으로 읽어 한글 글자 수·한국어 이름·글자 목록을 채운다.
// 목록은 판별 전에도 바로 쓸 수 있고, 판별은 뒤에서 동시에 2개씩 돈다. 화면에 보이는 가족을 먼저 읽는다.
// 결과는 100ms 마다 한 번 모아서 화면에 반영(가족 수백 개를 하나씩 다시 그리지 않게)
import { useEffect, useRef, useState, useCallback } from 'react';

const CONCURRENCY = 2;

export function useInspect(families, inspect) {
  const [info, setInfo] = useState({});
  const [done, setDone] = useState(0);
  const [ms, setMs] = useState(null);
  const ref = useRef({ queue: [], pending: {}, started: new Set(), urgent: [] });

  const prioritize = useCallback((keys) => {
    ref.current.urgent = keys;
  }, []);

  useEffect(() => {
    if (!families.length) return undefined;
    let alive = true;
    const st = { queue: families.slice(), pending: {}, started: new Set(), urgent: [] };
    ref.current = st;
    const byKey = new Map(families.map((f) => [f.key, f]));
    const t0 = performance.now();
    let finished = 0;

    const flush = setInterval(() => {
      if (!alive) return;
      const batch = st.pending;
      if (Object.keys(batch).length) {
        st.pending = {};
        setInfo((prev) => ({ ...prev, ...batch }));
        setDone(finished);
      }
    }, 100);

    const next = () => {
      while (st.urgent.length) {
        const f = byKey.get(st.urgent.shift());
        if (f && !st.started.has(f.key)) return f;
      }
      while (st.queue.length) {
        const f = st.queue.shift();
        if (!st.started.has(f.key)) return f;
      }
      return null;
    };

    const worker = async () => {
      for (let f = next(); f && alive; f = next()) {
        st.started.add(f.key);
        try {
          const r = await inspect(f);
          st.pending[f.key] = r || { error: true };
        } catch (e) {
          st.pending[f.key] = { error: String(e?.message || e) };
        }
        finished += 1;
        if (finished === families.length) setMs(Math.round(performance.now() - t0));
      }
    };
    Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
      if (!alive) return;
      // 묶음을 먼저 꺼내 둔다. 갱신 함수 안에서 st.pending 을 읽으면, React 가 그 함수를 부르기 전에
      // 아래 줄이 비워 버려서 마지막 묶음이 사라진다(11-26 e2e 에서 알파벳 끝 가족 7개가 판별 없음으로 남던 버그)
      const last = st.pending;
      st.pending = {};
      setInfo((prev) => ({ ...prev, ...last }));
      setDone(finished);
    });
    return () => {
      alive = false;
      clearInterval(flush);
    };
  }, [families, inspect]);

  return { info, done, total: families.length, ms, prioritize };
}
