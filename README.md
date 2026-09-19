# 주역 실전 기록

질문과 예상 결과를 먼저 잠근 뒤, 고정 난수표로 시초법의 확률분포를 재현해 괘를 뽑고 사후 결과까지 기록하는 모바일 웹앱입니다.

## 사용 흐름

1. 질문과 예상 결과를 작성해 잠급니다.
2. 멈추는 타이밍으로 난수표의 행과 열을 정합니다.
3. 본괘·변효·지괘와 주희 《역학계몽》 「고변점」에 따른 독법을 확인합니다.
4. 고변점 방식으로 정해진 해석문이 자동 저장되며, 나중에 실제 결과와 사전 예상을 대조합니다.

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
