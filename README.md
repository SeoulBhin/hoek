# hoek — 획

내 컴퓨터에 깔린 폰트를, 내가 쓴 문장으로 한눈에 보는 웹. 서버 없이 브라우저 안에서만 돈다.

- 허락 한 번이면 이 컴퓨터의 폰트를 전부 불러온다(브라우저의 Local Font Access)
- 내가 쓴 문장으로 폰트마다 미리보기, 크기 조절, 이름 검색(영문·한글 이름 둘 다)
- 한글 거르기: 가~힣 11,172자를 **전부** 가진 폰트만. 일부만 있는 폰트는 "한글 18자 없음"처럼 빠진 수를 보여 준다
- 폰트에 없는 글자는 흐리게 그린다(브라우저가 다른 글꼴로 몰래 대신 그린 글자라서)
- 별표 즐겨찾기(다시 와도 남음), 2~4개 나란히 비교
- 상세: 굵기·스타일별 모양(가변 폰트 포함), 글자표(한글 가~힣 / 영문 / 숫자·기호, 없는 글자는 흐리게)

**Chrome·Edge(컴퓨터용)만** 된다. 다른 브라우저에선 안내 화면이 나온다.
폰트 파일은 이 브라우저 밖으로 나가지 않는다. 외부 API·인터넷 폰트 요청 없음(화면 글꼴 Pretendard 는 앱 안에 넣어 둠).

## 실행

```bash
$ npm install
$ npm run dev
```

`npm run build` 결과(`dist/`)는 모든 주소가 상대 경로라 GitHub Pages 하위 경로(`/hoek/`)에서도 그대로 열린다.
`main` 에 올리면 `.github/workflows/pages.yml` 이 시험 → 빌드 → Pages 로 내보낸다.

## 어떻게 동작하나

| 단계 | 하는 일 | 파일 |
|---|---|---|
| 불러오기 | `queryLocalFonts()` 로 면(스타일) 목록을 받아 가족별로 묶는다. 허락이 없으면 Chrome 은 오류 대신 빈 목록을 줘서 그것도 "허락 안 됨"으로 본다 | `src/fonts/sources/local.js`, `src/logic.js` |
| 그리기 | 설치된 폰트를 `FontFace("hoek-N", local("포스트스크립트 이름"))` 로 가리킨다(파일을 옮기지 않음). 화면에 보이는 줄만 등록 | `src/fonts/faces.js`, `src/Specimen.jsx` |
| 판별 | 가족마다 대표 면 파일에서 필요한 표(name·cmap·fvar)만 잘라 해석해서 한글 글자 수, 한국어 이름, 글자 목록, 굵기 축을 얻는다. TTC 는 이름이 같은 면을 고른다 | `src/fonts/sfnt.js`, `src/useInspect.js` |
| 저장 | 즐겨찾기·내 문장·크기·거르기를 `localStorage` 에. 막혀 있으면 이 창에서만 기억한다 | `src/store.js` |

가변 폰트는 `local()` 로 부르면 이름 붙은 굵기(Thin~Black)가 전부 기본 굵기로 그려져서, 굵기 축 값을 직접 넣는다.
`FontData.blob()` 은 파일을 통째로 들고 올 수 있어서(CJK 폰트는 10MB 넘음) 조각 읽기는 해석할 양을 줄일 뿐 메모리를 아끼진 않는다. 그래서 동시에 2개씩만 읽는다.

### 같은 출처에 대해

브라우저의 폰트 허락과 `localStorage` 는 출처(`https://seoulbhin.github.io`) 단위다. 같은 계정의 다른 GitHub Pages 저장소 페이지도 같은 출처라서, 여기서 허락하면 그 페이지들도 허락 창 없이 폰트 목록을 읽을 수 있다. 획 코드는 폰트 정보를 어디로도 보내지 않지만, 출처를 따로 쓰려면 별도 도메인에 올려야 한다. 시험용 요약(`window.__hoek`)은 주소에 `?e2e` 가 있을 때만 만든다.

## 시험

```bash
$ npm test                                   # 폰트 표 읽기·로직·저장소 (29개, 실제 Windows 폰트 시험 8개는 파일이 없으면 건너뜀)
$ npm run build && python tests/e2e.py       # 실제 Chrome 으로 화면 끝까지 (34항목, fontTools 대조 포함)
$ node tools/dump-hangul.mjs out/hoek.json && python tools/crosscheck.py out/hoek.json   # fontTools 와 한글 글자 수 대조
```

- 단위 시험의 폰트는 코드로 만든 바이트라 저장소에 폰트 파일이 없다
- e2e 는 권한을 미리 주거나 안 준 상태로 시험한다. 진짜 허락 창에서 사람이 누르는 경로는 자동화로 못 누른다
- `out/` 에는 내 컴퓨터 폰트 목록이 찍혀서 올리지 않는다

## 다음 단계

이미지(직접 그린 글자 견본)로 폰트 만들기를 이 프로젝트에 이어서 **내 컴퓨터 전용**으로 붙인다. 만든 폰트는 `src/fonts/sources/` 에 출처를 하나 더 두고(`faces.js` 의 `registerBuffer`) 같은 목록·비교 화면에서 본다.

화면은 [Astryx](https://www.npmjs.com/package/@astryxdesign/core) 디자인 시스템(React, stone 테마)으로 만들었다. 화면 글꼴 Pretendard 는 SIL OFL 1.1(`src/fonts/ui/LICENSE-Pretendard.txt`).
