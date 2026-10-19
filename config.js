// ===========================================================================
// [config.js] 2그룹 카테고리(여행발견/생활편의), 취향 태그, 전역 상태(state) 및 공통 유틸리티
// ===========================================================================

// =========================================================================
    // [1] 보안 설정: GitHub Pages 등 공개 저장소에 키가 노출되지 않도록 빈 값("")으로 두고,
    // 웹앱 실행 시 화면 입력창을 통해 각 기기(폰·PC)의 브라우저에만 저장하는 방식을 기본으로 사용합니다.
    // =========================================================================
    const GOOGLE_MAPS_API_KEY = "";

    // API 요청 및 구글맵 평점 기준 상수
    const MAX_SEARCH_RESULTS = 10;          // 화면에 표시할 장소 수 (구글 평점 기준 상위 10개)
    const MAX_ROUTE_MATRIX_TARGETS = 6;     // 상위 6개 장소의 도보·대중교통 시간 백그라운드 계산
    const DEFAULT_SEARCH_RADIUS_M = 600;    // 기본 주변 탐색 반경 600m (도보권 우선 탐색 후 단계별 확장)
    const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }; // 초기 기본 중심

    // 카테고리 매핑: 목적성에 따라 [✨ 여행발견 (discovery)] 그룹과 [🛟 생활·편의 (utility)] 그룹으로 구조화
    const CATEGORIES = [
      // ==================== [그룹 1: ✨ 여행발견 (새로운 로컬 포인트 탐색)] ====================
      {
        id: "restaurant",
        group: "discovery",
        label: "맛집",
        icon: "🍽️",
        types: ["restaurant"],
        includedPrimaryTypes: [
          "restaurant", "korean_restaurant", "japanese_restaurant", "chinese_restaurant",
          "american_restaurant", "italian_restaurant", "seafood_restaurant", "steak_house",
          "sushi_restaurant", "ramen_restaurant", "hamburger_restaurant", "pizza_restaurant",
          "barbecue_restaurant", "fast_food_restaurant", "thai_restaurant", "vietnamese_restaurant",
          "indian_restaurant", "mexican_restaurant", "french_restaurant", "brunch_restaurant",
          "buffet_restaurant", "meal_takeaway"
        ],
        excludedPrimaryTypes: [
          "cafe", "coffee_shop", "bakery", "dessert_shop", "ice_cream_shop",
          "convenience_store", "supermarket", "grocery_store", "department_store",
          "shopping_mall", "hotel", "lodging", "motel", "gas_station"
        ],
        keywordKo: "맛집 음식점 식당",
        keywordEn: "popular restaurant local food",
        radiusM: 600
      },
      {
        id: "cafe",
        group: "discovery",
        label: "카페",
        icon: "☕",
        types: ["cafe", "coffee_shop"],
        includedPrimaryTypes: ["cafe", "coffee_shop", "tea_house"],
        excludedPrimaryTypes: [
          "restaurant", "korean_restaurant", "japanese_restaurant", "chinese_restaurant",
          "barbecue_restaurant", "seafood_restaurant", "fast_food_restaurant", "bar",
          "night_club", "hotel", "lodging", "convenience_store", "supermarket", "internet_cafe"
        ],
        keywordKo: "카페 커피전문점 로스터리",
        keywordEn: "cafe coffee shop roastery",
        radiusM: 600
      },
      {
        id: "bakery",
        group: "discovery",
        label: "디저트·빵",
        icon: "🍨",
        types: ["bakery", "dessert_shop", "ice_cream_shop"],
        includedPrimaryTypes: ["bakery", "donut_shop", "bagel_shop", "dessert_shop", "ice_cream_shop", "cake_shop", "pastry_shop"],
        excludedPrimaryTypes: ["restaurant", "korean_restaurant", "chinese_restaurant", "japanese_restaurant", "convenience_store", "supermarket", "hotel", "lodging"],
        keywordKo: "디저트 베이커리 빙수 빵집 제과점",
        keywordEn: "dessert bakery ice cream shaved ice pastry",
        radiusM: 600
      },
      {
        id: "night_market",
        group: "discovery",
        label: "야시장·야경",
        icon: "🌙",
        types: ["tourist_attraction", "market"],
        includedPrimaryTypes: ["tourist_attraction", "market", "night_market", "observation_deck", "plaza"],
        excludedPrimaryTypes: ["convenience_store", "supermarket", "gas_station", "bank", "atm", "pharmacy", "hospital"],
        keywordKo: "야시장 야경 전망대 먹자골목",
        keywordEn: "night market night view observation deck street food",
        radiusM: 600
      },
      {
        id: "bar",
        group: "discovery",
        label: "로컬 바·펍",
        icon: "🍺",
        types: ["bar"],
        includedPrimaryTypes: ["bar", "pub", "wine_bar", "cocktail_bar", "brewery"],
        excludedPrimaryTypes: ["convenience_store", "supermarket", "gas_station", "pharmacy", "hospital", "bank", "cafe"],
        keywordKo: "바 펍 이자카야 루프탑 맥주",
        keywordEn: "bar pub izakaya craft beer cocktail rooftop bar",
        radiusM: 600
      },
      {
        id: "tourist_attraction",
        group: "discovery",
        label: "관광명소",
        icon: "📸",
        types: ["tourist_attraction", "historical_landmark"],
        includedPrimaryTypes: ["tourist_attraction", "historical_landmark", "cultural_landmark", "monument", "amusement_park", "aquarium", "zoo"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "gas_station", "bank", "atm", "pharmacy", "hotel", "lodging"],
        keywordKo: "관광명소 볼거리 랜드마크 포토스팟",
        keywordEn: "tourist attraction landmark sightseeing",
        radiusM: 600
      },
      {
        id: "shopping_mall",
        group: "discovery",
        label: "소품·쇼핑",
        icon: "🎁",
        types: ["shopping_mall", "department_store", "gift_shop"],
        includedPrimaryTypes: ["shopping_mall", "department_store", "gift_shop", "market"],
        excludedPrimaryTypes: ["convenience_store", "restaurant", "cafe", "gas_station", "pharmacy", "bank"],
        keywordKo: "소품샵 기념품 쇼핑몰 백화점 상점가",
        keywordEn: "souvenir gift shop shopping mall",
        radiusM: 600
      },
      {
        id: "museum",
        group: "discovery",
        label: "박물관·전시",
        icon: "🏛️",
        types: ["museum", "art_gallery"],
        includedPrimaryTypes: ["museum", "art_gallery"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging"],
        keywordKo: "박물관 미술관 전시관 갤러리",
        keywordEn: "museum art gallery exhibition",
        radiusM: 600
      },
      {
        id: "park",
        group: "discovery",
        label: "공원·산책",
        icon: "🌳",
        types: ["park"],
        includedPrimaryTypes: ["park", "national_park", "botanical_garden"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging", "gas_station"],
        keywordKo: "공원 산책로 수목원 정원",
        keywordEn: "park garden promenade",
        radiusM: 600
      },
      {
        id: "spa",
        group: "discovery",
        label: "스파·마사지",
        icon: "♨️",
        types: ["spa"],
        includedPrimaryTypes: ["spa", "massage", "sauna"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "gas_station", "bank"],
        keywordKo: "마사지 스파 온천 발마사지",
        keywordEn: "massage spa foot massage hot spring",
        radiusM: 600
      },

      // ==================== [그룹 2: 🛟 생활·편의 (가까운 거리 최우선)] ====================
      {
        id: "convenience_store",
        group: "utility",
        label: "편의점",
        icon: "🏪",
        types: ["convenience_store"],
        includedPrimaryTypes: ["convenience_store"],
        excludedPrimaryTypes: ["restaurant", "cafe", "supermarket", "hotel", "lodging", "pharmacy", "bank"],
        keywordKo: "편의점",
        keywordEn: "convenience store 7-eleven familymart lawson",
        radiusM: 600
      },
      {
        id: "pharmacy",
        group: "utility",
        label: "약국·드럭",
        icon: "💊",
        types: ["pharmacy", "drugstore"],
        includedPrimaryTypes: ["pharmacy", "drugstore"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging", "hospital"],
        keywordKo: "약국 드럭스토어",
        keywordEn: "pharmacy drugstore",
        radiusM: 600
      },
      {
        id: "atm",
        group: "utility",
        label: "ATM",
        icon: "🏧",
        types: ["atm"],
        includedPrimaryTypes: ["atm", "bank"],
        excludedPrimaryTypes: ["restaurant", "cafe", "hotel", "lodging"],
        keywordKo: "ATM 현금인출기",
        keywordEn: "atm cash machine",
        radiusM: 600
      },
      {
        id: "bank",
        group: "utility",
        label: "은행·환전",
        icon: "🏦",
        types: ["bank"],
        includedPrimaryTypes: ["bank"],
        excludedPrimaryTypes: ["restaurant", "cafe", "hotel", "lodging", "convenience_store"],
        keywordKo: "은행 환전소",
        keywordEn: "bank currency exchange",
        radiusM: 600
      },
      {
        id: "supermarket",
        group: "utility",
        label: "마트·슈퍼",
        icon: "🛒",
        types: ["supermarket", "grocery_store"],
        includedPrimaryTypes: ["supermarket", "grocery_store"],
        excludedPrimaryTypes: ["convenience_store", "restaurant", "cafe", "hotel", "lodging"],
        keywordKo: "대형마트 슈퍼마켓 식료품",
        keywordEn: "supermarket grocery mart",
        radiusM: 600
      },
      {
        id: "gas_station",
        group: "utility",
        label: "주유소",
        icon: "⛽",
        types: ["gas_station"],
        includedPrimaryTypes: ["gas_station"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging"],
        keywordKo: "주유소",
        keywordEn: "gas station",
        radiusM: 600
      }
    ];

    // 카테고리별 원탭 세부 메뉴·취향 키워드 칩 정의
    const QUICK_TASTE_TAGS = {
      restaurant: [
        { label: "전체 맛집", kw: "" },
        { label: "🍜 면·우육면·라멘", kw: "면 우육면 라멘 국수 noodle ramen beef noodle" },
        { label: "🍲 훠궈·샤브·전골", kw: "훠궈 샤브샤브 전골 hot pot shabu" },
        { label: "🥟 만두·딤섬·샤오롱바오", kw: "딤섬 만두 샤오롱바오 교자 dumpling dim sum" },
        { label: "🥩 고기·구이·스테이크", kw: "구이 고기 야키니쿠 스테이크 삼겹살 bbq steak yakiniku" },
        { label: "🍣 해산물·초밥·회", kw: "초밥 스시 해산물 회 일식 sushi seafood" },
        { label: "🍱 현지인 로컬식당", kw: "로컬 맛집 백반 정식 local restaurant" }
      ],
      cafe: [
        { label: "전체 카페", kw: "" },
        { label: "☕ 스페셜티·로스터리", kw: "로스터리 스페셜티 핸드드립 specialty coffee roastery" },
        { label: "🌆 뷰맛집·루프탑", kw: "뷰 루프탑 전망 테라스 view cafe rooftop" },
        { label: "🍵 전통차·티하우스", kw: "찻집 티하우스 말차 밀크티 tea house bubble tea" },
        { label: "🍰 디저트·브런치 카페", kw: "디저트 케이크 브런치 카페 dessert brunch cafe" }
      ],
      bakery: [
        { label: "전체 디저트", kw: "" },
        { label: "🍧 망고빙수·빙수", kw: "빙수 망고빙수 아이스크림 shaved ice mango ice" },
        { label: "🥐 베이커리·소금빵", kw: "베이커리 빵집 크루아상 bakery bread pastry" },
        { label: "🍍 펑리수·전통과자", kw: "펑리수 누가크래커 화과자 타르트 pineapple cake pastry" },
        { label: "🍰 케이크·푸딩", kw: "케이크 푸딩 마카롱 cake pudding" }
      ],
      night_market: [
        { label: "전체 야시장·야경", kw: "" },
        { label: "🌙 야시장·먹자골목", kw: "야시장 길거리음식 먹자골목 night market street food" },
        { label: "🌃 야경·전망 포인트", kw: "야경 전망대 타워 야간명소 night view observation deck" }
      ],
      bar: [
        { label: "전체 바·펍", kw: "" },
        { label: "🍢 이자카야·심야포차", kw: "이자카야 포차 꼬치 오뎅바 izakaya pub" },
        { label: "🍸 루프탑·칵테일바", kw: "칵테일바 루프탑바 위스키바 cocktail bar rooftop" },
        { label: "🍺 수제맥주·탭하우스", kw: "수제맥주 브루어리 생맥주 craft beer brewery" }
      ],
      tourist_attraction: [
        { label: "전체 명소", kw: "" },
        { label: "📸 필수 랜드마크", kw: "랜드마크 필수명소 포토스팟 landmark attraction" },
        { label: "🏯 역사·사원·고궁", kw: "사원 성당 고궁 역사유적 temple shrine palace heritage" },
        { label: "🎨 복합문화·예술거리", kw: "문화거리 예술촌 벽화골목 creative park art street" }
      ],
      shopping_mall: [
        { label: "전체 쇼핑", kw: "" },
        { label: "🎁 기념품·소품샵", kw: "기념품샵 소품샵 캐릭터샵 문구점 souvenir gift shop" },
        { label: "🏬 백화점·쇼핑몰", kw: "백화점 쇼핑몰 면세점 아울렛 department store mall" },
        { label: "🛍️ 전통시장·상점가", kw: "시장 상점가 지하상가 market shopping street" }
      ]
    };

    // 거리 최우선 카테고리 (편의점, ATM, 은행, 약국, 주유소 등은 평점보다 거리가 중요하므로 가까운 순서대로 표시!)
    const DISTANCE_PRIORITY_CATEGORIES = new Set([
      "convenience_store",
      "atm",
      "bank",
      "pharmacy",
      "gas_station"
    ]);

    function isDistancePriorityCategory(catId) {
      return catId ? DISTANCE_PRIORITY_CATEGORIES.has(catId) : false;
    }

    function formatShortDist(distM) {
      if (typeof distM !== "number" || !isFinite(distM)) return "";
      if (distM < 1000) return `${Math.round(distM)}m`;
      return `${(distM / 1000).toFixed(1)}km`;
    }

    // 베이지안 가중 인기도 점수 계산 (리뷰 1~2개짜리 5.0점보다 리뷰 수백 개의 4.4점 로컬 명소가 상위에 오도록 계산)
    function computePopularityScore(place) {
      const r = typeof place?.rating === "number" && place.rating > 0 ? place.rating : 0;
      const c = typeof place?.userRatingCount === "number" && place.userRatingCount > 0 ? place.userRatingCount : 0;
      if (r === 0) return -1;
      const m = 50;
      const C = 4.0;
      const bayesian = (c / (c + m)) * r + (m / (c + m)) * C;
      const logBonus = Math.log10(c + 1) * 0.25;
      return bayesian + logBonus;
    }

    // 영문 primaryType -> 한국어 표시 사전 (세부 음식점·카페·명소 완벽 대응)
    const TYPE_KO_LABELS = {
      restaurant: "음식점·맛집",
      korean_restaurant: "한식당",
      japanese_restaurant: "일식당",
      chinese_restaurant: "중식당",
      italian_restaurant: "이탈리안 식당",
      american_restaurant: "양식·다이닝",
      western_restaurant: "양식당",
      seafood_restaurant: "해산물·횟집",
      barbecue_restaurant: "고기·구이 전문점",
      steak_house: "스테이크 하우스",
      sushi_restaurant: "초밥·스시",
      ramen_restaurant: "라멘 전문점",
      noodle_shop: "면요리 전문점",
      fast_food_restaurant: "패스트푸드",
      hamburger_restaurant: "버거 전문점",
      pizza_restaurant: "피자 전문점",
      thai_restaurant: "태국 음식점",
      vietnamese_restaurant: "베트남 음식점",
      indian_restaurant: "인도 음식점",
      mexican_restaurant: "멕시코 음식점",
      french_restaurant: "프랑스 음식점",
      spanish_restaurant: "스페인 음식점",
      mediterranean_restaurant: "지중해 음식점",
      middle_eastern_restaurant: "중동 음식점",
      brunch_restaurant: "브런치 식당",
      buffet_restaurant: "뷔페 식당",
      fine_dining_restaurant: "파인다이닝",
      vegan_restaurant: "비건 식당",
      vegetarian_restaurant: "채식 식당",
      sandwich_shop: "샌드위치·간식",
      diner: "다이닝·식당",
      bistro: "비스트로",
      snack_bar: "분식·스낵",
      meal_takeaway: "음식점·포장",
      meal_delivery: "음식점",
      food: "음식점·맛집",
      cafe: "카페",
      coffee_shop: "카페·커피전문점",
      tea_house: "티하우스·찻집",
      dessert_shop: "디저트 카페",
      ice_cream_shop: "아이스크림·디저트",
      bakery: "베이커리·빵집",
      donut_shop: "도넛·베이커리",
      bagel_shop: "베이글·베이커리",
      pastry_shop: "제과·베이커리",
      cake_shop: "케이크 전문점",
      tourist_attraction: "관광명소",
      historical_landmark: "역사 명소",
      cultural_landmark: "문화 명소",
      monument: "기념비·명소",
      amusement_park: "테마파크·유원지",
      aquarium: "아쿠아리움",
      zoo: "동물원",
      art_gallery: "미술관·갤러리",
      museum: "박물관",
      park: "공원",
      national_park: "국립공원",
      botanical_garden: "수목원·식물원",
      convenience_store: "편의점",
      atm: "ATM",
      bank: "은행",
      pharmacy: "약국",
      drugstore: "약국·드럭스토어",
      supermarket: "슈퍼마켓·마트",
      grocery_store: "식료품·마트",
      grocery_or_supermarket: "슈퍼마켓·마트",
      shopping_mall: "쇼핑몰",
      department_store: "백화점",
      gas_station: "주유소",
      locality: "도시·지역",
      sublocality: "지역·동네",
      administrative_area_level_1: "광역 지역",
      country: "국가",
      train_station: "기차역",
      subway_station: "지하철역",
      transit_station: "대중교통역",
      airport: "공항",
      lodging: "숙소·호텔",
      hotel: "호텔",
      point_of_interest: "주변 장소",
      store: "상점",
      bar: "바·펍",
      pub: "펍·맥주",
      wine_bar: "와인바",
      cocktail_bar: "칵테일바",
      night_market: "야시장",
      observation_deck: "전망대·야경",
      spa: "스파·마사지",
      massage: "마사지·테라피",
      gift_shop: "소품·기념품샵",
      establishment: "장소"
    };

// 가격대(PriceLevel) 한국어 변환
    const PRICE_LEVEL_LABELS = {
      FREE: "무료",
      PRICE_LEVEL_FREE: "무료",
      0: "무료",
      INEXPENSIVE: "₩ (저렴)",
      PRICE_LEVEL_INEXPENSIVE: "₩ (저렴)",
      1: "₩ (저렴)",
      MODERATE: "₩₩ (보통)",
      PRICE_LEVEL_MODERATE: "₩₩ (보통)",
      2: "₩₩ (보통)",
      EXPENSIVE: "₩₩₩ (고급)",
      PRICE_LEVEL_EXPENSIVE: "₩₩₩ (고급)",
      3: "₩₩₩ (고급)",
      VERY_EXPENSIVE: "₩₩₩₩ (매우 고급)",
      PRICE_LEVEL_VERY_EXPENSIVE: "₩₩₩₩ (매우 고급)",
      4: "₩₩₩₩ (매우 고급)"
    };

    // 대중교통 수단 한국어 변환
    const VEHICLE_KO_LABELS = {
      BUS: "버스",
      INTERCITY_BUS: "시외/고속버스",
      TROLLEYBUS: "트롤리버스",
      SUBWAY: "지하철",
      HEAVY_RAIL: "전철/기차",
      COMMUTER_TRAIN: "통근열차",
      HIGH_SPEED_TRAIN: "고속열차",
      LONG_DISTANCE_TRAIN: "장거리열차",
      LIGHT_RAIL: "경전철/트램",
      MONORAIL: "모노레일",
      TRAM: "트램",
      RAIL: "철도",
      FERRY: "페리",
      CABLE_CAR: "케이블카"
    };

    // 애플리케이션 상태
    const state = {
      apiKey: "",
      mapsLoaded: false,
      mapsLoadError: null,
      map: null,
      libs: {
        Map: null,
        Place: null,
        PlacesService: null,
        SearchNearbyRankPreference: null,
        Route: null,
        RouteMatrix: null,
        RouteMatrixItemCondition: null,
        DirectionsService: null,
        DistanceMatrixService: null,
        AdvancedMarkerElement: null,
        PinElement: null,
        LatLngBounds: null
      },
      currentLocation: null, // 실제 내 GPS 위치 { lat, lng }
      searchOrigin: null,    // 현재 주변 검색 기준 중심점
      searchOriginLabel: "현재 내 위치",
      isMapMovedFromOrigin: false,
      isProgrammaticPan: false,
      selectedRadius: DEFAULT_SEARCH_RADIUS_M,
      customRadiusM: DEFAULT_SEARCH_RADIUS_M,  // 사용자가 선택한 반경 (600m / 1.5km / 3km)
      activeCategoryGroup: "discovery",        // "discovery" (✨여행발견) | "utility" (🛟생활·편의)
      selectedCategory: null,                  // 앱 시작 시 자동 검색하지 않고 사용자가 카테고리를 누를 때 검색
      activeTasteKeyword: "",                  // 카테고리 내 세부 메뉴·취향 키워드
      onlyVerified100: false,                  // 리뷰 100개 이상 검증된 곳만 보기 필터
      keyword: "",
      sortBy: "popular",                       // 기본 정렬: 🏆 현지 인기순 (평점×리뷰수 베이지안 가중)
      isRequestInFlight: false,
      searchSeq: 0,
      lastSearchSignature: "",
      allCandidatePlaces: [],                  // 확장 탐색(+10곳 더보기)을 위한 전체 후보 장소 풀
      visibleLimit: 10,                        // 현재 화면에 표시할 장소 개수 (초기 10개, 더보기 클릭 시 +10)
      places: [],                              // 현재 화면에 노출할 장소 목록
      hoveredPlaceId: null,                    // 스크롤 시 지도 마커 자동 하이라이트용 ID
      currentTripDay: 1,                       // 여행 코스 현재 선택 일자 (Day 1, Day 2, Day 3)
      selectedPlaceId: null,
      activeRouteMode: "WALKING",
      routeOriginMode: "origin", // "origin" (고정 기준점) | "my_location" (내 GPS 위치)
      userMarker: null,
      searchCenterMarker: null,
      myPlaces: [],                            // 상단 '❤️ 내 장소'에 저장한 숙소·가고 싶은 여행지 목록 (하단 리스트와 완전 분리!)
      myPlaceMarkers: new Map(),               // 내 장소 전용 빨간 하트 마커
      isMyPlacesOpen: false,                   // 상단 '❤️ 내 장소' 드롭다운 열림 상태
      lastSearchedTarget: null,
      placeMarkers: new Map(),                 // placeId -> marker
      activePolylines: [],
      tripList: [],                            // 여행 코스에 담긴 장소 배열 (localStorage 자동 저장)
      tripTravelMode: "WALKING",
      tripLegMetrics: [],
      tripTotalDurationMs: null,
      tripTotalDistanceM: null,
      tripOptimizationLabel: "",
      sheetState: "normal",                    // "normal" | "expanded" | "hidden"
      isUserDragging: false,
      // 메모리 캐시 및 진행 중 요청 공유 맵
      searchCache: new Map(),
      inflightNearbyMap: new Map(),
      routeMatrixCache: new Map(),
      placeDetailsCache: new Map(),
      singleRouteCache: new Map()
    };

    const $ = (id) => document.getElementById(id);

// 실제 Google 평점 무결성 검증 함수 (가짜 평점 생성 절대 금지)
    function ensurePlaceRating(place) {
      if (!place) return;
      if (typeof place.rating === "number" && isFinite(place.rating) && place.rating > 0 && place.rating <= 5.0) {
        place.rating = Math.round(place.rating * 10) / 10;
        place.isGoogleRatingVerified = true;
      } else {
        place.rating = null;
        place.userRatingCount = null;
        place.isGoogleRatingVerified = false;
      }
    }

    function hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }

// =========================================================================
    // [11] 유틸리티 및 정밀 오류 진단 함수
    // =========================================================================
    function extractLatLngLiteral(loc) {
      if (!loc) return null;
      const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
      const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng };
      }
      return null;
    }

    function computeHaversineMeters(a, b) {
      const R = 6371000;
      const toRad = (deg) => (deg * Math.PI) / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const sinLat = Math.sin(dLat / 2);
      const sinLng = Math.sin(dLng / 2);
      const h =
        sinLat * sinLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
      return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
    }

    function formatDistance(meters) {
      if (typeof meters !== "number" || !isFinite(meters)) return "";
      if (meters < 1000) return `${Math.round(meters)}m`;
      return `${(meters / 1000).toFixed(1)}km`;
    }

    function formatDuration(ms) {
      if (typeof ms !== "number" || !isFinite(ms)) return "";
      const totalMin = Math.max(1, Math.round(ms / 60000));
      if (totalMin < 60) return `${totalMin}분`;
      const hrs = Math.floor(totalMin / 60);
      const mins = totalMin % 60;
      return mins > 0 ? `${hrs}시간 ${mins}분` : `${hrs}시간`;
    }

    function setLoading(isLoading, text = "처리 중...") {
      const box = $("loadingBox");
      const txt = $("loadingText");
      if (txt) txt.textContent = text;
      if (box) box.classList.toggle("active", isLoading);
    }

    function setButtonsDisabled(disabled) {
      $("btnSearch").disabled = disabled;
      $("btnLocate").disabled = disabled;
    }

    function showBanner(message, level = "info", showHelpButton = false) {
      const banner = $("statusBanner");
      const textEl = $("statusBannerText");
      const helpBtn = $("statusBannerHelpBtn");
      if (!banner || !textEl) return;
      textEl.textContent = message;
      banner.className = `status-banner ${level}`;
      if (helpBtn) {
        helpBtn.style.display = showHelpButton ? "inline-block" : "none";
      }
    }

    function handleApiError(err, fallbackMsg) {
      const rawMsg = String(err?.message || err || "");
      const reason = err?.reason || "";
      const diagBox = $("lastDiagnosticErrorBox");
      if (diagBox) {
        diagBox.style.display = "block";
        diagBox.textContent = `Google 서버 응답: ${rawMsg}`;
      }

      if (reason === "API_KEY_SERVICE_BLOCKED" || rawMsg.includes("API_KEY_SERVICE_BLOCKED") || rawMsg.includes("are blocked")) {
        showBanner(
          "Google 서버에서 API 키 설정 반영 대기 중이거나 브라우저에 이전 키가 캐시되어 있습니다. 우측 [원인·해결]에서 [캐시 초기화]를 눌러보세요.",
          "warn",
          true
        );
      } else if (reason === "SERVICE_DISABLED" || rawMsg.includes("has not been used in project") || rawMsg.includes("is disabled")) {
        showBanner(
          "Google Cloud 프로젝트에서 필요한 API가 활성화되어 있지 않습니다. 우측 [원인·해결]을 눌러 확인하세요.",
          "error",
          true
        );
      } else if (reason === "API_KEY_HTTP_REFERRER_BLOCKED" || rawMsg.includes("referer")) {
        showBanner(
          "API 키의 '웹사이트(HTTP 리퍼러) 제한사항'에 현재 접속 주소가 허용되어 있지 않습니다.",
          "error",
          true
        );
      } else if (rawMsg.includes("OVER_QUERY_LIMIT") || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("429")) {
        showBanner("API 요청 할당량이 초과되었습니다. 잠시 후 다시 시도해 주세요.", "error", true);
      } else if (!navigator.onLine) {
        showBanner("네트워크 연결이 끊어졌습니다. 인터넷 연결 상태를 확인해 주세요.", "error", false);
      } else {
        showBanner(`${fallbackMsg} 우측 [원인·해결]을 눌러 상세 원인을 확인하세요.`, "error", true);
      }
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function sanitizeUrl(url) {
      if (!url) return "#";
      const trimmed = String(url).trim();
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return "#";
    }
