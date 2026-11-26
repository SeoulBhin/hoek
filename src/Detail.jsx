// 상세: 한 가족의 굵기별 모양 + 글자표(한글 가~힣 / 영문 / 숫자·기호). 폰트에 없는 글자는 흐리게.
import { useEffect, useMemo, useRef, useState } from 'react';
import { VStack, HStack, Layout, LayoutHeader, LayoutContent } from '@astryxdesign/core/Layout';
import { PAGE_WIDTH } from './frame.js';
import { Section } from '@astryxdesign/core/Section';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { TabList, Tab } from '@astryxdesign/core/TabList';
import { Badge } from '@astryxdesign/core/Badge';
import { ArrowLeft, Star, Columns3 } from 'lucide-react';
import { Specimen } from './Specimen.jsx';
import { VirtualList } from './VirtualList.jsx';
import { HangulBadge } from './Browse.jsx';
import { faceName } from './fonts/faces.js';
import { hasChar } from './fonts/sfnt.js';
import { glyphList, weightSteps, axisWeight, GLYPH_SETS, FALLBACK_SAMPLE } from './logic.js';

const CELL = 64;

function GlyphGrid({ ps, ranges, set }) {
  const box = useRef(null);
  const [grid, setGrid] = useState({ cols: 10, cell: CELL });
  const { cols, cell } = grid;
  const glyphs = useMemo(() => glyphList(set), [set]);
  const missing = useMemo(() => (ranges ? glyphs.filter((g) => !hasChar(ranges, g.codePointAt(0))).length : null), [glyphs, ranges]);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const n = Math.max(4, Math.floor(el.clientWidth / CELL));
      setGrid({ cols: n, cell: Math.floor(el.clientWidth / n) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rows = Math.ceil(glyphs.length / cols);
  const family = faceName(ps);
  return (
    <VStack gap={2} height="100%">
      <Text type="supporting" hasTabularNumbers data-testid="glyph-summary">
        {glyphs.length.toLocaleString()}자{missing === null ? '' : missing ? ` 중 ${missing.toLocaleString()}자가 이 폰트에 없어요(흐리게 표시)` : ', 전부 있어요'}
      </Text>
      <VStack ref={box} style={{ flex: '1 1 auto', minHeight: 320 }}>
        <VirtualList count={rows} rowHeight={CELL} label={GLYPH_SETS[set].label} testId="glyphs" renderRow={(r) => (
          <HStack height={CELL}>
            {glyphs.slice(r * cols, r * cols + cols).map((g) => {
              const has = ranges ? hasChar(ranges, g.codePointAt(0)) : true;
              return (
                <HStack key={g} width={cell} height={CELL} hAlign="center" vAlign="center" data-testid="glyph" data-missing={has ? undefined : '1'}
                  style={{ border: '1px solid var(--color-border)', marginRight: -1, marginBottom: -1, opacity: has ? 1 : 0.18 }}
                  title={`U+${g.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}${has ? '' : ' · 이 폰트에 없음'}`}>
                  <span style={{ fontFamily: `"${family}"`, fontSize: 30, lineHeight: 1, color: 'var(--color-text-primary)', fontSynthesis: 'none' }}>{g}</span>
                </HStack>
              );
            })}
          </HStack>
        )} />
      </VStack>
    </VStack>
  );
}

export function Detail({ fam, info, sample, size, fav, onFav, inCompare, onCompare, compareFull, onBack }) {
  const [set, setSet] = useState('hangul');
  // 가변 폰트: Chrome 이 굵기마다 이름을 따로 주지만 local() 로 부르면 전부 기본 굵기로 그려진다
  // (11-26 실측: Noto Sans KR Thin~Black 영문 폭이 모두 291). 그래서 굵기 축 값을 직접 넣는다.
  // 이름 붙은 굵기가 하나뿐인 가변 폰트는 축 범위를 100 단위로 펼쳐 보여 준다.
  const wght = info?.wght;
  const axis = (w) => axisWeight(info, w);
  const steps = fam.faces.length > 1 ? [] : weightSteps(wght);
  const ko = info?.familyKo && info.familyKo !== fam.family ? info.familyKo : null;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  const text = sample || FALLBACK_SAMPLE;
  return (
    <Section variant="section" padding={0} height="100vh" data-testid="detail">
      <Layout contentWidth={PAGE_WIDTH} header={
        <LayoutHeader hasDivider paddingBlockEnd={3}>
          <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
            <HStack gap={3} vAlign="center">
              <Button variant="ghost" label="목록" icon={<Icon icon={ArrowLeft} />} onClick={onBack} data-testid="back" />
              <Heading level={4} accessibilityLevel={1}>{fam.family}</Heading>
              {ko && <Text color="secondary">{ko}</Text>}
              <HangulBadge info={info} />
              {info?.wght && <Badge variant="info" label={`가변 굵기 ${info.wght.min}~${info.wght.max}`} />}
            </HStack>
            <HStack gap={2}>
              <ToggleButton label={fav ? '즐겨찾기됨' : '즐겨찾기'} isPressed={fav} icon={<Icon icon={Star} size="sm" />}
                pressedIcon={<Icon icon={Star} size="sm" style={{ fill: 'currentColor' }} />} onPressedChange={() => onFav(fam.key)}>{fav ? '즐겨찾기됨' : '즐겨찾기'}</ToggleButton>
              <Button label={inCompare ? '비교에서 빼기' : '비교에 넣기'} icon={<Icon icon={Columns3} />} isDisabled={!inCompare && compareFull}
                tooltip={!inCompare && compareFull ? '비교는 4개까지예요' : undefined} onClick={() => onCompare(fam.key)} data-testid="detail-cmp" />
            </HStack>
          </HStack>
        </LayoutHeader>
      } content={
        <LayoutContent padding={4} isScrollable>
          <VStack gap={6}>
            <VStack gap={3}>
              <Text type="label">굵기 · 스타일 {fam.faces.length}개{steps.length ? ` · 가변 굵기 ${steps.length}단계` : ''}</Text>
              <VStack gap={4} data-testid="weights">
                {fam.faces.map((f) => (
                  <VStack key={f.ps} gap={1}>
                    <Text type="supporting" hasTabularNumbers>{f.style} · {f.weight}</Text>
                    <Specimen ps={f.ps} text={text} size={Math.min(size, 64)} weight={axis(f.weight)} testId="weight" ranges={info?.ranges} />
                  </VStack>
                ))}
                {steps.map((w) => (
                  <VStack key={`v${w}`} gap={1}>
                    <Text type="supporting" hasTabularNumbers>굵기 축 {w}</Text>
                    <Specimen ps={fam.rep.ps} text={text} size={Math.min(size, 64)} weight={w} testId="weight-var" ranges={info?.ranges} />
                  </VStack>
                ))}
              </VStack>
            </VStack>
            <VStack gap={3} style={{ height: '70vh' }}>
              <TabList value={set} onChange={setSet} hasDivider data-testid="glyph-tabs">
                <Tab value="hangul" label="한글 가~힣" />
                <Tab value="latin" label="영문" />
                <Tab value="digits" label="숫자·기호" />
              </TabList>
              <GlyphGrid key={set} ps={fam.rep.ps} ranges={info?.ranges} set={set} />
            </VStack>
          </VStack>
        </LayoutContent>
      } />
    </Section>
  );
}
