// 내 PC 폰트 폴더의 모든 면을 획의 폰트 읽기(sfnt.js)로 읽어 한글 글자 수를 JSON 으로 낸다(crosscheck.py 가 fontTools 와 대조)
// 사용: node tools/dump-hangul.mjs out/hoek.json   (out/ 은 저장소에 올리지 않는다: 내 폰트 목록이 찍힘)
import { open, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { readFontInfo, listFaces } from '../src/fonts/sfnt.js';

const dirs = ['C:/Windows/Fonts', join(process.env.LOCALAPPDATA || '', 'Microsoft/Windows/Fonts')];
const out = {};
for (const d of dirs) {
  let files = [];
  try { files = await readdir(d); } catch { continue; }
  for (const f of files.filter((x) => /\.(ttf|otf|ttc|otc)$/i.test(x))) {
    const fh = await open(join(d, f), 'r');
    const read = async (o, l) => {
      const b = Buffer.alloc(l);
      const { bytesRead } = await fh.read(b, 0, l, o);
      return new Uint8Array(b.buffer, b.byteOffset, bytesRead);
    };
    try {
      for (const ps of await listFaces(read)) {
        const info = await readFontInfo(read, ps);
        out[ps] = { hangul: info.symbol ? null : info.hangul, file: f };
      }
    } catch (e) {
      out[`ERR:${f}`] = { error: String(e) };
    } finally {
      await fh.close();
    }
  }
}
const dest = process.argv[2] || 'out/hoek.json';
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(out));
console.log(`${Object.keys(out).length} faces → ${dest}`);
