// 목록 화면: 위 도구 줄(내 문장·크기·검색·거르기) + 가족 목록(보이는 줄만) + 아래 비교 트레이
// Astryx Layout 은 머리·본문·바닥을 header/content/footer 슬롯으로 받는다(자식으로 넣으면 셋 다 본문 칸에 들어가
// 목록이 머리 높이만큼 화면 밖으로 밀리고 트레이가 안 보였다 — 디자인 리뷰에서 찾음)
import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { VStack, HStack, LayoutHeader, LayoutContent, LayoutFooter, Layout } from '@astryxdesign/core/Layout';
import { Section } from '@astryxdesign/core/Section';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Slider } from '@astryxdesign/core/Slider';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Badge } from '@astryxdesign/core/Badge';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { InfoTip } from '@astryxdesign/core/InfoTip';
import { Star, Search, Columns3, X, ChevronRight, SearchX } from 'lucide-react';
import { VirtualList } from './VirtualList.jsx';
import { PAGE_WIDTH } from './frame.js';
import { SIZE_MIN, SIZE_MAX } from './store.js';
import { Specimen } from './Specimen.jsx';
import { HANGUL_TOTAL } from './fonts/sfnt.js';
import { missingChars, axisWeight, COMPARE_MAX, COMPARE_MIN, FALLBACK_SAMPLE } from './logic.js';

export function rowHeightFor(size) {
  return Math.round(size * 1.3 + 56);
}

