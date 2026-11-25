// 목록 전 화면들: 처음 온 사람 안내, 미지원 브라우저, 허락 거절, 불러오는 중
import { Section } from '@astryxdesign/core/Section';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Heading, Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Card } from '@astryxdesign/core/Card';
import { Banner } from '@astryxdesign/core/Banner';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { Copy, FolderOpen, Lock, RefreshCw, ShieldCheck, Columns3, Languages } from 'lucide-react';
import { useState } from 'react';

function Frame({ children }) {
  return (
    <Section variant="section" padding={0} height="100vh">
      <VStack height="100%" width="100%" hAlign="center" vAlign="center" padding={4}>
        <VStack gap={6} width="100%" style={{ maxWidth: 560 }}>{children}</VStack>
      </VStack>
    </Section>
  );
}

function Brand() {
  return (
    <VStack gap={2}>
      <Heading level={1}>획</Heading>
      <Text type="large" color="secondary">내 컴퓨터에 깔린 폰트를, 내가 쓴 문장으로 한눈에.</Text>
    </VStack>
  );
}

const POINTS = [
  [FolderOpen, '허락 한 번이면 이 컴퓨터의 폰트를 전부 불러와요'],
  [Languages, '한글이 다 되는 폰트만 골라 볼 수 있어요'],
  [Columns3, '마음에 드는 건 별표, 4개까지 나란히 비교'],
  [ShieldCheck, '폰트 파일은 이 브라우저 밖으로 나가지 않아요'],
];

export function Intro({ onStart, busy }) {
  return (
    <Frame>
      <Brand />
      <VStack gap={3} data-testid="intro-points">
        {POINTS.map(([icon, text]) => (
          <HStack key={text} gap={3} vAlign="center">
            <Icon icon={icon} size="sm" color="secondary" />
            <Text>{text}</Text>
          </HStack>
        ))}
      </VStack>
      <VStack gap={2}>
        <Button variant="primary" size="lg" label="내 폰트 불러오기" icon={<Icon icon={FolderOpen} />} onClick={onStart} isLoading={busy} data-testid="start" />
        <Text type="supporting">누르면 Chrome 이 “글꼴 사용” 허락을 물어요. 허용을 눌러 주세요.</Text>
      </VStack>
    </Frame>
  );
}

export function Unsupported() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Frame>
      <Brand />
      <Banner status="warning" title="이 브라우저에선 내 컴퓨터 폰트를 읽을 수 없어요" collapsible={false}
        description="Chrome 이나 Edge(컴퓨터용)에서 이 주소를 열어 주세요. Firefox·Safari·휴대폰 브라우저에는 아직 이 기능이 없어요." data-testid="unsupported" />
      <HStack gap={2} vAlign="center">
        <Button label={copied ? '복사했어요' : '주소 복사'} icon={<Icon icon={Copy} />} onClick={copy} data-testid="copy-url" />
        <Text type="code" color="secondary" maxLines={1}>{location.href}</Text>
      </HStack>
    </Frame>
  );
}

export function Denied({ onRetry, busy, code }) {
  return (
    <Frame>
      <Brand />
      <Banner status={code === 'failed' ? 'error' : 'warning'} collapsible={false} data-testid="denied"
        title={code === 'empty' ? '불러온 폰트가 하나도 없어요' : code === 'failed' ? '폰트 목록을 읽다가 문제가 생겼어요' : '폰트를 읽을 허락을 받지 못했어요'}
        description={code === 'denied' ? '허락은 이 사이트에만, 언제든 거둘 수 있어요. 아래 순서로 허용으로 바꾼 뒤 다시 시도해 주세요.' : '잠시 뒤 다시 시도해 주세요.'} />
      {code === 'denied' && (
        <Card padding={4}>
          <VStack gap={3}>
            <HStack gap={3} vAlign="center"><Icon icon={Lock} size="sm" color="secondary" /><Text>1. 주소창 왼쪽의 사이트 정보 아이콘을 눌러요</Text></HStack>
            <HStack gap={3} vAlign="center"><Text color="secondary">⋯</Text><Text>2. “사이트 설정”에서 “글꼴”을 찾아요</Text></HStack>
            <HStack gap={3} vAlign="center"><Text color="secondary">✓</Text><Text>3. “허용”으로 바꾸고 이 화면으로 돌아와요</Text></HStack>
          </VStack>
        </Card>
      )}
      <Button variant="primary" label="다시 시도" icon={<Icon icon={RefreshCw} />} onClick={onRetry} isLoading={busy} data-testid="retry" />
    </Frame>
  );
}

export function Loading() {
  return (
    <Frame>
      <Brand />
      <VStack gap={2} data-testid="loading">
        <Text>폰트 목록을 읽고 있어요. 폰트가 많으면 몇 초 걸려요.</Text>
        <ProgressBar label="폰트 목록 읽는 중" isIndeterminate isLabelHidden />
      </VStack>
    </Frame>
  );
}

