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
import { Star, Search, Columns3, X, ChevronRight, SearchX } from 'lucide-react';
import { VirtualList } from './VirtualList.jsx';
import { SIZE_MIN, SIZE_MAX } from './store.js';
import { Specimen } from './Specimen.jsx';
import { HANGUL_TOTAL } from './fonts/sfnt.js';
import { missingChars, axisWeight, COMPARE_MAX, COMPARE_MIN, FALLBACK_SAMPLE } from './logic.js';

export function rowHeightFor(size) {
  return Math.round(size * 1.3 + 64);
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

function Row({ fam, info, sample, size, fav, inCompare, onFav, onCompare, onOpen, compareFull, narrow }) {
  const text = sample || FALLBACK_SAMPLE;
  // 한글이 아예 없는 폰트는 '한글 없음' 배지와 흐린 글자로 충분해서, '이 문장 N자 없음'은 한글이 있는 폰트에만
  const miss = info?.ranges && info.hangul > 0 ? missingChars(text, info.ranges) : 0;
  const ko = info?.familyKo && info.familyKo !== fam.family ? info.familyKo : null;
  return (
    <Section variant="transparent" padding={0} dividers={['bottom']} height="100%">
      <VStack height="100%" gap={1} paddingInline={narrow ? 2 : 4} paddingBlock={2} data-testid="row" data-family={fam.family}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center" style={{ minWidth: 0 }}>
            <ToggleButton size="sm" isIconOnly label={fav ? `${fam.family} 즐겨찾기에서 빼기` : `${fam.family} 즐겨찾기`} isPressed={fav}
              icon={<Icon icon={Star} size="sm" />} pressedIcon={<Icon icon={Star} size="sm" style={{ fill: 'currentColor' }} />}
              onPressedChange={() => onFav(fam.key)} data-testid="fav" />
            <CheckboxInput size="sm" label={`${fam.family} 비교에 넣기`} isLabelHidden value={inCompare} onChange={() => onCompare(fam.key)}
              isDisabled={!inCompare && compareFull} disabledMessage={`비교는 ${COMPARE_MAX}개까지예요`} data-testid="cmp" />
            <Text weight="semibold" maxLines={1}>{fam.family}</Text>
            {ko && !narrow && <Text color="secondary" maxLines={1}>{ko}</Text>}
          </HStack>
          <HStack gap={2} vAlign="center" style={{ flexShrink: 0 }}>
            <HangulBadge info={info} />
            {miss > 0 && <Badge variant="warning" label={`이 문장 ${miss}자 없음`} />}
            {!narrow && fam.faces.length > 1 && <Text type="supporting" hasTabularNumbers>스타일 {fam.faces.length}</Text>}
            <Button size="sm" variant="ghost" label={`${fam.family} 자세히`} isIconOnly={narrow}
              icon={narrow ? <Icon icon={ChevronRight} size="sm" /> : undefined}
              endContent={narrow ? undefined : <Icon icon={ChevronRight} size="sm" />}
              onClick={() => onOpen(fam.key)} data-testid="open">자세히</Button>
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

  const header = (
    <LayoutHeader hasDivider padding={3}>
      <VStack gap={3}>
        <HStack gap={3} vAlign="baseline" wrap="wrap">
          <Heading level={3} accessibilityLevel={1}>획</Heading>
          <Text type="supporting" hasTabularNumbers data-testid="summary">
            폰트 {families.length.toLocaleString()}가족 · {faceCount.toLocaleString()}개 스타일
            {inspecting ? ` · 한글 확인 중 ${inspectDone}/${families.length}` : ''}
          </Text>
          {!storageOk && <Badge variant="warning" label="이 창에서만 기억해요" />}
        </HStack>
        <HStack gap={3} vAlign="end" wrap="wrap">
          <VStack style={{ flex: '2 1 320px' }}>
            <TextInput label="내 문장" isLabelHidden={narrow} value={sample} onChange={(v) => setSettings({ sample: v })}
              placeholder={`비우면 기본 문장: ${FALLBACK_SAMPLE}`} data-testid="sample" />
          </VStack>
          <VStack style={{ flex: '1 1 180px' }}>
            <Slider label={`크기 ${size}px`} isLabelHidden={narrow} min={SIZE_MIN} max={SIZE_MAX} value={size} onChange={(v) => setSettings({ size: v })} valueDisplay="none" data-testid="size" />
          </VStack>
        </HStack>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <VStack style={{ flex: '1 1 260px' }} ref={searchRef}>
            <TextInput type="search" label="폰트 이름 찾기" isLabelHidden startIcon={Search} value={query}
              onChange={(v) => setSettings({ query: v })} placeholder="폰트 이름 찾기 (영문·한글, / 키)" data-testid="search" />
          </VStack>
          <SegmentedControl label="거르기" value={filter} onChange={(v) => setSettings({ filter: v })} data-testid="filter">
            <SegmentedControlItem value="all" label={`전체 ${counts.all}`} />
            <SegmentedControlItem value="hangul" label={inspecting ? '한글 …' : `한글 ${counts.hangul}`} />
            <SegmentedControlItem value="fav" label={`즐겨찾기 ${counts.fav}`} />
          </SegmentedControl>
        </HStack>
        <Text type="supporting" data-testid="legend">흐린 글자는 그 폰트에 없어서 브라우저가 다른 글꼴로 대신 그린 거예요.</Text>
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
        <VirtualList ref={listRef} count={shown.length} rowHeight={rowH} label="폰트 목록" testId="list" onVisible={onVisible} getKey={(i) => shown[i].key}
          renderRow={(i) => {
            const fam = shown[i];
            return (
              <Row fam={fam} info={info[fam.key]} sample={sample} size={size} fav={favorites.has(fam.key)} narrow={narrow}
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
      <Layout header={header} content={content} footer={footer} />
    </Section>
  );
}
