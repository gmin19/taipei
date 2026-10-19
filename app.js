// ===========================================================================
// [app.js] 앱 초기화, 기기별 API 키 보안 저장, 2그룹 카테고리·취향칩 제어, 다이어트 카드 및 스크롤 마커 연동
// ===========================================================================

// =========================================================================
    // [2] 초기화, '❤️ 내 장소' 및 여행 코스 영구 저장 관리
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
      loadPersistedData();
      renderCategoryButtons();
      renderQuickTasteBar();
      renderMyPlacesDropdown();
      bindUIEvents();
      bindSheetTouchGestures();
      bindSheetScrollMarkerSync();
      checkEnvironmentSecurity();
      initApiKeyAndBootstrap();
    });

    function loadPersistedData() {
      // 1) 여행 코스 복원
      try {
        const savedTripJson = localStorage.getItem("TRAVEL_HELPER_TRIP_LIST_V1");
        if (savedTripJson) {
          const parsedTrip = JSON.parse(savedTripJson);
          if (Array.isArray(parsedTrip)) {
            state.tripList = parsedTrip.filter((p) => p && p.location && typeof p.location.lat === "number");
            $("tripCountBadge").textContent = String(state.tripList.length);
          }
        }
      } catch (_) {}

      // 2) 상단 '❤️ 내 장소' 복원 (기존에 저장했던 숙소가 있으면 자동으로 ❤️ 내 장소로 이전)
      try {
        const myPlacesJson = localStorage.getItem("TRAVEL_HELPER_MY_PLACES_V1");
        if (myPlacesJson) {
          const parsed = JSON.parse(myPlacesJson);
          if (Array.isArray(parsed)) {
            state.myPlaces = parsed.filter((p) => p && p.location && typeof p.location.lat === "number");
          }
        }
        // 이전 버전의 단일 숙소 데이터가 남아있다면 내 장소 목록으로 자동 통합
        const legacyHotelJson = localStorage.getItem("TRAVEL_HELPER_SAVED_HOTEL_V1");
        if (legacyHotelJson) {
          const legacyHotel = JSON.parse(legacyHotelJson);
          if (
            legacyHotel &&
            legacyHotel.location &&
            !state.myPlaces.some((item) => item.name === legacyHotel.name)
          ) {
            state.myPlaces.unshift({
              id: legacyHotel.id || `my_${Date.now()}`,
              name: legacyHotel.name,
              address: legacyHotel.address || "",
              location: legacyHotel.location,
              categoryLabel: legacyHotel.categoryLabel || "저장한 숙소·장소",
              rating: legacyHotel.rating ?? null,
              userRatingCount: legacyHotel.userRatingCount ?? null,
              googleMapsURI: legacyHotel.googleMapsURI || null
            });
            saveMyPlacesToStorage();
          }
          localStorage.removeItem("TRAVEL_HELPER_SAVED_HOTEL_V1");
        }
      } catch (_) {}

      updateRestoreBarText();
    }

    function saveTripListToStorage() {
      try {
        const serializable = state.tripList.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address || "",
          location: p.location,
          primaryType: p.primaryType || "",
          categoryLabel: p.categoryLabel || "장소",
          rating: p.rating ?? null,
          userRatingCount: p.userRatingCount ?? null,
          googleMapsURI: p.googleMapsURI || null,
          day: p.day || 1,
          memo: p.memo || ""
        }));
        localStorage.setItem("TRAVEL_HELPER_TRIP_LIST_V1", JSON.stringify(serializable));
      } catch (_) {}
    }

    function saveMyPlacesToStorage() {
      try {
        const serializable = state.myPlaces.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address || "",
          location: { lat: Number(p.location.lat), lng: Number(p.location.lng) },
          categoryLabel: p.categoryLabel || "내 장소",
          rating: p.rating ?? null,
          userRatingCount: p.userRatingCount ?? null,
          googleMapsURI: p.googleMapsURI || null
        }));
        localStorage.setItem("TRAVEL_HELPER_MY_PLACES_V1", JSON.stringify(serializable));
      } catch (_) {}
    }

    function isPlaceInMyPlaces(placeObj) {
      if (!placeObj) return false;
      return state.myPlaces.some(
        (item) =>
          item.id === placeObj.id ||
          (item.name === placeObj.name &&
            item.location &&
            placeObj.location &&
            computeHaversineMeters(item.location, placeObj.location) < 80)
      );
    }

    function toggleMyPlace(placeObj) {
      if (!placeObj || !placeObj.location) return;
      const idx = state.myPlaces.findIndex(
        (item) =>
          item.id === placeObj.id ||
          (item.name === placeObj.name &&
            item.location &&
            computeHaversineMeters(item.location, placeObj.location) < 80)
      );

      if (idx >= 0) {
        const removed = state.myPlaces.splice(idx, 1)[0];
        saveMyPlacesToStorage();
        renderCategoryButtons();
        renderMyPlacesDropdown();
        renderMyPlacesMarkers();
        renderPlacesListAndMarkers(false);
        showBanner(`'${removed.name}'을(를) ❤️ 내 장소에서 삭제했습니다.`, "info");
      } else {
        const newItem = {
          id: placeObj.id || `my_${Date.now()}`,
          name: placeObj.name || "저장한 장소",
          address: placeObj.address || "",
          location: {
            lat: Number(placeObj.location.lat),
            lng: Number(placeObj.location.lng)
          },
          categoryLabel: placeObj.categoryLabel || "내 장소",
          rating: placeObj.rating ?? null,
          userRatingCount: placeObj.userRatingCount ?? null,
          googleMapsURI: placeObj.googleMapsURI || null
        };
        state.myPlaces.unshift(newItem);
        saveMyPlacesToStorage();
        renderCategoryButtons();
        renderMyPlacesDropdown();
        renderMyPlacesMarkers();
        renderPlacesListAndMarkers(false);
        showBanner(`❤️ '${newItem.name}'을(를) 상단 [내 장소]에 저장했습니다! 언제든 상단 ❤️ 버튼을 눌러 우선 찾아갈 수 있습니다.`, "info");
      }
    }

    function removeMyPlaceByIndex(idx) {
      if (idx < 0 || idx >= state.myPlaces.length) return;
      const removed = state.myPlaces.splice(idx, 1)[0];
      saveMyPlacesToStorage();
      renderCategoryButtons();
      renderMyPlacesDropdown();
      renderMyPlacesMarkers();
      renderPlacesListAndMarkers(false);
      showBanner(`'${removed.name}'을(를) ❤️ 내 장소에서 삭제했습니다.`, "info");
    }

    function toggleMyPlacesDropdown(forceState = null) {
      state.isMyPlacesOpen = typeof forceState === "boolean" ? forceState : !state.isMyPlacesOpen;
      const dropdown = $("myPlacesDropdown");
      if (dropdown) {
        dropdown.classList.toggle("open", state.isMyPlacesOpen);
      }
      const btn = document.getElementById("btnMyPlacesTop");
      if (btn) {
        btn.classList.toggle("active", state.isMyPlacesOpen);
      }
      if (state.isMyPlacesOpen) {
        renderMyPlacesDropdown();
      }
    }

    function renderMyPlacesDropdown() {
      const container = $("myPlacesListContainer");
      if (!container) return;

      if (state.myPlaces.length === 0) {
        container.innerHTML = `
          <div style="padding:12px 8px; text-align:center; font-size:12.5px; color:var(--text-secondary); line-height:1.5;">
            아직 저장된 <strong>❤️ 내 장소</strong>가 없습니다.<br/>
            상단 검색창에 <strong>숙소(호텔)</strong>나 <strong>가고 싶은 여행지</strong>를 검색한 뒤 <strong>[❤️ 내 장소에 저장]</strong>을 누르거나, 장소 카드의 <strong>[🤍 내장소]</strong> 버튼을 눌러 미리 등록해 두세요!
          </div>
        `;
        return;
      }

      container.innerHTML = "";
      state.myPlaces.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "my-place-item";

        const dirUrl = buildGoogleMapsDirectionsUrl(item);
        const ratingBadge =
          typeof item.rating === "number" ? ` · ★${item.rating.toFixed(1)}` : "";

        row.innerHTML = `
          <div class="my-place-item-main" data-select-idx="${idx}">
            <div class="my-place-item-name">
              <span>❤️</span>
              <span>${escapeHtml(item.name)}</span>
            </div>
            <div class="my-place-item-sub">
              ${escapeHtml(item.categoryLabel || "내 장소")}${ratingBadge}${item.address ? " · " + escapeHtml(item.address) : ""}
            </div>
          </div>
          <div class="my-place-item-actions">
            <button type="button" class="btn-my-place-act" data-focus-idx="${idx}" title="이곳을 기준점으로 이동 및 경로 보기">
              🎯 우선가기
            </button>
            <a href="${dirUrl}" target="_blank" rel="noopener noreferrer" class="btn-my-place-act primary" title="Google 지도 길찾기">
              ↗ 길찾기
            </a>
            <button type="button" class="btn-my-place-act del" data-del-idx="${idx}" title="내 장소에서 삭제" aria-label="삭제">
              ✕
            </button>
          </div>
        `;

        row.querySelector(`[data-select-idx="${idx}"]`).addEventListener("click", () => {
          selectAndGoToMyPlace(item);
        });
        row.querySelector(`[data-focus-idx="${idx}"]`).addEventListener("click", (e) => {
          e.stopPropagation();
          selectAndGoToMyPlace(item);
        });
        row.querySelector(`[data-del-idx="${idx}"]`).addEventListener("click", (e) => {
          e.stopPropagation();
          removeMyPlaceByIndex(idx);
        });

        container.appendChild(row);
      });
    }

    // 상단 '❤️ 내 장소'에서 장소를 선택했을 때:
    // 1) 해당 장소로 지도 중심을 즉시 이동하고 고정 기준점으로 설정
    // 2) 내 현재 위치가 있으면 그 장소로 가는 실제 경로(도보/대중교통)도 지도 위에 바로 표시
    // 3) 하단 리스트를 비우고 그 장소 주변 맛집·카페를 바로 찾거나 길찾기를 할 수 있는 안내 표시
    async function selectAndGoToMyPlace(myPlace) {
      if (!myPlace || !myPlace.location) return;
      toggleMyPlacesDropdown(false);

      const targetCenter = {
        lat: Number(myPlace.location.lat),
        lng: Number(myPlace.location.lng)
      };

      // 출발지(현재 내 GPS 위치 또는 기존 기준점) 백업 후 경로 계산용으로 활용
      const routeStartOrigin = state.currentLocation || state.searchOrigin;

      state.searchOrigin = targetCenter;
      state.searchOriginLabel = `❤️ ${myPlace.name}`;
      state.selectedCategory = null;
      state.places = [];
      state.selectedPlaceId = null;
      state.lastSearchSignature = "";
      updateCategorySelectionUI();

      clearMapMarkersAndPolylines();
      panToProgrammatically(targetCenter, 15);
      renderSearchCenterMarker(targetCenter);
      updateOriginContextBar();
      renderPlacesListAndMarkers(false);
      updateRestoreBarText();

      if (state.sheetState === "hidden") {
        setSheetState("normal");
      }

      const emptyEl = $("placesEmptyState");
      if (emptyEl) {
        const dirUrl = buildGoogleMapsDirectionsUrl(myPlace);
        const gmapsUrl = buildGoogleMapsPlaceUrl(myPlace);
        emptyEl.innerHTML = `
          <p class="empty-state-title">❤️ '${escapeHtml(myPlace.name)}' (내 장소 선택됨)</p>
          <p class="empty-state-desc" style="margin-bottom:12px;">
            선택하신 내 장소로 지도가 이동되었으며 고정 기준점으로 설정되었습니다.<br/>
            바로 <strong>길찾기</strong>로 이동하거나, 상단의 <strong>🍽️ 맛집 · ☕ 카페 · 🏪 편의점</strong>을 눌러 이 주변을 탐색해 보세요.
          </p>
          <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
            <button type="button" id="btnDrawRouteToMyPlace" class="card-btn" style="padding:0 12px; flex:0 1 auto;">
              🗺️ 현재 위치에서 경로 표시
            </button>
            <a href="${dirUrl}" target="_blank" rel="noopener noreferrer" class="card-btn primary" style="padding:0 12px; flex:0 1 auto;">
              ↗ Google 지도 길찾기
            </a>
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" style="padding:0 12px; flex:0 1 auto;">
              🗺️ 장소 상세보기
            </a>
          </div>
        `;
        const btnRoute = $("btnDrawRouteToMyPlace");
        if (btnRoute) {
          btnRoute.addEventListener("click", async () => {
            const fromCoord = state.currentLocation || routeStartOrigin;
            if (!fromCoord || computeHaversineMeters(fromCoord, targetCenter) < 20) {
              showBanner("현재 내 위치(GPS)를 먼저 확인하거나 [↗ Google 지도 길찾기]를 이용해 주세요.", "info");
              return;
            }
            const mode = isInSouthKorea(fromCoord) ? "TRANSIT" : state.activeRouteMode || "TRANSIT";
            setLoading(true, `'${myPlace.name}'까지 경로를 지도에 표시하는 중...`);
            try {
              const rData = await fetchSingleRouteNewApi(fromCoord, targetCenter, mode);
              if (rData) {
                drawRouteDataOnMap(rData, mode);
                const durText = formatDuration(rData.durationMillis);
                const distText = formatDistance(rData.distanceMeters);
                const modeLabel = mode === "TRANSIT" ? "🚌 대중교통" : "🚶 도보";
                updateMapRouteBadge(`❤️ ${myPlace.name}: ${modeLabel} ${durText}${distText ? " · " + distText : ""}`, mode);
              } else {
                showBanner("경로를 찾지 못했습니다. [↗ Google 지도 길찾기] 버튼을 눌러 확인해 보세요.", "warn");
              }
            } finally {
              setLoading(false);
            }
          });
        }
      }

      warmPopularCategoriesInBackground(targetCenter);
    }

    // 지도에 저장된 '❤️ 내 장소'들을 빨간 하트 마커로 상시 표시
    function renderMyPlacesMarkers() {
      if (!state.map) return;
      state.myPlaceMarkers.forEach((m) => {
        if (m.setMap) m.setMap(null);
        else m.map = null;
      });
      state.myPlaceMarkers.clear();

      state.myPlaces.forEach((item) => {
        if (!item || !item.location) return;
        const shortName = item.name.length > 9 ? item.name.slice(0, 9) + "…" : item.name;
        let marker;
        if (state.libs.AdvancedMarkerElement) {
          const badge = document.createElement("div");
          badge.style.display = "inline-flex";
          badge.style.alignItems = "center";
          badge.style.gap = "4px";
          badge.style.padding = "3px 8px";
          badge.style.borderRadius = "999px";
          badge.style.background = "#e11d48";
          badge.style.color = "#ffffff";
          badge.style.fontSize = "11.5px";
          badge.style.fontWeight = "800";
          badge.style.border = "2px solid #ffffff";
          badge.style.boxShadow = "0 3px 10px rgba(225, 29, 72, 0.4)";
          badge.style.whiteSpace = "nowrap";
          badge.style.cursor = "pointer";
          badge.textContent = `❤️ ${shortName}`;

          marker = new state.libs.AdvancedMarkerElement({
            map: state.map,
            position: item.location,
            content: badge,
            title: `내 장소: ${item.name}`,
            zIndex: 960
          });
          marker.addListener("click", () => selectAndGoToMyPlace(item));
        } else {
          marker = new google.maps.Marker({
            map: state.map,
            position: item.location,
            label: { text: `❤️${shortName.slice(0, 4)}`, color: "#ffffff", fontSize: "11px", fontWeight: "bold" },
            title: `내 장소: ${item.name}`,
            zIndex: 960
          });
          marker.addListener("click", () => selectAndGoToMyPlace(item));
        }
        state.myPlaceMarkers.set(item.id, marker);
      });
    }

    function checkEnvironmentSecurity() {
      if (window.location.protocol === "file:") {
        showBanner(
          "현재 file:// 로컬 파일로 열렸습니다. 아이폰 Safari에서는 HTTPS 웹 주소(예: GitHub Pages)에서 열어야 위치 권한과 지도가 정상 작동합니다.",
          "warn"
        );
      }
    }

    function getConfiguredApiKey() {
      const trimmedConst = (GOOGLE_MAPS_API_KEY || "").trim();
      if (trimmedConst && trimmedConst !== "YOUR_GOOGLE_MAPS_API_KEY") {
        try {
          sessionStorage.setItem("TRAVEL_HELPER_GMAPS_KEY", trimmedConst);
          localStorage.setItem("TRAVEL_HELPER_GMAPS_KEY", trimmedConst);
        } catch (_) {}
        return trimmedConst;
      }
      try {
        const savedSession = sessionStorage.getItem("TRAVEL_HELPER_GMAPS_KEY");
        if (savedSession && savedSession.trim()) return savedSession.trim();
        const savedLocal = localStorage.getItem("TRAVEL_HELPER_GMAPS_KEY");
        if (savedLocal && savedLocal.trim()) return savedLocal.trim();
      } catch (_) {}
      return "";
    }

    function updateActiveKeyInfoUI() {
      const infoEl = $("activeKeyInfoText");
      if (!infoEl) return;
      const trimmedConst = (GOOGLE_MAPS_API_KEY || "").trim();
      const isFromCode = trimmedConst && trimmedConst !== "YOUR_GOOGLE_MAPS_API_KEY";
      if (!state.apiKey) {
        infoEl.textContent = "현재 설정된 API 키가 없습니다.";
        return;
      }
      const k = state.apiKey;
      const masked = k.length > 12 ? `${k.slice(0, 8)}...${k.slice(-4)}` : k;
      infoEl.textContent = `현재 적용 키: ${masked} (${isFromCode ? "index.html 상수" : "브라우저 저장 키"})`;
    }

    async function initApiKeyAndBootstrap() {
      state.apiKey = getConfiguredApiKey();
      const runtimeInput = $("runtimeKeyInput");
      if (runtimeInput && state.apiKey) {
        runtimeInput.value = state.apiKey;
      }
      updateActiveKeyInfoUI();

      if (!state.apiKey) {
        showMissingKeyNotice();
        return;
      }

      await loadGoogleMapsLibraries(state.apiKey);
    }

    function showMissingKeyNotice() {
      const overlay = $("mapFallbackOverlay");
      const title = $("fallbackTitle");
      const desc = $("fallbackDesc");
      if (overlay) overlay.style.display = "flex";
      if (title) title.textContent = "내 기기에 Google Maps API 키 저장";
      if (desc) {
        desc.innerHTML =
          "보안을 위해 코드에 키를 넣지 않고 <strong>현재 스마트폰·PC 브라우저에만 안전하게 저장</strong>합니다. 아래에 API 키를 입력하면 다음부터 자동으로 열립니다.";
      }
      const overlayInput = $("overlayKeyInput");
      if (overlayInput) {
        setTimeout(() => overlayInput.focus(), 150);
      }
      showBanner("처음 한 번만 API 키를 입력하면 이 기기에 안전하게 저장됩니다.", "info");
    }

    window.gm_authFailure = function () {
      state.mapsLoadError = "AUTH_FAILURE";
      const overlay = $("mapFallbackOverlay");
      const title = $("fallbackTitle");
      const desc = $("fallbackDesc");
      if (overlay) overlay.style.display = "flex";
      if (title) title.textContent = "Google Maps API 키 인증 오류가 발생했습니다.";
      if (desc) {
        desc.innerHTML =
          "입력된 API 키가 유효하지 않거나 Maps JavaScript API / 결제 설정 / HTTP 리퍼러 제한에 의해 차단되었습니다.";
      }
      showBanner(
        "API 키 인증 오류가 발생했습니다. 우측 [원인·해결]을 눌러 API 키 설정을 확인하세요.",
        "error",
        true
      );
    };

    // 공식 Dynamic Library Import 로더
    async function loadGoogleMapsLibraries(apiKey) {
      try {
        setLoading(true, "지도를 준비하는 중...");

        if (!window.google || !window.google.maps || !window.google.maps.importLibrary) {
          await new Promise((resolve, reject) => {
            const existingScript = document.getElementById("gmaps-bootstrap-script");
            if (existingScript) existingScript.remove();

            ((g) => {
              var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
              b = b[c] || (b[c] = {});
              var d = b.maps || (b.maps = {}), r = new Set(["places", "routes", "marker", "geometry"]), e = new URLSearchParams(),
                u = () => h || (h = new Promise(async (f, n) => {
                  await (a = m.createElement("script"));
                  a.id = "gmaps-bootstrap-script";
                  e.set("libraries", [...r] + "");
                  for (k in g) e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
                  e.set("callback", c + ".maps." + q);
                  a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
                  d[q] = f;
                  a.onerror = () => (h = n(Error(p + " could not load.")));
                  a.nonce = m.querySelector("script[nonce]")?.nonce || "";
                  m.head.append(a);
                }));
              d[l] ? console.warn(p + " only loads once.") : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
            })({
              key: apiKey,
              v: "weekly",
              language: "ko"
            });

            resolve();
          });
        }

        const [mapsLib, placesLib, routesLib, markerLib, coreLib] = await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("places").catch(() => ({})),
          google.maps.importLibrary("routes").catch(() => ({})),
          google.maps.importLibrary("marker").catch(() => ({})),
          google.maps.importLibrary("core")
        ]);

        state.libs.Map = mapsLib.Map;
        state.libs.Place = placesLib?.Place || null;
        state.libs.PlacesService = placesLib?.PlacesService || google.maps?.places?.PlacesService || null;
        state.libs.SearchNearbyRankPreference = placesLib?.SearchNearbyRankPreference || null;
        state.libs.Route = routesLib?.Route || null;
        state.libs.RouteMatrix = routesLib?.RouteMatrix || null;
        state.libs.RouteMatrixItemCondition = routesLib?.RouteMatrixItemCondition || null;
        state.libs.DirectionsService = routesLib?.DirectionsService || google.maps?.DirectionsService || null;
        state.libs.DistanceMatrixService = routesLib?.DistanceMatrixService || google.maps?.DistanceMatrixService || null;
        state.libs.AdvancedMarkerElement = markerLib?.AdvancedMarkerElement || null;
        state.libs.PinElement = markerLib?.PinElement || null;
        state.libs.LatLngBounds = coreLib.LatLngBounds;

        initMapInstance();
        state.mapsLoaded = true;
        $("mapFallbackOverlay").style.display = "none";

        // 앱 시작 시: 현재 내 위치로 지도만 빠르게 이동하고, 무거운 전체 자동 검색은 하지 않음
        requestUserLocation({ isAutoStart: true });
      } catch (err) {
        console.error("Google Maps API 로드 실패:", err);
        state.mapsLoadError = err;
        const overlay = $("mapFallbackOverlay");
        const title = $("fallbackTitle");
        const desc = $("fallbackDesc");
        if (overlay) overlay.style.display = "flex";
        if (title) title.textContent = "Google Maps API를 불러오지 못했습니다.";
        if (desc) {
          desc.textContent =
            "네트워크 연결을 확인하거나 API 키 및 Google Cloud Console에서 Maps JavaScript API, Places API (New), Routes API가 활성화되어 있는지 확인하세요.";
        }
        showBanner("Google Maps API 로드에 실패했습니다. 네트워크 또는 API 키 설정을 확인하세요.", "error", true);
      } finally {
        setLoading(false);
      }
    }

    function initMapInstance() {
      const mapEl = $("map");
      state.map = new state.libs.Map(mapEl, {
        center: DEFAULT_CENTER,
        zoom: 15,
        mapId: "DEMO_MAP_ID",
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false
      });

      // 저장된 ❤️ 내 장소 마커 표시
      renderMyPlacesMarkers();

      // 지도를 클릭하면 상단 내 장소 드롭다운 자동 닫기
      state.map.addListener("click", () => {
        if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
      });

      // 지도 드래그 시작 시 타겟 십자선 표시
      state.map.addListener("dragstart", () => {
        state.isUserDragging = true;
        if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
        $("mapCenterReticle").classList.add("visible");
      });

      // 지도 이동(드래그, 줌, 패닝 등) 완료 시 기준점과의 거리 검사
      state.map.addListener("idle", () => {
        if (state.isProgrammaticPan) {
          state.isProgrammaticPan = false;
          return;
        }
        if (!state.map) return;
        const center = extractLatLngLiteral(state.map.getCenter());
        if (!center) return;

        const refOrigin = state.searchOrigin || state.currentLocation;
        if (refOrigin && computeHaversineMeters(refOrigin, center) >= 100) {
          state.isMapMovedFromOrigin = true;
          $("btnSearchMapCenter").classList.add("visible");
          $("mapCenterReticle").classList.add("visible");
        } else {
          state.isMapMovedFromOrigin = false;
          $("btnSearchMapCenter").classList.remove("visible");
          $("mapCenterReticle").classList.remove("visible");
        }
      });
    }

    function panToProgrammatically(coords, zoomLevel = null) {
      if (!state.map || !coords) return;
      state.isProgrammaticPan = true;
      state.isUserDragging = false;
      $("btnSearchMapCenter").classList.remove("visible");
      $("mapCenterReticle").classList.remove("visible");
      state.isMapMovedFromOrigin = false;
      state.map.setCenter(coords);
      if (typeof zoomLevel === "number") {
        state.map.setZoom(zoomLevel);
      }
    }

    // =========================================================================
    // [3] 하단 시트 숨기기/올리기/확대 제어 및 터치 스와이프 제스처
    // =========================================================================
    function setSheetState(newState) {
      state.sheetState = newState;
      const sheet = $("bottomSheet");
      const toggleBtn = $("btnToggleSheet");
      const restoreBar = $("btnRestoreSheet");

      sheet.classList.remove("expanded", "hidden");

      if (newState === "expanded") {
        sheet.classList.add("expanded");
        toggleBtn.textContent = "기본 크기";
        restoreBar.classList.remove("visible");
      } else if (newState === "hidden") {
        sheet.classList.add("hidden");
        toggleBtn.textContent = "크게";
        updateRestoreBarText();
        restoreBar.classList.add("visible");
      } else {
        toggleBtn.textContent = "크게";
        restoreBar.classList.remove("visible");
      }

      if (state.map && window.google?.maps?.event) {
        setTimeout(() => {
          google.maps.event.trigger(state.map, "resize");
        }, 260);
      }
    }

    function updateRestoreBarText() {
      const countBadge = $("restoreCountBadge");
      const isTripActive = $("tabTrip").classList.contains("active");
      if (isTripActive) {
        countBadge.textContent = `코스 ${state.tripList.length}`;
      } else {
        countBadge.textContent = `${state.places.length}곳`;
      }
    }

    function bindSheetTouchGestures() {
      const handle = $("sheetHandle");
      let startY = null;
      let startTime = 0;

      handle.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length !== 1) return;
          startY = e.touches[0].clientY;
          startTime = Date.now();
        },
        { passive: true }
      );

      handle.addEventListener(
        "touchend",
        (e) => {
          if (startY === null || !e.changedTouches.length) return;
          const endY = e.changedTouches[0].clientY;
          const deltaY = endY - startY;
          const elapsed = Date.now() - startTime;
          startY = null;

          if (deltaY > 45 || (deltaY > 25 && elapsed < 250)) {
            if (state.sheetState === "expanded") {
              setSheetState("normal");
            } else {
              setSheetState("hidden");
            }
          } else if (deltaY < -45 || (deltaY < -25 && elapsed < 250)) {
            if (state.sheetState === "hidden") {
              setSheetState("normal");
            } else if (state.sheetState === "normal") {
              setSheetState("expanded");
            }
          }
        },
        { passive: true }
      );
    }

    // =========================================================================
    // [4] 상단 '❤️ 내 장소' 버튼 + 2그룹 카테고리 바 + 세부 취향 칩 렌더링 및 이벤트 처리
    // =========================================================================
    function updateSortSelectOptions() {
      const select = $("sortSelect");
      if (!select) return;
      const isDist = isDistancePriorityCategory(state.selectedCategory);
      if (isDist) {
        select.innerHTML = `
          <option value="dist" ${state.sortBy === "dist" ? "selected" : ""}>📍 가장 가까운 순 (기본)</option>
          <option value="walk" ${state.sortBy === "walk" ? "selected" : ""}>🚶 도보 빠른 순</option>
          <option value="transit" ${state.sortBy === "transit" ? "selected" : ""}>🚌 대중교통 순</option>
          <option value="popular" ${state.sortBy === "popular" ? "selected" : ""}>🏆 현지 인기순 (평점×리뷰)</option>
          <option value="rating" ${state.sortBy === "rating" ? "selected" : ""}>★ 구글 평점 높은 순</option>
          <option value="open" ${state.sortBy === "open" ? "selected" : ""}>🟢 영업 중 우선</option>
        `;
      } else {
        select.innerHTML = `
          <option value="popular" ${state.sortBy === "popular" ? "selected" : ""}>🏆 현지 인기순 (평점×리뷰)</option>
          <option value="rating" ${state.sortBy === "rating" ? "selected" : ""}>★ 구글 평점 높은 순</option>
          <option value="dist" ${state.sortBy === "dist" ? "selected" : ""}>📍 가장 가까운 순</option>
          <option value="walk" ${state.sortBy === "walk" ? "selected" : ""}>🚶 도보 빠른 순</option>
          <option value="transit" ${state.sortBy === "transit" ? "selected" : ""}>🚌 대중교통 순</option>
          <option value="open" ${state.sortBy === "open" ? "selected" : ""}>🟢 영업 중 우선</option>
        `;
      }
    }

    function renderCategoryButtons() {
      const bar = $("categoryBar");
      if (!bar) return;
      bar.innerHTML = "";

      // 1) 맨 앞에 빨간 하트 '❤️ 내 장소' 버튼 배치
      const myBtn = document.createElement("button");
      myBtn.type = "button";
      myBtn.id = "btnMyPlacesTop";
      myBtn.className = "cat-btn my-places-btn" + (state.isMyPlacesOpen ? " active" : "");
      myBtn.innerHTML = `<span>❤️</span><span>내 장소</span><span class="my-places-count">${state.myPlaces.length}</span>`;
      myBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMyPlacesDropdown();
      });
      bar.appendChild(myBtn);

      // 2) 목적성 기반 2개 카테고리 그룹 스위치: [✨ 여행발견 | 🛟 생활·편의]
      const groupWrap = document.createElement("div");
      groupWrap.className = "cat-group-switch";
      groupWrap.setAttribute("role", "group");
      groupWrap.setAttribute("aria-label", "카테고리 그룹 전환");
      groupWrap.innerHTML = `
        <button type="button" class="cat-group-btn ${state.activeCategoryGroup === "discovery" ? "active" : ""}" data-group="discovery">
          ✨ 여행발견
        </button>
        <button type="button" class="cat-group-btn ${state.activeCategoryGroup === "utility" ? "active" : ""}" data-group="utility">
          🛟 생활·편의
        </button>
      `;
      groupWrap.querySelectorAll(".cat-group-btn").forEach((gBtn) => {
        gBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const newGroup = gBtn.dataset.group;
          if (state.activeCategoryGroup !== newGroup) {
            state.activeCategoryGroup = newGroup;
            renderCategoryButtons();
          }
        });
      });
      bar.appendChild(groupWrap);

      // 3) 현재 선택된 그룹(discovery 또는 utility)에 속하는 카테고리 알약 버튼 렌더링
      const visibleCategories = CATEGORIES.filter((c) => c.group === state.activeCategoryGroup);
      visibleCategories.forEach((cat) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cat-btn" + (cat.id === state.selectedCategory ? " active" : "");
        btn.dataset.catId = cat.id;
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", cat.id === state.selectedCategory ? "true" : "false");
        btn.innerHTML = `<span>${cat.icon}</span><span>${cat.label}</span>`;
        btn.addEventListener("click", () => {
          if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
          state.selectedCategory = cat.id;
          state.activeTasteKeyword = "";
          state.visibleLimit = 10;
          state.sortBy = isDistancePriorityCategory(cat.id) ? "dist" : "popular";

          // 반경 기본값 동기화
          const defaultR = cat.radiusM || DEFAULT_SEARCH_RADIUS_M;
          state.customRadiusM = defaultR;
          const rSelect = $("radiusSelect");
          if (rSelect) {
            rSelect.value = defaultR <= 800 ? "600" : defaultR >= 2500 ? "3000" : "1500";
          }

          updateSortSelectOptions();
          updateCategorySelectionUI();
          renderQuickTasteBar();
          if (state.sheetState === "hidden") setSheetState("normal");

          if (state.map) {
            const currentCenter = extractLatLngLiteral(state.map.getCenter());
            if (currentCenter) {
              const isGenericOrigin =
                !state.searchOrigin ||
                state.searchOriginLabel.startsWith("지도 중심") ||
                state.searchOriginLabel.startsWith("고정된 지도 중심");
              if (!state.searchOrigin || (state.isMapMovedFromOrigin && isGenericOrigin)) {
                state.searchOrigin = { lat: currentCenter.lat, lng: currentCenter.lng };
                state.searchOriginLabel = `지도 중심 (${currentCenter.lat.toFixed(4)}, ${currentCenter.lng.toFixed(4)})`;
                state.isMapMovedFromOrigin = false;
                $("btnSearchMapCenter").classList.remove("visible");
                $("mapCenterReticle").classList.remove("visible");
                renderSearchCenterMarker(state.searchOrigin);
                updateOriginContextBar();
              }
            }
          }

          executeSearch({ mode: "nearby", force: true });
        });
        bar.appendChild(btn);
      });
    }

    function renderQuickTasteBar() {
      const bar = $("quickTasteBar");
      if (!bar) return;
      const tags = state.selectedCategory ? QUICK_TASTE_TAGS[state.selectedCategory] : null;
      if (!tags || tags.length === 0) {
        bar.classList.remove("visible");
        bar.innerHTML = "";
        return;
      }

      bar.classList.add("visible");
      bar.innerHTML = "";
      tags.forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        const isActive = state.activeTasteKeyword === tag.kw;
        chip.className = "taste-chip" + (isActive ? " active" : "");
        chip.textContent = tag.label;
        chip.addEventListener("click", () => {
          state.activeTasteKeyword = tag.kw;
          state.visibleLimit = 10;
          renderQuickTasteBar();
          executeSearch({ mode: "nearby", force: true });
        });
        bar.appendChild(chip);
      });
    }

    function updateCategorySelectionUI() {
      document.querySelectorAll(".cat-btn[data-cat-id]").forEach((btn) => {
        const isSelected = btn.dataset.catId === state.selectedCategory;
        btn.classList.toggle("active", isSelected);
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
      });
    }

    // 입력된 검색어가 음식 메뉴·취향 키워드인지 판별하는 헬퍼
    function isLikelyMenuOrThemeKeyword(kw) {
      if (!kw) return false;
      return /(우육면|라멘|국수|소바|우동|짬뽕|짜장|마라탕|훠궈|샤브|전골|삼겹살|갈비|고기|스테이크|야키니쿠|초밥|스시|회|해산물|돈까스|돈카츠|치킨|피자|버거|햄버거|타코|파스타|브런치|국밥|설렁탕|곰탕|칼국수|냉면|만두|딤섬|샤오롱바오|빙수|망고빙수|아이스크림|젤라또|케이크|빵|베이커리|소금빵|크루아상|펑리수|디저트|푸딩|마카롱|커피|카페|로스터리|핸드드립|라떼|에스프레소|밀크티|버블티|말차|찻집|루프탑|이자카야|포차|술집|바\b|펍\b|맥주|수제맥주|위스키|칵테일|와인|야시장|야경|전망대|마사지|스파|온천|소품샵|기념품|선물|맛집|식당|밥집|야식|혼밥)/i.test(kw.trim());
    }

    function bindUIEvents() {
      const btnCloseMyPlaces = $("btnCloseMyPlaces");
      if (btnCloseMyPlaces) {
        btnCloseMyPlaces.addEventListener("click", () => toggleMyPlacesDropdown(false));
      }

      // 출발 기준점 전환 버튼 (📌고정 기준점 <-> 📍내 위치)
      const btnToggleOriginMode = $("btnToggleOriginMode");
      if (btnToggleOriginMode) {
        btnToggleOriginMode.addEventListener("click", () => {
          state.routeOriginMode = state.routeOriginMode === "my_location" ? "origin" : "my_location";
          updateOriginContextBar();
          renderPlacesListAndMarkers(false);
          const selected = state.places.find((p) => p.id === state.selectedPlaceId);
          if (selected) {
            computeAndDisplaySingleRoute(selected, state.activeRouteMode, true);
          }
        });
      }

      // 내 위치 버튼
      $("btnLocate").addEventListener("click", () => {
        if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
        requestUserLocation({ isAutoStart: false });
      });

      // 내 위치로 돌아가기 플로팅 버튼
      $("btnRecenter").addEventListener("click", () => {
        if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
        if (state.currentLocation && state.map) {
          state.searchOrigin = { ...state.currentLocation };
          state.searchOriginLabel = "현재 내 위치";
          $("searchInput").value = "";
          $("btnClearSearch").style.display = "none";
          state.keyword = "";
          panToProgrammatically(state.currentLocation, 15);
          renderSearchCenterMarker(null);
          updateOriginContextBar();
          if (state.selectedCategory) {
            executeSearch({ mode: "nearby", force: true });
          } else {
            showBanner("내 위치로 이동했습니다. 상단에서 맛집·카페 등 카테고리를 선택해 보세요.", "info");
          }
        } else {
          requestUserLocation({ isAutoStart: false });
        }
      });

      $("btnResetToMyLoc").addEventListener("click", () => {
        $("btnRecenter").click();
      });

      $("btnSearchMapCenter").addEventListener("click", () => {
        lockCurrentMapCenterAsOrigin(Boolean(state.selectedCategory));
      });

      const searchInput = $("searchInput");
      const btnClearSearch = $("btnClearSearch");
      searchInput.addEventListener("input", () => {
        btnClearSearch.style.display = searchInput.value.trim() ? "inline-flex" : "none";
      });

      btnClearSearch.addEventListener("click", () => {
        searchInput.value = "";
        btnClearSearch.style.display = "none";
        state.keyword = "";
        state.activeTasteKeyword = "";
        renderQuickTasteBar();
        if (state.selectedCategory) {
          executeSearch({ mode: "nearby", force: true });
        }
      });

      // [개선안 4] 🔍 주변검색 버튼: 현재 기준점(숙소/내위치)을 유지한 채 주변의 특정 메뉴·취향 키워드 검색!
      const btnSearchNearbyKw = $("btnSearchNearbyKw");
      if (btnSearchNearbyKw) {
        btnSearchNearbyKw.addEventListener("click", () => {
          if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
          const kw = searchInput.value.trim();
          if (!kw) {
            showBanner("주변에서 찾을 메뉴나 키워드(예: 우육면, 망고빙수, 루프탑, 마사지)를 입력해 주세요.", "info");
            searchInput.focus();
            return;
          }
          state.keyword = kw;
          state.visibleLimit = 10;
          if (state.sheetState === "hidden") setSheetState("normal");
          executeSearch({ mode: "nearby_keyword", force: true });
        });
      }

      // 상단 검색창 제출 (🌐 이동 버튼 클릭 또는 Enter 입력)
      $("searchForm").addEventListener("submit", (e) => {
        e.preventDefault();
        if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
        const kw = searchInput.value.trim();
        state.keyword = kw;
        state.visibleLimit = 10;
        if (state.sheetState === "hidden") setSheetState("normal");
        if (kw) {
          // 만약 Enter로 제출했는데 '우육면', '망고빙수' 같은 음식/취향 키워드이고 이미 기준점이 있다면 주변 키워드 검색으로 실행!
          const submitterId = e.submitter?.id || "";
          if (submitterId !== "btnSearch" && isLikelyMenuOrThemeKeyword(kw) && (state.searchOrigin || state.currentLocation)) {
            executeSearch({ mode: "nearby_keyword", force: true });
          } else {
            executeSearch({ mode: "worldwide_text", force: true });
          }
        } else if (state.selectedCategory) {
          executeSearch({ mode: "nearby", force: true });
        } else {
          showBanner("검색어를 입력하거나 상단에서 맛집·카페 등 카테고리를 선택해 주세요.", "info");
        }
      });

      // [개선안 1] 🔥 리뷰 100개 이상 검증된 곳만 보기 토글 버튼
      const btnFilterVerified100 = $("btnFilterVerified100");
      if (btnFilterVerified100) {
        btnFilterVerified100.addEventListener("click", () => {
          state.onlyVerified100 = !state.onlyVerified100;
          btnFilterVerified100.classList.toggle("active", state.onlyVerified100);
          renderPlacesListAndMarkers(false);
          if (state.onlyVerified100) {
            showBanner("🔥 구글 리뷰 100개 이상으로 검증된 인기 장소만 필터링합니다.", "info");
          } else {
            showBanner("리뷰 수 제한 없이 주변 장소를 모두 표시합니다.", "info");
          }
        });
      }

      // 반경 선택 셀렉트 (600m / 1.5km / 3km)
      const radiusSelect = $("radiusSelect");
      if (radiusSelect) {
        radiusSelect.addEventListener("change", (e) => {
          state.customRadiusM = Number(e.target.value) || DEFAULT_SEARCH_RADIUS_M;
          state.visibleLimit = 10;
          if (state.selectedCategory || state.keyword) {
            executeSearch({
              mode: state.selectedCategory ? "nearby" : "nearby_keyword",
              force: true
            });
          }
        });
      }

      // 추천/정렬 기준 선택
      $("sortSelect").addEventListener("change", (e) => {
        state.sortBy = e.target.value;
        renderPlacesListAndMarkers(false);
      });

      // 탭 전환 (주변 장소 <-> 여행 코스)
      $("tabPlaces").addEventListener("click", () => switchBottomTab("places"));
      $("tabTrip").addEventListener("click", () => switchBottomTab("trip"));

      // 여행 코스 Day 1 / Day 2 / Day 3 일자 전환 탭
      document.querySelectorAll("#tripDayTabs .trip-day-btn").forEach((dayBtn) => {
        dayBtn.addEventListener("click", () => {
          state.currentTripDay = Number(dayBtn.dataset.day) || 1;
          document.querySelectorAll("#tripDayTabs .trip-day-btn").forEach((b) => {
            b.classList.toggle("active", Number(b.dataset.day) === state.currentTripDay);
          });
          state.tripOptimizationLabel = "";
          calculateAndRenderTripCourse(false);
        });
      });

      // 하단 시트 확대/기본 토글 및 아래로 완전히 내리기/다시 올리기
      $("btnToggleSheet").addEventListener("click", () => {
        if (state.sheetState === "expanded") {
          setSheetState("normal");
        } else {
          setSheetState("expanded");
        }
      });

      $("btnHideSheet").addEventListener("click", () => {
        setSheetState("hidden");
      });

      $("btnRestoreSheet").addEventListener("click", () => {
        setSheetState("normal");
      });

      $("sheetHandle").addEventListener("click", () => {
        if (state.sheetState === "expanded") {
          setSheetState("normal");
        } else {
          setSheetState("expanded");
        }
      });

      // 지도 경로 모드 전환 (도보 <-> 대중교통)
      $("btnMapRouteWalk").addEventListener("click", () => switchSelectedPlaceRouteMode("WALKING"));
      $("btnMapRouteTransit").addEventListener("click", () => switchSelectedPlaceRouteMode("TRANSIT"));

      // 여행 코스 컨트롤
      $("btnTripModeWalk").addEventListener("click", () => setTripTravelMode("WALKING"));
      $("btnTripModeTransit").addEventListener("click", () => setTripTravelMode("TRANSIT"));
      $("btnOptimizeTrip").addEventListener("click", () => optimizeTripCourse("distance"));
      const btnOptSmart = $("btnOptimizeTripSmart");
      if (btnOptSmart) {
        btnOptSmart.addEventListener("click", () => optimizeTripCourse("smart_time"));
      }
      $("btnDrawTripRoute").addEventListener("click", () => calculateAndRenderTripCourse(true));

      // 배너 닫기 및 원인·해결 버튼
      $("statusBannerClose").addEventListener("click", () => {
        $("statusBanner").className = "status-banner";
      });
      $("statusBannerHelpBtn").addEventListener("click", () => {
        $("helpModal").classList.add("open");
      });

      // 도움말 모달 열기/닫기 및 런타임 API 키 적용
      $("btnOpenHelp").addEventListener("click", () => $("helpModal").classList.add("open"));
      $("btnFallbackOpenHelp").addEventListener("click", () => $("helpModal").classList.add("open"));
      $("btnCloseHelp").addEventListener("click", () => $("helpModal").classList.remove("open"));
      $("helpModal").addEventListener("click", (e) => {
        if (e.target === $("helpModal")) $("helpModal").classList.remove("open");
      });

      const saveAndLoadApiKey = async (rawKey) => {
        const val = (rawKey || "").trim();
        if (!val) {
          showBanner("유효한 Google Maps API 키(AIzaSy...)를 입력해 주세요.", "warn");
          return;
        }
        try {
          sessionStorage.setItem("TRAVEL_HELPER_GMAPS_KEY", val);
          localStorage.setItem("TRAVEL_HELPER_GMAPS_KEY", val);
        } catch (_) {}
        state.apiKey = val;
        if ($("runtimeKeyInput")) $("runtimeKeyInput").value = val;
        if ($("overlayKeyInput")) $("overlayKeyInput").value = val;
        state.searchCache.clear();
        state.routeMatrixCache.clear();
        state.placeDetailsCache.clear();
        state.singleRouteCache.clear();
        updateActiveKeyInfoUI();
        $("helpModal").classList.remove("open");
        if (window.google && window.google.maps && state.mapsLoaded) {
          window.location.reload();
          return;
        }
        await loadGoogleMapsLibraries(val);
      };

      $("btnApplyRuntimeKey").addEventListener("click", () => {
        saveAndLoadApiKey($("runtimeKeyInput").value);
      });

      const btnSaveOverlayKey = $("btnSaveOverlayKey");
      if (btnSaveOverlayKey) {
        btnSaveOverlayKey.addEventListener("click", () => {
          saveAndLoadApiKey($("overlayKeyInput").value);
        });
      }

      const overlayKeyInput = $("overlayKeyInput");
      if (overlayKeyInput) {
        overlayKeyInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveAndLoadApiKey(overlayKeyInput.value);
          }
        });
      }

      const btnToggleOverlayKeyVis = $("btnToggleOverlayKeyVis");
      if (btnToggleOverlayKeyVis && overlayKeyInput) {
        btnToggleOverlayKeyVis.addEventListener("click", () => {
          const isPwd = overlayKeyInput.type === "password";
          overlayKeyInput.type = isPwd ? "text" : "password";
          btnToggleOverlayKeyVis.textContent = isPwd ? "🙈" : "👁️";
        });
      }

      const btnToggleModalKeyVis = $("btnToggleModalKeyVis");
      const runtimeKeyInput = $("runtimeKeyInput");
      if (btnToggleModalKeyVis && runtimeKeyInput) {
        btnToggleModalKeyVis.addEventListener("click", () => {
          const isPwd = runtimeKeyInput.type === "password";
          runtimeKeyInput.type = isPwd ? "text" : "password";
          btnToggleModalKeyVis.textContent = isPwd ? "🙈" : "👁️";
        });
      }

      const btnDeleteStoredKey = $("btnDeleteStoredKey");
      if (btnDeleteStoredKey) {
        btnDeleteStoredKey.addEventListener("click", () => {
          try {
            sessionStorage.removeItem("TRAVEL_HELPER_GMAPS_KEY");
            localStorage.removeItem("TRAVEL_HELPER_GMAPS_KEY");
          } catch (_) {}
          state.apiKey = "";
          if ($("runtimeKeyInput")) $("runtimeKeyInput").value = "";
          if ($("overlayKeyInput")) $("overlayKeyInput").value = "";
          updateActiveKeyInfoUI();
          $("helpModal").classList.remove("open");
          showMissingKeyNotice();
          showBanner("이 기기(브라우저)에 저장된 API 키를 완전히 삭제했습니다.", "info");
        });
      }

      const btnClearKeyCache = $("btnClearKeyCache");
      if (btnClearKeyCache) {
        btnClearKeyCache.addEventListener("click", () => {
          state.searchCache.clear();
          state.routeMatrixCache.clear();
          state.placeDetailsCache.clear();
          state.singleRouteCache.clear();
          state.lastSearchSignature = "";
          $("helpModal").classList.remove("open");
          $("statusBanner").className = "status-banner";
          if (state.keyword || state.selectedCategory) {
            executeSearch({ mode: state.selectedCategory ? "nearby" : "nearby_keyword", force: true });
          }
        });
      }
    }

    function lockCurrentMapCenterAsOrigin(runCategorySearch = false) {
      if (!state.map) return;
      const center = extractLatLngLiteral(state.map.getCenter());
      if (!center) return;

      state.searchOrigin = { lat: center.lat, lng: center.lng };
      state.searchOriginLabel = `고정된 지도 중심 (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`;
      state.isMapMovedFromOrigin = false;
      state.routeOriginMode = "origin";
      $("btnSearchMapCenter").classList.remove("visible");
      $("mapCenterReticle").classList.remove("visible");

      $("searchInput").value = "";
      $("btnClearSearch").style.display = "none";
      state.keyword = "";

      if (isInSouthKorea(center)) {
        state.activeRouteMode = "TRANSIT";
      } else {
        state.activeRouteMode = "WALKING";
      }

      renderSearchCenterMarker(state.searchOrigin);
      updateOriginContextBar();
      warmPopularCategoriesInBackground(state.searchOrigin);

      if (runCategorySearch && state.selectedCategory) {
        executeSearch({ mode: "nearby", force: true });
      } else {
        state.allCandidatePlaces = [];
        state.places = [];
        state.selectedPlaceId = null;
        clearMapMarkersAndPolylines();
        renderPlacesListAndMarkers(false);
        updateEmptyStateMessage(
          "📌 현재 지도 중심이 기준점으로 고정되었습니다",
          "상단에서 ✨ 여행발견(맛집·카페·야시장·명소) 또는 🛟 생활·편의 메뉴를 누르거나, 검색창에 메뉴명을 입력해 [🔍 주변검색]을 눌러보세요."
        );
      }
    }

    function updateEmptyStateMessage(titleText, descText) {
      const emptyEl = $("placesEmptyState");
      if (!emptyEl) return;
      emptyEl.innerHTML = `
        <p class="empty-state-title">${escapeHtml(titleText)}</p>
        <p class="empty-state-desc">${escapeHtml(descText)}</p>
      `;
    }

    function updateOriginContextBar() {
      const textEl = $("originContextText");
      const toggleBtn = $("btnToggleOriginMode");
      const resetBtn = $("btnResetToMyLoc");
      if (!textEl) return;

      if (!state.searchOrigin) {
        textEl.textContent = "📍 기준점: 상단 카테고리 또는 ❤️ 내 장소 선택";
        if (toggleBtn) toggleBtn.style.display = "none";
        if (resetBtn) resetBtn.style.display = "none";
        return;
      }

      const isMyLoc =
        state.currentLocation &&
        computeHaversineMeters(state.currentLocation, state.searchOrigin) < 50;

      if (toggleBtn) {
        toggleBtn.style.display = state.currentLocation && !isMyLoc ? "inline-block" : "none";
        toggleBtn.textContent = state.routeOriginMode === "my_location" ? "출발: 📍내위치" : "출발: 📌기준점";
      }

      if (isMyLoc) {
        textEl.textContent = `📍 내 위치 기준`;
        if (resetBtn) resetBtn.style.display = "none";
      } else {
        const originDesc = state.routeOriginMode === "my_location"
          ? "현재 내 위치 (GPS)"
          : state.searchOriginLabel;
        textEl.textContent = `📌 기준: ${originDesc}`;
        if (resetBtn) resetBtn.style.display = state.currentLocation ? "inline-block" : "none";
      }
    }

    function switchBottomTab(tab) {
      const isPlaces = tab === "places";
      $("tabPlaces").classList.toggle("active", isPlaces);
      $("tabTrip").classList.toggle("active", !isPlaces);
      $("placesView").style.display = isPlaces ? "block" : "none";
      $("tripView").classList.toggle("active", !isPlaces);
      const filterBar = $("placesFilterBar");
      if (filterBar) {
        filterBar.style.display = isPlaces ? "flex" : "none";
      }
      const tasteBar = $("quickTasteBar");
      if (tasteBar) {
        if (isPlaces && state.selectedCategory && QUICK_TASTE_TAGS[state.selectedCategory]) {
          tasteBar.classList.add("visible");
        } else {
          tasteBar.classList.remove("visible");
        }
      }
      updateRestoreBarText();
      if (!isPlaces) {
        renderTripPanel();
      }
    }

    // [5] 현재 위치 자동 및 수동 감지
    // =========================================================================
    function requestUserLocation({ isAutoStart = false } = {}) {
      if (!navigator.geolocation) {
        if (!isAutoStart) {
          showBanner("이 브라우저에서는 위치 정보 기능을 지원하지 않습니다. 지도를 이동하거나 검색창으로 검색해 주세요.", "warn");
        }
        return;
      }

      const btnLocate = $("btnLocate");
      const locateBtnText = $("locateBtnText");
      btnLocate.disabled = true;
      locateBtnText.textContent = "확인중";

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btnLocate.disabled = false;
          locateBtnText.textContent = "내위치";

          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          state.currentLocation = coords;
          state.searchOrigin = { ...coords };
          state.searchOriginLabel = "현재 내 위치";

          if (isInSouthKorea(coords)) {
            state.activeRouteMode = "TRANSIT";
            state.tripTravelMode = "TRANSIT";
            $("btnTripModeWalk").classList.remove("active");
            $("btnTripModeTransit").classList.add("active");
          } else {
            state.activeRouteMode = "WALKING";
          }

          if (state.map) {
            panToProgrammatically(coords, 15);
            renderUserLocationMarker(coords);
            renderSearchCenterMarker(null);
          }

          updateOriginContextBar();
          warmPopularCategoriesInBackground(state.searchOrigin);

          if (!isAutoStart && state.selectedCategory) {
            executeSearch({ mode: "nearby", force: true });
          }
        },
        (err) => {
          btnLocate.disabled = false;
          locateBtnText.textContent = "내위치";

          if (!state.searchOrigin && state.map) {
            const fallbackCenter = extractLatLngLiteral(state.map.getCenter()) || DEFAULT_CENTER;
            state.searchOrigin = fallbackCenter;
            state.searchOriginLabel = "지도 중심 위치";
            updateOriginContextBar();
          }

          if (!isAutoStart) {
            let msg = "현재 위치를 가져오지 못했습니다. 지도를 움직여 카테고리를 누르거나 검색창을 이용해 보세요.";
            if (err.code === 1) {
              msg = "위치 권한이 거부되었습니다. 아이폰 설정 > Safari > 위치에서 허용하거나, 지도를 움직여 원하는 지역에서 카테고리를 선택해 보세요.";
            }
            showBanner(msg, "warn");
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 60000
        }
      );
    }

    function isInSouthKorea(coords) {
      if (!coords) return false;
      return coords.lat >= 33.0 && coords.lat <= 38.65 && coords.lng >= 124.5 && coords.lng <= 131.9;
    }

    function renderUserLocationMarker(coords) {
      if (!state.map) return;
      if (state.userMarker) {
        if (state.userMarker.setMap) state.userMarker.setMap(null);
        else state.userMarker.map = null;
      }

      if (state.libs.AdvancedMarkerElement) {
        const dot = document.createElement("div");
        dot.style.width = "18px";
        dot.style.height = "18px";
        dot.style.borderRadius = "50%";
        dot.style.background = "#2563eb";
        dot.style.border = "3px solid #ffffff";
        dot.style.boxShadow = "0 0 0 6px rgba(37, 99, 235, 0.28), 0 2px 6px rgba(0,0,0,0.35)";
        dot.title = "내 현재 위치";

        state.userMarker = new state.libs.AdvancedMarkerElement({
          map: state.map,
          position: coords,
          content: dot,
          title: "내 현재 위치",
          zIndex: 999
        });
      } else {
        state.userMarker = new google.maps.Marker({
          map: state.map,
          position: coords,
          title: "내 현재 위치",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3
          },
          zIndex: 999
        });
      }
    }

    function renderSearchCenterMarker(coords) {
      if (!state.map) return;
      if (state.searchCenterMarker) {
        if (state.searchCenterMarker.setMap) state.searchCenterMarker.setMap(null);
        else state.searchCenterMarker.map = null;
        state.searchCenterMarker = null;
      }
      if (!coords) return;

      if (state.libs.AdvancedMarkerElement) {
        const pin = document.createElement("div");
        pin.style.padding = "3px 8px";
        pin.style.borderRadius = "999px";
        pin.style.background = "#059669";
        pin.style.color = "#ffffff";
        pin.style.fontSize = "11px";
        pin.style.fontWeight = "800";
        pin.style.border = "2px solid #ffffff";
        pin.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
        pin.textContent = "🎯 기준점";

        state.searchCenterMarker = new state.libs.AdvancedMarkerElement({
          map: state.map,
          position: coords,
          content: pin,
          title: "현재 검색 중심 위치",
          zIndex: 950
        });
      } else {
        state.searchCenterMarker = new google.maps.Marker({
          map: state.map,
          position: coords,
          title: "현재 검색 중심 위치",
          zIndex: 950
        });
      }
    }

