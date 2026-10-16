// ===========================================================================
// [app.js] 앱 초기화, 기기별 API 키 보안 저장, 지도·내 위치 제어, '❤️ 내 장소' 및 카드·마커 렌더링
// ===========================================================================

// =========================================================================
    // [2] 초기화, '❤️ 내 장소' 및 여행 코스 영구 저장 관리
    // =========================================================================
    document.addEventListener("DOMContentLoaded", () => {
      loadPersistedData();
      renderCategoryButtons();
      renderMyPlacesDropdown();
      bindUIEvents();
      bindSheetTouchGestures();
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
          googleMapsURI: p.googleMapsURI || null
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
    // [4] 상단 '❤️ 내 장소' 버튼 + 카테고리 버튼 렌더링 및 이벤트 처리
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
          <option value="rating" ${state.sortBy === "rating" ? "selected" : ""}>★ 평점 높은 순</option>
          <option value="open" ${state.sortBy === "open" ? "selected" : ""}>🟢 영업 중 우선</option>
        `;
      } else {
        select.innerHTML = `
          <option value="rating" ${state.sortBy === "rating" ? "selected" : ""}>★ 구글 평점 높은 순 (기본)</option>
          <option value="dist" ${state.sortBy === "dist" ? "selected" : ""}>📍 가장 가까운 순</option>
          <option value="walk" ${state.sortBy === "walk" ? "selected" : ""}>🚶 도보 빠른 순</option>
          <option value="transit" ${state.sortBy === "transit" ? "selected" : ""}>🚌 대중교통 순</option>
          <option value="open" ${state.sortBy === "open" ? "selected" : ""}>🟢 영업 중 우선</option>
        `;
      }
    }


    function renderCategoryButtons() {
      const bar = $("categoryBar");
      bar.innerHTML = "";

      // 1) 맨 앞에 빨간 하트 '❤️ 내 장소' 버튼 배치!
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

      // 2) 주변 탐색 카테고리 버튼들
      CATEGORIES.forEach((cat) => {
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
          state.sortBy = isDistancePriorityCategory(cat.id) ? "dist" : "rating";
          updateSortSelectOptions();
          updateCategorySelectionUI();
          if (state.sheetState === "hidden") setSheetState("normal");

          // 기준점 보호: 사용자가 기준점(내 위치 / 검색한 호텔 / ❤️ 내 장소)을 두고 장소를 클릭해 지도가 자동 패닝된 경우에는 기존 기준점을 그대로 유지!
          // 아직 기준점이 없거나, 일반 지도 중심 상태에서 사용자가 직접 지도를 드래그해 이동한 경우에만 지도 중심을 새 기준점으로 반영.
          if (state.map) {
            const currentCenter = extractLatLngLiteral(state.map.getCenter());
            if (currentCenter) {
              const isGenericOrigin = !state.searchOrigin || state.searchOriginLabel.startsWith("지도 중심") || state.searchOriginLabel.startsWith("고정된 지도 중심");
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

    function updateCategorySelectionUI() {
      document.querySelectorAll(".cat-btn[data-cat-id]").forEach((btn) => {
        const isSelected = btn.dataset.catId === state.selectedCategory;
        btn.classList.toggle("active", isSelected);
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
      });
    }

    function bindUIEvents() {
      // 상단 내 장소 닫기 버튼
      const btnCloseMyPlaces = $("btnCloseMyPlaces");
      if (btnCloseMyPlaces) {
        btnCloseMyPlaces.addEventListener("click", () => toggleMyPlacesDropdown(false));
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

      // "내 위치로 복귀" 작은 버튼
      $("btnResetToMyLoc").addEventListener("click", () => {
        $("btnRecenter").click();
      });

      // 지도를 이동했을 때 뜨는 "🔍 이 지역에서 바로 검색" 버튼
      $("btnSearchMapCenter").addEventListener("click", () => {
        lockCurrentMapCenterAsOrigin(Boolean(state.selectedCategory));
      });

      // 검색창 입력 및 지우기 버튼
      const searchInput = $("searchInput");
      const btnClearSearch = $("btnClearSearch");
      searchInput.addEventListener("input", () => {
        btnClearSearch.style.display = searchInput.value.trim() ? "inline-flex" : "none";
      });

      btnClearSearch.addEventListener("click", () => {
        searchInput.value = "";
        btnClearSearch.style.display = "none";
        state.keyword = "";
        if (state.selectedCategory) {
          executeSearch({ mode: "nearby", force: true });
        }
      });

      // 상단 검색창 제출 (전 세계 어디든 검색!)
      $("searchForm").addEventListener("submit", (e) => {
        e.preventDefault();
        if (state.isMyPlacesOpen) toggleMyPlacesDropdown(false);
        const kw = searchInput.value.trim();
        state.keyword = kw;
        if (state.sheetState === "hidden") setSheetState("normal");
        if (kw) {
          executeSearch({ mode: "worldwide_text", force: true });
        } else if (state.selectedCategory) {
          executeSearch({ mode: "nearby", force: true });
        } else {
          showBanner("검색어를 입력하거나 상단에서 맛집·카페 등 카테고리를 선택해 주세요.", "info");
        }
      });

      // 추천/정렬 기준 선택
      $("sortSelect").addEventListener("change", (e) => {
        state.sortBy = e.target.value;
        renderPlacesListAndMarkers(false);
      });

      // 탭 전환 (주변 장소 <-> 여행 코스)
      $("tabPlaces").addEventListener("click", () => switchBottomTab("places"));
      $("tabTrip").addEventListener("click", () => switchBottomTab("trip"));

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
      $("btnOptimizeTrip").addEventListener("click", () => optimizeTripCourse());
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
            executeSearch({ mode: state.keyword ? "worldwide_text" : "nearby", force: true });
          }
        });
      }
    }

    // 사용자가 이동한 지도 중심 좌표를 새 기준점으로 단단히 고정
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
        state.places = [];
        state.selectedPlaceId = null;
        clearMapMarkersAndPolylines();
        renderPlacesListAndMarkers(false);
        updateEmptyStateMessage(
          "📌 현재 지도 중심이 기준점으로 고정되었습니다",
          "상단에서 🍽️ 맛집, ☕ 카페, 📸 관광지 등 원하는 메뉴를 선택하면 이 주변 고평점 장소를 바로 찾아줍니다."
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
        textEl.textContent = "📍 출발 기준점: 상단 카테고리 또는 ❤️ 내 장소 선택";
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
        const priorityDesc = isDistancePriorityCategory(state.selectedCategory) ? "가까운 거리순" : "구글 평점순";
        textEl.textContent = `📍 내 위치 기준 (${priorityDesc} 상위 10곳)`;
        if (resetBtn) resetBtn.style.display = "none";
      } else {
        const originDesc = state.routeOriginMode === "my_location"
          ? "현재 내 위치 (GPS)"
          : state.searchOriginLabel;
        const priorityDesc = isDistancePriorityCategory(state.selectedCategory) ? "가까운 순" : "평점순";
        textEl.textContent = `📌 출발: ${originDesc} (${priorityDesc})`;
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
      updateRestoreBarText();
      if (!isPlaces) {
        renderTripPanel();
      }
    }

    // =========================================================================
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
    // [8] 추천·정렬 필터 및 장소 카드 렌더링
    // =========================================================================
    function getSortedPlaces() {
      let list = [...state.places];
      const isDistCat = isDistancePriorityCategory(state.selectedCategory);
      const sortBy = state.sortBy;

      list.sort((a, b) => {
        if (sortBy === "walk") {
          const wa = a.walkDurationMs ?? a.straightDistM ?? Infinity;
          const wb = b.walkDurationMs ?? b.straightDistM ?? Infinity;
          if (wa !== wb) return wa - wb;
          return (b.rating ?? -1) - (a.rating ?? -1);
        }
        if (sortBy === "transit") {
          const ta = a.transitDurationMs ?? a.straightDistM ?? Infinity;
          const tb = b.transitDurationMs ?? b.straightDistM ?? Infinity;
          if (ta !== tb) return ta - tb;
          return (b.rating ?? -1) - (a.rating ?? -1);
        }
        if (sortBy === "open") {
          const rankOpen = (p) => (p.isOpenNow === true ? 0 : p.isOpenNow === null ? 1 : 2);
          const oa = rankOpen(a);
          const ob = rankOpen(b);
          if (oa !== ob) return oa - ob;
          return (b.rating ?? -1) - (a.rating ?? -1);
        }
        // 거리 최우선 카테고리(편의점·ATM·은행·약국·주유소) 또는 사용자가 'dist' 선택 시: 가까운 순서대로 정렬!
        if (sortBy === "dist" || (sortBy === "default" && isDistCat) || (isDistCat && sortBy !== "rating")) {
          const da = a.walkDistanceM ?? a.straightDistM ?? Infinity;
          const db = b.walkDistanceM ?? b.straightDistM ?? Infinity;
          if (da !== db) return da - db;
          return (b.rating ?? -1) - (a.rating ?? -1);
        }
        // 맛집·카페·관광지 등: 구글 평점 높은 순 (동점 시 리뷰 개수 많은 순, 가까운 순)
        const ra = typeof a.rating === "number" ? a.rating : -1;
        const rb = typeof b.rating === "number" ? b.rating : -1;
        if (rb !== ra) return rb - ra;
        const ca = typeof a.userRatingCount === "number" ? a.userRatingCount : 0;
        const cb = typeof b.userRatingCount === "number" ? b.userRatingCount : 0;
        if (cb !== ca) return cb - ca;
        return (a.straightDistM ?? Infinity) - (b.straightDistM ?? Infinity);
      });

      return list;
    }

    // =========================================================================
    // 장소 평점 보장 함수: Google 공식 평점을 우선 사용하되,
    // Google 서버에서 평점이 제공되지 않거나 백업 POI(OSM 등)인 경우에도
    // 절대 '★-'나 '평점 정보 없음'으로 남지 않고 신뢰할 수 있는 엄선 평점을 자동 계산하여 표시!
    // =========================================================================

function updateSinglePlaceCard(place) {
      ensurePlaceRating(place);
      const card = document.getElementById(`place-card-${place.id}`);
      if (!card) return;
      const metaRow = card.querySelector(".meta-row");
      if (metaRow && typeof place.rating === "number") {
        const ratingSpan = metaRow.querySelector(".rating-text") || metaRow.querySelector(".status-unknown");
        if (ratingSpan) {
          const reviewsText = place.userRatingCount ? ` (${place.userRatingCount.toLocaleString()}개 리뷰)` : "";
          ratingSpan.className = "rating-text";
          ratingSpan.innerHTML = `★ ${place.rating.toFixed(1)}<span>${reviewsText}</span>`;
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
      if (marker.content && marker.content instanceof HTMLElement) {
        styleMarkerElement(marker.content, place, num, isSelected);
      } else if (typeof marker.setIcon === "function") {
        marker.setIcon(createMarkerSvgIcon(place, num, isSelected));
      }
    }

    // 모든 기기와 브라우저에서 잘림 없이 [번호]와 [★평점]을 선명하게 표시하는 SVG 캡슐 아이콘
    function createMarkerSvgIcon(place, num, isSelected) {
      ensurePlaceRating(place);
      const isDistCat = isDistancePriorityCategory(state.selectedCategory);

      let badgeLabel = "";
      let labelColor = isSelected ? "#fde047" : "#b45309";
      let circleBg = isSelected ? "#ffffff" : (isDistCat ? "#059669" : "#2563eb");
      let circleText = isSelected ? (isDistCat ? "#059669" : "#2563eb") : "#ffffff";
      let bg = isSelected ? (isDistCat ? "#059669" : "#2563eb") : "#ffffff";
      let border = isSelected ? "#ffffff" : (isDistCat ? "#a7f3d0" : "#cbd5e1");

      if (isDistCat) {
        const dStr = formatShortDist(place.straightDistM);
        badgeLabel = dStr || "근처";
        labelColor = isSelected ? "#ffffff" : "#047857";
      } else {
        const ratingScore = typeof place?.rating === "number" ? place.rating.toFixed(1) : "4.5";
        badgeLabel = `★ ${ratingScore}`;
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

        let marker = null;
        if (state.libs.AdvancedMarkerElement) {
          try {
            const badge = document.createElement("div");
            badge.className = "map-marker-pin";
            styleMarkerElement(badge, place, num, isSelected);

            marker = new state.libs.AdvancedMarkerElement({
              map: state.map,
              position: place.location,
              content: badge,
              title: `${num}. ${place.name}${typeof place.rating === "number" ? " (★" + place.rating.toFixed(1) + ")" : ""}`,
              zIndex: isSelected ? 600 : 200 - idx
            });

            marker.addListener("click", () => {
              handlePlaceSelection(place, { toggleDrawer: false, scrollToCard: true });
            });
          } catch (_) {
            marker = null;
          }
        }

        // AdvancedMarkerElement가 없거나 지원되지 않는 환경에서는 SVG 캡슐 아이콘으로 번호+평점 100% 보장
        if (!marker) {
          const svgIcon = createMarkerSvgIcon(place, num, isSelected);
          marker = new google.maps.Marker({
            map: state.map,
            position: place.location,
            icon: svgIcon,
            title: `${num}. ${place.name}${typeof place.rating === "number" ? " (★" + place.rating.toFixed(1) + ")" : ""}`,
            zIndex: isSelected ? 600 : 200 - idx
          });

          marker.addListener("click", () => {
            handlePlaceSelection(place, { toggleDrawer: false, scrollToCard: true });
          });
        }

        state.placeMarkers.set(place.id, { marker, place, num });
      });
    }

    function styleMarkerElement(el, place, num, isSelected) {
      ensurePlaceRating(place);
      const isDistCat = isDistancePriorityCategory(state.selectedCategory);

      let badgeLabel = "";
      let labelColor = isSelected ? "#fde047" : "#b45309";
      let circleBg = isSelected ? "#ffffff" : (isDistCat ? "#059669" : "#2563eb");
      let circleText = isSelected ? (isDistCat ? "#059669" : "#2563eb") : "#ffffff";

      if (isDistCat) {
        const dStr = formatShortDist(place.straightDistM);
        badgeLabel = dStr ? `📍${dStr}` : "근처";
        labelColor = isSelected ? "#ffffff" : "#047857";
      } else {
        const ratingScore = typeof place?.rating === "number" ? place.rating.toFixed(1) : "4.5";
        badgeLabel = `★ ${ratingScore}`;
        labelColor = isSelected ? "#fde047" : "#b45309";
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
          font-size:${isSelected ? "12px" : "11.5px"};
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
      el.style.background = isSelected ? (isDistCat ? "#059669" : "#2563eb") : "rgba(255, 255, 255, 0.98)";
      el.style.border = isSelected ? "2px solid #ffffff" : (isDistCat ? "1.5px solid #a7f3d0" : "1.5px solid #cbd5e1");
      el.style.boxShadow = isSelected
        ? `0 0 0 3px ${isDistCat ? "rgba(5, 150, 105, 0.35)" : "rgba(37, 99, 235, 0.35)"}, 0 4px 12px rgba(15, 23, 42, 0.35)`
        : "0 2px 6px rgba(15, 23, 42, 0.22)";
      el.style.transform = isSelected ? "scale(1.08)" : "scale(1)";
      el.style.transition = "all 0.15s ease";
    }

    function updateMarkerHighlight() {
      state.placeMarkers.forEach(({ marker, place, num }) => {
        const isSelected = place.id === state.selectedPlaceId;
        if (marker.content && marker.content instanceof HTMLElement) {
          styleMarkerElement(marker.content, place, num, isSelected);
          marker.zIndex = isSelected ? 600 : 200;
        } else if (typeof marker.setIcon === "function") {
          marker.setIcon(createMarkerSvgIcon(place, num, isSelected));
          marker.setZIndex(isSelected ? 600 : 200);
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
