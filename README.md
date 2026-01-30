# XIΛIX_BEST_MAP - 원클릭 상권분석

## 프로젝트 개요
- **이름**: XIΛIX_BEST_MAP
- **목표**: 네이버스마트플레이스 & 구글업체등록 전 주변 상권을 미리 분석하여 맞춤형 마케팅 방법과 설정을 제공
- **주요 기능**: 원클릭 상권분석, AI 맞춤 분석 리포트, 마케팅 전략 추천

## 🔗 프로젝트 링크

### 프론트엔드
| 구분 | URL | 상태 |
|------|-----|------|
| **메인 페이지** | https://xivix-best-map.pages.dev/ | ✅ 활성 |
| **샌드박스 테스트** | https://3000-ie26bucm1ib6w6uy2spzg-c81df28e.sandbox.novita.ai | ✅ 활성 |
| **대시보드** | - | ❌ 미구현 |
| **어드민 페이지** | - | ❌ 미구현 |

### 백엔드 API
| 구분 | URL | 상태 |
|------|-----|------|
| **API 서버** | https://xivix-best-map.pages.dev/api/ | ✅ 활성 |
| **Health Check** | https://xivix-best-map.pages.dev/ | ✅ 200 OK |
| **Swagger 문서** | - | ❌ 미구현 |

### GitHub 저장소
| 구분 | URL |
|------|-----|
| **Backend 저장소** | https://github.com/ikjoobang/xivix-best-map |

## 📡 API 엔드포인트

| 엔드포인트 | 메서드 | 파라미터 | 설명 |
|------------|--------|----------|------|
| `/api/gemini/analyze` | POST | `{prompt, model}` | AI 분석 (Gemini 2.5 Pro/Flash) |
| `/api/tmap/search` | GET | `keyword` | T-MAP 장소 검색 |
| `/api/tmap/reverse-geocode` | GET | `lat, lon` | 좌표→주소 변환 |
| `/api/semas/radius` | GET | `cx, cy, radius` | 주변 상가 조회 (네이버 지역검색 API) |
| `/api/semas/area` | GET | `divId, code` | 지역별 상권 분석 |
| `/api/semas/upjong` | GET | `divId, code, indsLclsCd` | 업종별 상가 수 |
| `/api/naver/local` | GET | `query` | 네이버 지역검색 |
| `/api/config/naver-map` | GET | - | 네이버 지도 Client ID |

## ✅ 완료된 기능

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
  - 네이버 지역검색 API 연동 (소상공인 API 대체)
  - 반경 내 총 상가 수 집계
  - 업종별 상가 현황 분석
  - 경쟁 밀도 계산

✔️ **AI 맞춤 분석**
  - Gemini 2.5 Pro 연동 상권 분석 리포트
  - Gemini 2.5 Flash 연동 마케팅 전략 추천
  - 지역+업종 기반 사사분면 마케팅 모델 적용

✔️ **UI/UX**
  - 반응형 디자인 (모바일/PC)
  - 다크모드 지원
  - 타이포그래피 가이드 적용

## 🔧 기술 스택

| 구분 | 기술 |
|------|------|
| **프레임워크** | Hono (TypeScript) |
| **배포** | Cloudflare Pages |
| **지도** | 네이버 지도 API v3 |
| **AI** | Google Gemini 2.5 Pro/Flash |
| **위치** | T-MAP API |
| **상가 데이터** | 네이버 지역검색 API |
| **스타일링** | TailwindCSS |

## 📁 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx        # 메인 백엔드 (Hono API + HTML 렌더링)
│   └── renderer.tsx     # 렌더러
├── public/
│   └── static/
│       └── style.css    # 커스텀 CSS
├── dist/                # 빌드 결과물
├── .dev.vars            # 로컬 환경변수 (API 키)
├── wrangler.jsonc       # Cloudflare 설정
├── ecosystem.config.cjs # PM2 설정
├── package.json         # 의존성
├── tsconfig.json        # TypeScript 설정
├── vite.config.ts       # Vite 빌드 설정
└── README.md            # 프로젝트 문서
```

## 📖 사용자 가이드

1. **위치 선택**: 검색창에 주소/장소 입력 또는 "현재 위치" 버튼 클릭
2. **업종 선택**: 창업 희망 업종 선택 (복수 선택 불가)
3. **반경 설정**: 분석할 반경 선택 (기본 500m)
4. **분석 시작**: "원클릭 상권분석 시작!" 버튼 클릭
5. **결과 확인**: 상권 요약, 업종별 현황, AI 분석 리포트, 마케팅 전략 확인

## 🚀 배포 정보

- **플랫폼**: Cloudflare Pages
- **상태**: ✅ Active
- **프로덕션 URL**: https://xivix-best-map.pages.dev/
- **최종 업데이트**: 2026-01-30

## 📋 향후 개발 예정

- [ ] 대시보드 페이지
- [ ] 어드민 페이지
- [ ] Swagger API 문서
- [ ] 사용자 분석 결과 저장 기능
- [ ] PDF 리포트 다운로드
- [ ] 경쟁업체 상세 분석
- [ ] 임대료 정보 연동
- [ ] 프랜차이즈 창업 비용 계산기

---

클릭하면 링크로 접속: [https://xivix.kr/](https://xivix.kr/) | @**XIΛIX** | © 2026. ALL RIGHTS RESERVED.