// =========================================================================
    // [8] 추천·정렬 필터(현지 인기순·리뷰 100+ 검증) 및 다이어트 장소 카드·스크롤 연동 렌더링
    // =========================================================================
    function getFilteredCandidatePlaces() {
      const basePool =
        Array.isArray(state.allCandidatePlaces) && state.allCandidatePlaces.length > 0
          ? [...state.allCandidatePlaces]
          : [...state.places];

      if (state.onlyVerified100) {
        const verified = basePool.filter(
          (p) => typeof p.userRatingCount === "number" && p.userRatingCount >= 100
        );
        if (verified.length > 0) {
          return verified;
        }
      }
      return basePool;
    }

    function getSortedPlaces() {
      let list = getFilteredCandidatePlaces();
      const isDistCat = isDistancePriorityCategory(state.selectedCategory);
      const sortBy = state.sortBy;

      list.sort((a, b) => {
        if (sortBy === "walk") {
          const wa = a.walkDurationMs ?? (typeof a.straightDistM === "number" ? a.straightDistM * 1000 : Infinity);
          const wb = b.walkDurationMs ?? (typeof b.straightDistM === "number" ? b.straightDistM * 1000 : Infinity);
          if (wa !== wb) return wa - wb;
          return computePopularityScore(b) - computePopularityScore(a);
        }
        if (sortBy === "transit") {
          const ta = a.transitDurationMs ?? (typeof a.straightDistM === "number" ? a.straightDistM * 1000 : Infinity);
          const tb = b.transitDurationMs ?? (typeof b.straightDistM === "number" ? b.straightDistM * 1000 : Infinity);
          if (ta !== tb) return ta - tb;
          return computePopularityScore(b) - computePopularityScore(a);
        }
        if (sortBy === "open") {
          const rankOpen = (p) => (p.isOpenNow === true ? 0 : p.isOpenNow === null ? 1 : 2);
          const oa = rankOpen(a);
          const ob = rankOpen(b);
          if (oa !== ob) return oa - ob;
          return computePopularityScore(b) - computePopularityScore(a);
        }
        if (sortBy === "dist" || (sortBy === "default" && isDistCat)) {
          const da = a.walkDistanceM ?? a.straightDistM ?? Infinity;
          const db = b.walkDistanceM ?? b.straightDistM ?? Infinity;
          if (da !== db) return da - db;
          return computePopularityScore(b) - computePopularityScore(a);
        }
        if (sortBy === "rating") {
          const ra = typeof a.rating === "number" ? a.rating : -1;
          const rb = typeof b.rating === "number" ? b.rating : -1;
          if (rb !== ra) return rb - ra;
          const ca = typeof a.userRatingCount === "number" ? a.userRatingCount : 0;
          const cb = typeof b.userRatingCount === "number" ? b.userRatingCount : 0;
          if (cb !== ca) return cb - ca;
          return (a.straightDistM ?? Infinity) - (b.straightDistM ?? Infinity);
        }
        // 기본 'popular': 베이지안 가중 현지 인기순 (평점 × 리뷰 신뢰도 종합)
        const pa = computePopularityScore(a);
        const pb = computePopularityScore(b);
        if (Math.abs(pb - pa) > 0.001) return pb - pa;
        return (a.straightDistM ?? Infinity) - (b.straightDistM ?? Infinity);
      });

      const limit = Math.max(10, state.visibleLimit || 10);
      const sliced = list.slice(0, limit);
      state.places = sliced;
      return sliced;
    }

