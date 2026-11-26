// 보이는 줄만 그리는 목록(가족 수백 개, 글자표 11,172칸). 줄 높이는 모두 같다.
// 줄의 위치를 정하는 바깥 틀만 일반 요소로 두고, 줄 안은 Astryx 컴포넌트로 그린다.
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const OVERSCAN = 4;

export const VirtualList = forwardRef(function VirtualList(
  { count, rowHeight, renderRow, onVisible, label, testId, getKey, innerWidth },
  ref,
) {
  const box = useRef(null);
  const [view, setView] = useState({ top: 0, height: 800 });

  useImperativeHandle(ref, () => ({
    scrollToTop: () => { if (box.current) box.current.scrollTop = 0; },
    element: () => box.current,
  }));

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setView({ top: el.scrollTop, height: el.clientHeight }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const first = Math.max(0, Math.floor(view.top / rowHeight) - OVERSCAN);
  const last = Math.min(count - 1, Math.ceil((view.top + view.height) / rowHeight) + OVERSCAN);

  useEffect(() => {
    if (onVisible && count) onVisible(first, last);
  }, [first, last, count, onVisible]);

  const rows = [];
  for (let i = first; i <= last; i++) {
    rows.push(
      <div key={getKey ? getKey(i) : i} role="listitem" aria-setsize={count} aria-posinset={i + 1} style={{ position: 'absolute', top: i * rowHeight, left: 0, right: 0, height: rowHeight }}>
        {renderRow(i)}
      </div>,
    );
  }
  return (
    <div ref={box} role="list" aria-label={label} data-testid={testId} data-count={count} tabIndex={-1}
      style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain', position: 'relative' }}>
      {/* 스크롤 막대는 화면 끝에 두고 줄만 가운데 폭으로 모은다 */}
      <div style={{ height: count * rowHeight, position: 'relative', maxWidth: innerWidth, marginInline: 'auto' }}>{rows}</div>
    </div>
  );
});