export function useNarrow(px = 640) {
  const q = `(max-width: ${px}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return narrow;
}

export function HangulBadge({ info }) {
  if (!info) return <Badge label="확인 중" />;
  if (info.error) return <Badge label="못 읽음" />;
  if (info.symbol) return <Badge label="기호 폰트" />;
  if (info.hangul === HANGUL_TOTAL) return <Badge variant="success" label="한글" />;
  if (info.hangul > 0) return <Badge variant="warning" label={`한글 ${(HANGUL_TOTAL - info.hangul).toLocaleString()}자 없음`} />;
  return <Badge label="한글 없음" />;
}

// 마우스가 있는 화면에서만 줄 동작(별·비교·자세히)을 올렸을 때 보인다. 터치 화면은 늘 보인다.
// 켜 둔 별·비교는 내려놔도 보인다. 숨길 때도 투명도만 바꿔서 Tab 으로 닿으면 그대로 보인다
function useCanHover() {
  const [can] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  return can;
}

function Row({ fam, info, sample, size, fav, inCompare, onFav, onCompare, onOpen, compareFull, narrow, canHover }) {
  const [hot, setHot] = useState(false);
  const text = sample || FALLBACK_SAMPLE;
  // 한글이 아예 없는 폰트는 '한글 없음' 배지와 흐린 글자로 충분해서, '이 문장 N자 없음'은 한글이 있는 폰트에만
  const miss = info?.ranges && info.hangul > 0 ? missingChars(text, info.ranges) : 0;
  const ko = info?.familyKo && info.familyKo !== fam.family ? info.familyKo : null;
  const show = (on) => ({ opacity: !canHover || hot || on ? 1 : 0, transition: 'opacity var(--duration-fast) ease-out' });
  return (
    <Section variant="transparent" padding={0} dividers={['bottom']} height="100%">
      <VStack height="100%" gap={1} paddingInline={narrow ? 2 : 3} paddingBlock={2} vAlign="center"
        data-testid="row" data-family={fam.family}
        onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}
        onFocus={() => setHot(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHot(false); }}
        style={{ background: hot && canHover ? 'color-mix(in srgb, var(--color-background-muted) 45%, transparent)' : undefined, transition: 'background var(--duration-fast) ease-out' }}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center" style={{ minWidth: 0 }}>
            <Text weight="semibold" maxLines={1}>{fam.family}</Text>
            {ko && !narrow && <Text color="secondary" maxLines={1}>{ko}</Text>}
            {!narrow && fam.faces.length > 1 && <Text type="supporting" hasTabularNumbers style={{ flexShrink: 0 }}>스타일 {fam.faces.length}</Text>}
            <HangulBadge info={info} />
            {miss > 0 && <Badge variant="warning" label={`이 문장 ${miss}자 없음`} />}
          </HStack>
          <HStack gap={1} vAlign="center" style={{ flexShrink: 0 }}>
            <HStack style={show(fav)}>
              <ToggleButton isIconOnly label={fav ? `${fam.family} 즐겨찾기에서 빼기` : `${fam.family} 즐겨찾기`} isPressed={fav}
                icon={<Icon icon={Star} size="sm" />} pressedIcon={<Icon icon={Star} size="sm" style={{ fill: 'currentColor' }} />}
                onPressedChange={() => onFav(fam.key)} data-testid="fav" />
            </HStack>
            <HStack paddingInline={1} style={show(inCompare)}>
              <CheckboxInput label="비교" value={inCompare} onChange={() => onCompare(fam.key)}
                isDisabled={!inCompare && compareFull} disabledMessage={`비교는 ${COMPARE_MAX}개까지예요`} data-testid="cmp" />
            </HStack>
            <HStack style={show(false)}>
              <Button variant="ghost" isIconOnly label={`${fam.family} 자세히`}
                icon={<Icon icon={ChevronRight} size="sm" />} onClick={() => onOpen(fam.key)} data-testid="open" />
            </HStack>
          </HStack>
        </HStack>
        <Specimen ps={fam.rep.ps} text={text} size={size} oneLine testId="preview" ranges={info?.ranges} placeholder={!sample} weight={axisWeight(info, fam.rep.weight)} />
      </VStack>
    </Section>
  );
}

export function Browse({
  families, shown, counts, info, inspectDone, settings, setSettings, favorites, toggleFav,
  compare, onCompare, compareFull, clearCompare, onOpen, onShowCompare, prioritize, storageOk, faceCount, hidden,
}) {
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const narrow = useNarrow();
  const canHover = useCanHover();
  const { sample, size, filter, query } = settings;
  const rowH = rowHeightFor(size);

  useEffect(() => {
    const onKey = (e) => {
      if (hidden) return;
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden]);

  useEffect(() => { listRef.current?.scrollToTop(); }, [filter, query]);

  const onVisible = useCallback((a, b) => prioritize(shown.slice(a, b + 1).map((f) => f.key)), [shown, prioritize]);

  const byKey = useMemo(() => new Map(families.map((f) => [f.key, f])), [families]);
  const inspecting = inspectDone < families.length;

  // 머리: 윗줄은 이름·요약(나중에 '만들기' 화면이 붙으면 여기에 화면 전환이 들어간다)과 찾기·거르기,
  // 아랫줄은 미리보기 문장과 크기. 예전엔 세 줄 + 설명 한 줄이라 화면 1/4을 먹었다
  const header = (
    <LayoutHeader hasDivider paddingBlockEnd={3}>
      <VStack gap={3}>
        <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
          <HStack gap={2} vAlign="baseline" style={{ minWidth: 0 }}>
            <Heading level={3} accessibilityLevel={1}>획</Heading>
            <Text type="supporting" hasTabularNumbers data-testid="summary" maxLines={1}>
              {families.length.toLocaleString()}가족 · {faceCount.toLocaleString()}스타일
              {inspecting ? ` · 한글 확인 중 ${inspectDone}/${families.length}` : ''}
            </Text>
            {!storageOk && <Badge variant="warning" label="이 창에서만 기억해요" />}
          </HStack>
          <HStack gap={2} vAlign="center" wrap="wrap" style={{ flex: narrow ? '1 1 100%' : '0 1 auto' }}>
            <VStack style={{ flex: '1 1 220px', minWidth: 180 }} ref={searchRef}>
              <TextInput type="search" label="폰트 이름 찾기" isLabelHidden startIcon={Search} value={query} size="sm"
                onChange={(v) => setSettings({ query: v })} placeholder="폰트 찾기 ( / )" data-testid="search" />
            </VStack>
            <SegmentedControl label="거르기" size="sm" value={filter} onChange={(v) => setSettings({ filter: v })} data-testid="filter">
              <SegmentedControlItem value="all" label={`전체 ${counts.all}`} />
              <SegmentedControlItem value="hangul" label={inspecting ? '한글 …' : `한글 ${counts.hangul}`} />
              <SegmentedControlItem value="fav" label={`즐겨찾기 ${counts.fav}`} />
            </SegmentedControl>
          </HStack>
        </HStack>
        <HStack gap={4} vAlign="center" wrap="wrap">
          <HStack gap={1} vAlign="center" style={{ flex: '1 1 320px' }}>
            <VStack style={{ flex: 1 }}>
              <TextInput label="내 문장" isLabelHidden value={sample} onChange={(v) => setSettings({ sample: v })}
                placeholder={`미리 볼 문장 (비우면: ${FALLBACK_SAMPLE})`} data-testid="sample" />
            </VStack>
            <InfoTip label="흐린 글자" content="흐린 글자는 그 폰트에 없어서 브라우저가 다른 글꼴로 대신 그린 거예요." data-testid="legend" />
          </HStack>
          <HStack gap={2} vAlign="center" style={{ flex: '0 1 240px', minWidth: 180 }}>
            <Text type="supporting" hasTabularNumbers style={{ flexShrink: 0, minWidth: 44 }}>{size}px</Text>
            <VStack style={{ flex: 1 }}>
              <Slider label="크기" isLabelHidden min={SIZE_MIN} max={SIZE_MAX} value={size} onChange={(v) => setSettings({ size: v })} valueDisplay="none" data-testid="size" />
            </VStack>
          </HStack>
        </HStack>
      </VStack>
    </LayoutHeader>
  );

  const emptyTitle = filter === 'fav' && !query ? '아직 즐겨찾기한 폰트가 없어요'
    : filter === 'hangul' && inspecting ? '한글을 확인하는 중이에요' : '맞는 폰트가 없어요';
  const emptyDesc = filter === 'fav' && !query ? '목록에서 별을 누르면 여기 모여요. 다음에 와도 남아 있어요.'
    : filter === 'all' ? '이름 철자를 확인해 보세요. 영문 이름과 한글 이름 둘 다 찾아요.'
      : '이름을 줄여 보거나 거르기를 “전체”로 바꿔 보세요.';

  const content = (
    <LayoutContent padding={0}>
      {shown.length ? (
        <VirtualList ref={listRef} count={shown.length} rowHeight={rowH} label="폰트 목록" testId="list" innerWidth={PAGE_WIDTH} onVisible={onVisible} getKey={(i) => shown[i].key}
          renderRow={(i) => {
            const fam = shown[i];
            return (
              <Row fam={fam} info={info[fam.key]} sample={sample} size={size} fav={favorites.has(fam.key)} narrow={narrow} canHover={canHover}
                inCompare={compare.includes(fam.key)} compareFull={compareFull} onFav={toggleFav} onCompare={onCompare} onOpen={onOpen} />
            );
          }} />
      ) : (
        <VStack height="100%" hAlign="center" vAlign="center" padding={6} data-testid="empty">
          <EmptyState icon={<Icon icon={filter === 'fav' ? Star : SearchX} size="lg" color="secondary" />} title={emptyTitle} description={emptyDesc}
            actions={(query || filter !== 'all') && <Button label="전체 보기" onClick={() => setSettings({ query: '', filter: 'all' })} />} />
        </VStack>
      )}
    </LayoutContent>
  );

  const footer = compare.length > 0 ? (
    <LayoutFooter hasDivider padding={3}>
      <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap" data-testid="tray">
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label" hasTabularNumbers>비교 {compare.length}/{COMPARE_MAX}</Text>
          {compare.map((k) => (
            <Button key={k} size="sm" variant="secondary" label={`${byKey.get(k)?.family || k} 비교에서 빼기`} endContent={<Icon icon={X} size="sm" />}
              onClick={() => onCompare(k)} data-testid="tray-item">{byKey.get(k)?.family || k}</Button>
          ))}
          {compare.length < COMPARE_MIN && <Text type="supporting">하나 더 고르면 나란히 볼 수 있어요</Text>}
        </HStack>
        <HStack gap={2}>
          <Button variant="ghost" size="sm" label="비우기" onClick={clearCompare} />
          <Button variant="primary" label="나란히 비교" icon={<Icon icon={Columns3} />} isDisabled={compare.length < COMPARE_MIN}
            onClick={onShowCompare} data-testid="show-compare" />
        </HStack>
      </HStack>
    </LayoutFooter>
  ) : undefined;

  return (
    <Section variant="section" padding={0} height="100vh" style={hidden ? { display: 'none' } : undefined}>
      <Layout contentWidth={PAGE_WIDTH} padding={narrow ? 2 : 4} header={header} content={content} footer={footer} />
    </Section>
  );
}
