// 나란히 비교: 고른 2~4개를 같은 문장·같은 크기로 세로 칸에 나란히
import { useEffect } from 'react';
import { VStack, HStack, Layout, LayoutHeader, LayoutContent } from '@astryxdesign/core/Layout';
import { Section } from '@astryxdesign/core/Section';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Slider } from '@astryxdesign/core/Slider';
import { Card } from '@astryxdesign/core/Card';
import { ArrowLeft, X, ChevronRight } from 'lucide-react';
import { Specimen } from './Specimen.jsx';
import { FALLBACK_SAMPLE, axisWeight } from './logic.js';
import { SIZE_MIN, SIZE_MAX } from './store.js';
import { HangulBadge } from './Browse.jsx';

const LINES = ['가나다라마바사 아자차카타파하', 'ABCDEFGHIJKLM abcdefghijklm', '0123456789 ₩1,250 (2026.11.26)'];

export function Compare({ fams, info, settings, setSettings, onRemove, onBack, onOpen }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  const { sample, size } = settings;
  return (
    <Section variant="section" padding={0} height="100vh" data-testid="compare">
      <Layout header={
        <LayoutHeader hasDivider padding={3}>
          <VStack gap={3}>
            <HStack gap={3} vAlign="center">
              <Button variant="ghost" label="목록" icon={<Icon icon={ArrowLeft} />} onClick={onBack} data-testid="back" />
              <Heading level={4} accessibilityLevel={1}>나란히 비교</Heading>
              <Text type="supporting" hasTabularNumbers>{fams.length}개</Text>
            </HStack>
            <HStack gap={3} vAlign="end" wrap="wrap">
              <VStack style={{ flex: '2 1 320px' }}>
                <TextInput label="내 문장" value={sample} onChange={(v) => setSettings({ sample: v })} placeholder={`비우면 기본 문장: ${FALLBACK_SAMPLE}`} />
              </VStack>
              <VStack style={{ flex: '1 1 180px' }}>
                <Slider label={`크기 ${size}px`} min={SIZE_MIN} max={SIZE_MAX} value={size} onChange={(v) => setSettings({ size: v })} valueDisplay="none" />
              </VStack>
            </HStack>
          </VStack>
        </LayoutHeader>
      } content={
        <LayoutContent padding={4} isScrollable>
          <HStack gap={3} vAlign="start" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${Math.max(240, Math.min(420, size * 6))}px, 1fr))` }}>
            {fams.map((f) => (
              <Card key={f.key} padding={4} data-testid="compare-col">
                <VStack gap={4}>
                  <HStack gap={2} vAlign="center" hAlign="between">
                    <VStack gap={1} style={{ minWidth: 0 }}>
                      <Text weight="semibold" maxLines={1}>{f.family}</Text>
                      <HStack gap={2}><HangulBadge info={info[f.key]} /></HStack>
                    </VStack>
                    <HStack gap={1}>
                      <Button size="sm" variant="ghost" label={`${f.family} 자세히`} endContent={<Icon icon={ChevronRight} size="sm" />} onClick={() => onOpen(f.key)}>자세히</Button>
                      <Button size="sm" variant="ghost" isIconOnly label={`${f.family} 비교에서 빼기`} icon={<Icon icon={X} size="sm" />} onClick={() => onRemove(f.key)} data-testid="col-remove" />
                    </HStack>
                  </HStack>
                  <Specimen ps={f.rep.ps} text={sample || FALLBACK_SAMPLE} placeholder={!sample} weight={axisWeight(info[f.key], f.rep.weight)} size={size} testId="compare-sample" ranges={info[f.key]?.ranges} />
                  <VStack gap={1}>
                    {LINES.map((l) => <Specimen key={l} ps={f.rep.ps} text={l} size={18} weight={axisWeight(info[f.key], f.rep.weight)} ranges={info[f.key]?.ranges} />)}
                  </VStack>
                </VStack>
              </Card>
            ))}
          </HStack>
        </LayoutContent>
      } />
    </Section>
  );
}
