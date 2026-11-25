// 획: 화면 흐름
//  미지원 브라우저 → 안내 / 처음 → 안내 + 버튼(사용자 클릭 안에서 허락 요청) / 이미 허락 → 바로 목록
//  거절 → 다시 허락받는 법 / 목록 ⇄ 상세 ⇄ 나란히 비교 (목록은 숨겨 둔 채 남겨서 스크롤 위치 유지)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { hoekTheme } from './theme.js';
import { Intro, Unsupported, Denied, Loading } from './Gate.jsx';
import { Browse } from './Browse.jsx';
import { Detail } from './Detail.jsx';
import { Compare } from './Compare.jsx';
import { useInspect } from './useInspect.js';
import { createStore } from './store.js';
import { filterFamilies, toggleCompare, COMPARE_MAX } from './logic.js';
import { HANGUL_TOTAL } from './fonts/sfnt.js';
import * as local from './fonts/sources/local.js';

export function App() {
  const store = useRef(null);
  if (!store.current) store.current = createStore(safeStorage());
  const [stage, setStage] = useState('boot'); // boot | unsupported | intro | loading | denied | ready
  const [errCode, setErrCode] = useState('denied');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState({ families: [], faceCount: 0 });
  const [saved, setSaved] = useState(() => store.current.get());
  const [query, setQuery] = useState('');
  const [compare, setCompare] = useState([]);
  const [view, setView] = useState({ name: 'list', key: null });

  const load = useCallback(async () => {
    setBusy(true);
    setStage('loading');
    try {
      const r = await local.loadLocal();
      setData({ families: r.families, faceCount: r.faceCount });
      setStage('ready');
    } catch (e) {
      setErrCode(e.code || 'failed');
      setStage('denied');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!local.isSupported()) { setStage('unsupported'); return; }
    local.permissionState().then((s) => {
      if (s === 'granted') load();
      else if (s === 'denied') { setErrCode('denied'); setStage('denied'); }
      else setStage('intro');
    });
  }, [load]);

  const { info, done, ms, prioritize } = useInspect(data.families, local.inspect);

  // 시험(e2e)이 읽는 요약: 가족 이름·대표 면·한글 글자 수·판별 시간(폰트 파일 내용은 없음).
  // 주소에 ?e2e 가 있을 때만 만든다 — 같은 출처(같은 github.io)의 다른 페이지가 이걸 읽지 못하게(코드 리뷰 1번)
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('e2e')) return;
    window.__hoek = {
      done,
      ms,
      families: data.families.map((f) => ({ key: f.key, family: f.family, rep: f.rep.ps, faces: f.faces.length })),
      errors: Object.fromEntries(Object.entries(info).filter(([, v]) => v.error).map(([k, v]) => [k, v.error])),
      hangul: Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.symbol ? null : v.hangul ?? null])),
    };
  }, [data.families, info, done, ms]);

  const settings = { ...saved, query };
  const setSettings = useCallback((patch) => {
    if ('query' in patch) setQuery(patch.query);
    const { query: _q, ...rest } = patch;
    if (Object.keys(rest).length) setSaved(store.current.set(rest));
  }, []);

  const favorites = useMemo(() => new Set(saved.favorites), [saved.favorites]);
  const toggleFav = useCallback((key) => {
    const cur = store.current.get().favorites;
    setSaved(store.current.set({ favorites: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }));
  }, []);
  const onCompare = useCallback((key) => setCompare((list) => toggleCompare(list, key).list), []);

  const shown = useMemo(
    () => filterFamilies(data.families, { query, filter: saved.filter, favorites, info }),
    [data.families, query, saved.filter, favorites, info],
  );
  const counts = useMemo(() => ({
    all: data.families.length,
    hangul: data.families.filter((f) => info[f.key]?.hangul === HANGUL_TOTAL).length,
    fav: data.families.filter((f) => favorites.has(f.key)).length,
  }), [data.families, info, favorites]);
  const byKey = useMemo(() => new Map(data.families.map((f) => [f.key, f])), [data.families]);
  const back = useCallback(() => setView({ name: 'list', key: null }), []);

  // 목록·상세·비교는 화면 높이에 맞춰 안쪽만 스크롤한다. 바깥 창이 밀려 있으면 다음 화면 머리가 가려져서
  // (e2e 캡처에서 비교 화면 위쪽이 잘려 보임) 바깥 스크롤을 막고 화면이 바뀔 때마다 맨 위로
  useEffect(() => {
    const el = document.documentElement;
    el.style.overflow = stage === 'ready' ? 'hidden' : '';
    window.scrollTo(0, 0);
  }, [stage, view.name, view.key]);

  let screen = null;
  if (stage === 'unsupported') screen = <Unsupported />;
  else if (stage === 'intro') screen = <Intro onStart={load} busy={busy} />;
  else if (stage === 'loading') screen = <Loading />;
  else if (stage === 'denied') screen = <Denied onRetry={load} busy={busy} code={errCode} />;
  else if (stage === 'ready') {
    const fam = view.key && byKey.get(view.key);
    screen = (
      <>
        <Browse families={data.families} shown={shown} counts={counts} info={info} inspectDone={done}
          settings={settings} setSettings={setSettings} favorites={favorites} toggleFav={toggleFav}
          compare={compare} onCompare={onCompare} compareFull={compare.length >= COMPARE_MAX} clearCompare={() => setCompare([])}
          onOpen={(key) => setView({ name: 'detail', key })} onShowCompare={() => setView({ name: 'compare', key: null })}
          prioritize={prioritize} storageOk={store.current.ok} faceCount={data.faceCount} hidden={view.name !== 'list'} />
        {view.name === 'detail' && fam && (
          <Detail fam={fam} info={info[fam.key]} sample={saved.sample} size={saved.size} fav={favorites.has(fam.key)} onFav={toggleFav}
            inCompare={compare.includes(fam.key)} onCompare={onCompare} compareFull={compare.length >= COMPARE_MAX} onBack={back} />
        )}
        {view.name === 'compare' && (
          <Compare fams={compare.map((k) => byKey.get(k)).filter(Boolean)} info={info} settings={settings} setSettings={setSettings}
            onRemove={(k) => { const next = compare.filter((x) => x !== k); setCompare(next); if (next.length < 2) back(); }}
            onBack={back} onOpen={(key) => setView({ name: 'detail', key })} />
        )}
      </>
    );
  }
  return <Theme theme={hoekTheme}>{screen}</Theme>;
}

// localStorage 접근 자체가 throw 하는 환경(쿠키 차단 등)에서도 createStore 가 받게
function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  }
}
