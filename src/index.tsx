import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

type Bindings = {
  GEMINI_PRO_KEY: string
  GEMINI_FLASH_KEY: string
  TMAP_API_KEY: string
  NAVER_MAP_CLIENT_ID: string
  NAVER_MAP_CLIENT_SECRET: string
  NAVER_CLIENT_ID: string
  NAVER_CLIENT_SECRET: string
  SEMAS_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Static files
app.use('/static/*', serveStatic())

// ============================================
// API Routes
// ============================================

// Gemini AI 분석 API
app.post('/api/gemini/analyze', async (c) => {
  const { prompt, model } = await c.req.json()
  const apiKey = model === 'pro' ? c.env.GEMINI_PRO_KEY : c.env.GEMINI_FLASH_KEY
  const modelName = model === 'pro' ? 'gemini-2.5-pro-preview-05-06' : 'gemini-2.5-flash-preview-05-20'
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          }
        })
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      return c.json({ error: `Gemini API Error: ${error}` }, 500)
    }
    
    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return c.json({ result: text })
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// T-MAP 주소 검색 API
app.get('/api/tmap/search', async (c) => {
  const keyword = c.req.query('keyword')
  
  if (!keyword) {
    return c.json({ error: 'keyword is required' }, 400)
  }
  
  try {
    const response = await fetch(
      `https://apis.openapi.sk.com/tmap/pois?version=1&searchKeyword=${encodeURIComponent(keyword)}&resCoordType=WGS84GEO&reqCoordType=WGS84GEO&count=10`,
      {
        headers: {
          'Accept': 'application/json',
          'appKey': c.env.TMAP_API_KEY
        }
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      return c.json({ error: `T-MAP API Error: ${error}` }, 500)
    }
    
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// T-MAP 역지오코딩 (좌표 → 주소)
app.get('/api/tmap/reverse-geocode', async (c) => {
  const lat = c.req.query('lat')
  const lon = c.req.query('lon')
  
  if (!lat || !lon) {
    return c.json({ error: 'lat and lon are required' }, 400)
  }
  
  try {
    const response = await fetch(
      `https://apis.openapi.sk.com/tmap/geo/reversegeocoding?version=1&lat=${lat}&lon=${lon}&coordType=WGS84GEO&addressType=A10`,
      {
        headers: {
          'Accept': 'application/json',
          'appKey': c.env.TMAP_API_KEY
        }
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      return c.json({ error: `T-MAP API Error: ${error}` }, 500)
    }
    
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// 소상공인 상권정보 API - 상권 분석
app.get('/api/semas/area', async (c) => {
  const key = c.env.SEMAS_API_KEY
  const divId = c.req.query('divId') || 'adongCd'
  const code = c.req.query('code')
  
  if (!code) {
    return c.json({ error: 'code is required' }, 400)
  }
  
  try {
    // 상권 정보 조회
    const response = await fetch(
      `https://apis.data.go.kr/B553077/api/open/sdsc/storeListInArea?serviceKey=${key}&divId=${divId}&key=${code}&type=json&numOfRows=100`,
      {
        headers: { 'Accept': 'application/json' }
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      return c.json({ error: `SEMAS API Error: ${error}` }, 500)
    }
    
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// 소상공인 상권정보 API - 업종별 상가 수
app.get('/api/semas/upjong', async (c) => {
  const key = c.env.SEMAS_API_KEY
  const divId = c.req.query('divId') || 'adongCd'
  const code = c.req.query('code')
  const indsLclsCd = c.req.query('indsLclsCd') || ''  // 대분류 코드
  
  if (!code) {
    return c.json({ error: 'code is required' }, 400)
  }
  
  try {
    let url = `https://apis.data.go.kr/B553077/api/open/sdsc/storeListInUpjong?serviceKey=${key}&divId=${divId}&key=${code}&type=json&numOfRows=100`
    if (indsLclsCd) {
      url += `&indsLclsCd=${indsLclsCd}`
    }
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    })
    
    if (!response.ok) {
      const error = await response.text()
      return c.json({ error: `SEMAS API Error: ${error}` }, 500)
    }
    
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// 소상공인 - 반경 내 상가 조회
app.get('/api/semas/radius', async (c) => {
  const key = c.env.SEMAS_API_KEY
  const cx = c.req.query('cx')  // 경도
  const cy = c.req.query('cy')  // 위도
  const radius = c.req.query('radius') || '500'  // 반경(m)
  const indsLclsCd = c.req.query('indsLclsCd') || ''  // 대분류 코드
  
  if (!cx || !cy) {
    return c.json({ error: 'cx and cy are required' }, 400)
  }
  
  try {
    let url = `https://apis.data.go.kr/B553077/api/open/sdsc/storeListInRadius?serviceKey=${key}&radius=${radius}&cx=${cx}&cy=${cy}&type=json&numOfRows=1000`
    if (indsLclsCd) {
      url += `&indsLclsCd=${indsLclsCd}`
    }
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    })
    
    if (!response.ok) {
      const error = await response.text()
      return c.json({ error: `SEMAS API Error: ${error}` }, 500)
    }
    
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// 네이버 지역 검색 API
app.get('/api/naver/local', async (c) => {
  const query = c.req.query('query')
  
  if (!query) {
    return c.json({ error: 'query is required' }, 400)
  }
  
  try {
    const response = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=random`,
      {
        headers: {
          'X-Naver-Client-Id': c.env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': c.env.NAVER_CLIENT_SECRET
        }
      }
    )
    
    if (!response.ok) {
      const error = await response.text()
      return c.json({ error: `Naver API Error: ${error}` }, 500)
    }
    
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})

// API Keys for frontend (Naver Map)
app.get('/api/config/naver-map', (c) => {
  return c.json({
    clientId: c.env.NAVER_MAP_CLIENT_ID
  })
})

// ============================================
// Main Page
// ============================================
app.get('/', (c) => {
  const naverMapClientId = c.env.NAVER_MAP_CLIENT_ID
  
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XIΛIX_BEST_MAP - 원클릭 상권분석</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${naverMapClientId}"></script>
  <style>
    /* =========================================
       Typography & Layout System
       ========================================= */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #333333;
      word-break: keep-all;
      margin: 0;
    }

    @media (max-width: 768px) {
      body {
        font-size: 17px;
        line-height: 1.65;
        letter-spacing: -0.02em;
      }
    }

    @media (min-width: 769px) {
      body {
        font-size: 16px;
        line-height: 1.55;
        letter-spacing: -0.01em;
      }
    }

    /* Visual Hierarchy */
    .ordered-list, .emphasis-list, .check-list {
      list-style: none;
      padding-left: 0;
    }

    .ordered-list li, .emphasis-list li, .check-list li {
      margin-bottom: 8px;
    }

    a {
      color: #03C75A;
      text-decoration: none;
      font-weight: 500;
    }
    a:hover {
      text-decoration: underline;
    }

    a.secondary {
      color: #FF6B35;
    }

    strong, b {
      font-weight: 700;
      color: #000;
    }

    /* Dark Mode Support */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1a1a1a;
        color: #e0e0e0;
      }

      strong, b {
        color: #fff;
      }

      a {
        color: #05d662;
      }
    }

    /* Custom Styles */
    .gradient-bg {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .card-hover {
      transition: all 0.3s ease;
    }

    .card-hover:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.15);
    }

    .loading-spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .fade-in {
      animation: fadeIn 0.5s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    #map {
      width: 100%;
      height: 400px;
      border-radius: 12px;
    }

    .analysis-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }

    @media (prefers-color-scheme: dark) {
      .analysis-card {
        background: #2a2a2a;
      }
    }

    .step-indicator {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .category-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      margin: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .category-badge:hover {
      transform: scale(1.05);
    }

    .category-badge.selected {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .stat-card {
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }

    @media (prefers-color-scheme: dark) {
      .stat-card {
        background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
      }
    }

    .markdown-content h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #667eea;
    }

    .markdown-content h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
    }

    .markdown-content ul {
      list-style-type: disc;
      padding-left: 1.5rem;
      margin: 0.5rem 0;
    }

    .markdown-content li {
      margin-bottom: 0.25rem;
    }

    .markdown-content p {
      margin: 0.5rem 0;
    }

    .markdown-content strong {
      color: #764ba2;
    }
  </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900 min-h-screen">
  <!-- Header -->
  <header class="gradient-bg text-white py-8 px-4">
    <div class="max-w-6xl mx-auto">
      <h1 class="text-3xl md:text-4xl font-bold mb-2">
        <i class="fas fa-map-marker-alt mr-2"></i>
        XIΛIX_BEST_MAP
      </h1>
      <p class="text-lg opacity-90">원클릭 상권분석 - 네이버스마트플레이스 & 구글업체등록 전 필수!</p>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto px-4 py-8">
    <!-- Step 1: 위치 선택 -->
    <section class="mb-8 fade-in">
      <div class="flex items-center mb-4">
        <div class="step-indicator mr-4">❶</div>
        <h2 class="text-2xl font-bold dark:text-white">어느 지역에서 창업하시나요?</h2>
      </div>
      
      <div class="analysis-card">
        <div class="flex flex-col md:flex-row gap-4 mb-4">
          <div class="flex-1">
            <label class="block text-sm font-medium mb-2 dark:text-gray-300">
              <i class="fas fa-search mr-1"></i> 주소 또는 장소 검색
            </label>
            <div class="flex gap-2">
              <input type="text" id="searchInput" 
                placeholder="예: 강남역, 홍대입구, 신촌역 맛집골목"
                class="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <button onclick="searchLocation()" 
                class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div class="flex items-end">
            <button onclick="getCurrentLocation()" 
              class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
              <i class="fas fa-location-crosshairs mr-2"></i> 현재 위치
            </button>
          </div>
        </div>
        
        <!-- 검색 결과 -->
        <div id="searchResults" class="hidden mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg max-h-60 overflow-y-auto"></div>
        
        <!-- 지도 -->
        <div id="map" class="mb-4"></div>
        
        <!-- 선택된 위치 정보 -->
        <div id="selectedLocation" class="hidden p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
          <p class="font-medium dark:text-white">
            <i class="fas fa-map-pin text-purple-600 mr-2"></i>
            <span id="selectedAddress">-</span>
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            좌표: <span id="selectedCoords">-</span>
          </p>
        </div>
      </div>
    </section>

    <!-- Step 2: 업종 선택 -->
    <section class="mb-8 fade-in">
      <div class="flex items-center mb-4">
        <div class="step-indicator mr-4">❷</div>
        <h2 class="text-2xl font-bold dark:text-white">어떤 업종으로 창업하시나요?</h2>
      </div>
      
      <div class="analysis-card">
        <div class="flex flex-wrap gap-2 mb-4">
          <span class="category-badge bg-red-100 text-red-800" data-code="Q" onclick="selectCategory(this)">
            <i class="fas fa-utensils mr-1"></i> 음식점
          </span>
          <span class="category-badge bg-blue-100 text-blue-800" data-code="D" onclick="selectCategory(this)">
            <i class="fas fa-store mr-1"></i> 소매
          </span>
          <span class="category-badge bg-green-100 text-green-800" data-code="F" onclick="selectCategory(this)">
            <i class="fas fa-concierge-bell mr-1"></i> 생활서비스
          </span>
          <span class="category-badge bg-yellow-100 text-yellow-800" data-code="N" onclick="selectCategory(this)">
            <i class="fas fa-dumbbell mr-1"></i> 스포츠/오락
          </span>
          <span class="category-badge bg-purple-100 text-purple-800" data-code="L" onclick="selectCategory(this)">
            <i class="fas fa-house mr-1"></i> 부동산
          </span>
          <span class="category-badge bg-pink-100 text-pink-800" data-code="P" onclick="selectCategory(this)">
            <i class="fas fa-graduation-cap mr-1"></i> 학문/교육
          </span>
          <span class="category-badge bg-indigo-100 text-indigo-800" data-code="R" onclick="selectCategory(this)">
            <i class="fas fa-briefcase-medical mr-1"></i> 의료
          </span>
          <span class="category-badge bg-gray-100 text-gray-800" data-code="" onclick="selectCategory(this)">
            <i class="fas fa-list mr-1"></i> 전체
          </span>
        </div>
        
        <div id="selectedCategoryInfo" class="hidden p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p class="text-sm dark:text-gray-300">
            ■ 선택된 업종: <strong id="selectedCategoryName">-</strong>
          </p>
        </div>
      </div>
    </section>

    <!-- Step 3: 분석 반경 설정 -->
    <section class="mb-8 fade-in">
      <div class="flex items-center mb-4">
        <div class="step-indicator mr-4">❸</div>
        <h2 class="text-2xl font-bold dark:text-white">분석 반경을 설정하세요</h2>
      </div>
      
      <div class="analysis-card">
        <div class="flex flex-wrap gap-3">
          <button class="radius-btn px-6 py-3 rounded-lg border-2 border-purple-300 hover:border-purple-500 transition dark:text-white" data-radius="300" onclick="selectRadius(this)">
            300m
          </button>
          <button class="radius-btn px-6 py-3 rounded-lg border-2 border-purple-500 bg-purple-500 text-white" data-radius="500" onclick="selectRadius(this)">
            500m
          </button>
          <button class="radius-btn px-6 py-3 rounded-lg border-2 border-purple-300 hover:border-purple-500 transition dark:text-white" data-radius="1000" onclick="selectRadius(this)">
            1km
          </button>
          <button class="radius-btn px-6 py-3 rounded-lg border-2 border-purple-300 hover:border-purple-500 transition dark:text-white" data-radius="2000" onclick="selectRadius(this)">
            2km
          </button>
        </div>
      </div>
    </section>

    <!-- 분석 시작 버튼 -->
    <section class="mb-8 text-center">
      <button onclick="startAnalysis()" 
        class="px-12 py-4 text-xl font-bold text-white gradient-bg rounded-xl hover:opacity-90 transition shadow-lg card-hover">
        <i class="fas fa-rocket mr-2"></i> 원클릭 상권분석 시작!
      </button>
    </section>

    <!-- 로딩 상태 -->
    <div id="loadingSection" class="hidden mb-8">
      <div class="analysis-card text-center py-12">
        <div class="loading-spinner inline-block w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full mb-4"></div>
        <p class="text-xl font-medium dark:text-white" id="loadingText">상권 데이터를 수집하고 있습니다...</p>
        <p class="text-gray-500 dark:text-gray-400 mt-2" id="loadingSubText">잠시만 기다려주세요</p>
      </div>
    </div>

    <!-- 분석 결과 -->
    <section id="resultSection" class="hidden">
      <!-- 요약 통계 -->
      <div class="mb-8 fade-in">
        <h2 class="text-2xl font-bold mb-4 dark:text-white">
          <i class="fas fa-chart-bar text-purple-600 mr-2"></i> 상권 분석 요약
        </h2>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="stat-card">
            <p class="text-3xl font-bold text-purple-600" id="totalStores">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">총 상가 수</p>
          </div>
          <div class="stat-card">
            <p class="text-3xl font-bold text-blue-600" id="sameCategory">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">동종 업종</p>
          </div>
          <div class="stat-card">
            <p class="text-3xl font-bold text-green-600" id="competitorRatio">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">경쟁 밀도</p>
          </div>
          <div class="stat-card">
            <p class="text-3xl font-bold text-orange-600" id="riskLevel">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">위험도</p>
          </div>
        </div>
      </div>

      <!-- 업종별 현황 -->
      <div class="mb-8 fade-in">
        <h2 class="text-2xl font-bold mb-4 dark:text-white">
          <i class="fas fa-list-ul text-purple-600 mr-2"></i> 업종별 현황
        </h2>
        <div class="analysis-card">
          <div id="categoryBreakdown" class="space-y-3"></div>
        </div>
      </div>

      <!-- AI 분석 결과 -->
      <div class="mb-8 fade-in">
        <h2 class="text-2xl font-bold mb-4 dark:text-white">
          <i class="fas fa-robot text-purple-600 mr-2"></i> AI 맞춤 분석 리포트
        </h2>
        <div class="analysis-card">
          <div id="aiAnalysis" class="markdown-content prose dark:prose-invert max-w-none"></div>
        </div>
      </div>

      <!-- 마케팅 추천 -->
      <div class="mb-8 fade-in">
        <h2 class="text-2xl font-bold mb-4 dark:text-white">
          <i class="fas fa-bullhorn text-purple-600 mr-2"></i> 맞춤 마케팅 전략
        </h2>
        <div class="analysis-card">
          <div id="marketingAdvice" class="markdown-content prose dark:prose-invert max-w-none"></div>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="bg-gray-800 text-white py-8 px-4 mt-16">
    <div class="max-w-6xl mx-auto text-center">
      <a href="https://xivix.kr/" target="_blank" class="text-xl font-bold hover:text-purple-400 transition">
        @XIΛIX
      </a>
      <p class="text-gray-400 mt-2">© 2026. ALL RIGHTS RESERVED.</p>
    </div>
  </footer>

  <script>
    // ============================================
    // Global Variables
    // ============================================
    let map = null;
    let currentMarker = null;
    let currentCircle = null;
    let selectedLat = null;
    let selectedLon = null;
    let selectedAddress = '';
    let selectedCategory = '';
    let selectedCategoryName = '전체';
    let selectedRadius = 500;

    // ============================================
    // Initialize Map
    // ============================================
    function initMap() {
      const mapOptions = {
        center: new naver.maps.LatLng(37.5665, 126.9780),
        zoom: 15,
        zoomControl: true,
        zoomControlOptions: {
          position: naver.maps.Position.TOP_RIGHT
        }
      };
      
      map = new naver.maps.Map('map', mapOptions);
      
      // 지도 클릭 이벤트
      naver.maps.Event.addListener(map, 'click', function(e) {
        const lat = e.coord.lat();
        const lon = e.coord.lng();
        setLocation(lat, lon);
        reverseGeocode(lat, lon);
      });
    }

    // ============================================
    // Location Functions
    // ============================================
    async function searchLocation() {
      const keyword = document.getElementById('searchInput').value.trim();
      if (!keyword) {
        alert('검색어를 입력해주세요');
        return;
      }

      try {
        const response = await fetch('/api/tmap/search?keyword=' + encodeURIComponent(keyword));
        const data = await response.json();
        
        if (data.error) {
          alert('검색 오류: ' + data.error);
          return;
        }
        
        const pois = data.searchPoiInfo?.pois?.poi || [];
        if (pois.length === 0) {
          alert('검색 결과가 없습니다');
          return;
        }
        
        // 검색 결과 표시
        const resultsDiv = document.getElementById('searchResults');
        resultsDiv.innerHTML = '';
        resultsDiv.classList.remove('hidden');
        
        pois.forEach((poi, index) => {
          const item = document.createElement('div');
          item.className = 'p-3 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer rounded-lg transition mb-2';
          item.innerHTML = \`
            <p class="font-medium dark:text-white">\${poi.name}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">\${poi.upperAddrName} \${poi.middleAddrName} \${poi.lowerAddrName} \${poi.detailAddrName || ''}</p>
          \`;
          item.onclick = () => {
            const lat = parseFloat(poi.noorLat);
            const lon = parseFloat(poi.noorLon);
            setLocation(lat, lon);
            selectedAddress = \`\${poi.upperAddrName} \${poi.middleAddrName} \${poi.lowerAddrName} \${poi.detailAddrName || ''} (\${poi.name})\`;
            updateSelectedLocation();
            resultsDiv.classList.add('hidden');
          };
          resultsDiv.appendChild(item);
        });
        
      } catch (error) {
        console.error('Search error:', error);
        alert('검색 중 오류가 발생했습니다');
      }
    }

    function getCurrentLocation() {
      if (!navigator.geolocation) {
        alert('브라우저가 위치 서비스를 지원하지 않습니다');
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setLocation(lat, lon);
          reverseGeocode(lat, lon);
        },
        (error) => {
          alert('위치를 가져올 수 없습니다: ' + error.message);
        }
      );
    }

    function setLocation(lat, lon) {
      selectedLat = lat;
      selectedLon = lon;
      
      // 마커 업데이트
      if (currentMarker) {
        currentMarker.setMap(null);
      }
      
      const position = new naver.maps.LatLng(lat, lon);
      currentMarker = new naver.maps.Marker({
        position: position,
        map: map,
        icon: {
          content: '<div style="width:30px;height:30px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);"></div>',
          anchor: new naver.maps.Point(15, 15)
        }
      });
      
      // 반경 원 업데이트
      updateRadiusCircle();
      
      // 지도 이동
      map.setCenter(position);
      map.setZoom(16);
    }

    function updateRadiusCircle() {
      if (currentCircle) {
        currentCircle.setMap(null);
      }
      
      if (selectedLat && selectedLon) {
        currentCircle = new naver.maps.Circle({
          map: map,
          center: new naver.maps.LatLng(selectedLat, selectedLon),
          radius: selectedRadius,
          fillColor: '#667eea',
          fillOpacity: 0.1,
          strokeColor: '#764ba2',
          strokeWeight: 2,
          strokeOpacity: 0.8
        });
      }
    }

    async function reverseGeocode(lat, lon) {
      try {
        const response = await fetch(\`/api/tmap/reverse-geocode?lat=\${lat}&lon=\${lon}\`);
        const data = await response.json();
        
        if (data.error) {
          selectedAddress = \`위도: \${lat.toFixed(6)}, 경도: \${lon.toFixed(6)}\`;
        } else {
          const addr = data.addressInfo;
          selectedAddress = \`\${addr.city_do} \${addr.gu_gun} \${addr.eup_myun} \${addr.legalDong || ''} \${addr.ri || ''} \${addr.roadName || ''} \${addr.buildingIndex || ''}\`.trim();
        }
        
        updateSelectedLocation();
      } catch (error) {
        console.error('Reverse geocode error:', error);
        selectedAddress = \`위도: \${lat.toFixed(6)}, 경도: \${lon.toFixed(6)}\`;
        updateSelectedLocation();
      }
    }

    function updateSelectedLocation() {
      document.getElementById('selectedLocation').classList.remove('hidden');
      document.getElementById('selectedAddress').textContent = selectedAddress || '-';
      document.getElementById('selectedCoords').textContent = \`\${selectedLat?.toFixed(6)}, \${selectedLon?.toFixed(6)}\`;
    }

    // ============================================
    // Category Selection
    // ============================================
    function selectCategory(el) {
      document.querySelectorAll('.category-badge').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      selectedCategory = el.dataset.code;
      selectedCategoryName = el.textContent.trim();
      
      document.getElementById('selectedCategoryInfo').classList.remove('hidden');
      document.getElementById('selectedCategoryName').textContent = selectedCategoryName;
    }

    // ============================================
    // Radius Selection
    // ============================================
    function selectRadius(el) {
      document.querySelectorAll('.radius-btn').forEach(b => {
        b.classList.remove('bg-purple-500', 'text-white', 'border-purple-500');
        b.classList.add('border-purple-300');
      });
      el.classList.add('bg-purple-500', 'text-white', 'border-purple-500');
      el.classList.remove('border-purple-300');
      selectedRadius = parseInt(el.dataset.radius);
      
      updateRadiusCircle();
    }

    // ============================================
    // Analysis
    // ============================================
    async function startAnalysis() {
      if (!selectedLat || !selectedLon) {
        alert('먼저 위치를 선택해주세요');
        return;
      }

      // 로딩 표시
      document.getElementById('loadingSection').classList.remove('hidden');
      document.getElementById('resultSection').classList.add('hidden');

      try {
        // 1. 상권 데이터 수집
        updateLoading('주변 상권 데이터를 수집하고 있습니다...', 'T-MAP 및 소상공인 API 연동 중');
        
        const storeData = await fetchStoreData();
        
        // 2. 데이터 분석
        updateLoading('수집된 데이터를 분석하고 있습니다...', '업종별 현황 파악 중');
        
        const analysisResult = analyzeStoreData(storeData);
        displayBasicAnalysis(analysisResult);
        
        // 3. AI 분석
        updateLoading('AI가 맞춤 분석을 진행하고 있습니다...', 'Gemini 2.5 Pro 분석 중');
        
        await performAIAnalysis(analysisResult);
        
        // 완료
        document.getElementById('loadingSection').classList.add('hidden');
        document.getElementById('resultSection').classList.remove('hidden');
        
      } catch (error) {
        console.error('Analysis error:', error);
        document.getElementById('loadingSection').classList.add('hidden');
        alert('분석 중 오류가 발생했습니다: ' + error.message);
      }
    }

    function updateLoading(text, subText) {
      document.getElementById('loadingText').textContent = text;
      document.getElementById('loadingSubText').textContent = subText;
    }

    async function fetchStoreData() {
      let url = \`/api/semas/radius?cx=\${selectedLon}&cy=\${selectedLat}&radius=\${selectedRadius}\`;
      if (selectedCategory) {
        url += \`&indsLclsCd=\${selectedCategory}\`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data;
    }

    function analyzeStoreData(data) {
      const items = data.body?.items || [];
      const totalCount = data.body?.totalCount || 0;
      
      // 업종별 분류
      const categoryCount = {};
      const categoryNames = {
        'Q': '음식점', 'D': '소매', 'F': '생활서비스', 
        'N': '스포츠/오락', 'L': '부동산', 'P': '학문/교육', 
        'R': '의료', 'O': '숙박', 'S': '수리/개인', 'E': '제조'
      };
      
      items.forEach(item => {
        const code = item.indsLclsCd || 'Z';
        const name = categoryNames[code] || item.indsLclsNm || '기타';
        if (!categoryCount[name]) {
          categoryCount[name] = { count: 0, items: [] };
        }
        categoryCount[name].count++;
        categoryCount[name].items.push(item);
      });
      
      // 동종 업종 수
      const sameCategoryCount = selectedCategory ? 
        (categoryCount[selectedCategoryName]?.count || 0) : totalCount;
      
      // 경쟁 밀도 계산 (반경 면적 대비 상가 수)
      const areaKm2 = Math.PI * Math.pow(selectedRadius / 1000, 2);
      const density = (totalCount / areaKm2).toFixed(1);
      
      // 위험도 판단
      let riskLevel = '낮음';
      if (sameCategoryCount > 30) riskLevel = '높음';
      else if (sameCategoryCount > 15) riskLevel = '보통';
      
      return {
        totalCount,
        sameCategoryCount,
        density,
        riskLevel,
        categoryCount,
        items,
        address: selectedAddress,
        radius: selectedRadius,
        category: selectedCategoryName
      };
    }

    function displayBasicAnalysis(result) {
      document.getElementById('totalStores').textContent = result.totalCount.toLocaleString() + '개';
      document.getElementById('sameCategory').textContent = result.sameCategoryCount.toLocaleString() + '개';
      document.getElementById('competitorRatio').textContent = result.density + '/km²';
      document.getElementById('riskLevel').textContent = result.riskLevel;
      
      // 업종별 현황
      const breakdown = document.getElementById('categoryBreakdown');
      breakdown.innerHTML = '';
      
      const sortedCategories = Object.entries(result.categoryCount)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);
      
      sortedCategories.forEach(([name, data]) => {
        const percentage = ((data.count / result.totalCount) * 100).toFixed(1);
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg';
        item.innerHTML = \`
          <span class="font-medium dark:text-white">\${name}</span>
          <div class="flex items-center gap-4">
            <div class="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-3">
              <div class="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full" style="width: \${Math.min(percentage * 2, 100)}%"></div>
            </div>
            <span class="text-sm text-gray-600 dark:text-gray-300 w-20 text-right">\${data.count}개 (\${percentage}%)</span>
          </div>
        \`;
        breakdown.appendChild(item);
      });
    }

    async function performAIAnalysis(result) {
      const prompt = \`
당신은 상권분석 전문가입니다. 아래 데이터를 기반으로 창업 희망자에게 맞춤형 분석 리포트를 작성해주세요.

## 분석 대상 정보
- 위치: \${result.address}
- 분석 반경: \${result.radius}m
- 희망 업종: \${result.category}

## 상권 현황 데이터
- 총 상가 수: \${result.totalCount}개
- 동종 업종 수: \${result.sameCategoryCount}개
- 상가 밀도: \${result.density}개/km²
- 경쟁 위험도: \${result.riskLevel}

## 업종별 분포
\${Object.entries(result.categoryCount).map(([name, data]) => \`- \${name}: \${data.count}개\`).join('\\n')}

## 요청사항
1. 해당 지역의 상권 특성을 분석해주세요
2. \${result.category} 업종 창업 시 예상되는 기회와 위험을 분석해주세요
3. 경쟁 현황과 차별화 전략을 제안해주세요
4. 네이버스마트플레이스와 구글 비즈니스 등록 전 준비사항을 안내해주세요

응답은 마크다운 형식으로 작성하되, 한국어로 작성해주세요.
각 섹션은 ## 헤더로 구분하고, 핵심 내용은 **볼드**로 강조해주세요.
리스트는 - 또는 숫자 형식을 사용해주세요.
\`;

      try {
        const response = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: 'pro' })
        });
        
        const data = await response.json();
        
        if (data.error) {
          document.getElementById('aiAnalysis').innerHTML = '<p class="text-red-500">AI 분석 중 오류가 발생했습니다: ' + data.error + '</p>';
        } else {
          document.getElementById('aiAnalysis').innerHTML = formatMarkdown(data.result);
        }
        
        // 마케팅 전략 분석
        await performMarketingAnalysis(result);
        
      } catch (error) {
        console.error('AI analysis error:', error);
        document.getElementById('aiAnalysis').innerHTML = '<p class="text-red-500">AI 분석 중 오류가 발생했습니다</p>';
      }
    }

    async function performMarketingAnalysis(result) {
      const prompt = \`
당신은 소상공인 마케팅 전문가입니다. 아래 상권 데이터를 기반으로 맞춤형 마케팅 전략을 제안해주세요.

## 상권 정보
- 위치: \${result.address}
- 희망 업종: \${result.category}
- 주변 경쟁업체 수: \${result.sameCategoryCount}개
- 경쟁 밀도: \${result.density}개/km²

## 요청사항
1. 네이버 스마트플레이스 최적화 전략
2. 구글 비즈니스 프로필 최적화 전략
3. 온라인 마케팅 채널별 추천 (블로그, 인스타그램, 배달앱 등)
4. 오프라인 마케팅 전략
5. 초기 3개월 마케팅 로드맵

응답은 마크다운 형식으로 작성하고, 실행 가능한 구체적인 액션 아이템을 포함해주세요.
각 섹션은 ## 헤더로 구분하고, 핵심 내용은 **볼드**로 강조해주세요.
\`;

      try {
        const response = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: 'flash' })
        });
        
        const data = await response.json();
        
        if (data.error) {
          document.getElementById('marketingAdvice').innerHTML = '<p class="text-red-500">마케팅 분석 중 오류가 발생했습니다: ' + data.error + '</p>';
        } else {
          document.getElementById('marketingAdvice').innerHTML = formatMarkdown(data.result);
        }
        
      } catch (error) {
        console.error('Marketing analysis error:', error);
        document.getElementById('marketingAdvice').innerHTML = '<p class="text-red-500">마케팅 분석 중 오류가 발생했습니다</p>';
      }
    }

    function formatMarkdown(text) {
      // 간단한 마크다운 변환
      return text
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
        .replace(/^(\\d+)\\. (.+)$/gm, '<li>$2</li>')
        .replace(/\\n\\n/g, '</p><p>')
        .replace(/\\n/g, '<br>');
    }

    // Enter 키 검색 지원
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchLocation();
      }
    });

    // 페이지 로드 시 지도 초기화
    window.addEventListener('load', initMap);
  </script>
</body>
</html>`)
})

export default app
