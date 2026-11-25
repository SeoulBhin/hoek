// Windows 에 기본으로 깔린 실제 폰트 파일로 한글 판별을 확인한다(파일이 없는 PC·CI 에선 건너뜀).
// 기대값은 fontTools 4.61.1 로 따로 센 값(2026-11-25, _workspace/14_작업기록.md)
// protects: 한글 폰트(맑은 고딕·굴림·바탕 TTC 면)는 11,172자, 영문 폰트(Arial·Consolas·Times New Roman)는 0자
// fails_when: 실제 폰트 파일 형식(형식 4 의 idRangeOffset, TTC 오프셋)을 잘못 읽어 수가 달라짐
// no_claim: 브라우저 blob() 경로(그건 e2e), 이 PC 에 없는 폰트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readFontInfo, HANGUL_TOTAL } from '../src/fonts/sfnt.js';

const DIR = 'C:/Windows/Fonts';
const CASES = [
  ['malgun.ttf', 'MalgunGothic', HANGUL_TOTAL, '맑은 고딕'],
  ['malgunbd.ttf', 'MalgunGothicBold', HANGUL_TOTAL, '맑은 고딕'],
  ['gulim.ttc', 'Gulim', HANGUL_TOTAL, '굴림'],
  ['gulim.ttc', 'GulimChe', HANGUL_TOTAL, '굴림체'],
  ['batang.ttc', 'Batang', HANGUL_TOTAL, '바탕'],
  ['arial.ttf', 'ArialMT', 0, null],
  ['consola.ttf', 'Consolas', 0, null],
  ['times.ttf', 'TimesNewRomanPSMT', 0, null],
];

async function fileReader(path) {
  const fh = await open(path, 'r');
  return {
    fh,
    read: async (o, l) => {
      const buf = Buffer.alloc(l);
      const { bytesRead } = await fh.read(buf, 0, l, o);
      return new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
    },
  };
}

for (const [file, ps, hangul, ko] of CASES) {
  const path = `${DIR}/${file}`;
  test(`${file} ${ps}: 한글 ${hangul}자`, { skip: !existsSync(path) && '이 PC 에 없는 파일' }, async () => {
    const { fh, read } = await fileReader(path);
    try {
      const info = await readFontInfo(read, ps);
      assert.equal(info.ps, ps);
      assert.equal(info.hangul, hangul);
      if (ko) assert.equal(info.familyKo, ko);
    } finally {
      await fh.close();
    }
  });
}
