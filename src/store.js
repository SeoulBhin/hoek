// 즐겨찾기·내 문장·크기·거르기를 브라우저 저장소에 남긴다.
// 시크릿 창·저장소 차단으로 읽기·쓰기가 막히면 이 창에서만 기억하고(ok=false) 화면은 그대로 돈다.
const KEY = 'hoek:v1';
export const SIZE_MIN = 12;
export const SIZE_MAX = 120;

export const DEFAULTS = {
  favorites: [],
  sample: '다람쥐 헌 쳇바퀴에 타고파 The quick brown fox 0123',
  size: 40,
  filter: 'all',
};

export function createStore(storage = globalThis.localStorage) {
  let ok = true;
  let state = { ...DEFAULTS };
  try {
    const raw = storage.getItem(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === 'object') {
      state = {
        favorites: Array.isArray(saved.favorites) ? saved.favorites.filter((x) => typeof x === 'string') : DEFAULTS.favorites,
        sample: typeof saved.sample === 'string' ? saved.sample : DEFAULTS.sample,
        size: Number.isFinite(saved.size) ? Math.min(SIZE_MAX, Math.max(SIZE_MIN, saved.size)) : DEFAULTS.size,
        filter: ['all', 'hangul', 'fav'].includes(saved.filter) ? saved.filter : DEFAULTS.filter,
      };
    }
  } catch {
    ok = false;
  }
  return {
    get: () => state,
    get ok() { return ok; },
    set(patch) {
      state = { ...state, ...patch };
      try {
        storage.setItem(KEY, JSON.stringify(state));
        ok = true;
      } catch {
        ok = false;
      }
      return state;
    },
  };
}
