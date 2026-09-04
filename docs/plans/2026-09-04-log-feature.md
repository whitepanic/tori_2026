# 毎月生活費 계산 로그 표시 기능 구현 계획

사용자가 `毎月生活費` 계산 과정(비과세 공제, 세금 적용 내역 등)을 직접 보고 검산할 수 있도록, 상세 계산 로그를 보여주는 기능을 추가합니다.

## Proposed Changes

### UI 및 HTML 구성요소 변경

#### [MODIFY] [index.html](file:///Users/whitepanic/projects/_whitepanic/tori_2026/index.html)
- `results-section` (그래프 영역) 하단에 회색 폰트를 적용한 `로그표시/로그숨기기(ログ表示/ログ隠し)` 버튼을 추가합니다.
- 버튼 바로 아래에 `result-card` 스타일을 재사용한 로그 출력 패널(`log-panel`)을 추가하며, 초기 상태는 `hidden`으로 숨김 처리합니다.
- 로그 내용을 텍스트 그대로 렌더링하기 위해 내부에 `<pre id="log-content">` 태그를 배치합니다.

### 스크립트 및 로직 변경

#### [MODIFY] [script.js](file:///Users/whitepanic/projects/_whitepanic/tori_2026/script.js)
- **DOM 엘리먼트 바인딩**: `toggleLogBtn`, `logPanel`, `logContent` 변수 추가.
- **토글 이벤트**: `toggleLogBtn` 클릭 시 `log-panel`의 `hidden` 클래스를 토글하고 버튼 텍스트를 `ログ表示` ↔ `ログ隠し`로 변경합니다.
- **계산 로그 생성**: `updateSimulation()` 내부에서 생활비(기본 금리 기준)가 계산될 때 다음 내용을 포함하는 텍스트 로그를 생성합니다.
  - 총 금융자산 (万円)
  - NISA 비과세 한도 (万円)
  - 과세 대상 자산 및 비과세 자산 비율
  - 세전 월 생활비
  - 비과세 비율에 따른 세전 금액
  - 과세 비율에 따른 세금 공제 (20.315%) 후 금액
  - 최종 세후 월 생활비 합계
- 생성된 로그를 `logContent.textContent`에 주입하여 사용자가 쉽게 검산할 수 있게 제공합니다.

## Verification Plan

### Manual Verification
1. 브라우저 하단에 회색 폰트의 `ログ表示` 버튼이 나타나는지 확인합니다.
2. 버튼 클릭 시 로그 패널이 부드럽게 나타나며 텍스트가 `ログ隠し`로 바뀌는지 확인합니다.
3. 패널 내부에 총 자산, NISA 금액, 과세/비과세 비율, 세금 공제 내역 등이 정확한 수식과 함께 표기되어 인간이 직접 계산기를 두드려 검산할 수 있는지 확인합니다.
4. 설정값(자산, NISA 한도 등)을 변경했을 때 로그 패널의 수치도 실시간으로 올바르게 업데이트되는지 검증합니다.
