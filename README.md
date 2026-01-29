# XIΛIX_BEST_MAP - 원클릭 상권분석

## 프로젝트 개요
- **이름**: XIΛIX_BEST_MAP
- **목표**: 네이버스마트플레이스 & 구글업체등록 전 주변 상권을 미리 분석하여 맞춤형 마케팅 방법과 설정을 제공
- **주요 기능**: 원클릭 상권분석, AI 맞춤 분석 리포트, 마케팅 전략 추천

## URLs
- **프로덕션**: https://xivix-best-map.pages.dev/
- **로컬 테스트**: https://3000-ie26bucm1ib6w6uy2spzg-c81df28e.sandbox.novita.ai

## 완료된 기능
✔️ **위치 선택 기능**
  - T-MAP API 연동 주소/장소 검색
  - 현재 위치 기반 자동 설정
  - 네이버 지도 연동 시각화
  - 지도 클릭으로 위치 선택

✔️ **업종 선택 기능**
  - 8개 업종 카테고리 지원 (음식점, 소매, 생활서비스, 스포츠/오락, 부동산, 학문/교육, 의료, 전체)

✔️ **분석 반경 설정**
  - 300m, 500m, 1km, 2km 반경 선택
  - 지도에 반경 시각화

✔️ **상권 데이터 분석**
  - 소상공인 상권정보 API 연동
  - 반경 내 총 상가 수 집계
  - 업종별 상가 현황 분석
  - 경쟁 밀도 계산

✔️ **AI 맞춤 분석**
  - Gemini 2.5 Pro 연동 상권 분석 리포트
  - Gemini 2.5 Flash 연동 마케팅 전략 추천

✔️ **UI/UX**
  - 반응형 디자인 (모바일/PC)
  - 다크모드 지원
  - 타이포그래피 가이드 적용

## API 엔드포인트
| 경로 | 메소드 | 설명 |
|------|--------|------|
| `/` | GET | 메인 페이지 |
| `/api/gemini/analyze` | POST | Gemini AI 분석 (body: { prompt, model }) |
| `/api/tmap/search` | GET | T-MAP 주소 검색 (query: keyword) |
| `/api/tmap/reverse-geocode` | GET | 좌표→주소 변환 (query: lat, lon) |
| `/api/semas/radius` | GET | 반경 내 상가 조회 (query: cx, cy, radius, indsLclsCd) |
| `/api/semas/area` | GET | 지역별 상권 분석 (query: divId, code) |
| `/api/semas/upjong` | GET | 업종별 상가 수 (query: divId, code, indsLclsCd) |
| `/api/naver/local` | GET | 네이버 지역 검색 (query: query) |
| `/api/config/naver-map` | GET | 네이버 맵 클라이언트 ID 조회 |

## 데이터 아키텍처
- **외부 API 연동**:
  - Gemini 2.5 Pro / Flash (AI 분석)
  - T-MAP API (주소 검색, 역지오코딩)
  - 네이버 지도 API (지도 표시)
  - 네이버 검색 API (지역 검색)
  - 소상공인 상권정보 API (상가 데이터)

## 사용자 가이드
1. **위치 선택**: 검색창에 주소/장소 입력 또는 "현재 위치" 버튼 클릭
2. **업종 선택**: 창업 희망 업종 선택 (복수 선택 불가)
3. **반경 설정**: 분석할 반경 선택 (기본 500m)
4. **분석 시작**: "원클릭 상권분석 시작!" 버튼 클릭
5. **결과 확인**: 상권 요약, 업종별 현황, AI 분석 리포트, 마케팅 전략 확인

## 배포 정보
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ Active
- **기술 스택**: Hono + TypeScript + TailwindCSS + Naver Maps
- **최종 업데이트**: 2026-01-29

## 향후 개발 예정
- [ ] 사용자 분석 결과 저장 기능
- [ ] PDF 리포트 다운로드
- [ ] 경쟁업체 상세 분석
- [ ] 임대료 정보 연동
- [ ] 프랜차이즈 창업 비용 계산기

---

클릭하면 링크로 접속: [https://xivix.kr/](https://xivix.kr/) | @**XIΛIX** | © 2026. ALL RIGHTS RESERVED.
