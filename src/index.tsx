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
  KAKAO_REST_API_KEY: string
  KAKAO_JS_KEY: string
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
  const modelName = model === 'pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash'
  
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
  const indsLclsCd = c.req.query('indsLclsCd') || ''
  
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

// 소상공인 상권정보 API (공식 sdsc2 엔드포인트) - 반경 내 상가 조회
app.get('/api/semas/radius', async (c) => {
  const cx = c.req.query('cx')
  const cy = c.req.query('cy')
  const radius = c.req.query('radius') || '500'
  const category = c.req.query('category') || ''
  
  if (!cx || !cy) {
    return c.json({ error: 'cx and cy are required' }, 400)
  }
  
  try {
    // 소상공인 상권정보 API 호출 (새 엔드포인트: sdsc2)
    const apiUrl = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${c.env.SEMAS_API_KEY}&radius=${radius}&cx=${cx}&cy=${cy}&type=json&numOfRows=1000`;
    
    console.log('SEMAS API URL:', apiUrl.replace(c.env.SEMAS_API_KEY, 'HIDDEN'));
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SEMAS API Error:', errorText);
      return c.json({ error: `소상공인 API 오류: ${response.status}` }, 500);
    }
    
    const data = await response.json();
    
    if (data.header?.resultCode !== '00') {
      return c.json({ error: `API 응답 오류: ${data.header?.resultMsg}` }, 500);
    }
    
    const items = data.body?.items || [];
    const totalCount = data.body?.totalCount || 0;
    
    // 업종별 분류를 위한 매핑
    const categoryMapping: Record<string, string> = {
      'S207': '이용·미용',
      'I201': '한식',
      'I202': '중식',
      'I203': '일식',
      'I204': '양식',
      'I205': '제과/패스트푸드',
      'I206': '치킨/피자',
      'I210': '기타 간이음식',
      'I211': '주점',
      'I212': '비알코올(카페)',
      'G204': '종합소매',
      'G205': '음·식료품 소매',
      'G215': '의약·화장품 소매',
      'Q101': '병원',
      'Q102': '의원',
      'P101': '학교',
      'P105': '일반 교육',
      'P106': '기타 교육',
      'L102': '부동산 서비스',
      'R103': '스포츠 서비스',
    };
    
    // 선택한 업종에 해당하는 중분류 코드
    const categoryToCode: Record<string, string[]> = {
      '미용실': ['S207'],
      '음식점': ['I201', 'I202', 'I203', 'I204', 'I205', 'I206', 'I210'],
      '카페': ['I212'],
      '편의점': ['G204', 'G205'],
      '병원': ['Q101', 'Q102'],
      '약국': ['G215'],
      '학원': ['P105', 'P106'],
      '헬스장': ['R103'],
      '부동산': ['L102'],
    };
    
    // 동종 업종 필터링
    const targetCodes = categoryToCode[category] || [];
    let targetCategoryCount = 0;
    const competitorList: any[] = [];
    
    // 업종별 카운트
    const categoryCount: Record<string, { count: number; items: any[] }> = {};
    
    items.forEach((item: any) => {
      const mclsCd = item.indsMclsCd || '';
      const mclsNm = item.indsMclsNm || categoryMapping[mclsCd] || '기타';
      
      // 카테고리 집계
      if (!categoryCount[mclsNm]) {
        categoryCount[mclsNm] = { count: 0, items: [] };
      }
      categoryCount[mclsNm].count++;
      categoryCount[mclsNm].items.push(item);
      
      // 동종 업종 체크 - isTargetCategory 플래그 설정
      const isTarget = targetCodes.length > 0 && targetCodes.includes(mclsCd);
      item.isTargetCategory = isTarget;
      
      if (isTarget) {
        targetCategoryCount++;
        competitorList.push({
          name: item.bizesNm,
          branch: item.brchNm || '',
          category: item.indsSclsNm || mclsNm,
          address: item.rdnmAdr || item.lnoAdr,
          lon: item.lon,
          lat: item.lat
        });
      }
    });
    
    // 동종 업종이 없으면 상호명으로 추가 검색
    if (targetCategoryCount === 0 && category) {
      items.forEach((item: any) => {
        const bizName = (item.bizesNm || '').toLowerCase();
        const categoryLower = category.toLowerCase();
        
        const isMatch = 
          (categoryLower.includes('미용') && (bizName.includes('미용') || bizName.includes('헤어') || bizName.includes('hair'))) ||
          (categoryLower.includes('카페') && (bizName.includes('카페') || bizName.includes('cafe') || bizName.includes('커피')));
        
        if (isMatch) {
          item.isTargetCategory = true;
          targetCategoryCount++;
          competitorList.push({
            name: item.bizesNm,
            branch: item.brchNm || '',
            category: item.indsSclsNm || item.indsMclsNm,
            address: item.rdnmAdr || item.lnoAdr,
            lon: item.lon,
            lat: item.lat
          });
        }
      });
    }
    
    return c.json({
      body: {
        items,
        totalCount,
        targetCategoryCount,
        competitorList,
        categoryCount,
        dataDate: data.header?.stdrYm || '',
        searchCategory: category
      },
      dataSource: 'semas_official_api',
      message: `소상공인시장진흥공단 상권정보 API (데이터 기준: ${data.header?.stdrYm || 'N/A'}). 반경 ${radius}m 내 총 ${totalCount}개 업소, 동종 업종(${category || '전체'}): ${targetCategoryCount}개`
    });
  } catch (error: any) {
    console.error('SEMAS API Error:', error);
    return c.json({ error: error.message }, 500);
  }
})

// 카테고리 코드 매핑 함수
function getCategoryCode(naverCategory: string, searchedCategory: string): string {
  const catLower = (naverCategory || '').toLowerCase();
  const searched = (searchedCategory || '').toLowerCase();
  
  // 검색한 카테고리 기반 매핑
  if (searched.includes('미용') || searched.includes('헤어') || searched.includes('네일') || searched.includes('피부')) return 'F';
  if (searched.includes('음식') || searched.includes('카페') || searched.includes('식당') || searched.includes('치킨') || searched.includes('피자')) return 'Q';
  if (searched.includes('편의점') || searched.includes('마트') || searched.includes('슈퍼')) return 'D';
  if (searched.includes('병원') || searched.includes('약국') || searched.includes('의원') || searched.includes('치과')) return 'R';
  if (searched.includes('학원') || searched.includes('교육')) return 'P';
  if (searched.includes('헬스') || searched.includes('스포츠') || searched.includes('요가') || searched.includes('필라테스')) return 'N';
  if (searched.includes('부동산')) return 'L';
  if (searched.includes('세탁')) return 'F';
  
  // 네이버 카테고리 기반 매핑
  if (catLower.includes('음식') || catLower.includes('카페') || catLower.includes('식당')) return 'Q';
  if (catLower.includes('판매') || catLower.includes('마트') || catLower.includes('편의점') || catLower.includes('소매')) return 'D';
  if (catLower.includes('미용') || catLower.includes('세탁') || catLower.includes('서비스') || catLower.includes('네일')) return 'F';
  if (catLower.includes('스포츠') || catLower.includes('헬스') || catLower.includes('오락')) return 'N';
  if (catLower.includes('부동산')) return 'L';
  if (catLower.includes('학원') || catLower.includes('교육')) return 'P';
  if (catLower.includes('병원') || catLower.includes('의원') || catLower.includes('약국') || catLower.includes('의료')) return 'R';
  
  return 'Z';
}

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

// ============================================
// 🔥 다중 API 통합 상권분석 (Multi-API Analysis)
// ============================================
app.get('/api/analysis/multi', async (c) => {
  const cx = c.req.query('cx')  // 경도
  const cy = c.req.query('cy')  // 위도
  const radius = c.req.query('radius') || '1000'  // 반경(m)
  const category = c.req.query('category') || '미용실'  // 업종
  const address = c.req.query('address') || ''  // 주소 (지역명 추출용)
  
  if (!cx || !cy) {
    return c.json({ error: 'cx(경도)와 cy(위도)는 필수입니다' }, 400)
  }
  
  const radiusKm = parseInt(radius) / 1000  // km 단위로 변환
  const results: any = {
    meta: {
      coordinates: { lon: parseFloat(cx), lat: parseFloat(cy) },
      radius: parseInt(radius),
      radiusKm,
      category,
      address,
      analyzedAt: new Date().toISOString(),
    },
    sources: {},
    summary: {},
    competitors: [],
    categoryBreakdown: {},
  }
  
  // 지역명 추출 (주소에서)
  const locationKeyword = address.split(' ').slice(0, 3).join(' ') || '해당 지역'
  
  // ===== 1. 카카오 로컬 API (좌표+반경 검색) =====
  try {
    const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
    kakaoUrl.searchParams.set('query', category)
    kakaoUrl.searchParams.set('x', cx)
    kakaoUrl.searchParams.set('y', cy)
    kakaoUrl.searchParams.set('radius', radius)
    kakaoUrl.searchParams.set('size', '15')
    kakaoUrl.searchParams.set('sort', 'distance')
    
    const kakaoResponse = await fetch(kakaoUrl.toString(), {
      headers: { 'Authorization': `KakaoAK ${c.env.KAKAO_REST_API_KEY}` }
    })
    
    if (kakaoResponse.ok) {
      const kakaoData = await kakaoResponse.json()
      const meta = kakaoData.meta || {}
      const docs = kakaoData.documents || []
      
      results.sources.kakao = {
        totalCount: meta.total_count || 0,
        returnedCount: docs.length,
        isAccurate: !meta.is_end,  // 더 많은 결과가 있는지
        items: docs.map((d: any) => ({
          name: d.place_name,
          category: d.category_name,
          address: d.road_address_name || d.address_name,
          phone: d.phone,
          distance: parseInt(d.distance) || 0,
          lon: parseFloat(d.x),
          lat: parseFloat(d.y),
          placeUrl: d.place_url,
        }))
      }
    }
  } catch (error: any) {
    console.error('Kakao API Error:', error.message)
    results.sources.kakao = { error: error.message }
  }
  
  // ===== 2. T-MAP POI API (반경 검색) =====
  try {
    const tmapUrl = new URL('https://apis.openapi.sk.com/tmap/pois/search/around')
    tmapUrl.searchParams.set('version', '1')
    tmapUrl.searchParams.set('centerLon', cx)
    tmapUrl.searchParams.set('centerLat', cy)
    tmapUrl.searchParams.set('categories', category)
    tmapUrl.searchParams.set('radius', radiusKm.toString())
    tmapUrl.searchParams.set('count', '20')
    tmapUrl.searchParams.set('resCoordType', 'WGS84GEO')
    
    const tmapResponse = await fetch(tmapUrl.toString(), {
      headers: { 'appKey': c.env.TMAP_API_KEY }
    })
    
    if (tmapResponse.ok) {
      const tmapData = await tmapResponse.json()
      const poiInfo = tmapData.searchPoiInfo || {}
      const pois = poiInfo.pois?.poi || []
      
      results.sources.tmap = {
        totalCount: poiInfo.totalCount || 0,
        returnedCount: pois.length,
        items: pois.map((p: any) => ({
          name: p.name,
          address: p.roadName ? `${p.upperAddrName} ${p.middleAddrName} ${p.roadName} ${p.buildingNo1}` : 
                   `${p.upperAddrName} ${p.middleAddrName} ${p.lowerAddrName}`,
          phone: p.telNo,
          distance: parseFloat(p.radius) * 1000,  // km to m
          lon: parseFloat(p.frontLon),
          lat: parseFloat(p.frontLat),
        }))
      }
    }
  } catch (error: any) {
    console.error('T-MAP API Error:', error.message)
    results.sources.tmap = { error: error.message }
  }
  
  // ===== 3. 네이버 지역검색 API (키워드 검색) =====
  try {
    const naverQuery = `${locationKeyword} ${category}`
    const naverUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(naverQuery)}&display=15&sort=comment`
    
    const naverResponse = await fetch(naverUrl, {
      headers: {
        'X-Naver-Client-Id': c.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': c.env.NAVER_CLIENT_SECRET
      }
    })
    
    if (naverResponse.ok) {
      const naverData = await naverResponse.json()
      const items = naverData.items || []
      
      results.sources.naver = {
        totalCount: naverData.total || 0,
        returnedCount: items.length,
        searchQuery: naverQuery,
        items: items.map((item: any) => ({
          name: item.title.replace(/<[^>]*>/g, ''),  // HTML 태그 제거
          category: item.category,
          address: item.roadAddress || item.address,
          phone: item.telephone,
          lon: item.mapx ? parseInt(item.mapx) / 10000000 : null,
          lat: item.mapy ? parseInt(item.mapy) / 10000000 : null,
        }))
      }
    }
  } catch (error: any) {
    console.error('Naver API Error:', error.message)
    results.sources.naver = { error: error.message }
  }
  
  // ===== 4. 소상공인 상권정보 API (공식 통계) =====
  try {
    const semasUrl = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${c.env.SEMAS_API_KEY}&radius=${radius}&cx=${cx}&cy=${cy}&type=json&numOfRows=1000`
    
    const semasResponse = await fetch(semasUrl)
    
    if (semasResponse.ok) {
      const semasData = await semasResponse.json()
      
      if (semasData.header?.resultCode === '00') {
        const items = semasData.body?.items || []
        const totalCount = semasData.body?.totalCount || 0
        const dataDate = semasData.header?.stdrYm || ''
        
        // 업종별 분류
        const categoryCount: Record<string, number> = {}
        const targetItems: any[] = []
        
        // 동종 업종 코드 매핑
        const categoryCodeMap: Record<string, string[]> = {
          '미용실': ['S207'],
          '음식점': ['I201', 'I202', 'I203', 'I204', 'I205', 'I206', 'I210'],
          '카페': ['I212'],
          '편의점': ['G204', 'G205'],
          '병원': ['Q101', 'Q102'],
          '약국': ['G215'],
          '학원': ['P105', 'P106'],
          '헬스장': ['R103'],
          '부동산': ['L102'],
        }
        
        const targetCodes = categoryCodeMap[category] || []
        
        items.forEach((item: any) => {
          const mclsCd = item.indsMclsCd || ''
          const mclsNm = item.indsMclsNm || '기타'
          
          // 업종별 카운트
          categoryCount[mclsNm] = (categoryCount[mclsNm] || 0) + 1
          
          // 동종 업종 필터
          if (targetCodes.includes(mclsCd)) {
            targetItems.push({
              name: item.bizesNm,
              category: item.indsSclsNm || mclsNm,
              address: item.rdnmAdr || item.lnoAdr,
              lon: parseFloat(item.lon),
              lat: parseFloat(item.lat),
              source: 'semas'
            })
          }
        })
        
        results.sources.semas = {
          totalCount,
          targetCategoryCount: targetItems.length,
          dataDate,
          dataSource: '소상공인시장진흥공단 공식 통계',
          categoryBreakdown: categoryCount,
          items: targetItems.slice(0, 30)  // 상위 30개만
        }
        
        // 전체 업종 분포 저장
        results.categoryBreakdown = categoryCount
      }
    }
  } catch (error: any) {
    console.error('SEMAS API Error:', error.message)
    results.sources.semas = { error: error.message }
  }
  
  // ===== 데이터 통합 및 교차 검증 =====
  const allCompetitors: Map<string, any> = new Map()
  
  // 각 소스에서 경쟁업체 수집 및 중복 제거
  const addCompetitors = (source: string, items: any[]) => {
    items.forEach(item => {
      const key = `${item.name}_${item.address}`.toLowerCase().replace(/\s/g, '')
      if (!allCompetitors.has(key)) {
        allCompetitors.set(key, { ...item, sources: [source] })
      } else {
        const existing = allCompetitors.get(key)
        if (!existing.sources.includes(source)) {
          existing.sources.push(source)
        }
        // 추가 정보 병합
        if (item.phone && !existing.phone) existing.phone = item.phone
        if (item.distance && !existing.distance) existing.distance = item.distance
        if (item.placeUrl && !existing.placeUrl) existing.placeUrl = item.placeUrl
      }
    })
  }
  
  if (results.sources.kakao?.items) addCompetitors('kakao', results.sources.kakao.items)
  if (results.sources.tmap?.items) addCompetitors('tmap', results.sources.tmap.items)
  if (results.sources.naver?.items) addCompetitors('naver', results.sources.naver.items)
  if (results.sources.semas?.items) addCompetitors('semas', results.sources.semas.items)
  
  // 경쟁업체 리스트 (여러 소스에서 확인된 업체 우선)
  results.competitors = Array.from(allCompetitors.values())
    .sort((a, b) => {
      // 1. 다중 소스 확인된 업체 우선
      if (b.sources.length !== a.sources.length) return b.sources.length - a.sources.length
      // 2. 거리순
      return (a.distance || 9999) - (b.distance || 9999)
    })
  
  // ===== 요약 통계 생성 =====
  const kakaoCount = results.sources.kakao?.totalCount || 0
  const tmapCount = results.sources.tmap?.totalCount || 0
  const semasCount = results.sources.semas?.targetCategoryCount || 0
  
  // 추정치 계산 (가중 평균)
  const estimatedCount = Math.round(
    (kakaoCount * 0.4) + (tmapCount * 0.3) + (semasCount * 0.3)
  )
  
  const areaKm2 = Math.PI * Math.pow(parseInt(radius) / 1000, 2)
  const density = estimatedCount / areaKm2
  
  // 위험도 평가
  let riskLevel = ''
  let riskColor = ''
  let riskDescription = ''
  
  if (estimatedCount === 0) {
    riskLevel = '블루오션'
    riskColor = 'blue'
    riskDescription = '경쟁업체가 거의 없는 미개척 시장'
  } else if (estimatedCount <= 10) {
    riskLevel = '낮음'
    riskColor = 'green'
    riskDescription = `경쟁업체 ${estimatedCount}개 - 진입 용이`
  } else if (estimatedCount <= 30) {
    riskLevel = '보통'
    riskColor = 'yellow'
    riskDescription = `경쟁업체 ${estimatedCount}개 - 차별화 필요`
  } else if (estimatedCount <= 70) {
    riskLevel = '높음'
    riskColor = 'orange'
    riskDescription = `경쟁업체 ${estimatedCount}개 - 치열한 경쟁`
  } else {
    riskLevel = '매우 높음'
    riskColor = 'red'
    riskDescription = `경쟁업체 ${estimatedCount}개 - 레드오션`
  }
  
  results.summary = {
    estimatedCompetitors: estimatedCount,
    areaKm2: Math.round(areaKm2 * 100) / 100,
    density: Math.round(density * 10) / 10,
    riskLevel,
    riskColor,
    riskDescription,
    totalStores: results.sources.semas?.totalCount || 0,
    dataComparison: {
      kakao: kakaoCount,
      tmap: tmapCount,
      semas: semasCount,
      crossVerified: results.competitors.filter((c: any) => c.sources.length > 1).length
    },
    reliability: results.competitors.filter((c: any) => c.sources.length > 1).length > 5 ? '높음' : '보통'
  }
  
  return c.json(results)
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
  <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${naverMapClientId}"></script>
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
        background-color: #121212;
        color: #e0e0e0;
      }

      strong, b {
        color: #fff;
      }

      a {
        color: #05d662;
      }
    }

    /* Custom Styles - 검정/네이버그린 테마 */
    .primary-bg {
      background: #000000;
    }

    .primary-green {
      color: #03C75A;
    }

    .bg-primary-green {
      background-color: #03C75A;
    }

    .border-primary-green {
      border-color: #03C75A;
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
      border: 2px solid #e5e7eb;
    }

    .analysis-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border: 1px solid #e5e7eb;
    }

    @media (prefers-color-scheme: dark) {
      .analysis-card {
        background: #1e1e1e;
        border-color: #333;
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
      background: #000;
      color: #03C75A;
      border: 2px solid #03C75A;
    }

    .category-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      margin: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;
    }

    .category-badge:hover {
      transform: scale(1.02);
      border-color: #03C75A;
    }

    .category-badge.selected {
      background: #000 !important;
      color: #03C75A !important;
      border-color: #03C75A;
    }

    .stat-card {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid #e5e7eb;
    }

    @media (prefers-color-scheme: dark) {
      .stat-card {
        background: #1e1e1e;
        border-color: #333;
      }
    }

    .markdown-content h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #000;
      border-bottom: 2px solid #03C75A;
      padding-bottom: 8px;
    }

    @media (prefers-color-scheme: dark) {
      .markdown-content h2 {
        color: #fff;
      }
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
      color: #03C75A;
    }

    /* 면책조항 스타일 */
    .disclaimer-box {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 16px;
      margin-top: 24px;
    }

    @media (prefers-color-scheme: dark) {
      .disclaimer-box {
        background: #3d3200;
        border-color: #ffc107;
      }
    }

    /* 데이터 출처 박스 */
    .source-box {
      background: #e8f5e9;
      border: 1px solid #03C75A;
      border-radius: 8px;
      padding: 12px;
      margin-top: 16px;
      font-size: 13px;
    }

    @media (prefers-color-scheme: dark) {
      .source-box {
        background: #1a3d1a;
      }
    }

    /* 버튼 기본 스타일 */
    .btn-primary {
      background: #000;
      color: #03C75A;
      border: 2px solid #03C75A;
      transition: all 0.2s ease;
    }

    .btn-primary:hover {
      background: #03C75A;
      color: #000;
    }

    .btn-green {
      background: #03C75A;
      color: #000;
      font-weight: 600;
    }

    .btn-green:hover {
      background: #02a74d;
    }

    /* 반경 버튼 */
    .radius-btn {
      border: 2px solid #e5e7eb;
      background: white;
      color: #333;
    }

    .radius-btn:hover {
      border-color: #03C75A;
    }

    .radius-btn.selected {
      background: #000;
      color: #03C75A;
      border-color: #03C75A;
    }

    @media (prefers-color-scheme: dark) {
      .radius-btn {
        background: #1e1e1e;
        color: #e0e0e0;
        border-color: #444;
      }
    }
  </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900 min-h-screen">
  <!-- Header -->
  <header class="primary-bg text-white py-8 px-4">
    <div class="max-w-6xl mx-auto flex justify-between items-center">
      <div>
        <h1 class="text-3xl md:text-4xl font-bold mb-2">
          <i class="fas fa-map-marker-alt mr-2 primary-green"></i>
          <span class="primary-green">XIΛIX</span>_BEST_MAP
        </h1>
        <p class="text-lg opacity-90">원클릭 상권분석 - 네이버스마트플레이스 & 구글업체등록 전 필수!</p>
      </div>
      <button onclick="resetAll()" class="btn-primary px-4 py-2 rounded-lg">
        <i class="fas fa-redo mr-2"></i> 새로고침
      </button>
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
                class="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent">
              <button onclick="searchLocation()" 
                class="px-6 py-3 btn-primary rounded-lg">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div class="flex items-end">
            <button onclick="getCurrentLocation()" 
              class="px-6 py-3 btn-green rounded-lg">
              <i class="fas fa-location-crosshairs mr-2"></i> 현재 위치
            </button>
          </div>
        </div>
        
        <!-- 검색 결과 -->
        <div id="searchResults" class="hidden mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg max-h-60 overflow-y-auto"></div>
        
        <!-- 지도 -->
        <div id="map" class="mb-4"></div>
        
        <!-- 선택된 위치 정보 -->
        <div id="selectedLocation" class="hidden p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
          <p class="font-medium dark:text-white">
            <i class="fas fa-map-pin primary-green mr-2"></i>
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
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          ■ 업종을 선택하거나 직접 입력하면 해당 업종의 <strong>경쟁 현황을 분석</strong>합니다. 
          "업종 추천받기"를 누르면 <strong>AI가 적합한 업종을 추천</strong>합니다.
        </p>
        
        <!-- 업종 검색 입력창 -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2 dark:text-gray-300">
            <i class="fas fa-search mr-1"></i> 업종 직접 입력
          </label>
          <div class="flex gap-2">
            <input type="text" id="categorySearchInput" 
              placeholder="예: 카페, 미용실, 편의점, 치킨집, 네일샵..."
              class="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              oninput="filterCategories(this.value)"
              onkeypress="if(event.key==='Enter') setCustomCategory()">
            <button onclick="setCustomCategory()" 
              class="px-6 py-3 btn-primary rounded-lg">
              <i class="fas fa-check"></i> 선택
            </button>
          </div>
          <!-- 자동완성 결과 -->
          <div id="categoryAutocomplete" class="hidden mt-2 p-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto shadow-lg"></div>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">또는 아래에서 대분류 선택:</p>
        
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
          <span class="category-badge bg-orange-100 text-orange-800" data-code="L" onclick="selectCategory(this)">
            <i class="fas fa-house mr-1"></i> 부동산
          </span>
          <span class="category-badge bg-pink-100 text-pink-800" data-code="P" onclick="selectCategory(this)">
            <i class="fas fa-graduation-cap mr-1"></i> 학문/교육
          </span>
          <span class="category-badge bg-teal-100 text-teal-800" data-code="R" onclick="selectCategory(this)">
            <i class="fas fa-briefcase-medical mr-1"></i> 의료
          </span>
          <span class="category-badge bg-gray-200 text-gray-800" data-code="" onclick="selectCategory(this)">
            <i class="fas fa-list mr-1"></i> 전체
          </span>
        </div>
        
        <div class="flex gap-3 mt-4">
          <button onclick="requestCategoryRecommendation()" 
            class="px-6 py-3 btn-primary rounded-lg font-medium">
            <i class="fas fa-lightbulb mr-2"></i> 업종 추천받기
          </button>
        </div>
        
        <div id="selectedCategoryInfo" class="hidden p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mt-4">
          <p class="text-sm dark:text-gray-300">
            ■ 선택된 업종: <strong id="selectedCategoryName" class="primary-green">-</strong>
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
          <button class="radius-btn px-6 py-3 rounded-lg" data-radius="300" onclick="selectRadius(this)">
            300m
          </button>
          <button class="radius-btn px-6 py-3 rounded-lg selected" data-radius="500" onclick="selectRadius(this)">
            500m
          </button>
          <button class="radius-btn px-6 py-3 rounded-lg" data-radius="1000" onclick="selectRadius(this)">
            1km
          </button>
          <button class="radius-btn px-6 py-3 rounded-lg" data-radius="2000" onclick="selectRadius(this)">
            2km
          </button>
        </div>
      </div>
    </section>

    <!-- 분석 시작 버튼 -->
    <section class="mb-8 text-center">
      <button onclick="startAnalysis()" 
        class="px-12 py-4 text-xl font-bold btn-green rounded-xl shadow-lg card-hover">
        <i class="fas fa-rocket mr-2"></i> 원클릭 상권분석 시작!
      </button>
    </section>

    <!-- 로딩 상태 -->
    <div id="loadingSection" class="hidden mb-8">
      <div class="analysis-card text-center py-12">
        <div class="loading-spinner inline-block w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full mb-4"></div>
        <p class="text-xl font-medium dark:text-white" id="loadingText">상권 데이터를 수집하고 있습니다...</p>
        <p class="text-gray-500 dark:text-gray-400 mt-2" id="loadingSubText">잠시만 기다려주세요</p>
      </div>
    </div>

    <!-- 분석 결과 -->
    <section id="resultSection" class="hidden">
      <!-- 결과 상단 버튼 -->
      <div class="flex justify-end gap-3 mb-4">
        <button onclick="startAnalysis()" class="px-4 py-2 btn-primary rounded-lg text-sm">
          <i class="fas fa-redo mr-1"></i> 다시 분석하기
        </button>
        <button onclick="resetAll()" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm dark:text-white">
          <i class="fas fa-home mr-1"></i> 처음으로
        </button>
      </div>

      <!-- 요약 통계 -->
      <div class="mb-8 fade-in">
        <h2 class="text-2xl font-bold mb-4 dark:text-white">
          <i class="fas fa-chart-bar primary-green mr-2"></i> 상권 분석 요약
        </h2>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="stat-card">
            <p class="text-3xl font-bold text-black dark:text-white" id="totalStores">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">총 상가 수</p>
          </div>
          <div class="stat-card">
            <p class="text-3xl font-bold primary-green" id="sameCategory">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">동종 업종</p>
          </div>
          <div class="stat-card">
            <p class="text-3xl font-bold text-blue-600" id="competitorRatio">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">경쟁 밀도</p>
          </div>
          <div class="stat-card">
            <p class="text-3xl font-bold" id="riskLevel">-</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">위험도</p>
          </div>
        </div>

        <!-- 데이터 출처 표시 -->
        <div class="source-box">
          <p class="font-medium mb-1"><i class="fas fa-database mr-1"></i> 데이터 출처 및 근거</p>
          <ul class="text-gray-700 dark:text-gray-300">
            <li>✔️ 상가 데이터: <strong>네이버 지역검색 API</strong> (실시간 조회)</li>
            <li>✔️ 위치 정보: <strong>T-MAP API</strong> (SK텔레콤)</li>
            <li>✔️ 지도 표시: <strong>네이버 지도 API</strong></li>
            <li>✔️ AI 분석: <strong>Google Gemini 2.5 Pro/Flash</strong></li>
            <li>✔️ 분석 시점: <span id="analysisTime">-</span></li>
          </ul>
        </div>
      </div>

      <!-- 업종별 현황 -->
      <div class="mb-8 fade-in">
        <h2 class="text-2xl font-bold mb-4 dark:text-white">
          <i class="fas fa-list-ul primary-green mr-2"></i> 업종별 현황
        </h2>
        <div class="analysis-card">
          <div id="categoryBreakdown" class="space-y-3"></div>
        </div>
      </div>

      <!-- AI 분석 결과 -->
      <div class="mb-8 fade-in">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold dark:text-white">
            <i class="fas fa-robot primary-green mr-2"></i> AI 맞춤 분석 리포트
          </h2>
          <button onclick="regenerateAIAnalysis()" class="px-4 py-2 btn-primary rounded-lg text-sm">
            <i class="fas fa-sync-alt mr-1"></i> 다시 분석
          </button>
        </div>
        <div class="analysis-card">
          <div id="aiAnalysis" class="markdown-content prose dark:prose-invert max-w-none"></div>
        </div>
      </div>

      <!-- 업종 추천 (AI) -->
      <div id="recommendationSection" class="mb-8 fade-in hidden">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold dark:text-white">
            <i class="fas fa-lightbulb primary-green mr-2"></i> AI 업종 추천
          </h2>
          <button onclick="regenerateRecommendation()" class="px-4 py-2 btn-primary rounded-lg text-sm">
            <i class="fas fa-sync-alt mr-1"></i> 다시 추천
          </button>
        </div>
        <div class="analysis-card">
          <div id="categoryRecommendation" class="markdown-content prose dark:prose-invert max-w-none"></div>
        </div>
      </div>

      <!-- 마케팅 추천 -->
      <div class="mb-8 fade-in">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold dark:text-white">
            <i class="fas fa-bullhorn primary-green mr-2"></i> 맞춤 마케팅 전략
          </h2>
          <button onclick="regenerateMarketing()" class="px-4 py-2 btn-primary rounded-lg text-sm">
            <i class="fas fa-sync-alt mr-1"></i> 다시 분석
          </button>
        </div>
        <div class="analysis-card">
          <div id="marketingAdvice" class="markdown-content prose dark:prose-invert max-w-none"></div>
        </div>
      </div>

      <!-- 면책조항 -->
      <div class="disclaimer-box">
        <h3 class="font-bold text-lg mb-2"><i class="fas fa-exclamation-triangle mr-2"></i> 면책조항 (Disclaimer)</h3>
        <ul class="text-sm space-y-1 text-gray-800 dark:text-gray-200">
          <li>■ 본 분석 결과는 <strong>참고용</strong>이며, 실제 창업 결정에 대한 법적 책임을 지지 않습니다.</li>
          <li>■ AI 분석은 <strong>공개 데이터 기반 추정치</strong>이며, 실제 상황과 다를 수 있습니다.</li>
          <li>■ 상권 데이터는 <strong>네이버 지역검색 API</strong> 기반으로, 실제 상권 현황과 차이가 있을 수 있습니다.</li>
          <li>■ 창업 전 반드시 <strong>현장 조사</strong> 및 <strong>전문가 상담</strong>을 권장합니다.</li>
          <li>■ 매출 예측, 임대료 정보 등은 포함되어 있지 않으며, <strong>별도 확인이 필요</strong>합니다.</li>
          <li>■ 본 서비스 이용으로 인한 어떠한 손해에 대해서도 XIΛIX는 책임을 지지 않습니다.</li>
        </ul>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="primary-bg text-white py-8 px-4 mt-16">
    <div class="max-w-6xl mx-auto text-center">
      <a href="https://xivix.kr/" target="_blank" class="text-xl font-bold primary-green hover:underline">
        @XIΛIX
      </a>
      <p class="text-gray-400 mt-2">© 2026. ALL RIGHTS RESERVED.</p>
    </div>
  </footer>

  <script>
    // ============================================
    // 네이버 지도 인증 실패 콜백 함수
    // ============================================
    window.navermap_authFailure = function() {
      console.error('네이버 지도 API 인증 실패!');
      console.error('원인: Client ID 또는 서비스 URL이 올바르지 않습니다.');
      console.error('현재 URL:', window.location.href);
      
      const mapEl = document.getElementById('map');
      if (mapEl) {
        mapEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1e1e1e;color:#e0e0e0;border-radius:12px;">' +
          '<i class="fas fa-exclamation-triangle" style="font-size:48px;color:#ffc107;margin-bottom:16px;"></i>' +
          '<p style="font-size:18px;font-weight:bold;margin-bottom:8px;">지도 인증 오류</p>' +
          '<p style="font-size:14px;color:#999;">네이버 클라우드 플랫폼에서 서비스 URL 등록을 확인해주세요.</p>' +
          '<p style="font-size:12px;color:#666;margin-top:8px;">현재 URL: ' + window.location.hostname + '</p>' +
          '</div>';
      }
      
      alert('네이버 지도 API 인증에 실패했습니다.\\n\\n네이버 클라우드 플랫폼(console.ncloud.com)에서:\\n1. Application 선택\\n2. Web Dynamic Map > Web 서비스 URL에 현재 도메인 추가\\n\\n현재 도메인: ' + window.location.hostname);
    };

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
    let lastAnalysisResult = null;
    let customCategoryInput = '';

    // 업종 목록 (소상공인 상권정보 기준 + 일반적인 업종명)
    const categoryList = [
      // 음식점 (Q)
      { name: '한식', code: 'Q', parent: '음식점' },
      { name: '중식', code: 'Q', parent: '음식점' },
      { name: '일식', code: 'Q', parent: '음식점' },
      { name: '양식', code: 'Q', parent: '음식점' },
      { name: '치킨집', code: 'Q', parent: '음식점' },
      { name: '피자집', code: 'Q', parent: '음식점' },
      { name: '햄버거', code: 'Q', parent: '음식점' },
      { name: '분식', code: 'Q', parent: '음식점' },
      { name: '카페', code: 'Q', parent: '음식점' },
      { name: '커피숍', code: 'Q', parent: '음식점' },
      { name: '베이커리', code: 'Q', parent: '음식점' },
      { name: '제과점', code: 'Q', parent: '음식점' },
      { name: '호프집', code: 'Q', parent: '음식점' },
      { name: '술집', code: 'Q', parent: '음식점' },
      { name: '포차', code: 'Q', parent: '음식점' },
      { name: '고깃집', code: 'Q', parent: '음식점' },
      { name: '삼겹살', code: 'Q', parent: '음식점' },
      { name: '곱창', code: 'Q', parent: '음식점' },
      { name: '족발', code: 'Q', parent: '음식점' },
      { name: '보쌈', code: 'Q', parent: '음식점' },
      { name: '국밥', code: 'Q', parent: '음식점' },
      { name: '냉면', code: 'Q', parent: '음식점' },
      { name: '칼국수', code: 'Q', parent: '음식점' },
      { name: '떡볶이', code: 'Q', parent: '음식점' },
      { name: '김밥', code: 'Q', parent: '음식점' },
      { name: '라면', code: 'Q', parent: '음식점' },
      { name: '우동', code: 'Q', parent: '음식점' },
      { name: '초밥', code: 'Q', parent: '음식점' },
      { name: '회', code: 'Q', parent: '음식점' },
      { name: '돈까스', code: 'Q', parent: '음식점' },
      { name: '파스타', code: 'Q', parent: '음식점' },
      { name: '스테이크', code: 'Q', parent: '음식점' },
      { name: '브런치', code: 'Q', parent: '음식점' },
      { name: '샐러드', code: 'Q', parent: '음식점' },
      { name: '샌드위치', code: 'Q', parent: '음식점' },
      { name: '도시락', code: 'Q', parent: '음식점' },
      { name: '배달음식', code: 'Q', parent: '음식점' },
      { name: '디저트', code: 'Q', parent: '음식점' },
      { name: '아이스크림', code: 'Q', parent: '음식점' },
      { name: '빵집', code: 'Q', parent: '음식점' },
      { name: '와플', code: 'Q', parent: '음식점' },
      { name: '타코야끼', code: 'Q', parent: '음식점' },
      { name: '밀크티', code: 'Q', parent: '음식점' },
      { name: '버블티', code: 'Q', parent: '음식점' },
      { name: '주스', code: 'Q', parent: '음식점' },
      
      // 소매 (D)
      { name: '편의점', code: 'D', parent: '소매' },
      { name: '슈퍼마켓', code: 'D', parent: '소매' },
      { name: '마트', code: 'D', parent: '소매' },
      { name: '과일가게', code: 'D', parent: '소매' },
      { name: '정육점', code: 'D', parent: '소매' },
      { name: '반찬가게', code: 'D', parent: '소매' },
      { name: '꽃집', code: 'D', parent: '소매' },
      { name: '문구점', code: 'D', parent: '소매' },
      { name: '서점', code: 'D', parent: '소매' },
      { name: '의류', code: 'D', parent: '소매' },
      { name: '옷가게', code: 'D', parent: '소매' },
      { name: '신발가게', code: 'D', parent: '소매' },
      { name: '가방', code: 'D', parent: '소매' },
      { name: '악세사리', code: 'D', parent: '소매' },
      { name: '화장품', code: 'D', parent: '소매' },
      { name: '드럭스토어', code: 'D', parent: '소매' },
      { name: '약국', code: 'D', parent: '소매' },
      { name: '안경점', code: 'D', parent: '소매' },
      { name: '휴대폰', code: 'D', parent: '소매' },
      { name: '전자제품', code: 'D', parent: '소매' },
      { name: '컴퓨터', code: 'D', parent: '소매' },
      { name: '철물점', code: 'D', parent: '소매' },
      { name: '인테리어', code: 'D', parent: '소매' },
      { name: '가구', code: 'D', parent: '소매' },
      { name: '애견용품', code: 'D', parent: '소매' },
      { name: '펫샵', code: 'D', parent: '소매' },
      { name: '유아용품', code: 'D', parent: '소매' },
      { name: '장난감', code: 'D', parent: '소매' },
      { name: '주류', code: 'D', parent: '소매' },
      { name: '담배', code: 'D', parent: '소매' },
      
      // 생활서비스 (F)
      { name: '미용실', code: 'F', parent: '생활서비스' },
      { name: '헤어샵', code: 'F', parent: '생활서비스' },
      { name: '이발소', code: 'F', parent: '생활서비스' },
      { name: '네일샵', code: 'F', parent: '생활서비스' },
      { name: '속눈썹', code: 'F', parent: '생활서비스' },
      { name: '피부관리', code: 'F', parent: '생활서비스' },
      { name: '왁싱', code: 'F', parent: '생활서비스' },
      { name: '세탁소', code: 'F', parent: '생활서비스' },
      { name: '빨래방', code: 'F', parent: '생활서비스' },
      { name: '수선', code: 'F', parent: '생활서비스' },
      { name: '사진관', code: 'F', parent: '생활서비스' },
      { name: '스튜디오', code: 'F', parent: '생활서비스' },
      { name: '인쇄소', code: 'F', parent: '생활서비스' },
      { name: '복사', code: 'F', parent: '생활서비스' },
      { name: '열쇠', code: 'F', parent: '생활서비스' },
      { name: '자동차정비', code: 'F', parent: '생활서비스' },
      { name: '세차장', code: 'F', parent: '생활서비스' },
      { name: '주유소', code: 'F', parent: '생활서비스' },
      { name: '이사', code: 'F', parent: '생활서비스' },
      { name: '청소', code: 'F', parent: '생활서비스' },
      { name: '에어컨', code: 'F', parent: '생활서비스' },
      { name: '보일러', code: 'F', parent: '생활서비스' },
      
      // 스포츠/오락 (N)
      { name: '헬스장', code: 'N', parent: '스포츠/오락' },
      { name: '피트니스', code: 'N', parent: '스포츠/오락' },
      { name: '필라테스', code: 'N', parent: '스포츠/오락' },
      { name: '요가', code: 'N', parent: '스포츠/오락' },
      { name: '골프연습장', code: 'N', parent: '스포츠/오락' },
      { name: '스크린골프', code: 'N', parent: '스포츠/오락' },
      { name: '볼링장', code: 'N', parent: '스포츠/오락' },
      { name: '당구장', code: 'N', parent: '스포츠/오락' },
      { name: '탁구장', code: 'N', parent: '스포츠/오락' },
      { name: '테니스', code: 'N', parent: '스포츠/오락' },
      { name: '배드민턴', code: 'N', parent: '스포츠/오락' },
      { name: '수영장', code: 'N', parent: '스포츠/오락' },
      { name: '태권도', code: 'N', parent: '스포츠/오락' },
      { name: '복싱', code: 'N', parent: '스포츠/오락' },
      { name: '주짓수', code: 'N', parent: '스포츠/오락' },
      { name: 'PC방', code: 'N', parent: '스포츠/오락' },
      { name: '노래방', code: 'N', parent: '스포츠/오락' },
      { name: '코인노래방', code: 'N', parent: '스포츠/오락' },
      { name: '만화방', code: 'N', parent: '스포츠/오락' },
      { name: '보드게임', code: 'N', parent: '스포츠/오락' },
      { name: '방탈출', code: 'N', parent: '스포츠/오락' },
      { name: '오락실', code: 'N', parent: '스포츠/오락' },
      { name: '키즈카페', code: 'N', parent: '스포츠/오락' },
      
      // 부동산 (L)
      { name: '부동산', code: 'L', parent: '부동산' },
      { name: '공인중개사', code: 'L', parent: '부동산' },
      
      // 학문/교육 (P)
      { name: '학원', code: 'P', parent: '학문/교육' },
      { name: '영어학원', code: 'P', parent: '학문/교육' },
      { name: '수학학원', code: 'P', parent: '학문/교육' },
      { name: '입시학원', code: 'P', parent: '학문/교육' },
      { name: '피아노', code: 'P', parent: '학문/교육' },
      { name: '미술학원', code: 'P', parent: '학문/교육' },
      { name: '태권도', code: 'P', parent: '학문/교육' },
      { name: '댄스학원', code: 'P', parent: '학문/교육' },
      { name: '어린이집', code: 'P', parent: '학문/교육' },
      { name: '유치원', code: 'P', parent: '학문/교육' },
      { name: '독서실', code: 'P', parent: '학문/교육' },
      { name: '스터디카페', code: 'P', parent: '학문/교육' },
      { name: '코딩학원', code: 'P', parent: '학문/교육' },
      
      // 의료 (R)
      { name: '병원', code: 'R', parent: '의료' },
      { name: '의원', code: 'R', parent: '의료' },
      { name: '치과', code: 'R', parent: '의료' },
      { name: '한의원', code: 'R', parent: '의료' },
      { name: '피부과', code: 'R', parent: '의료' },
      { name: '내과', code: 'R', parent: '의료' },
      { name: '정형외과', code: 'R', parent: '의료' },
      { name: '안과', code: 'R', parent: '의료' },
      { name: '이비인후과', code: 'R', parent: '의료' },
      { name: '소아과', code: 'R', parent: '의료' },
      { name: '산부인과', code: 'R', parent: '의료' },
      { name: '정신과', code: 'R', parent: '의료' },
      { name: '동물병원', code: 'R', parent: '의료' },
      { name: '마사지', code: 'R', parent: '의료' },
      { name: '스파', code: 'R', parent: '의료' },
      { name: '찜질방', code: 'R', parent: '의료' },
    ];

    // ============================================
    // Category Search Functions
    // ============================================
    function filterCategories(keyword) {
      const autocompleteDiv = document.getElementById('categoryAutocomplete');
      
      if (!keyword || keyword.trim().length < 1) {
        autocompleteDiv.classList.add('hidden');
        return;
      }
      
      const searchTerm = keyword.trim().toLowerCase();
      const matches = categoryList.filter(cat => 
        cat.name.toLowerCase().includes(searchTerm)
      ).slice(0, 10);
      
      if (matches.length === 0) {
        autocompleteDiv.innerHTML = \`
          <div class="p-3 text-gray-500 dark:text-gray-400">
            <p>"\${keyword}" 업종을 찾을 수 없습니다.</p>
            <p class="text-sm mt-1">Enter 키를 누르면 직접 입력한 업종으로 분석합니다.</p>
          </div>
        \`;
        autocompleteDiv.classList.remove('hidden');
        return;
      }
      
      autocompleteDiv.innerHTML = '';
      matches.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'p-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer rounded-lg transition flex justify-between items-center';
        item.innerHTML = \`
          <span class="font-medium dark:text-white">\${cat.name}</span>
          <span class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-500 text-gray-600 dark:text-gray-200">\${cat.parent}</span>
        \`;
        item.onclick = () => {
          document.getElementById('categorySearchInput').value = cat.name;
          selectedCategory = cat.code;
          selectedCategoryName = cat.name;
          customCategoryInput = cat.name;
          
          // 대분류 배지 선택 해제
          document.querySelectorAll('.category-badge').forEach(b => b.classList.remove('selected'));
          
          // 선택 정보 표시
          document.getElementById('selectedCategoryInfo').classList.remove('hidden');
          document.getElementById('selectedCategoryName').textContent = \`\${cat.name} (\${cat.parent})\`;
          
          autocompleteDiv.classList.add('hidden');
        };
        autocompleteDiv.appendChild(item);
      });
      
      autocompleteDiv.classList.remove('hidden');
    }

    function setCustomCategory() {
      const input = document.getElementById('categorySearchInput').value.trim();
      
      if (!input) {
        alert('업종명을 입력해주세요');
        return;
      }
      
      // 목록에서 찾기
      const found = categoryList.find(cat => cat.name.toLowerCase() === input.toLowerCase());
      
      if (found) {
        selectedCategory = found.code;
        selectedCategoryName = found.name;
        customCategoryInput = found.name;
        document.getElementById('selectedCategoryName').textContent = \`\${found.name} (\${found.parent})\`;
      } else {
        // 사용자 정의 업종
        selectedCategory = '';  // 전체로 검색하되 AI에게 업종명 전달
        selectedCategoryName = input;
        customCategoryInput = input;
        document.getElementById('selectedCategoryName').textContent = \`\${input} (사용자 입력)\`;
      }
      
      // 대분류 배지 선택 해제
      document.querySelectorAll('.category-badge').forEach(b => b.classList.remove('selected'));
      
      document.getElementById('selectedCategoryInfo').classList.remove('hidden');
      document.getElementById('categoryAutocomplete').classList.add('hidden');
    }

    // ============================================
    // Initialize Map
    // ============================================
    function initMap() {
      try {
        // 네이버 지도 API 로드 확인
        if (typeof naver === 'undefined' || !naver.maps) {
          console.error('네이버 지도 API가 로드되지 않았습니다.');
          const mapEl = document.getElementById('map');
          if (mapEl) {
            mapEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#1e1e1e;color:#e0e0e0;border-radius:12px;">' +
              '<i class="fas fa-spinner fa-spin" style="font-size:48px;color:#03C75A;margin-bottom:16px;"></i>' +
              '<p style="font-size:16px;">지도를 불러오는 중...</p>' +
              '</div>';
          }
          // 1초 후 재시도
          setTimeout(initMap, 1000);
          return;
        }

        console.log('네이버 지도 API 초기화 시작...');
        
        const mapOptions = {
          center: new naver.maps.LatLng(37.5665, 126.9780),
          zoom: 15,
          zoomControl: true,
          zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT
          }
        };
        
        map = new naver.maps.Map('map', mapOptions);
        
        console.log('네이버 지도 생성 완료!');
        
        naver.maps.Event.addListener(map, 'click', function(e) {
          const lat = e.coord.lat();
          const lon = e.coord.lng();
          setLocation(lat, lon);
          reverseGeocode(lat, lon);
        });
        
        console.log('지도 이벤트 리스너 등록 완료!');
      } catch (error) {
        console.error('지도 초기화 오류:', error);
        const mapEl = document.getElementById('map');
        if (mapEl) {
          mapEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#fee2e2;color:#dc2626;border-radius:12px;padding:20px;text-align:center;">' +
            '<i class="fas fa-exclamation-circle" style="font-size:48px;margin-bottom:16px;"></i>' +
            '<p style="font-size:16px;font-weight:bold;">지도 초기화 오류</p>' +
            '<p style="font-size:14px;margin-top:8px;">' + error.message + '</p>' +
            '</div>';
        }
      }
    }

    // ============================================
    // Reset Functions
    // ============================================
    function resetAll() {
      // 위치 초기화
      selectedLat = null;
      selectedLon = null;
      selectedAddress = '';
      if (currentMarker) currentMarker.setMap(null);
      if (currentCircle) currentCircle.setMap(null);
      
      // 업종 초기화
      selectedCategory = '';
      selectedCategoryName = '전체';
      customCategoryInput = '';
      document.querySelectorAll('.category-badge').forEach(b => b.classList.remove('selected'));
      document.getElementById('selectedCategoryInfo').classList.add('hidden');
      document.getElementById('categorySearchInput').value = '';
      document.getElementById('categoryAutocomplete').classList.add('hidden');
      
      // 반경 초기화
      selectedRadius = 500;
      document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('selected'));
      document.querySelector('.radius-btn[data-radius="500"]').classList.add('selected');
      
      // UI 초기화
      document.getElementById('searchInput').value = '';
      document.getElementById('searchResults').classList.add('hidden');
      document.getElementById('selectedLocation').classList.add('hidden');
      document.getElementById('loadingSection').classList.add('hidden');
      document.getElementById('resultSection').classList.add('hidden');
      document.getElementById('recommendationSection').classList.add('hidden');
      
      // 지도 초기화
      map.setCenter(new naver.maps.LatLng(37.5665, 126.9780));
      map.setZoom(15);
      
      // 스크롤 맨 위로
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        
        const resultsDiv = document.getElementById('searchResults');
        resultsDiv.innerHTML = '';
        resultsDiv.classList.remove('hidden');
        
        pois.forEach((poi, index) => {
          const item = document.createElement('div');
          item.className = 'p-3 hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer rounded-lg transition mb-2 border border-gray-200 dark:border-gray-600';
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
      
      if (currentMarker) {
        currentMarker.setMap(null);
      }
      
      const position = new naver.maps.LatLng(lat, lon);
      currentMarker = new naver.maps.Marker({
        position: position,
        map: map,
        icon: {
          content: '<div style="width:30px;height:30px;background:#000;border-radius:50%;border:3px solid #03C75A;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><i class="fas fa-map-marker-alt" style="color:#03C75A;font-size:14px;"></i></div>',
          anchor: new naver.maps.Point(15, 15)
        }
      });
      
      updateRadiusCircle();
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
          fillColor: '#03C75A',
          fillOpacity: 0.1,
          strokeColor: '#03C75A',
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
      document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      selectedRadius = parseInt(el.dataset.radius);
      updateRadiusCircle();
    }

    // ============================================
    // Category Recommendation
    // ============================================
    async function requestCategoryRecommendation() {
      if (!selectedLat || !selectedLon) {
        alert('먼저 위치를 선택해주세요');
        return;
      }

      document.getElementById('loadingSection').classList.remove('hidden');
      updateLoading('AI가 적합한 업종을 분석하고 있습니다...', 'Gemini 2.5 Pro 분석 중');

      try {
        // 전체 상권 데이터 수집
        const response = await fetch(\`/api/semas/radius?cx=\${selectedLon}&cy=\${selectedLat}&radius=\${selectedRadius}\`);
        const storeData = await response.json();
        
        if (storeData.error) {
          throw new Error(storeData.error);
        }

        const items = storeData.body?.items || [];
        const totalCount = storeData.body?.totalCount || 0;
        
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
            categoryCount[name] = { count: 0, code: code };
          }
          categoryCount[name].count++;
        });

        const prompt = \`
당신은 상권분석 및 창업 컨설팅 전문가입니다. 아래 데이터를 기반으로 이 지역에 적합한 업종을 추천해주세요.

## 분석 위치
- 주소: \${selectedAddress}
- 분석 반경: \${selectedRadius}m

## 현재 상권 현황
- 총 상가 수: \${totalCount}개
- 업종별 분포:
\${Object.entries(categoryCount).sort((a,b) => b[1].count - a[1].count).map(([name, data]) => \`  - \${name}: \${data.count}개 (\${((data.count/totalCount)*100).toFixed(1)}%)\`).join('\\n')}

## 요청사항
1. 이 지역에 **부족한 업종** (공급 대비 수요가 높을 것으로 예상되는 업종)을 분석해주세요
2. **추천 업종 TOP 3**를 선정하고 각각에 대해:
   - 추천 이유 (데이터 기반 근거 필수)
   - 예상 경쟁 강도
   - 성공 가능성 (상/중/하)
   - 주의사항
3. **비추천 업종**과 그 이유도 알려주세요
4. 각 추천에는 **구체적인 숫자와 근거**를 반드시 포함해주세요

응답은 마크다운 형식으로 작성해주세요.
## 헤더로 섹션을 구분하고, **볼드**로 핵심 내용을 강조해주세요.
\`;

        const aiResponse = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model: 'pro' })
        });
        
        const aiData = await aiResponse.json();
        
        document.getElementById('loadingSection').classList.add('hidden');
        document.getElementById('recommendationSection').classList.remove('hidden');
        
        if (aiData.error) {
          document.getElementById('categoryRecommendation').innerHTML = '<p class="text-red-500">추천 분석 중 오류가 발생했습니다: ' + aiData.error + '</p>';
        } else {
          document.getElementById('categoryRecommendation').innerHTML = formatMarkdown(aiData.result);
        }
        
        // 스크롤 이동
        document.getElementById('recommendationSection').scrollIntoView({ behavior: 'smooth' });
        
      } catch (error) {
        console.error('Recommendation error:', error);
        document.getElementById('loadingSection').classList.add('hidden');
        alert('업종 추천 중 오류가 발생했습니다: ' + error.message);
      }
    }

    async function regenerateRecommendation() {
      await requestCategoryRecommendation();
    }

    // ============================================
    // Analysis
    // ============================================
    async function startAnalysis() {
      if (!selectedLat || !selectedLon) {
        alert('먼저 위치를 선택해주세요');
        return;
      }

      document.getElementById('loadingSection').classList.remove('hidden');
      document.getElementById('resultSection').classList.add('hidden');

      try {
        updateLoading('주변 상권 데이터를 수집하고 있습니다...', '카카오 + T-MAP + 네이버 + 소상공인 API 연동 중');
        
        const storeData = await fetchStoreData();
        
        updateLoading('수집된 데이터를 분석하고 있습니다...', '업종별 현황 파악 중');
        
        const analysisResult = analyzeStoreData(storeData);
        lastAnalysisResult = analysisResult;
        displayBasicAnalysis(analysisResult);
        
        updateLoading('AI가 맞춤 분석을 진행하고 있습니다...', 'Gemini 2.5 Pro 분석 중');
        
        await performAIAnalysis(analysisResult);
        
        document.getElementById('loadingSection').classList.add('hidden');
        document.getElementById('resultSection').classList.remove('hidden');
        
        // 분석 시간 표시
        document.getElementById('analysisTime').textContent = new Date().toLocaleString('ko-KR');
        
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
      // 🔥 다중 API 통합 분석 API 사용 (카카오 + T-MAP + 네이버 + 소상공인)
      const categoryEncoded = encodeURIComponent(selectedCategoryName || '미용실');
      const addressEncoded = encodeURIComponent(selectedAddress || '');
      
      let url = \`/api/analysis/multi?cx=\${selectedLon}&cy=\${selectedLat}&radius=\${selectedRadius}&category=\${categoryEncoded}&address=\${addressEncoded}\`;
      
      console.log('🔥 Fetching multi-API data:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      console.log('📊 Multi-API data received:', data);
      console.log('📍 Sources:', Object.keys(data.sources || {}));
      console.log('🎯 Estimated competitors:', data.summary?.estimatedCompetitors);
      console.log('🔍 Cross verified:', data.summary?.dataComparison?.crossVerified);
      return data;
    }

    function analyzeStoreData(data) {
      // 🔥 다중 API 통합 분석 결과 처리
      const summary = data.summary || {};
      const sources = data.sources || {};
      const meta = data.meta || {};
      const competitors = data.competitors || [];
      const categoryBreakdown = data.categoryBreakdown || {};
      
      // 추정 경쟁업체 수 (카카오, T-MAP, 소상공인 가중 평균)
      const sameCategoryCount = summary.estimatedCompetitors || 0;
      const totalCount = summary.totalStores || 
        (sources.semas?.totalCount || 0) || 
        Math.max(sources.kakao?.totalCount || 0, sources.tmap?.totalCount || 0) * 10;
      
      const areaKm2 = summary.areaKm2 || Math.PI * Math.pow(selectedRadius / 1000, 2);
      const density = summary.density || (sameCategoryCount / areaKm2).toFixed(1);
      const competitorDensity = (sameCategoryCount / areaKm2).toFixed(1);
      
      // 서버에서 계산한 위험도 사용
      const riskLevel = summary.riskLevel || '보통';
      const riskColor = {
        '블루오션': 'text-blue-600',
        '낮음': 'text-green-600',
        '보통': 'text-yellow-600',
        '높음': 'text-orange-600',
        '매우 높음': 'text-red-600'
      }[riskLevel] || 'text-yellow-600';
      const riskDescription = summary.riskDescription || '';
      
      // 업종별 카운트 (소상공인 API에서 가져온 데이터)
      let categoryCount = {};
      if (Object.keys(categoryBreakdown).length > 0) {
        Object.entries(categoryBreakdown).forEach(([name, count]) => {
          categoryCount[name] = { count: count, items: [] };
        });
      }
      
      // 데이터 소스 정보
      const dataComparison = summary.dataComparison || {};
      const dataSourceInfo = \`카카오(\${dataComparison.kakao || 0}개) + T-MAP(\${dataComparison.tmap || 0}개) + 교차검증(\${dataComparison.crossVerified || 0}개)\`;
      
      return {
        totalCount,
        sameCategoryCount,
        density,
        competitorDensity,
        riskLevel,
        riskColor,
        riskDescription,
        categoryCount,
        items: competitors,  // 통합 경쟁업체 목록
        competitorList: competitors,
        dataDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),  // 2026년 1월
        dataSource: 'multi_api_analysis',
        dataSourceInfo,
        dataSources: sources,
        dataComparison,
        reliability: summary.reliability || '보통',
        address: selectedAddress || meta.address,
        radius: selectedRadius,
        category: selectedCategoryName || meta.category,
        searchLocation: meta.address
      };
    }

    function displayBasicAnalysis(result) {
      document.getElementById('totalStores').textContent = result.totalCount.toLocaleString() + '개';
      document.getElementById('sameCategory').textContent = result.sameCategoryCount.toLocaleString() + '개';
      document.getElementById('competitorRatio').textContent = result.density + '/km²';
      
      const riskEl = document.getElementById('riskLevel');
      riskEl.textContent = result.riskLevel;
      riskEl.className = 'text-3xl font-bold ' + result.riskColor;
      
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
              <div class="bg-green-500 h-3 rounded-full" style="width: \${Math.min(percentage * 2, 100)}%"></div>
            </div>
            <span class="text-sm text-gray-600 dark:text-gray-300 w-20 text-right">\${data.count}개 (\${percentage}%)</span>
          </div>
        \`;
        breakdown.appendChild(item);
      });
    }

    async function performAIAnalysis(result) {
      // 🔥 다중 API 경쟁업체 목록 (교차 검증된 업체 우선, 최대 15개)
      const crossVerifiedCompetitors = result.competitorList?.filter(c => c.sources?.length > 1) || [];
      const singleSourceCompetitors = result.competitorList?.filter(c => c.sources?.length === 1) || [];
      const topCompetitors = [...crossVerifiedCompetitors, ...singleSourceCompetitors].slice(0, 15);
      
      const competitorSample = topCompetitors.map(c => {
        const sources = c.sources?.join('+') || 'unknown';
        const distance = c.distance ? \` [\${c.distance}m]\` : '';
        return \`- \${c.name}\${distance} (\${c.address}) [출처: \${sources}]\`;
      }).join('\\n') || '정보 없음';
      
      // 데이터 소스 비교 정보
      const dataComparison = result.dataComparison || {};
      const sourceInfo = \`카카오(\${dataComparison.kakao || 0}개), T-MAP(\${dataComparison.tmap || 0}개), 교차검증(\${dataComparison.crossVerified || 0}개)\`;
      
      const prompt = \`
당신은 10년 경력의 상권분석 전문 컨설턴트입니다. 아래 **다중 API 실시간 데이터(2026년 1월 기준)**를 기반으로 창업 희망자에게 정확하고 실용적인 분석 리포트를 작성해주세요.

## 🎯 분석 대상 정보
- **위치**: \${result.address}
- **검색 지역**: \${result.searchLocation || result.address}
- **분석 반경**: \${result.radius}m (면적: 약 \${(Math.PI * Math.pow(result.radius/1000, 2)).toFixed(2)}km²)
- **희망 창업 업종**: \${result.category}

## 📊 상권 현황 데이터 (🔥 다중 API 교차 검증, 데이터 기준: 2026년 1월)
- **데이터 소스**: \${sourceInfo}
- **추정 경쟁업체 수**: \${result.sameCategoryCount}개 (카카오+T-MAP+소상공인 가중 평균)
- **전체 상가 수**: \${result.totalCount || 'N/A'}개
- **경쟁 밀도**: \${result.density}개/km²
- **교차 검증된 업체**: \${dataComparison.crossVerified || 0}개 (여러 API에서 동시 확인)
- **경쟁 위험도**: \${result.riskLevel} - \${result.riskDescription || ''}
- **데이터 신뢰도**: \${result.reliability || '보통'}

## 🏪 업종별 분포 현황 (소상공인 API 기준)
\${Object.keys(result.categoryCount).length > 0 ? Object.entries(result.categoryCount).sort((a,b) => b[1].count - a[1].count).slice(0, 10).map(([name, data]) => \`- \${name}: \${data.count}개 (\${result.totalCount > 0 ? ((data.count/result.totalCount)*100).toFixed(1) : 0}%)\`).join('\\n') : '업종별 분포 데이터 없음 (카카오/T-MAP 기반 분석)'}

## 🎯 주변 동종 업종(\${result.category}) 경쟁업체 목록 (다중 API 교차 검증)
\${competitorSample}

---

## 📝 분석 요청사항

다음 형식으로 **간결하고 실용적인** 분석을 작성해주세요:

### 1. 상권 특성 요약 (3줄 이내)
- 이 지역이 어떤 상권인지 한눈에 파악할 수 있게

### 2. \${result.category} 창업 기회 분석
- 동종 업종 \${result.sameCategoryCount}개 기준으로 시장 진입 난이도
- 구체적 숫자와 함께 기회 요인 2~3개

### 3. 위험 요인 분석  
- 경쟁업체 현황 기반 실질적 위협 요소
- 주의해야 할 점 2~3개

### 4. 차별화 전략 제안 (구체적으로)
- 이 지역에서 성공하려면 어떤 차별화가 필요한지
- 실행 가능한 아이디어 2~3개

### 5. 핵심 결론 (1줄)
- 창업 추천/비추천 여부와 핵심 이유

---
⚠️ 중요: 
- **환각 금지**: 제공된 데이터만 사용하세요
- **숫자 정확히**: 동종업종 \${result.sameCategoryCount}개를 정확히 반영하세요
- **간결하게**: 각 섹션 3~5줄 이내로 작성
- **실용적으로**: 창업자가 바로 활용할 수 있는 정보만
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
        
        await performMarketingAnalysis(result);
        
      } catch (error) {
        console.error('AI analysis error:', error);
        document.getElementById('aiAnalysis').innerHTML = '<p class="text-red-500">AI 분석 중 오류가 발생했습니다</p>';
      }
    }

    async function regenerateAIAnalysis() {
      if (!lastAnalysisResult) {
        alert('먼저 상권 분석을 실행해주세요');
        return;
      }
      
      document.getElementById('aiAnalysis').innerHTML = '<div class="text-center py-8"><div class="loading-spinner inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div><p class="mt-2">다시 분석 중...</p></div>';
      
      await performAIAnalysis(lastAnalysisResult);
    }

    async function performMarketingAnalysis(result) {
      // 업종별 마케팅 특성 분류 (사사분면 모델 기반)
      const categoryMarketingType = {
        // 지역 + 정보형 (블로그 중심) - 실력/신뢰가 중요
        '의료': { type: 'local_info', channels: ['네이버 블로그', '네이버 플레이스'], primary: '전문성 블로그 포스팅' },
        '생활서비스': { type: 'local_info', channels: ['네이버 블로그', '네이버 플레이스'], primary: '전문성 블로그 포스팅' },
        '부동산': { type: 'local_info', channels: ['네이버 블로그', '유튜브'], primary: '신뢰 구축 콘텐츠' },
        
        // 지역 + 이미지형 (블로그 + 네이버지도 중심) - 비주얼 중요
        '음식점': { type: 'local_image', channels: ['네이버 플레이스', '네이버 블로그', '인스타그램'], primary: '네이버 지도 상위노출 + 사진 리뷰' },
        '소매': { type: 'local_image', channels: ['네이버 플레이스', '인스타그램'], primary: '네이버 지도 + SNS 비주얼' },
        '스포츠/오락': { type: 'local_image', channels: ['네이버 플레이스', '인스타그램 릴스'], primary: '시설 사진 + 체험 콘텐츠' },
        
        // 전국 + 정보형 (유튜브/릴스 + 블로그) - 전문성 신뢰
        '학문/교육': { type: 'national_info', channels: ['유튜브', '블로그', '인스타그램'], primary: '전문성 영상 콘텐츠' },
        
        // 기본값
        '전체': { type: 'local_image', channels: ['네이버 플레이스', '네이버 블로그'], primary: '네이버 플랫폼 최적화' }
      };
      
      const marketingInfo = categoryMarketingType[result.category] || categoryMarketingType['전체'];
      
      const prompt = \`
당신은 소상공인 마케팅 전문가입니다. 
**핵심만 간결하게!** 이 지역, 이 업종에 **꼭 필요한 마케팅 채널과 방법만** 추천하세요.

## 📍 분석 대상
- **위치**: \${result.address}
- **업종**: \${result.category}
- **주변 경쟁업체**: \${result.sameCategoryCount}개
- **경쟁 밀도**: \${result.density}개/km²

## 🎯 마케팅 특성 분류
이 업종은 **"\${marketingInfo.type === 'local_info' ? '지역+정보형' : marketingInfo.type === 'local_image' ? '지역+이미지형' : marketingInfo.type === 'national_info' ? '전국+정보형' : '전국+이미지형'}"** 유형입니다.
- 주력 채널: \${marketingInfo.channels.join(', ')}
- 핵심 전략: \${marketingInfo.primary}

## 📋 요청사항 (간결하게 핵심만!)

아래 형식으로만 답변해주세요:

### 🥇 1순위 마케팅 (반드시 해야 할 것)
- **채널명**: 
- **왜 필수인가**: (1줄)
- **구체적 액션**: (3개 이내 불릿)
- **예상 비용**: 
- **기대 효과**: 

### 🥈 2순위 마케팅 (하면 좋은 것)
- **채널명**: 
- **왜 추천인가**: (1줄)
- **구체적 액션**: (3개 이내 불릿)
- **예상 비용**: 
- **기대 효과**: 

### ❌ 이 업종에 비추천 마케팅
- **채널명**과 **비추천 이유** (1줄씩, 2개 이내)

### ✅ 이 지역 특화 팁 (1~2개)
- \${result.address} 지역 특성에 맞는 마케팅 포인트

---
⚠️ 주의: 
- 모든 마케팅을 다 하지 마세요. **주력 채널 1개에 집중**하세요.
- 장황한 설명 없이 **실행 가능한 액션**만 제시하세요.
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

    async function regenerateMarketing() {
      if (!lastAnalysisResult) {
        alert('먼저 상권 분석을 실행해주세요');
        return;
      }
      
      document.getElementById('marketingAdvice').innerHTML = '<div class="text-center py-8"><div class="loading-spinner inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div><p class="mt-2">다시 분석 중...</p></div>';
      
      await performMarketingAnalysis(lastAnalysisResult);
    }

    function formatMarkdown(text) {
      if (!text) return '';
      
      // 먼저 줄바꿈으로 분리
      let html = text
        // 헤더 처리 (#### -> h4, ### -> h3, ## -> h2)
        .replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold text-green-600 mt-4 mb-2">$1</h4>')
        .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-green-700 dark:text-green-400 mt-6 mb-4 flex items-center gap-2"><span class="w-1 h-6 bg-green-500 rounded"></span>$1</h2>')
        // 볼드 처리
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong class="text-gray-900 dark:text-white font-semibold">$1</strong>')
        // 이탤릭 처리
        .replace(/\\*(.+?)\\*/g, '<em class="text-gray-700 dark:text-gray-300">$1</em>')
        // 리스트 처리 (- 로 시작)
        .replace(/^- (.+)$/gm, '<li class="flex items-start gap-2 mb-2"><span class="text-green-500 mt-1">•</span><span>$1</span></li>')
        // 숫자 리스트 처리
        .replace(/^(\\d+)\\. (.+)$/gm, '<li class="flex items-start gap-2 mb-2"><span class="text-green-600 font-semibold min-w-[20px]">$1.</span><span>$2</span></li>')
        // > 인용문 처리
        .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-green-500 pl-4 py-2 my-3 bg-green-50 dark:bg-green-900/20 rounded-r text-gray-700 dark:text-gray-300 italic">$1</blockquote>')
        // 코드 블록 처리
        .replace(/\`([^\`]+)\`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm text-red-600 dark:text-red-400">$1</code>')
        // 구분선 처리
        .replace(/^---$/gm, '<hr class="my-6 border-gray-200 dark:border-gray-700">')
        // 단락 처리
        .replace(/\\n\\n/g, '</p><p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">')
        .replace(/\\n/g, '<br>');
      
      // ul/ol 태그로 리스트 감싸기
      html = html.replace(/(<li class="flex.*?<\\/li>\\s*)+/g, (match) => {
        return '<ul class="space-y-1 my-4 pl-2">' + match + '</ul>';
      });
      
      // 시작 p 태그 추가
      if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<blockquote')) {
        html = '<p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">' + html + '</p>';
      }
      
      return html;
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
