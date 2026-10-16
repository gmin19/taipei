// ===========================================================================
// [config.js] 카테고리 정의, 전역 상태(state) 및 공통 유틸리티 (API 키는 브라우저에 안전하게 저장됨)
// ===========================================================================

// =========================================================================
    // [1] 보안 설정: GitHub Pages 등 공개 저장소에 키가 노출되지 않도록 빈 값("")으로 두고,
    // 웹앱 실행 시 화면 입력창을 통해 각 기기(폰·PC)의 브라우저에만 저장하는 방식을 기본으로 사용합니다.
    // =========================================================================
    const GOOGLE_MAPS_API_KEY = "";

    // API 요청 및 구글맵 평점 기준 상수
    const MAX_SEARCH_RESULTS = 10;          // 화면에 표시할 장소 수 (구글 평점 기준 상위 10개)
    const MAX_ROUTE_MATRIX_TARGETS = 6;     // 상위 6개 장소의 도보·대중교통 시간 백그라운드 계산
    const DEFAULT_SEARCH_RADIUS_M = 1500;   // 주변 검색 반경 1.5km
    const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }; // 초기 기본 중심

    // 카테고리 매핑 (조건에 따른 제외 없이 구글 평점 기준으로 10곳을 우선 표시)
    const CATEGORIES = [
      {
        id: "restaurant",
        label: "맛집",
        icon: "🍽️",
        types: ["restaurant"],
        includedPrimaryTypes: [
          "restaurant",
          "korean_restaurant",
          "japanese_restaurant",
          "chinese_restaurant",
          "american_restaurant",
          "italian_restaurant",
          "seafood_restaurant",
          "steak_house",
          "sushi_restaurant",
          "ramen_restaurant",
          "hamburger_restaurant",
          "pizza_restaurant",
          "barbecue_restaurant",
          "fast_food_restaurant",
          "thai_restaurant",
          "vietnamese_restaurant",
          "indian_restaurant",
          "mexican_restaurant",
          "french_restaurant",
          "brunch_restaurant",
          "buffet_restaurant",
          "meal_takeaway"
        ],
        excludedPrimaryTypes: [
          "cafe",
          "coffee_shop",
          "bakery",
          "dessert_shop",
          "ice_cream_shop",
          "convenience_store",
          "supermarket",
          "grocery_store",
          "department_store",
          "shopping_mall",
          "hotel",
          "lodging",
          "motel",
          "gas_station"
        ],
        keywordKo: "음식점 식당",
        keywordEn: "restaurant",
        radiusM: 1500
      },
      {
        id: "cafe",
        label: "카페",
        icon: "☕",
        types: ["cafe", "coffee_shop"],
        includedPrimaryTypes: ["cafe", "coffee_shop", "tea_house", "bakery"],
        excludedPrimaryTypes: [
          "restaurant",
          "korean_restaurant",
          "japanese_restaurant",
          "chinese_restaurant",
          "barbecue_restaurant",
          "seafood_restaurant",
          "fast_food_restaurant",
          "bar",
          "night_club",
          "hotel",
          "lodging",
          "convenience_store",
          "supermarket",
          "internet_cafe"
        ],
        keywordKo: "카페 커피전문점",
        keywordEn: "cafe coffee shop",
        radiusM: 1500
      },
      {
        id: "tourist_attraction",
        label: "관광지",
        icon: "📸",
        types: ["tourist_attraction", "museum", "park", "historical_landmark"],
        includedPrimaryTypes: ["tourist_attraction", "museum", "park", "historical_landmark", "amusement_park", "art_gallery", "aquarium", "zoo"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "gas_station", "bank", "atm", "pharmacy", "hotel", "lodging"],
        keywordKo: "관광명소 볼거리",
        keywordEn: "tourist attraction",
        radiusM: 2500
      },
      {
        id: "convenience_store",
        label: "편의점",
        icon: "🏪",
        types: ["convenience_store"],
        includedPrimaryTypes: ["convenience_store"],
        excludedPrimaryTypes: ["restaurant", "cafe", "supermarket", "hotel", "lodging", "pharmacy", "bank"],
        keywordKo: "편의점",
        keywordEn: "convenience store",
        radiusM: 1000
      },
      {
        id: "atm",
        label: "ATM",
        icon: "🏧",
        types: ["atm"],
        includedPrimaryTypes: ["atm", "bank"],
        excludedPrimaryTypes: ["restaurant", "cafe", "hotel", "lodging"],
        keywordKo: "ATM 현금인출기",
        keywordEn: "atm",
        radiusM: 1200
      },
      {
        id: "bank",
        label: "은행",
        icon: "🏦",
        types: ["bank"],
        includedPrimaryTypes: ["bank"],
        excludedPrimaryTypes: ["restaurant", "cafe", "hotel", "lodging", "convenience_store"],
        keywordKo: "은행",
        keywordEn: "bank",
        radiusM: 1500
      },
      {
        id: "pharmacy",
        label: "약국",
        icon: "💊",
        types: ["pharmacy"],
        includedPrimaryTypes: ["pharmacy", "drugstore"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging", "hospital"],
        keywordKo: "약국",
        keywordEn: "pharmacy",
        radiusM: 1200
      },
      {
        id: "park",
        label: "공원",
        icon: "🌳",
        types: ["park"],
        includedPrimaryTypes: ["park", "national_park", "botanical_garden"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging", "gas_station"],
        keywordKo: "공원",
        keywordEn: "park",
        radiusM: 2000
      },
      {
        id: "museum",
        label: "박물관",
        icon: "🏛️",
        types: ["museum"],
        includedPrimaryTypes: ["museum", "art_gallery"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging"],
        keywordKo: "박물관 미술관",
        keywordEn: "museum",
        radiusM: 3000
      },
      {
        id: "bakery",
        label: "베이커리",
        icon: "🥐",
        types: ["bakery"],
        includedPrimaryTypes: ["bakery", "donut_shop", "bagel_shop", "dessert_shop"],
        excludedPrimaryTypes: ["restaurant", "korean_restaurant", "chinese_restaurant", "japanese_restaurant", "convenience_store", "supermarket", "hotel", "lodging"],
        keywordKo: "베이커리 빵집 제과점",
        keywordEn: "bakery",
        radiusM: 1500
      },
      {
        id: "supermarket",
        label: "마트",
        icon: "🛒",
        types: ["supermarket", "grocery_store"],
        includedPrimaryTypes: ["supermarket", "grocery_store"],
        excludedPrimaryTypes: ["convenience_store", "restaurant", "cafe", "hotel", "lodging"],
        keywordKo: "대형마트 슈퍼마켓",
        keywordEn: "supermarket",
        radiusM: 1800
      },
      {
        id: "shopping_mall",
        label: "쇼핑",
        icon: "🛍️",
        types: ["shopping_mall"],
        includedPrimaryTypes: ["shopping_mall", "department_store"],
        excludedPrimaryTypes: ["convenience_store", "restaurant", "cafe", "gas_station", "pharmacy", "bank"],
        keywordKo: "쇼핑몰 백화점",
        keywordEn: "shopping mall",
        radiusM: 2500
      },
      {
        id: "gas_station",
        label: "주유소",
        icon: "⛽",
        types: ["gas_station"],
        includedPrimaryTypes: ["gas_station"],
        excludedPrimaryTypes: ["restaurant", "cafe", "convenience_store", "hotel", "lodging"],
        keywordKo: "주유소",
        keywordEn: "gas station",
        radiusM: 3000
      }
    ];

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
      selectedCategory: null,                  // 앱 시작 시 자동 검색하지 않고 사용자가 카테고리를 누를 때 검색
      keyword: "",
      sortBy: "rating",                     // 기본 정렬: 추천 베스트 순 (평점 3.8+ · 리뷰 신뢰도 · 1km 근접성 종합)
      isRequestInFlight: false,
      searchSeq: 0,
      lastSearchSignature: "",
      places: [],                              // 정규화된 장소 목록
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


    function renderPlacesListAndMarkers(updateMapBounds = false) {
      const sorted = getSortedPlaces();
      $("placeCountText").textContent = `(${sorted.length})`;
      updateRestoreBarText();

      const listEl = $("placesList");
      const emptyEl = $("placesEmptyState");

      if (sorted.length === 0) {
        listEl.innerHTML = "";
        emptyEl.style.display = "block";
        return;
      }

      emptyEl.style.display = "none";
      listEl.innerHTML = "";

      sorted.forEach((place, idx) => {
        const displayIdx = idx + 1;
        place.displayIndex = displayIdx;
        const card = createPlaceCardElement(place, displayIdx);
        listEl.appendChild(card);
      });

      renderMapMarkers(sorted, updateMapBounds);
    }

    function createPlaceCardElement(place, indexNum) {
      const isSelected = place.id === state.selectedPlaceId;
      const inTrip = state.tripList.some((item) => item.id === place.id);
      const inMyPlaces = isPlaceInMyPlaces(place);

      const card = document.createElement("article");
      card.className = "place-card" + (isSelected ? " selected" : "");
      card.id = `place-card-${place.id}`;

      const isDistCat = isDistancePriorityCategory(state.selectedCategory);
      ensurePlaceRating(place);
      const hasRealRating = typeof place.rating === "number" && place.rating > 0;
      const ratingScore = hasRealRating ? place.rating.toFixed(1) : null;
      const reviewCountText =
        hasRealRating && typeof place.userRatingCount === "number" && place.userRatingCount > 0
          ? `(${place.userRatingCount.toLocaleString()}개 리뷰)`
          : "";

      const realRatingSpan = hasRealRating
        ? `<span class="rating-text">★ ${ratingScore}</span> ${reviewCountText ? `<span>${reviewCountText}</span>` : ""}`
        : `<span class="status-unknown rating-placeholder">평점 정보 없음</span>`;

      // 거리 우선 카테고리(편의점·ATM·은행·약국·주유소)는 거리순임을 강조하고 실제 평점이 있을 때만 함께 표시
      const ratingHtml = isDistCat
        ? `<span style="color:#047857; font-weight:800;">📍 거리 우선 (가장 가까움 #${indexNum})</span>${hasRealRating ? ` · ${realRatingSpan}` : ""}`
        : realRatingSpan;

      let openBadgeHtml = `<span class="status-unknown">영업 상태 정보 없음</span>`;
      if (place.isOpenNow === true) {
        openBadgeHtml = `<span class="status-open">● 영업 중</span>`;
      } else if (place.isOpenNow === false) {
        openBadgeHtml = `<span class="status-closed">● 영업 종료</span>`;
      }

      const priceText =
        place.priceLevel !== null && place.priceLevel !== undefined && PRICE_LEVEL_LABELS[place.priceLevel]
          ? `<span class="price-badge">${PRICE_LEVEL_LABELS[place.priceLevel]}</span>`
          : "";

      let walkText = "도보 정보 없음";
      if (place.walkStatus === "PENDING") {
        walkText = "도보 계산 중...";
      } else if (place.walkStatus === "OK" && place.walkDurationMs !== null) {
        const wDur = formatDuration(place.walkDurationMs);
        const wDist = place.walkDistanceM !== null ? ` · ${formatDistance(place.walkDistanceM)}` : "";
        walkText = `도보 ${wDur}${wDist}`;
      } else if (place.walkStatus === "SKIPPED_LIMIT") {
        walkText = "도보 (카드 선택 시 표시)";
      }

      let transitText = "대중교통 경로 없음";
      if (place.transitStatus === "PENDING") {
        transitText = "대중교통 계산 중...";
      } else if (place.transitStatus === "OK" && place.transitDurationMs !== null) {
        transitText = `대중교통 ${formatDuration(place.transitDurationMs)}`;
      } else if (place.transitStatus === "SKIPPED_LIMIT") {
        transitText = "대중교통 (카드 선택 시 표시)";
      }

      let summaryLineHtml = "";
      if (place.editorialSummary) {
        summaryLineHtml = `<div class="place-summary">${escapeHtml(place.editorialSummary)}</div>`;
      } else if (place.address) {
        summaryLineHtml = `<div class="place-summary">📍 ${escapeHtml(place.address)}</div>`;
      }

      const todayHoursLine = place.todayHoursText
        ? `<div class="opening-hours-line">🕒 ${escapeHtml(place.todayHoursText)}</div>`
        : "";

      const photoBoxHtml = place.photoUrl
        ? `<div class="card-photo-box">
             <img src="${place.photoUrl}" alt="${escapeHtml(place.name)}" class="card-photo" loading="lazy" />
             ${place.photoAttrHtml ? `<div class="photo-attr">${place.photoAttrHtml}</div>` : ""}
           </div>`
        : "";

      const weekdayListHtml =
        Array.isArray(place.weekdayDescriptions) && place.weekdayDescriptions.length > 0
          ? `<div class="detail-block-title">📅 요일별 영업시간</div>
             <div style="font-size:12px; line-height:1.5;">${place.weekdayDescriptions.map(escapeHtml).join("<br/>")}</div>`
          : `<div class="detail-block-title">📅 영업시간</div><div style="font-size:12px;">제공된 영업시간 정보가 없습니다.</div>`;

      let transitDetailsHtml = "";
      if (place.transitSteps !== null) {
        if (place.transitSteps.length === 0) {
          transitDetailsHtml = `<div class="detail-block-title">🚌 대중교통 세부 경로</div><div style="font-size:12px;">이 구간은 대중교통 노선이 없거나 도보 이동이 더 빠른 거리입니다.</div>`;
        } else {
          const transitOnlyCount = place.transitSteps.filter((s) => s.type === "TRANSIT").length;
          const transferCount = Math.max(0, transitOnlyCount - 1);
          const headerNote =
            transitOnlyCount === 0
              ? `총 ${formatDuration(place.transitDurationMs)} · 가까운 거리 도보 이동`
              : `총 ${formatDuration(place.transitDurationMs)} · 환승 ${transferCount}회`;

          transitDetailsHtml = `
            <div class="detail-block-title">
              🚌 대중교통 세부 경로 (${headerNote})
            </div>
            <div class="transit-steps-list">
              ${place.transitSteps
                .map(
                  (st) => `
                <div class="transit-step-item">
                  <span class="transit-line-pill" style="${st.type === "WALKING" ? "background:#64748b;" : ""}">${escapeHtml(st.badge)}</span>
                  <div>
                    <div style="font-weight:700; color:var(--text-primary);">${escapeHtml(st.text)}</div>
                    ${st.sub ? `<div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(st.sub)}</div>` : ""}
                  </div>
                </div>`
                )
                .join("")}
            </div>
          `;
        }
      }

      const websiteHtml = place.websiteURI
        ? `<div style="margin-top:6px; font-size:12px;">🌐 공식 웹사이트: <a href="${sanitizeUrl(place.websiteURI)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); font-weight:700;">바로가기 ↗</a></div>`
        : "";

      const isKorea = isInSouthKorea(place.location);
      const mapsDetailUrl = buildGoogleMapsPlaceUrl(place);
      const mapsDirTransitUrl = buildGoogleMapsDirectionsUrl(place, "TRANSIT");
      const mapsDirWalkUrl = buildGoogleMapsDirectionsUrl(place, "WALKING");
      const naverDirUrl = isKorea ? buildNaverDirectionsUrl(place) : "";
      const kakaoDirUrl = isKorea ? buildKakaoDirectionsUrl(place) : "";
      const originLabelShort = state.routeOriginMode === "my_location" ? "내위치" : (state.searchOriginLabel || "기준점");

      card.innerHTML = `
        <div class="card-top">
          <div class="card-main-info">
            <div class="card-title-row">
              <span class="place-index-badge" style="${isDistCat ? 'background:#059669;' : ''}">${indexNum}</span>
              <h3 class="place-name">${escapeHtml(place.name)}</h3>
              <span class="place-category-badge">${escapeHtml(place.categoryLabel)}</span>
            </div>
            <div class="meta-row">
              ${ratingHtml}
              <span>·</span>
              ${openBadgeHtml}
              ${priceText ? `<span>·</span>${priceText}` : ""}
            </div>
          </div>
          ${photoBoxHtml}
        </div>

        <div class="distance-bar">
          <span class="dist-chip walk">🚶 ${walkText}</span>
          <span class="dist-divider">|</span>
          <span class="dist-chip transit">🚌 ${transitText}</span>
        </div>

        ${summaryLineHtml}
        ${todayHoursLine}

        <div class="place-details-drawer ${place.drawerOpen ? "open" : ""}" id="drawer-${place.id}">
          ${place.address ? `<div style="font-size:12px; margin-bottom:4px;">📍 주소: ${escapeHtml(place.address)}</div>` : ""}
          ${weekdayListHtml}
          ${websiteHtml}
          ${transitDetailsHtml}
          <div class="detail-block-title" style="margin-top:10px;">🗺️ 앱별 길찾기 바로가기 (${escapeHtml(originLabelShort)} 출발)</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
            <a href="${mapsDirTransitUrl}" target="_blank" rel="noopener noreferrer" class="card-btn primary" style="flex:1 1 calc(50% - 3px); min-width:130px;">
              🚌 Google 대중교통
            </a>
            <a href="${mapsDirWalkUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" style="flex:1 1 calc(50% - 3px); min-width:130px;">
              🚶 Google 도보
            </a>
            ${isKorea ? `
            <a href="${naverDirUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" style="flex:1 1 calc(50% - 3px); min-width:130px; border-color:#03c75a; color:#03c75a; font-weight:800;">
              🟢 네이버지도 대중교통
            </a>
            <a href="${kakaoDirUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" style="flex:1 1 calc(50% - 3px); min-width:130px; border-color:#eab308; background:#fef08a; color:#713f12; font-weight:800;">
              🟡 카카오맵 길찾기
            </a>
            ` : ""}
          </div>
        </div>

        <div class="card-actions">
          <button type="button" class="card-btn btn-detail-toggle" data-action="detail">
            ℹ️ 상세·교통
          </button>
          <a href="${mapsDetailUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" data-action="gmaps">
            🗺️ 구글지도
          </a>
          <button type="button" class="card-btn primary" data-action="directions" title="지도 화면에 경로 표시 및 길찾기 (${escapeHtml(originLabelShort)} 출발)">
            🗺️ 길찾기
          </button>
          <button type="button" class="card-btn ${inTrip ? "in-trip" : ""}" data-action="trip">
            ${inTrip ? "✓ 코스담김" : "+ 코스추가"}
          </button>
          <button type="button" class="card-btn ${inMyPlaces ? "fav-saved" : ""}" data-action="save-fav">
            ${inMyPlaces ? "❤️ 내장소✓" : "🤍 내장소"}
          </button>
        </div>
      `;

      card.addEventListener("click", async (e) => {
        const actionEl = e.target.closest("[data-action]");
        if (actionEl) {
          const act = actionEl.dataset.action;
          if (act === "gmaps") {
            e.stopPropagation();
            return;
          }
          if (act === "directions") {
            e.stopPropagation();
            place.drawerOpen = true;
            await handlePlaceSelection(place, { toggleDrawer: false, scrollToCard: false, forceFitRoute: true });
            return;
          }
          if (act === "trip") {
            e.stopPropagation();
            togglePlaceInTrip(place);
            return;
          }
          if (act === "save-fav") {
            e.stopPropagation();
            toggleMyPlace(place);
            return;
          }
          if (act === "detail") {
            e.stopPropagation();
            await handlePlaceSelection(place, { toggleDrawer: true });
            return;
          }
        }
        await handlePlaceSelection(place, { toggleDrawer: false });
      });

      return card;
    }

    async function handlePlaceSelection(place, { toggleDrawer = false, scrollToCard = false, forceFitRoute = true } = {}) {
      const wasSelected = state.selectedPlaceId === place.id;
      state.selectedPlaceId = place.id;

      if (scrollToCard && state.sheetState === "hidden") {
        setSheetState("normal");
      }

      if (toggleDrawer) {
        place.drawerOpen = !place.drawerOpen;
      } else if (!wasSelected) {
        place.drawerOpen = true;
      }

      if (state.map && place.location && !forceFitRoute) {
        panToProgrammatically(place.location);
      }

      updateMarkerHighlight();

      if (scrollToCard) {
        switchBottomTab("places");
        setTimeout(() => {
          const cardEl = document.getElementById(`place-card-${place.id}`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 80);
      }

      const origin = state.searchOrigin || state.currentLocation;

      await Promise.all([
        ensurePlaceDetailsLoaded(place),
        computeAndDisplaySingleRoute(place, state.activeRouteMode, forceFitRoute),
        (async () => {
          if (origin && (place.transitSteps === null || place.transitStatus !== "OK")) {
            try {
              const tData = await fetchSingleRouteNewApi(origin, place.location, "TRANSIT");
              if (tData && typeof tData.durationMillis === "number") {
                place.transitDurationMs = tData.durationMillis;
                place.transitDistanceM = tData.distanceMeters ?? place.transitDistanceM;
                place.transitStatus = "OK";
                place.transitSteps = tData.transitSteps || [];
              } else if (place.transitSteps === null) {
                place.transitSteps = [];
              }
            } catch (_) {
              if (place.transitSteps === null) place.transitSteps = [];
            }
          }
        })(),
        (async () => {
          if (origin && place.walkStatus !== "OK") {
            try {
              const wData = await fetchSingleRouteNewApi(origin, place.location, "WALKING");
              if (wData && typeof wData.durationMillis === "number") {
                place.walkDurationMs = wData.durationMillis;
                place.walkDistanceM = wData.distanceMeters ?? place.walkDistanceM;
                place.walkStatus = "OK";
              }
            } catch (_) {}
          }
        })()
      ]);

      renderPlacesListAndMarkers(false);
    }

    // =========================================================================
    // Google 평점이 누락된 장소에 대해 Google Places 검색을 통해 실시간으로 평점 보강!
    // =========================================================================
    async function enrichPlacesWithGoogleRatings(placesList) {
      if (!Array.isArray(placesList) || placesList.length === 0) return;
      placesList.forEach(ensurePlaceRating);

      const unverified = placesList.filter((p) => p && p.location && !p.isGoogleRatingVerified);
      if (unverified.length === 0) return;

      let anyUpdated = false;

      const enrichOnePlace = async (place) => {
        const pLat = Number(place.location.lat);
        const pLng = Number(place.location.lng);

        const isGoodCandidate = (candName, candLoc, candTypes) => {
          if (!candName) return false;
          const rTypes = Array.isArray(candTypes) ? candTypes : [];
          if (rTypes.some((t) => ["route", "street_address", "intersection", "locality", "sublocality", "political", "postal_code"].includes(t))) {
            return false;
          }
          if (isRoadOrNonBusinessName(candName)) return false;
          if (candLoc && computeHaversineMeters(place.location, candLoc) > 350) {
            return false;
          }
          return true;
        };

        // [방법 1] Places API (New) REST v1 places:searchText로 정확한 매장 평점 조회
        if (state.apiKey) {
          try {
            const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": state.apiKey,
                "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.photos"
              },
              body: JSON.stringify({
                textQuery: place.name,
                locationBias: {
                  circle: {
                    center: { latitude: pLat, longitude: pLng },
                    radius: 250
                  }
                },
                maxResultCount: 5
              })
            });
            if (resp.ok) {
              const data = await resp.json();
              const candidates = data.places || [];
              const match = candidates.find((c) =>
                isGoodCandidate(
                  c.displayName?.text,
                  c.location ? { lat: c.location.latitude, lng: c.location.longitude } : null,
                  c.types
                )
              );
              if (match) {
                if (match.id) place.googlePlaceId = match.id;
                if (match.googleMapsUri) place.googleMapsURI = match.googleMapsUri;
                if (typeof match.rating === "number" && match.rating > 0) {
                  place.rating = Math.round(match.rating * 10) / 10;
                  place.userRatingCount = typeof match.userRatingCount === "number" ? match.userRatingCount : null;
                  place.isGoogleRatingVerified = true;
                  anyUpdated = true;
                }
                if (!place.photoUrl && Array.isArray(match.photos) && match.photos[0]?.name) {
                  place.photoUrl = `https://places.googleapis.com/v1/${match.photos[0].name}/media?maxWidthPx=320&maxHeightPx=240&key=${encodeURIComponent(state.apiKey)}`;
                }
                updateSinglePlaceCard(place);
                updateSinglePlaceMarker(place);
                return;
              }
            }
          } catch (_) {}
        }

        // [방법 2] Maps JS SDK Place.searchByText로 조회
        if (state.libs.Place && typeof state.libs.Place.searchByText === "function") {
          try {
            const { places } = await state.libs.Place.searchByText({
              textQuery: place.name,
              fields: ["displayName", "location", "types", "rating", "userRatingCount", "photos", "googleMapsURI"],
              locationBias: { center: { lat: pLat, lng: pLng }, radius: 250 },
              maxResultCount: 5
            });
            if (Array.isArray(places) && places.length > 0) {
              const match = places.find((c) =>
                isGoodCandidate(c.displayName, extractLatLngLiteral(c.location), c.types)
              );
              if (match) {
                if (match.id) place.googlePlaceId = match.id;
                if (match.googleMapsURI) place.googleMapsURI = match.googleMapsURI;
                if (typeof match.rating === "number" && match.rating > 0) {
                  place.rating = Math.round(match.rating * 10) / 10;
                  place.userRatingCount = typeof match.userRatingCount === "number" ? match.userRatingCount : null;
                  place.isGoogleRatingVerified = true;
                  anyUpdated = true;
                }
                if (!place.photoUrl && Array.isArray(match.photos) && match.photos[0] && typeof match.photos[0].getURI === "function") {
                  try {
                    place.photoUrl = match.photos[0].getURI({ maxWidth: 320, maxHeight: 240 });
                  } catch (_) {}
                }
                updateSinglePlaceCard(place);
                updateSinglePlaceMarker(place);
                return;
              }
            }
          } catch (_) {}
        }

        // [방법 3] PlacesService (Legacy textSearch) 조회
        if (state.libs.PlacesService && state.map) {
          try {
            const svc = new state.libs.PlacesService(state.map);
            const gLatLng = new google.maps.LatLng(pLat, pLng);
            await new Promise((resolve) => {
              svc.textSearch(
                {
                  query: place.name,
                  location: gLatLng,
                  radius: 250
                },
                (results, status) => {
                  if (status === "OK" && Array.isArray(results) && results.length > 0) {
                    const validMatch = results.find((r) =>
                      isGoodCandidate(r.name, extractLatLngLiteral(r.geometry?.location), r.types)
                    );
                    if (validMatch) {
                      if (validMatch.place_id) place.googlePlaceId = validMatch.place_id;
                      if (typeof validMatch.rating === "number" && validMatch.rating > 0) {
                        place.rating = Math.round(validMatch.rating * 10) / 10;
                        place.userRatingCount = typeof validMatch.user_ratings_total === "number" ? validMatch.user_ratings_total : null;
                        place.isGoogleRatingVerified = true;
                        anyUpdated = true;
                      }
                      if (!place.photoUrl && validMatch.photos && validMatch.photos[0]) {
                        try {
                          place.photoUrl = validMatch.photos[0].getUrl({ maxWidth: 320, maxHeight: 240 });
                        } catch (_) {}
                      }
                      updateSinglePlaceCard(place);
                      updateSinglePlaceMarker(place);
                    }
                  }
                  resolve();
                }
              );
            });
          } catch (_) {}
        }
      };

      await Promise.all(unverified.slice(0, 10).map(enrichOnePlace));

      // 실제 Google 평점이 새로 반영된 경우, 실제 평점 순서대로 카드를 즉시 재정렬!
      if (anyUpdated) {
        state.places = getSortedPlaces();
        renderPlacesListAndMarkers(false);
      }
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
