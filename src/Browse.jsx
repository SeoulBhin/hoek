// 목록 화면: 위 도구 줄(내 문장·크기·검색·거르기) + 가족 목록(보이는 줄만) + 아래 비교 트레이
import { useCallback, useMemo, useRef, useEffect } from 'react';
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
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Star, Search, Columns3, X, ChevronRight, SearchX } from 'lucide-react';
import { VirtualList } from './VirtualList.jsx';
import { Specimen } from './Specimen.jsx';
import { HANGUL_TOTAL } from './fonts/sfnt.js';
import { missingChars, COMPARE_MAX, COMPARE_MIN } from './logic.js';

export function rowHeightFor(size) {
  return Math.round(size * 1.3 + 64);
}

export function HangulBadge({ info }) {
  if (!info) return <Badge label="확인 중" />;
  if (info.error) return <Badge label="못 읽음" />;
  if (info.symbol) return <Badge label="기호 폰트" />;
  if (info.hangul === HANGUL_TOTAL) return <Badge variant="success" label="한글" />;
  if (info.hangul > 0) return <Badge variant="warning" label={`한글 ${(HANGUL_TOTAL - info.hangul).toLocaleString()}자 없음`} />;
  return null;
}

function Row({ fam, info, sample, size, fav, inCompare, onFav, onCompare, onOpen, compareFull }) {
  const miss = info?.ranges ? missingChars(sample, info.ranges) : null;
  const ko = info?.familyKo && info.familyKo !== fam.family ? info.familyKo : null;
  return (
    <Section variant="transparent" padding={0} dividers={['bottom']} height="100%">
      <VStack height="100%" gap={1} paddingInline={4} paddingBlock={2} data-testid="row" data-family={fam.family}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center" style={{ minWidth: 0 }}>
            <ToggleButton size="sm" isIconOnly label={fav ? '즐겨찾기에서 빼기' : '즐겨찾기'} isPressed={fav}
              icon={<Icon icon={Star} size="sm" />} pressedIcon={<Icon icon={Star} size="sm" style={{ fill: 'currentColor' }} />}
              onPressedChange={() => onFav(fam.key)} data-testid="fav" />
            <CheckboxInput size="sm" label="비교" value={inCompare} onChange={() => onCompare(fam.key)}
              isDisabled={!inCompare && compareFull} disabledMessage={`비교는 ${COMPARE_MAX}개까지예요`} data-testid="cmp" />
            <Text weight="semibold" maxLines={1}>{fam.family}</Text>
            {ko && <Text color="secondary" maxLines={1}>{ko}</Text>}
          </HStack>
          <HStack gap={2} vAlign="center" style={{ flexShrink: 0 }}>
            <HangulBadge info={info} />
            {miss > 0 && <Badge variant="neutral" label={`이 문장 ${miss}자 없음`} />}
            <Text type="supporting" hasTabularNumbers>{fam.faces.length > 1 ? `스타일 ${fam.faces.length}` : ''}</Text>
            <Button size="sm" variant="ghost" label="자세히" icon={<Icon icon={ChevronRight} size="sm" />} onClick={() => onOpen(fam.key)} data-testid="open" />
          </HStack>
        </HStack>
        <Specimen ps={fam.rep.ps} text={sample} size={size} oneLine testId="preview" ranges={info?.ranges} />
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

  return (
    <Section variant="section" padding={0} height="100vh" style={hidden ? { display: 'none' } : undefined}>
      <Layout>
        <LayoutHeader hasDivider padding={3}>
          <VStack gap={3}>
            <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
              <HStack gap={3} vAlign="center">
                <Heading level={4} accessibilityLevel={1}>획</Heading>
                <Text type="supporting" hasTabularNumbers data-testid="summary">폰트 {families.length.toLocaleString()}가족 · {faceCount.toLocaleString()}개 스타일</Text>
              </HStack>
              <HStack gap={2} vAlign="center">
                {inspecting && (
                  <HStack gap={2} vAlign="center" width={220} data-testid="inspecting">
                    <Text type="supporting" hasTabularNumbers>한글 확인 {inspectDone}/{families.length}</Text>
                    <ProgressBar label="한글 확인" isLabelHidden value={inspectDone} max={families.length} variant="neutral" />
                  </HStack>
                )}
                {!storageOk && <Badge variant="warning" label="이 창에서만 기억해요" />}
              </HStack>
            </HStack>
            <HStack gap={3} vAlign="end" wrap="wrap">
              <VStack style={{ flex: '2 1 320px' }}>
                <TextInput label="내 문장" value={sample} onChange={(v) => setSettings({ sample: v })} placeholder="여기에 쓴 문장으로 모든 폰트를 봐요" data-testid="sample" />
              </VStack>
              <VStack style={{ flex: '1 1 180px' }}>
                <Slider label={`크기 ${size}px`} min={12} max={120} value={size} onChange={(v) => setSettings({ size: v })} valueDisplay="none" data-testid="size" />
              </VStack>
            </HStack>
            <HStack gap={3} vAlign="center" wrap="wrap">
              <VStack style={{ flex: '1 1 260px' }} ref={searchRef}>
                <TextInput type="search" label="폰트 이름 찾기" isLabelHidden startIcon={Search} value={query}
                  onChange={(v) => setSettings({ query: v })} placeholder="폰트 이름 찾기 (영문·한글, / 키)" data-testid="search" />
              </VStack>
              <SegmentedControl label="거르기" value={filter} onChange={(v) => setSettings({ filter: v })} data-testid="filter">
                <SegmentedControlItem value="all" label={`전체 ${counts.all}`} />
                <SegmentedControlItem value="hangul" label={`한글 ${counts.hangul}${inspecting ? '+' : ''}`} />
                <SegmentedControlItem value="fav" label={`즐겨찾기 ${counts.fav}`} />
              </SegmentedControl>
            </HStack>
          </VStack>
        </LayoutHeader>
        <LayoutContent padding={0}>
          {shown.length ? (
            <VirtualList ref={listRef} count={shown.length} rowHeight={rowH} label="폰트 목록" testId="list" onVisible={onVisible}
              renderRow={(i) => {
                const fam = shown[i];
                return (
                  <Row fam={fam} info={info[fam.key]} sample={sample} size={size} fav={favorites.has(fam.key)}
                    inCompare={compare.includes(fam.key)} compareFull={compareFull} onFav={toggleFav} onCompare={onCompare} onOpen={onOpen} />
                );
              }} />
          ) : (
            <VStack height="100%" hAlign="center" vAlign="center" padding={6} data-testid="empty">
              <EmptyState icon={<Icon icon={filter === 'fav' ? Star : SearchX} size="lg" color="secondary" />}
                title={filter === 'fav' && !query ? '아직 즐겨찾기한 폰트가 없어요' : filter === 'hangul' && inspecting ? '한글을 확인하는 중이에요' : '맞는 폰트가 없어요'}
                description={filter === 'fav' && !query ? '목록에서 별을 누르면 여기 모여요. 다음에 와도 남아 있어요.' : '이름을 줄여 보거나 거르기를 “전체”로 바꿔 보세요.'}
                actions={(query || filter !== 'all') && <Button label="전체 보기" onClick={() => setSettings({ query: '', filter: 'all' })} />} />
            </VStack>
          )}
        </LayoutContent>
        {compare.length > 0 && (
          <LayoutFooter hasDivider padding={3}>
            <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap" data-testid="tray">
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="label" hasTabularNumbers>비교 {compare.length}/{COMPARE_MAX}</Text>
                {compare.map((k) => (
                  <Button key={k} size="sm" variant="secondary" label={byKey.get(k)?.family || k} icon={<Icon icon={X} size="sm" />}
                    tooltip="비교에서 빼기" onClick={() => onCompare(k)} data-testid="tray-item" />
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
        )}
      </Layout>
    </Section>
  );
}
