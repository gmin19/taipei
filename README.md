# 주변 여행 도우미 (다중 파일 분리 버전)

유지보수와 기능별 관리가 쉽도록 단일 `index.html`을 **역할별 6개 파일**로 분리한 버전입니다.

## 📁 파일 구성 및 역할

| 파일명 | 역할 및 주요 내용 |
| :--- | :--- |
| **`index.html`** | 웹앱의 화면 뼈대(HTML 마크업)와 스타일·스크립트 연결만 담당합니다. |
| **`style.css`** | 아이폰 Safari 노치 대응, 상단 플로팅 바, 하단 시트, 장소 카드, 모달 등 모든 디자인 스타일을 담당합니다. |
| **`config.js`** | **`GOOGLE_MAPS_API_KEY` 설정**, 13개 카테고리 정의, 평점/거리 우선순위, 전역 상태(`state`) 및 공통 유틸리티 함수를 담당합니다. |
| **`search.js`** | 주변 카테고리 검색, **도로명('해돋이로' 등)·비업종 완벽 차단 필터(`isRoadOrNonBusinessName`, `isValidPlaceForCategory`)**, 전 세계 다국어 검색을 담당합니다. |
| **`route.js`** | 화면 지도 위 **경로선(Polyline) 표시**, 도보·대중교통 소요 시간 계산, 여행 코스 최적화, **구글·네이버·카카오 지도 연결 URL 생성**을 담당합니다. |
| **`app.js`** | 앱 초기화, Google 지도 로드, 내 위치(GPS) 감지, `❤️ 내 장소` 관리, 장소 카드 및 지도 마커 렌더링을 담당합니다. |

## 🔑 API 키 입력 방법

1. **`config.js`** 파일을 텍스트 에디터(메모장, VS Code 등)로 엽니다.
2. 파일 맨 위 **6번째 줄**의 `GOOGLE_MAPS_API_KEY`에 본인의 Google Maps API 키를 입력하고 저장합니다.
   ```javascript
   const GOOGLE_MAPS_API_KEY = "AIzaSy...본인의_API_키_입력";
   ```
3. 또는 웹앱 실행 후 우측 상단 **⚙️ 버튼**을 눌러 화면에서 바로 API 키를 입력·저장할 수도 있습니다.

## 🚀 GitHub Pages 업로드 방법

1. GitHub 저장소(Repository)에 아래 **6개 파일을 모두 같은 폴더(루트 경로)**에 업로드합니다:
   - `index.html`
   - `style.css`
   - `config.js`
   - `search.js`
   - `route.js`
   - `app.js`
2. 저장소의 **Settings > Pages**에서 Branch를 `main`으로 설정하면 즉시 배포됩니다.