function renderPlacesListAndMarkers(updateMapBounds = false) {
      const sorted = getSortedPlaces();
      const totalFiltered = getFilteredCandidatePlaces().length;
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

      // [개선안 3] 하단 '+ 주변 장소 10곳 더 보기' 버튼 렌더링
      if (totalFiltered > sorted.length || (state.selectedRadius || 1500) < 4000) {
        const moreBtn = document.createElement("button");
        moreBtn.type = "button";
        moreBtn.id = "btnLoadMorePlaces";
        moreBtn.className = "btn-load-more";
        if (totalFiltered > sorted.length) {
          const remain = totalFiltered - sorted.length;
          moreBtn.innerHTML = `<span>➕ 주변 장소 ${Math.min(10, remain)}곳 더 보기</span><span style="font-size:12px; font-weight:600; opacity:0.85;">(현재 ${sorted.length} / 후보 ${totalFiltered}곳)</span>`;
        } else {
          const nextR = Math.min(4500, Math.max(2500, Math.round((state.selectedRadius || 1500) * 1.8)));
          moreBtn.innerHTML = `<span>🔭 반경 ${formatDistance(nextR)}로 넓혀 주변 장소 10곳 더 찾기</span>`;
        }
        moreBtn.addEventListener("click", () => {
          loadMorePlaces();
        });
        listEl.appendChild(moreBtn);
      }

      renderMapMarkers(sorted, updateMapBounds);
    }

    function createPlaceCardElement(place, indexNum) {
      const isSelected = place.id === state.selectedPlaceId;
      const isScrollFocused = place.id === state.hoveredPlaceId && !isSelected;
      const inTrip = state.tripList.some((item) => item.id === place.id);
      const inMyPlaces = isPlaceInMyPlaces(place);

      const card = document.createElement("article");
      card.className = "place-card" + (isSelected ? " selected" : "") + (isScrollFocused ? " scroll-focused" : "");
      card.id = `place-card-${place.id}`;
      card.dataset.placeId = place.id;

      const isDistCat = isDistancePriorityCategory(state.selectedCategory);
      ensurePlaceRating(place);
      const hasRealRating = typeof place.rating === "number" && place.rating > 0;
      const ratingScore = hasRealRating ? place.rating.toFixed(1) : null;
      const isVerified100 = hasRealRating && typeof place.userRatingCount === "number" && place.userRatingCount >= 100;
      const reviewCountText =
        hasRealRating && typeof place.userRatingCount === "number" && place.userRatingCount > 0
          ? `(${place.userRatingCount.toLocaleString()}개 리뷰${isVerified100 ? " · 🔥검증됨" : ""})`
          : "";

      const realRatingSpan = hasRealRating
        ? `<span class="rating-text">★ ${ratingScore}</span> ${reviewCountText ? `<span style="${isVerified100 ? "color:#b45309; font-weight:700;" : ""}">${reviewCountText}</span>` : ""}`
        : `<span class="status-unknown rating-placeholder">평점 정보 없음</span>`;

      const ratingHtml = isDistCat
        ? `<span style="color:#047857; font-weight:800;">📍 거리 우선 (#${indexNum})</span>${hasRealRating ? ` · ${realRatingSpan}` : ""}`
        : realRatingSpan;

      let openBadgeHtml = `<span class="status-unknown">영업시간 미확인</span>`;
      if (place.isOpenNow === true) {
        openBadgeHtml = `<span class="status-open">● 영업 중</span>`;
      } else if (place.isOpenNow === false) {
        openBadgeHtml = `<span class="status-closed">● 영업 종료</span>`;
      }

      const priceText =
        place.priceLevel !== null && place.priceLevel !== undefined && PRICE_LEVEL_LABELS[place.priceLevel]
          ? `<span class="price-badge">${PRICE_LEVEL_LABELS[place.priceLevel]}</span>`
          : "";

      // [개선안 5-3] 7위 이후 장소도 직선거리 기반 예상 도보 시간·거리를 즉시 표시!
      let walkText = "도보 계산 중...";
      if (place.walkStatus === "OK" && place.walkDurationMs !== null) {
        const wDur = formatDuration(place.walkDurationMs);
        const wDist = place.walkDistanceM !== null ? ` · ${formatDistance(place.walkDistanceM)}` : "";
        walkText = `도보 ${wDur}${wDist}`;
      } else if (typeof place.straightDistM === "number" && isFinite(place.straightDistM)) {
        const estWalkM = Math.max(30, Math.round(place.straightDistM * 1.28));
        const estWalkMin = Math.max(1, Math.round(estWalkM / 75));
        walkText = `도보 약 ${estWalkMin}분 · 직선 ${formatDistance(place.straightDistM)}`;
      } else {
        walkText = "도보 경로 확인 가능";
      }

      let transitText = "대중교통 (선택 시 상세경로)";
      if (place.transitStatus === "OK" && place.transitDurationMs !== null) {
        transitText = `대중교통 ${formatDuration(place.transitDurationMs)}`;
      } else if (place.transitStatus === "NO_ROUTE") {
        transitText = "도보 이동 권장 구간";
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

      // [개선안 5-1] 카드 UI 다이어트: 우측 상단에 [🤍 내장소] + [+코스] 아이콘 배치, 하단은 큼직한 핵심 액션 3개만 배치!
      card.innerHTML = `
        <div class="card-top">
          <div class="card-main-info">
            <div class="card-title-row">
              <span class="place-index-badge" style="${isDistCat ? 'background:#059669;' : ''}">${indexNum}</span>
              <h3 class="place-name">${escapeHtml(place.name)}</h3>
              <span class="place-category-badge">${escapeHtml(place.categoryLabel)}</span>
              <div class="card-quick-icons">
                <button type="button" class="btn-card-icon ${inMyPlaces ? "fav-saved" : ""}" data-action="save-fav" title="내 장소에 저장">
                  ${inMyPlaces ? "❤️ 저장됨" : "🤍 내장소"}
                </button>
                <button type="button" class="btn-card-icon ${inTrip ? "in-trip" : ""}" data-action="trip" title="Day ${state.currentTripDay} 여행 코스에 추가">
                  ${inTrip ? "✓ 코스담김" : "+ 코스"}
                </button>
              </div>
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
          <div class="detail-block-title" style="margin-top:10px;">🗺️ 외부 지도앱 길찾기 바로가기 (${escapeHtml(originLabelShort)} 출발)</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
            <a href="${mapsDirTransitUrl}" target="_blank" rel="noopener noreferrer" class="card-btn primary" style="flex:1 1 calc(50% - 3px); min-width:130px;">
              🚌 Google 대중교통
            </a>
            <a href="${mapsDirWalkUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" style="flex:1 1 calc(50% - 3px); min-width:130px;">
              🚶 Google 도보
            </a>
            ${isKorea ? `
            <a href="${naverDirUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" style="flex:1 1 calc(50% - 3px); min-width:130px; border-color:#03c75a; color:#03c75a; font-weight:800;">
              🟢 네이버지도 길찾기
            </a>
            <a href="${kakaoDirUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" style="flex:1 1 calc(50% - 3px); min-width:130px; border-color:#eab308; background:#fef08a; color:#713f12; font-weight:800;">
              🟡 카카오맵 길찾기
            </a>
            ` : ""}
          </div>
        </div>

        <div class="card-actions">
          <button type="button" class="card-btn btn-detail-toggle" data-action="detail" style="flex:1;">
            ℹ️ 상세·시간
          </button>
          <button type="button" class="card-btn primary" data-action="directions" style="flex:1.2;" title="지도에 이동 경로선 및 대중교통·도보 안내 표시">
            🗺️ 경로보기
          </button>
          <a href="${mapsDetailUrl}" target="_blank" rel="noopener noreferrer" class="card-btn" data-action="gmaps" style="flex:1;">
            ↗ 구글지도
          </a>
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

    // [개선안 5-2] 하단 시트 스크롤 시 현재 보고 있는 카드의 지도 마커 자동 강조 연동
    function bindSheetScrollMarkerSync() {
      const sheetBody = document.querySelector(".sheet-body");
      if (!sheetBody) return;
      let ticking = false;

      sheetBody.addEventListener(
        "scroll",
        () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            if (!state.places || state.places.length === 0) return;
            const bodyRect = sheetBody.getBoundingClientRect();
            const targetY = bodyRect.top + Math.min(110, bodyRect.height * 0.32);
            const cards = sheetBody.querySelectorAll(".place-card");
            let closestPlaceId = null;
            let minDist = Infinity;

            cards.forEach((c) => {
              const r = c.getBoundingClientRect();
              const center = (r.top + r.bottom) / 2;
              const d = Math.abs(center - targetY);
              if (d < minDist) {
                minDist = d;
                closestPlaceId = c.dataset.placeId || null;
              }
            });

            if (closestPlaceId && closestPlaceId !== state.hoveredPlaceId) {
              state.hoveredPlaceId = closestPlaceId;
              cards.forEach((c) => {
                c.classList.toggle("scroll-focused", c.dataset.placeId === closestPlaceId && c.dataset.placeId !== state.selectedPlaceId);
              });
              updateMarkerHighlight();
            }
          });
        },
        { passive: true }
      );
    }

    async function handlePlaceSelection(place, { toggleDrawer = false, scrollToCard = false, forceFitRoute = true } = {}) {
      const wasSelected = state.selectedPlaceId === place.id;
      state.selectedPlaceId = place.id;
      state.hoveredPlaceId = place.id;

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

function updateSinglePlaceCard(place) {
      ensurePlaceRating(place);
      const card = document.getElementById(`place-card-${place.id}`);
      if (!card) return;
      const metaRow = card.querySelector(".meta-row");
      if (metaRow && typeof place.rating === "number" && place.rating > 0) {
        const ratingSpan = metaRow.querySelector(".rating-text") || metaRow.querySelector(".rating-placeholder") || metaRow.querySelector(".status-unknown");
        if (ratingSpan) {
          const isVerified100 = typeof place.userRatingCount === "number" && place.userRatingCount >= 100;
          const reviewsText =
            typeof place.userRatingCount === "number" && place.userRatingCount > 0
              ? ` (${place.userRatingCount.toLocaleString()}개 리뷰${isVerified100 ? " · 🔥검증됨" : ""})`
              : "";
          ratingSpan.className = "rating-text";
          ratingSpan.innerHTML = `★ ${place.rating.toFixed(1)}<span style="${isVerified100 ? "color:#b45309; font-weight:700;" : ""}">${reviewsText}</span>`;
        }
      }
      if (place.photoUrl) {
        const photoBox = card.querySelector(".card-photo-box");
        if (!photoBox) {
          const cardTop = card.querySelector(".card-top");
          if (cardTop) {
            const pBox = document.createElement("div");
            pBox.className = "card-photo-box";
            pBox.innerHTML = `<img src="${place.photoUrl}" alt="${escapeHtml(place.name)}" class="card-photo" loading="lazy" />`;
            cardTop.appendChild(pBox);
          }
        }
      }
      const gmapsLink = card.querySelector('[data-action="gmaps"]');
      if (gmapsLink) {
        gmapsLink.href = buildGoogleMapsPlaceUrl(place);
      }
    }

    function updateSinglePlaceMarker(place) {
      const entry = state.placeMarkers.get(place.id);
      if (!entry) return;
      const { marker, num } = entry;
      const isSelected = place.id === state.selectedPlaceId;
      const isHovered = place.id === state.hoveredPlaceId;
      if (marker.content && marker.content instanceof HTMLElement) {
        styleMarkerElement(marker.content, place, num, isSelected, isHovered);
      } else if (typeof marker.setIcon === "function") {
        marker.setIcon(createMarkerSvgIcon(place, num, isSelected || isHovered));
      }
    }

    function createMarkerSvgIcon(place, num, isSelected) {
      ensurePlaceRating(place);
      const isDistCat = isDistancePriorityCategory(state.selectedCategory);

      let badgeLabel = "";
      let labelColor = isSelected ? "#fde047" : "#b45309";
      let circleBg = isSelected ? "#ffffff" : (isDistCat ? "#059669" : "#2563eb");
      let circleText = isSelected ? (isDistCat ? "#059669" : "#2563eb") : "#ffffff";
      let bg = isSelected ? (isDistCat ? "#059669" : "#2563eb") : "#ffffff";
      let border = isSelected ? "#ffffff" : (isDistCat ? "#a7f3d0" : "#cbd5e1");

      const hasRealRating = typeof place?.rating === "number" && place.rating > 0;
      if (isDistCat || !hasRealRating) {
        const dStr = formatShortDist(place?.straightDistM);
        badgeLabel = dStr || "장소";
        labelColor = isSelected ? "#ffffff" : (isDistCat ? "#047857" : "#334155");
      } else {
        badgeLabel = `★ ${place.rating.toFixed(1)}`;
        labelColor = isSelected ? "#fde047" : "#b45309";
      }

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="76" height="30" viewBox="0 0 76 30">
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.25"/>
          </filter>
          <rect x="2" y="2" width="72" height="26" rx="13" fill="${bg}" stroke="${border}" stroke-width="${isSelected ? '2' : '1.5'}" filter="url(#shadow)"/>
          <circle cx="15" cy="15" r="9.5" fill="${circleBg}"/>
          <text x="15" y="18.5" font-size="11" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, sans-serif" text-anchor="middle" fill="${circleText}">${num}</text>
          <text x="47" y="19" font-size="11.5" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, sans-serif" text-anchor="middle" fill="${labelColor}">${badgeLabel}</text>
        </svg>
      `.trim();

      return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(76, 30),
        anchor: new google.maps.Point(38, 15)
      };
    }

    function renderMapMarkers(placesList, fitBounds = false) {
      if (!state.map) return;

      state.placeMarkers.forEach(({ marker }) => {
        if (marker.setMap) marker.setMap(null);
        else marker.map = null;
      });
      state.placeMarkers.clear();

      placesList.forEach((place, idx) => {
        const num = idx + 1;
        const isSelected = place.id === state.selectedPlaceId;
        const isHovered = place.id === state.hoveredPlaceId;

        let marker = null;
        if (state.libs.AdvancedMarkerElement) {
          try {
            const badge = document.createElement("div");
            badge.className = "map-marker-pin";
            styleMarkerElement(badge, place, num, isSelected, isHovered);

            marker = new state.libs.AdvancedMarkerElement({
              map: state.map,
              position: place.location,
              content: badge,
              title: `${num}. ${place.name}${typeof place.rating === "number" ? " (★" + place.rating.toFixed(1) + ")" : ""}`,
              zIndex: isSelected ? 600 : isHovered ? 500 : 200 - idx
            });

            marker.addListener("click", () => {
              handlePlaceSelection(place, { toggleDrawer: false, scrollToCard: true });
            });
          } catch (_) {
            marker = null;
          }
        }

        if (!marker) {
          const svgIcon = createMarkerSvgIcon(place, num, isSelected || isHovered);
          marker = new google.maps.Marker({
            map: state.map,
            position: place.location,
            icon: svgIcon,
            title: `${num}. ${place.name}${typeof place.rating === "number" ? " (★" + place.rating.toFixed(1) + ")" : ""}`,
            zIndex: isSelected ? 600 : isHovered ? 500 : 200 - idx
          });

          marker.addListener("click", () => {
            handlePlaceSelection(place, { toggleDrawer: false, scrollToCard: true });
          });
        }

        state.placeMarkers.set(place.id, { marker, place, num });
      });
    }

    function styleMarkerElement(el, place, num, isSelected, isHovered = false) {
      ensurePlaceRating(place);
      const isDistCat = isDistancePriorityCategory(state.selectedCategory);
      const activeVisual = isSelected || isHovered;

      let badgeLabel = "";
      let labelColor = activeVisual ? "#fde047" : "#b45309";
      let circleBg = activeVisual ? "#ffffff" : (isDistCat ? "#059669" : "#2563eb");
      let circleText = activeVisual ? (isDistCat ? "#059669" : "#2563eb") : "#ffffff";

      const hasRealRating = typeof place?.rating === "number" && place.rating > 0;
      if (isDistCat || !hasRealRating) {
        const dStr = formatShortDist(place?.straightDistM);
        badgeLabel = dStr ? `📍${dStr}` : "장소";
        labelColor = activeVisual ? "#ffffff" : (isDistCat ? "#047857" : "#334155");
      } else {
        badgeLabel = `★ ${place.rating.toFixed(1)}`;
        labelColor = activeVisual ? "#fde047" : "#b45309";
      }

      el.innerHTML = `
        <span style="
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:21px;
          height:21px;
          padding:0 4px;
          border-radius:999px;
          background:${circleBg};
          color:${circleText};
          font-size:11px;
          font-weight:900;
          line-height:1;
        ">${num}</span>
        <span style="
          font-size:${activeVisual ? "12px" : "11.5px"};
          font-weight:800;
          color:${labelColor};
          white-space:nowrap;
          letter-spacing:-0.01em;
          line-height:1;
        ">${badgeLabel}</span>
      `;

      el.style.display = "inline-flex";
      el.style.alignItems = "center";
      el.style.gap = "5px";
      el.style.padding = "3px 9px 3px 4px";
      el.style.borderRadius = "999px";
      el.style.background = activeVisual ? (isDistCat ? "#059669" : "#2563eb") : "rgba(255, 255, 255, 0.98)";
      el.style.border = activeVisual ? "2px solid #ffffff" : (isDistCat ? "1.5px solid #a7f3d0" : "1.5px solid #cbd5e1");
      el.style.boxShadow = activeVisual
        ? `0 0 0 3px ${isDistCat ? "rgba(5, 150, 105, 0.35)" : "rgba(37, 99, 235, 0.35)"}, 0 4px 12px rgba(15, 23, 42, 0.35)`
        : "0 2px 6px rgba(15, 23, 42, 0.22)";
      el.style.transform = isSelected ? "scale(1.1)" : isHovered ? "scale(1.06)" : "scale(1)";
      el.style.transition = "all 0.15s ease";
    }

    function updateMarkerHighlight() {
      state.placeMarkers.forEach(({ marker, place, num }) => {
        const isSelected = place.id === state.selectedPlaceId;
        const isHovered = place.id === state.hoveredPlaceId;
        if (marker.content && marker.content instanceof HTMLElement) {
          styleMarkerElement(marker.content, place, num, isSelected, isHovered);
          marker.zIndex = isSelected ? 600 : isHovered ? 500 : 200;
        } else if (typeof marker.setIcon === "function") {
          marker.setIcon(createMarkerSvgIcon(place, num, isSelected || isHovered));
          marker.setZIndex(isSelected ? 600 : isHovered ? 500 : 200);
        }
      });
    }

    function clearMapMarkersAndPolylines() {
      state.placeMarkers.forEach(({ marker }) => {
        if (marker.setMap) marker.setMap(null);
        else marker.map = null;
      });
      state.placeMarkers.clear();
      clearActivePolylines();
      $("mapRouteBadge").classList.remove("visible");
    }
