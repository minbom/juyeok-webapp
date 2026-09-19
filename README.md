# 주역 실전 기록

질문을 먼저 잠근 뒤, 고정 난수표(시초법 재현) 또는 직접 던진 동전으로 괘를 뽑고, 고변점 방식의 해석문을 본 다음 내 의견을 기록하는 모바일 웹앱입니다.

## 사용 흐름

1. 질문을 작성해 잠급니다.
2. 난수표(멈추는 타이밍으로 행·열을 정함) 또는 동전(직접 던져 나온 효값 6·7·8·9를 순서대로 입력)으로 여섯 효를 뽑습니다.
3. 본괘·변효·지괘와 주희 《역학계몽》 「고변점」에 따른 해석문을 확인합니다. 해석문은 자동으로 저장됩니다.
4. 괘와 해석문을 본 뒤, 내 의견(결과 예측)을 적어 기록합니다.

사후 결과 입력과 적중 판정(맞았는지 여부)은 이 앱에서 다루지 않습니다. `내보내기`로 만든 JSON(질문·괘·해석문·내 의견까지 포함)을 이 저장소에 모아 두고, `tools/reading_log.py`로 나중에 처리합니다.

질문과 기록은 브라우저 `localStorage`에만 저장됩니다. 서버나 GitHub 저장소로 전송되지 않으며, JSON 내보내기·가져오기로 직접 백업할 수 있습니다. iPhone·iPad에서는 JSON 내보내기 버튼이 Safari 공유 시트를 열며, 여기서 “파일에 저장”을 선택합니다.

## 로컬 실행

```sh
python3 -m http.server 8765
```

브라우저에서 `http://127.0.0.1:8765/`를 엽니다. `file://`로 직접 열면 난수표를 불러오는 브라우저 보안 정책 때문에 앱이 동작하지 않습니다.

## 검증

```sh
python3 tools/nansu_siochi.py verify
python3 tools/sync_nansu.py check
python3 tools/reading_log.py list
node --check assets/webapp.js
node --check sw.js
```

괘 번호와 구조는 `assets/hex64.js`, 난수표는 `reference/random-number-table.html`을 단일 원천으로 재사용합니다.
