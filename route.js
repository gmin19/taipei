// ===========================================================================
// [route.js] 도보·대중교통 경로 탐색, 지도 폴리라인, Day 1~3 여행 코스·메모·스마트 동선 최적화
// ===========================================================================

// =========================================================================
    // [7] 도보 및 대중교통 소요 시간·경로 계산 (국내·해외 대중교통 지원 3중 엔진)
    // =========================================================================
    async function computeTravelTimesForTopPlaces(originCoords, placesArray, seqId) {
      if (!originCoords) return;

      const targets = placesArray.slice(0, MAX_ROUTE_MATRIX_TARGETS);
      const skipped = placesArray.slice(MAX_ROUTE_MATRIX_TARGETS);
      skipped.forEach((p) => {
        p.walkStatus = "SKIPPED_LIMIT";
        p.transitStatus = "SKIPPED_LIMIT";
      });

      if (targets.length === 0) return;

      const originKey = `${originCoords.lat.toFixed(4)},${originCoords.lng.toFixed(4)}`;
      const destIdsKey = targets.map((t) => t.id).join(",");

      await Promise.all([
        fetchSingleModeMatrix(originCoords, targets, "WALKING", `${originKey}|WALK|${destIdsKey}`).then(() => {
          if (seqId === state.searchSeq) renderPlacesListAndMarkers(false);
        }),
        fetchSingleModeMatrix(originCoords, targets, "TRANSIT", `${originKey}|TRANSIT|${destIdsKey}`).then(() => {
          if (seqId === state.searchSeq) renderPlacesListAndMarkers(false);
        })
      ]);
    }

    function parseProtoDurationMs(durVal) {
      if (typeof durVal === "number" && isFinite(durVal)) return durVal;
      if (typeof durVal === "string") {
        const m = durVal.match(/^([0-9.]+)s$/);
        if (m) return Math.round(parseFloat(m[1]) * 1000);
      }
      return null;
    }

    async function fetchSingleModeMatrix(originCoords, targets, travelMode, cacheKey) {
      const inKorea = isInSouthKorea(originCoords);

      try {
        let normalizedItems = null;
        if (state.routeMatrixCache.has(cacheKey)) {
          normalizedItems = state.routeMatrixCache.get(cacheKey);
        } else {
          try {
            const restMode = travelMode === "TRANSIT" ? "TRANSIT" : "WALK";
            const resp = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": state.apiKey,
                "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,status,condition"
              },
              body: JSON.stringify({
                origins: [
                  {
                    waypoint: {
                      location: {
                        latLng: { latitude: originCoords.lat, longitude: originCoords.lng }
                      }
                    }
                  }
                ],
                destinations: targets.map((t) => ({
                  waypoint: {
                    location: {
                      latLng: { latitude: t.location.lat, longitude: t.location.lng }
                    }
                  }
                })),
                travelMode: restMode,
                languageCode: "ko"
              })
            });

            if (resp.ok) {
              const arr = await resp.json();
              if (Array.isArray(arr) && arr.length > 0) {
                const mapped = new Array(targets.length).fill(null);
                for (const el of arr) {
                  const dIdx = typeof el.destinationIndex === "number" ? el.destinationIndex : 0;
                  const durMs = parseProtoDurationMs(el.duration);
                  const condOk = !el.condition || el.condition === "ROUTE_EXISTS";
                  if (condOk && durMs !== null) {
                    mapped[dIdx] = {
                      durationMillis: durMs,
                      distanceMeters: typeof el.distanceMeters === "number" ? el.distanceMeters : null,
                      ok: true
                    };
                  }
                }
                if (mapped.some((x) => x && x.ok)) {
                  normalizedItems = mapped;
                }
              }
            }
          } catch (_) {}

          if (!normalizedItems && state.libs.RouteMatrix && typeof state.libs.RouteMatrix.computeRouteMatrix === "function") {
            try {
              const condEnum = state.libs.RouteMatrixItemCondition;
              const { matrix } = await state.libs.RouteMatrix.computeRouteMatrix({
                origins: [originCoords],
                destinations: targets.map((t) => t.location),
                travelMode: travelMode,
                fields: ["durationMillis", "distanceMeters", "condition"]
              });
              const rawRow = matrix?.rows?.[0]?.items || [];
              if (rawRow.length > 0) {
                const mapped = rawRow.map((it) => {
                  const ok =
                    it &&
                    (!it.condition ||
                      it.condition === "ROUTE_EXISTS" ||
                      (condEnum && it.condition === condEnum.ROUTE_EXISTS)) &&
                    typeof it.durationMillis === "number" &&
                    isFinite(it.durationMillis);
                  return ok
                    ? {
                        durationMillis: it.durationMillis,
                        distanceMeters: typeof it.distanceMeters === "number" ? it.distanceMeters : null,
                        ok: true
                      }
                    : null;
                });
                if (mapped.some((x) => x && x.ok)) {
                  normalizedItems = mapped;
                }
              }
            } catch (_) {}
          }

          if (!normalizedItems && state.libs.DistanceMatrixService) {
            try {
              const dms = new state.libs.DistanceMatrixService();
              const dmsRes = await new Promise((resolve) => {
                dms.getDistanceMatrix(
                  {
                    origins: [originCoords],
                    destinations: targets.map((t) => t.location),
                    travelMode: travelMode === "TRANSIT" ? "TRANSIT" : "WALKING"
                  },
                  (response, status) => {
                    if (status === "OK" && response?.rows?.[0]?.elements) {
                      resolve(response.rows[0].elements);
                    } else {
                      resolve(null);
                    }
                  }
                );
              });
              if (Array.isArray(dmsRes)) {
                const mapped = dmsRes.map((el) => {
                  if (el && el.status === "OK" && typeof el.duration?.value === "number") {
                    return {
                      durationMillis: el.duration.value * 1000,
                      distanceMeters: typeof el.distance?.value === "number" ? el.distance.value : null,
                      ok: true
                    };
                  }
                  return null;
                });
                if (mapped.some((x) => x && x.ok)) {
                  normalizedItems = mapped;
                }
              }
            } catch (_) {}
          }

          if (normalizedItems) {
            state.routeMatrixCache.set(cacheKey, normalizedItems);
          }
        }

        let anyWalkMissing = false;
        let anyTransitMissing = false;

        targets.forEach((place, idx) => {
          if (place.straightDistM !== null && place.straightDistM < 25) {
            if (travelMode === "WALKING") {
              place.walkDurationMs = 60000;
              place.walkDistanceM = place.straightDistM;
              place.walkStatus = "OK";
            } else {
              place.transitDurationMs = 60000;
              place.transitDistanceM = place.straightDistM;
              place.transitStatus = "OK";
            }
            return;
          }

          const item = normalizedItems ? normalizedItems[idx] : null;
          if (travelMode === "WALKING") {
            if (item && item.ok) {
              place.walkDurationMs = item.durationMillis;
              place.walkDistanceM = item.distanceMeters;
              place.walkStatus = "OK";
            } else {
              anyWalkMissing = true;
              place.walkDurationMs = null;
              place.walkDistanceM = null;
              place.walkStatus = inKorea ? "KR_UNSUPPORTED" : "NO_ROUTE";
            }
          } else if (travelMode === "TRANSIT") {
            if (item && item.ok) {
              place.transitDurationMs = item.durationMillis;
              place.transitDistanceM = item.distanceMeters;
              place.transitStatus = "OK";
            } else {
              anyTransitMissing = true;
              place.transitDurationMs = null;
              place.transitDistanceM = null;
              place.transitStatus = "NO_ROUTE";
            }
          }
        });

        if (travelMode === "WALKING" && anyWalkMissing) {
          await populateOsrmWalkingMatrix(originCoords, targets);
        }

        if (travelMode === "TRANSIT" && anyTransitMissing) {
          const missingTargets = targets.filter((t) => t.transitStatus !== "OK").slice(0, 4);
          await Promise.all(
            missingTargets.map(async (place) => {
              try {
                const single = await fetchSingleRouteNewApi(originCoords, place.location, "TRANSIT");
                if (single && typeof single.durationMillis === "number") {
                  place.transitDurationMs = single.durationMillis;
                  place.transitDistanceM = single.distanceMeters ?? null;
                  place.transitStatus = "OK";
                  if (single.transitSteps) place.transitSteps = single.transitSteps;
                }
              } catch (_) {}
            })
          );
        }
      } catch (err) {
        console.warn(`${travelMode} Matrix 계산 실패:`, err);
        if (travelMode === "WALKING") {
          await populateOsrmWalkingMatrix(originCoords, targets);
        } else {
          targets.forEach((place) => {
            if (place.transitStatus === "PENDING") place.transitStatus = "NO_ROUTE";
          });
        }
      }
    }

    async function populateOsrmWalkingMatrix(originCoords, targets) {
      try {
        const coordsList = [
          `${originCoords.lng.toFixed(6)},${originCoords.lat.toFixed(6)}`,
          ...targets.map((t) => `${t.location.lng.toFixed(6)},${t.location.lat.toFixed(6)}`)
        ].join(";");
        const url = `https://routing.openstreetmap.de/routed-foot/table/v1/foot/${coordsList}?sources=0&annotations=duration,distance`;
        const resp = await fetch(url);
        if (!resp.ok) return;
        const data = await resp.json();
        const distances = data.distances?.[0];
        const durations = data.durations?.[0];
        if (!Array.isArray(distances)) return;

        targets.forEach((place, idx) => {
          if (place.walkStatus === "OK") return;
          const distM = distances[idx + 1];
          const durSec = durations ? durations[idx + 1] : null;
          if (typeof distM === "number" && isFinite(distM) && distM > 0) {
            place.walkDistanceM = Math.round(distM);
            const realisticWalkMs = Math.max(
              typeof durSec === "number" ? durSec * 1000 : 0,
              Math.round((distM / 1.25) * 1000)
            );
            place.walkDurationMs = realisticWalkMs;
            place.walkStatus = "OK";
          }
        });
      } catch (_) {}
    }

    async function computeAndDisplaySingleRoute(placeItem, travelMode = state.activeRouteMode, fitRouteBounds = true) {
      let origin = state.searchOrigin || state.currentLocation;
      if (state.routeOriginMode === "my_location" && state.currentLocation) {
        origin = state.currentLocation;
      }
      if (!origin || !placeItem || !placeItem.location) return;

      // 출발지와 목적지가 거의 같은 위치면 내 현재 위치를 출발지로 사용
      if (computeHaversineMeters(origin, placeItem.location) < 25 && state.currentLocation) {
        origin = state.currentLocation;
      }

      const getCachedOrFetchRoute = async (modeToFetch) => {
        const cKey = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${placeItem.id}|${modeToFetch}`;
        if (state.singleRouteCache.has(cKey)) {
          return state.singleRouteCache.get(cKey);
        }
        const fetched = await fetchSingleRouteNewApi(origin, placeItem.location, modeToFetch);
        if (fetched) {
          state.singleRouteCache.set(cKey, fetched);
        }
        return fetched;
      };

      clearActivePolylines();

      try {
        let effectiveMode = travelMode;
        let routeData = await getCachedOrFetchRoute(effectiveMode);

        // 핵심 복구: 대중교통(TRANSIT) 경로가 없는 가까운 거리이거나 대중교통 미제공 구간이면
        // 즉시 도보(WALKING) 경로로 자동 전환하여 화면 지도에 실제 경로선을 표시!
        if ((!routeData || !routeData.path || routeData.path.length === 0) && effectiveMode === "TRANSIT") {
          placeItem.transitStatus = "NO_ROUTE";
          placeItem.transitSteps = [];
          const walkFallback = await getCachedOrFetchRoute("WALKING");
          if (walkFallback) {
            routeData = walkFallback;
            effectiveMode = "WALKING";
          }
        }

        // 만약 모든 라우팅 서버에서 상세 폴리라인을 받지 못한 경우에도 출발지->목적지 직선/보조 경로선을 지도에 표시!
        if (!routeData) {
          const straightM = computeHaversineMeters(origin, placeItem.location);
          const estWalkMs = Math.max(60000, Math.round((straightM * 1.3 / 1.25) * 1000));
          routeData = {
            rawRoute: null,
            durationMillis: estWalkMs,
            distanceMeters: Math.round(straightM * 1.25),
            path: [
              { lat: Number(origin.lat), lng: Number(origin.lng) },
              { lat: Number(placeItem.location.lat), lng: Number(placeItem.location.lng) }
            ],
            transitSteps: [],
            isFallbackLine: true
          };
          effectiveMode = "WALKING";
        }

        if (effectiveMode === "WALKING") {
          if (typeof routeData.durationMillis === "number") {
            placeItem.walkDurationMs = routeData.durationMillis;
            placeItem.walkDistanceM = routeData.distanceMeters ?? placeItem.walkDistanceM;
            placeItem.walkStatus = "OK";
          }
        } else if (effectiveMode === "TRANSIT") {
          if (typeof routeData.durationMillis === "number") {
            placeItem.transitDurationMs = routeData.durationMillis;
            placeItem.transitDistanceM = routeData.distanceMeters ?? placeItem.transitDistanceM;
            placeItem.transitStatus = "OK";
          }
          placeItem.transitSteps = routeData.transitSteps || [];
        }

        drawRouteDataOnMap(routeData, effectiveMode, origin, placeItem.location, fitRouteBounds);

        const durText = formatDuration(routeData.durationMillis);
        const distText = formatDistance(routeData.distanceMeters);
        const modeLabel = effectiveMode === "TRANSIT" ? "🚌 대중교통" : "🚶 도보";
        const fallbackNote = travelMode === "TRANSIT" && effectiveMode === "WALKING" ? " (도보 구간)" : "";
        updateMapRouteBadge(`${modeLabel} ${durText}${distText ? " · " + distText : ""}${fallbackNote}`, effectiveMode);

        renderPlacesListAndMarkers(false);
      } catch (err) {
        console.warn(`${travelMode} 상세 경로 조회 실패:`, err);
        // 오류 시에도 출발지와 목적지를 잇는 경로선을 화면에 표시
        const fallbackRoute = {
          rawRoute: null,
          durationMillis: null,
          distanceMeters: computeHaversineMeters(origin, placeItem.location),
          path: [
            { lat: Number(origin.lat), lng: Number(origin.lng) },
            { lat: Number(placeItem.location.lat), lng: Number(placeItem.location.lng) }
          ],
          isFallbackLine: true
        };
        drawRouteDataOnMap(fallbackRoute, "WALKING", origin, placeItem.location, fitRouteBounds);
        updateMapRouteBadge(`📍 이동 거리 약 ${formatDistance(fallbackRoute.distanceMeters)}`, travelMode);
        renderPlacesListAndMarkers(false);
      }
    }

    async function fetchSingleRouteNewApi(origin, destination, travelMode) {
      try {
        const restMode = travelMode === "TRANSIT" ? "TRANSIT" : "WALK";
        const fieldMask = [
          "routes.duration",
          "routes.distanceMeters",
          "routes.polyline.encodedPolyline",
          "routes.legs.steps.travelMode",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.staticDuration",
          "routes.legs.steps.polyline.encodedPolyline",
          "routes.legs.steps.transitDetails"
        ].join(",");

        const resp = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": state.apiKey,
            "X-Goog-FieldMask": fieldMask
          },
          body: JSON.stringify({
            origin: {
              location: { latLng: { latitude: origin.lat, longitude: origin.lng } }
            },
            destination: {
              location: { latLng: { latitude: destination.lat, longitude: destination.lng } }
            },
            travelMode: restMode,
            languageCode: "ko"
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const r0 = data.routes && data.routes[0];
          if (r0) {
            const durMs = parseProtoDurationMs(r0.duration);
            const encodedPoly = r0.polyline?.encodedPolyline || "";
            const path = encodedPoly ? decodeEncodedPolyline(encodedPoly) : [];
            return {
              rawRoute: null,
              durationMillis: durMs,
              distanceMeters: typeof r0.distanceMeters === "number" ? r0.distanceMeters : null,
              path,
              transitSteps: travelMode === "TRANSIT" ? parseTransitStepsFromRoute(r0) : null
            };
          }
        }
      } catch (_) {}

      if (state.libs.Route && typeof state.libs.Route.computeRoutes === "function") {
        try {
          const { routes } = await state.libs.Route.computeRoutes({
            origin,
            destination,
            travelMode,
            fields: ["*"]
          });
          const r = routes && routes[0];
          if (r) {
            return {
              rawRoute: r,
              durationMillis: r.durationMillis ?? r.staticDurationMillis ?? null,
              distanceMeters: r.distanceMeters ?? null,
              path: r.path || r.legs?.flatMap((l) => l.path || []) || [],
              transitSteps: travelMode === "TRANSIT" ? parseTransitStepsFromRoute(r) : null
            };
          }
        } catch (_) {}
      }

      if (state.libs.DirectionsService) {
        try {
          const ds = new state.libs.DirectionsService();
          const dirRes = await new Promise((resolve) => {
            ds.route(
              {
                origin,
                destination,
                travelMode: travelMode === "TRANSIT" ? "TRANSIT" : "WALKING"
              },
              (result, status) => {
                if (status === "OK" && result?.routes?.[0]) {
                  resolve(result.routes[0]);
                } else {
                  resolve(null);
                }
              }
            );
          });

          if (dirRes && dirRes.legs && dirRes.legs[0]) {
            const leg = dirRes.legs[0];
            const durMs = typeof leg.duration?.value === "number" ? leg.duration.value * 1000 : null;
            const distM = typeof leg.distance?.value === "number" ? leg.distance.value : null;
            const path = (dirRes.overview_path || []).map(extractLatLngLiteral).filter(Boolean);
            return {
              rawRoute: null,
              durationMillis: durMs,
              distanceMeters: distM,
              path,
              transitSteps: travelMode === "TRANSIT" ? parseTransitStepsFromDirectionsLeg(leg) : null
            };
          }
        } catch (_) {}
      }

      if (travelMode === "WALKING") {
        try {
          const coords = `${origin.lng.toFixed(6)},${origin.lat.toFixed(6)};${destination.lng.toFixed(6)},${destination.lat.toFixed(6)}`;
          const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json();
            const r0 = data.routes && data.routes[0];
            if (r0 && typeof r0.distance === "number") {
              const geoCoords = r0.geometry?.coordinates || [];
              const path = geoCoords.map((pt) => ({ lat: pt[1], lng: pt[0] }));
              const realisticWalkMs = Math.max(
                typeof r0.duration === "number" ? r0.duration * 1000 : 0,
                Math.round((r0.distance / 1.25) * 1000)
              );
              return {
                rawRoute: null,
                durationMillis: realisticWalkMs,
                distanceMeters: Math.round(r0.distance),
                path,
                transitSteps: null
              };
            }
          }
        } catch (_) {}
      }

      return null;
    }

    function decodeEncodedPolyline(encoded) {
      if (!encoded || typeof encoded !== "string") return [];
      const poly = [];
      let index = 0;
      const len = encoded.length;
      let lat = 0;
      let lng = 0;

      while (index < len) {
        let b;
        let shift = 0;
        let result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20 && index < len);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20 && index < len);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
      }
      return poly;
    }

    function parseTransitStepsFromRoute(routeObj) {
      const stepsSummary = [];
      const legs = routeObj?.legs || [];
      legs.forEach((leg) => {
        const steps = leg.steps || [];
        steps.forEach((step) => {
          const stepMode = step.travelMode || "";
          const td = step.transitDetails;
          const stepDurMs =
            step.durationMillis ||
            step.staticDurationMillis ||
            parseProtoDurationMs(step.staticDuration) ||
            parseProtoDurationMs(step.duration);

          if (td) {
            const line = td.transitLine || {};
            const vehicleType = line.vehicle?.type || "";
            const vehicleNameRaw = line.vehicle?.name?.text || line.vehicle?.name || "";
            const vehicleKo =
              (typeof vehicleNameRaw === "string" && vehicleNameRaw) ||
              VEHICLE_KO_LABELS[vehicleType] ||
              "대중교통";
            const lineName = line.nameShort || line.name || vehicleKo;
            const depStop = td.stopDetails?.departureStop?.name || "출발 정류장";
            const arrStop = td.stopDetails?.arrivalStop?.name || "도착 정류장";
            const stopCount = typeof td.stopCount === "number" ? `${td.stopCount}개 역/정류장 이동` : "";
            const headsign = td.headsign ? `(${td.headsign} 방면)` : "";

            stepsSummary.push({
              type: "TRANSIT",
              badge: `${vehicleKo} ${lineName}`.trim(),
              text: `${depStop} → ${arrStop} ${headsign}`.trim(),
              sub: [stopCount, formatDuration(stepDurMs)].filter(Boolean).join(" · ")
            });
          } else if (stepMode === "WALKING" || stepMode === "WALK") {
            const dist = typeof step.distanceMeters === "number" ? step.distanceMeters : 0;
            if (dist >= 20 || stepDurMs) {
              stepsSummary.push({
                type: "WALKING",
                badge: "도보 구간",
                text: `도보 이동${dist ? " (" + formatDistance(dist) + ")" : ""}`,
                sub: formatDuration(stepDurMs)
              });
            }
          }
        });
      });

      const merged = [];
      for (const s of stepsSummary) {
        const prev = merged[merged.length - 1];
        if (prev && prev.type === "WALKING" && s.type === "WALKING") {
          prev.text = "도보 환승/이동 구간";
        } else {
          merged.push(s);
        }
      }
      return merged;
    }

    function parseTransitStepsFromDirectionsLeg(leg) {
      const stepsSummary = [];
      const steps = leg?.steps || [];
      steps.forEach((step) => {
        const mode = step.travel_mode || "";
        const t = step.transit;
        const stepDurMs = typeof step.duration?.value === "number" ? step.duration.value * 1000 : null;
        const distM = typeof step.distance?.value === "number" ? step.distance.value : 0;

        if (t) {
          const line = t.line || {};
          const vType = line.vehicle?.type || "";
          const vehicleKo = line.vehicle?.name || VEHICLE_KO_LABELS[vType] || "대중교통";
          const lineName = line.short_name || line.name || vehicleKo;
          const depStop = t.departure_stop?.name || "출발역";
          const arrStop = t.arrival_stop?.name || "도착역";
          const stopCount = typeof t.num_stops === "number" ? `${t.num_stops}개 역/정류장 이동` : "";
          const headsign = t.headsign ? `(${t.headsign} 방면)` : "";

          stepsSummary.push({
            type: "TRANSIT",
            badge: `${vehicleKo} ${lineName}`.trim(),
            text: `${depStop} → ${arrStop} ${headsign}`.trim(),
            sub: [stopCount, formatDuration(stepDurMs)].filter(Boolean).join(" · ")
          });
        } else if (mode === "WALKING" && (distM >= 20 || stepDurMs)) {
          stepsSummary.push({
            type: "WALKING",
            badge: "도보 구간",
            text: `도보 이동${distM ? " (" + formatDistance(distM) + ")" : ""}`,
            sub: formatDuration(stepDurMs)
          });
        }
      });
      return stepsSummary;
    }

    function drawRouteDataOnMap(routeData, travelMode, originCoords = null, destCoords = null, fitRouteBounds = true) {
      if (!state.map || !routeData) return;
      clearActivePolylines();

      let drawn = false;
      try {
        if (routeData.rawRoute && typeof routeData.rawRoute.createPolylines === "function") {
          const polylines = routeData.rawRoute.createPolylines();
          if (Array.isArray(polylines) && polylines.length > 0) {
            polylines.forEach((pl) => {
              pl.setMap(state.map);
              state.activePolylines.push(pl);
            });
            drawn = true;
          }
        }
      } catch (_) {}

      const pathCoords = Array.isArray(routeData.path) && routeData.path.length > 0
        ? routeData.path
        : (originCoords && destCoords ? [originCoords, destCoords] : []);

      if (!drawn && pathCoords.length > 0) {
        // 외곽선(가시성 향상용 흰색 테두리) + 메인 경로선 2중 렌더링으로 지도 위에서 경로가 선명하게 보이도록 처리
        const outlinePoly = new google.maps.Polyline({
          path: pathCoords,
          map: state.map,
          strokeColor: "#ffffff",
          strokeOpacity: 0.9,
          strokeWeight: 8,
          zIndex: 400
        });
        const mainPoly = new google.maps.Polyline({
          path: pathCoords,
          map: state.map,
          strokeColor: travelMode === "TRANSIT" ? "#059669" : "#2563eb",
          strokeOpacity: 0.95,
          strokeWeight: 5,
          zIndex: 401
        });
        state.activePolylines.push(outlinePoly, mainPoly);
      }

      // 출발지와 목적지, 경로 전체가 지도 화면 한눈에 들어오도록 자동 줌/바운드 맞춤
      if (fitRouteBounds && state.libs.LatLngBounds && pathCoords.length > 0) {
        try {
          const bounds = new state.libs.LatLngBounds();
          if (originCoords) bounds.extend(originCoords);
          if (destCoords) bounds.extend(destCoords);
          pathCoords.forEach((pt) => {
            if (pt && typeof pt.lat === "number" && typeof pt.lng === "number") {
              bounds.extend(pt);
            }
          });
          state.isProgrammaticPan = true;
          state.map.fitBounds(bounds, { top: 115, right: 40, bottom: 40, left: 40 });
        } catch (_) {}
      }
    }

    function clearActivePolylines() {
      state.activePolylines.forEach((pl) => {
        if (pl && typeof pl.setMap === "function") pl.setMap(null);
      });
      state.activePolylines = [];
    }

    function updateMapRouteBadge(text, activeMode) {
      const badge = $("mapRouteBadge");
      $("mapRouteSummaryText").textContent = text;
      $("btnMapRouteWalk").classList.toggle("active", activeMode === "WALKING");
      $("btnMapRouteTransit").classList.toggle("active", activeMode === "TRANSIT");
      badge.classList.add("visible");
    }

    async function switchSelectedPlaceRouteMode(mode) {
      state.activeRouteMode = mode;
      const selected = state.places.find((p) => p.id === state.selectedPlaceId);
      if (selected) {
        await computeAndDisplaySingleRoute(selected, mode);
        if (mode === "TRANSIT") {
          selected.drawerOpen = true;
          renderPlacesListAndMarkers(false);
        }
      }
    }

// =========================================================================
    // [9] 여행 코스(Day 1~3 일자별 관리 + 한 줄 메모 + 최단거리/시간·업종 맞춤 최적화)
    // =========================================================================
    function getCurrentDayTripList() {
      return state.tripList.filter((item) => (item.day || 1) === state.currentTripDay);
    }

    function togglePlaceInTrip(place) {
      const idx = state.tripList.findIndex((item) => item.id === place.id);
      if (idx >= 0) {
        const removed = state.tripList.splice(idx, 1)[0];
        showBanner(`'${removed.name}' 장소를 여행 코스에서 제외했습니다.`, "info");
      } else {
        state.tripList.push({
          ...place,
          day: state.currentTripDay || 1,
          memo: ""
        });
        showBanner(`'${place.name}' 장소를 [Day ${state.currentTripDay}] 여행 코스에 추가했습니다!`, "info");
      }

      saveTripListToStorage();
      $("tripCountBadge").textContent = String(state.tripList.length);
      updateRestoreBarText();
      state.tripOptimizationLabel = "";
      renderPlacesListAndMarkers(false);
      calculateAndRenderTripCourse(false);
    }

    function setTripTravelMode(mode) {
      state.tripTravelMode = mode;
      $("btnTripModeWalk").classList.toggle("active", mode === "WALKING");
      $("btnTripModeTransit").classList.toggle("active", mode === "TRANSIT");
      state.tripOptimizationLabel = "";
      calculateAndRenderTripCourse(true);
    }

    function moveTripStop(dayLocalIdx, direction) {
      const dayItems = getCurrentDayTripList();
      const targetLocalIdx = dayLocalIdx + direction;
      if (targetLocalIdx < 0 || targetLocalIdx >= dayItems.length) return;

      const itemA = dayItems[dayLocalIdx];
      const itemB = dayItems[targetLocalIdx];
      const globalIdxA = state.tripList.findIndex((x) => x.id === itemA.id);
      const globalIdxB = state.tripList.findIndex((x) => x.id === itemB.id);
      if (globalIdxA < 0 || globalIdxB < 0) return;

      const temp = state.tripList[globalIdxA];
      state.tripList[globalIdxA] = state.tripList[globalIdxB];
      state.tripList[globalIdxB] = temp;

      saveTripListToStorage();
      state.tripOptimizationLabel = `Day ${state.currentTripDay} 사용자 지정 방문 순서`;
      calculateAndRenderTripCourse(true);
    }

    function removeTripStop(placeId) {
      const idx = state.tripList.findIndex((x) => x.id === placeId);
      if (idx < 0) return;
      state.tripList.splice(idx, 1);
      saveTripListToStorage();
      $("tripCountBadge").textContent = String(state.tripList.length);
      updateRestoreBarText();
      state.tripOptimizationLabel = "";
      renderPlacesListAndMarkers(false);
      calculateAndRenderTripCourse(false);
    }

    async function calculateAndRenderTripCourse(drawOnMap = false) {
      renderTripPanel();
      const dayList = getCurrentDayTripList();
      if (dayList.length === 0) {
        state.tripLegMetrics = [];
        state.tripTotalDurationMs = null;
        state.tripTotalDistanceM = null;
        renderTripPanel();
        return;
      }

      const startOrigin = state.searchOrigin || state.currentLocation;
      const nodes = [];
      if (startOrigin) {
        nodes.push({
          id: "__USER_ORIGIN__",
          name: state.searchOriginLabel || "출발 기준 위치",
          location: startOrigin,
          isOrigin: true
        });
      }
      dayList.forEach((p) => nodes.push(p));

      if (nodes.length < 2) {
        state.tripLegMetrics = [];
        state.tripTotalDurationMs = 0;
        state.tripTotalDistanceM = 0;
        renderTripPanel();
        return;
      }

      if (drawOnMap) clearActivePolylines();

      const legMetrics = [];
      let totalDuration = 0;
      let totalDistance = 0;
      let hasAllDurations = true;

      for (let i = 0; i < nodes.length - 1; i++) {
        const fromNode = nodes[i];
        const toNode = nodes[i + 1];
        try {
          const rData = await fetchSingleRouteNewApi(fromNode.location, toNode.location, state.tripTravelMode);
          if (rData && typeof rData.durationMillis === "number") {
            legMetrics.push({
              fromName: fromNode.name,
              toName: toNode.name,
              durationMs: rData.durationMillis,
              distanceM: rData.distanceMeters ?? null,
              status: "OK"
            });
            totalDuration += rData.durationMillis;
            totalDistance += rData.distanceMeters || 0;

            if (drawOnMap && rData.path && rData.path.length > 0 && state.map) {
              const poly = new google.maps.Polyline({
                path: rData.path,
                map: state.map,
                strokeColor: state.tripTravelMode === "TRANSIT" ? "#059669" : "#2563eb",
                strokeOpacity: 0.9,
                strokeWeight: 5
              });
              state.activePolylines.push(poly);
            }
          } else {
            hasAllDurations = false;
            legMetrics.push({
              fromName: fromNode.name,
              toName: toNode.name,
              durationMs: null,
              distanceM: null,
              status: "NO_ROUTE"
            });
          }
        } catch (_) {
          hasAllDurations = false;
          legMetrics.push({
            fromName: fromNode.name,
            toName: toNode.name,
            durationMs: null,
            distanceM: null,
            status: "NO_ROUTE"
          });
        }
      }

      state.tripLegMetrics = legMetrics;
      state.tripTotalDurationMs = totalDuration;
      state.tripTotalDistanceM = totalDistance;
      state.tripHasIncompleteLegs = !hasAllDurations;

      renderTripPanel();
    }

    // 업종별 권장 방문 시간대 우선순위 (1: 오전 명소/공원 -> 2: 점심 식당 -> 3: 오후 카페/디저트/쇼핑 -> 4: 저녁 식당 -> 5: 야시장/바/스파)
    function getPlaceTimeSlotPriority(place) {
      const t = String(place.primaryType || "").toLowerCase();
      const label = String(place.categoryLabel || "");
      const name = String(place.name || "");
      const combined = `${t} ${label} ${name}`;

      if (/(night_market|bar|pub|izakaya|야시장|야경|전망대|바|펍|이자카야|포차|루프탑|spa|massage|스파|마사지)/i.test(combined)) {
        return 5; // 밤·야간 코스
      }
      if (/(cafe|coffee|bakery|dessert|ice_cream|카페|커피|베이커리|디저트|빙수|소품|쇼핑|shopping|gift)/i.test(combined)) {
        return 3; // 오후 티타임·쇼핑
      }
      if (/(restaurant|식당|맛집|음식점|한식|중식|일식|양식|우육면|라멘|훠궈)/i.test(combined)) {
        return 2; // 식사
      }
      return 1; // 오전 관광명소·박물관·공원
    }

    async function optimizeTripCourse(optMode = "distance") {
      const dayList = getCurrentDayTripList();
      if (dayList.length < 2) {
        showBanner(`Day ${state.currentTripDay} 코스에 장소를 2개 이상 추가해 주세요.`, "info");
        return;
      }

      setLoading(true, `Day ${state.currentTripDay} 코스의 추천 방문 순서를 계산하는 중...`);
      try {
        const refOrigin = state.searchOrigin || state.currentLocation;
        const startPoint = refOrigin || dayList[0].location;
        let orderedDayList = [];

        if (optMode === "smart_time") {
          // [개선안 5-4] 시간대·업종 맥락(오전 명소 → 점심 맛집 → 오후 카페·쇼핑 → 저녁 식사 → 밤 야시장·바) + 근접성 결합 정렬
          const remaining = [...dayList];
          // 만약 식당이 2개 이상이면 하나는 점심(slot 2), 하나는 저녁(slot 4)으로 자동 배분!
          const restItems = remaining.filter((p) => getPlaceTimeSlotPriority(p) === 2);
          restItems.forEach((p, idx) => {
            p._tempSlot = idx === 0 ? 2 : 4;
          });
          remaining.forEach((p) => {
            if (!p._tempSlot) p._tempSlot = getPlaceTimeSlotPriority(p);
          });

          let currLoc = startPoint;
          while (remaining.length > 0) {
            const minSlot = Math.min(...remaining.map((p) => p._tempSlot));
            const sameSlotCandidates = remaining.filter((p) => p._tempSlot === minSlot);
            sameSlotCandidates.sort(
              (a, b) => computeHaversineMeters(currLoc, a.location) - computeHaversineMeters(currLoc, b.location)
            );
            const chosen = sameSlotCandidates[0];
            delete chosen._tempSlot;
            orderedDayList.push(chosen);
            currLoc = chosen.location;
            const rmIdx = remaining.findIndex((x) => x.id === chosen.id);
            if (rmIdx >= 0) remaining.splice(rmIdx, 1);
          }
          state.tripOptimizationLabel = `✨ Day ${state.currentTripDay} 시간대·업종 맞춤 정렬 완료 (명소→식사→카페→야경 순)`;
        } else {
          // 최단 거리 그리디(Nearest-Neighbor) 정렬
          const remaining = [...dayList];
          let currLoc = startPoint;
          while (remaining.length > 0) {
            remaining.sort(
              (a, b) => computeHaversineMeters(currLoc, a.location) - computeHaversineMeters(currLoc, b.location)
            );
            const chosen = remaining.shift();
            orderedDayList.push(chosen);
            currLoc = chosen.location;
          }
          state.tripOptimizationLabel = `📍 Day ${state.currentTripDay} 최단 이동 거리순 정렬 완료`;
        }

        const otherDays = state.tripList.filter((item) => (item.day || 1) !== state.currentTripDay);
        state.tripList = [...otherDays, ...orderedDayList];

        saveTripListToStorage();
        await calculateAndRenderTripCourse(true);
        showBanner(state.tripOptimizationLabel, "info");
      } catch (err) {
        console.error("여행 코스 추천 순서 계산 실패:", err);
        showBanner("추천 방문 순서를 계산하지 못했습니다. 수동으로 순서를 조정해 주세요.", "error");
      } finally {
        setLoading(false);
      }
    }

    function renderTripPanel() {
      const stopsListEl = $("tripStopsList");
      const metricsBox = $("tripMetricsBox");
      const optNoteEl = $("tripOptNote");
      const gmapsBtn = $("btnOpenTripGoogleMaps");

      $("tripCountBadge").textContent = String(state.tripList.length);
      updateRestoreBarText();

      // 각 Day 탭에 담긴 장소 개수 표시 업데이트
      document.querySelectorAll("#tripDayTabs .trip-day-btn").forEach((btn) => {
        const dNum = Number(btn.dataset.day) || 1;
        const cnt = state.tripList.filter((it) => (it.day || 1) === dNum).length;
        btn.textContent = `🗓️ Day ${dNum}${cnt > 0 ? ` (${cnt})` : ""}`;
        btn.classList.toggle("active", dNum === state.currentTripDay);
      });

      const dayList = getCurrentDayTripList();
      gmapsBtn.href = buildGoogleMapsTripUrl(dayList);

      if (dayList.length === 0) {
        metricsBox.innerHTML = `<strong>[Day ${state.currentTripDay}]</strong>에 담긴 장소가 없습니다. 장소 카드 우측 상단의 <strong>+코스</strong> 버튼을 눌러 장소를 담아보세요.`;
        optNoteEl.textContent = "";
        stopsListEl.innerHTML = "";
        return;
      }

      const startOrigin = state.searchOrigin || state.currentLocation;
      const modeLabel = state.tripTravelMode === "TRANSIT" ? "🚌 대중교통" : "🚶 도보";
      if (state.tripTotalDurationMs !== null && dayList.length >= 1) {
        const totalDurText =
          state.tripTotalDurationMs > 0 ? formatDuration(state.tripTotalDurationMs) : "0분";
        const totalDistText =
          state.tripTotalDistanceM > 0 ? ` · 총 이동거리 ${formatDistance(state.tripTotalDistanceM)}` : "";
        metricsBox.innerHTML = `
          <div><strong>[Day ${state.currentTripDay}] ${modeLabel} 예상 이동 시간: ${totalDurText}</strong>${totalDistText}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">총 ${dayList.length}개 방문 장소${startOrigin ? ` (${state.searchOriginLabel} 출발 기준)` : ""}</div>
        `;
      } else {
        metricsBox.innerHTML = `<div><strong>[Day ${state.currentTripDay}] 총 ${dayList.length}개 방문 장소</strong>가 저장되었습니다.</div>`;
      }

      optNoteEl.textContent = state.tripOptimizationLabel || "";

      stopsListEl.innerHTML = "";
      const hasOrigin = Boolean(startOrigin);

      if (hasOrigin && state.tripLegMetrics[0]) {
        const firstLeg = state.tripLegMetrics[0];
        const legDiv = document.createElement("div");
        legDiv.className = "trip-leg-connector";
        legDiv.textContent =
          firstLeg.status === "OK"
            ? `📍 기준 위치 → 1번째 장소: ${modeLabel} ${formatDuration(firstLeg.durationMs)}${
                firstLeg.distanceM ? " (" + formatDistance(firstLeg.distanceM) + ")" : ""
              }`
            : `📍 기준 위치 → 1번째 장소: 도보 또는 대중교통 이동`;
        stopsListEl.appendChild(legDiv);
      }

      dayList.forEach((place, idx) => {
        const card = document.createElement("div");
        card.className = "trip-stop-card";
        const singleDirUrl = buildGoogleMapsDirectionsUrl(place, state.tripTravelMode);

        card.innerHTML = `
          <div class="trip-stop-row">
            <div class="trip-stop-title">
              <span class="place-index-badge">${idx + 1}</span>
              <div>
                <div>${escapeHtml(place.name)}</div>
                <div style="font-size:11.5px; color:var(--text-muted); font-weight:500;">${escapeHtml(place.categoryLabel)}${typeof place.rating === "number" ? ` · ★${place.rating.toFixed(1)}` : ""}</div>
              </div>
            </div>
            <div class="trip-stop-controls">
              <button type="button" class="btn-mini" data-move="up" ${idx === 0 ? "disabled" : ""} aria-label="위로 이동">▲</button>
              <button type="button" class="btn-mini" data-move="down" ${idx === dayList.length - 1 ? "disabled" : ""} aria-label="아래로 이동">▼</button>
              <a href="${singleDirUrl}" target="_blank" rel="noopener noreferrer" class="btn-mini" style="text-decoration:none; display:inline-flex; align-items:center;">길찾기↗</a>
              <button type="button" class="btn-mini danger" data-remove="true" aria-label="목록에서 삭제">삭제</button>
            </div>
          </div>
          <input
            type="text"
            class="trip-memo-input"
            placeholder="📝 메모 입력 (예: 12시 점심 예약, 대표 메뉴 주문)"
            value="${escapeHtml(place.memo || "")}"
          />
        `;

        card.querySelector('[data-move="up"]').addEventListener("click", () => moveTripStop(idx, -1));
        card.querySelector('[data-move="down"]').addEventListener("click", () => moveTripStop(idx, 1));
        card.querySelector('[data-remove="true"]').addEventListener("click", () => removeTripStop(place.id));

        const memoInput = card.querySelector(".trip-memo-input");
        if (memoInput) {
          memoInput.addEventListener("change", (e) => {
            place.memo = e.target.value.trim();
            saveTripListToStorage();
          });
        }

        stopsListEl.appendChild(card);

        const legMetricIdx = hasOrigin ? idx + 1 : idx;
        if (idx < dayList.length - 1 && state.tripLegMetrics[legMetricIdx]) {
          const leg = state.tripLegMetrics[legMetricIdx];
          const legDiv = document.createElement("div");
          legDiv.className = "trip-leg-connector";
          legDiv.textContent =
            leg.status === "OK"
              ? `↓ 다음 장소까지 ${modeLabel} ${formatDuration(leg.durationMs)}${
                  leg.distanceM ? " (" + formatDistance(leg.distanceM) + ")" : ""
                }`
              : `↓ 다음 장소까지 도보/대중교통 이동`;
          stopsListEl.appendChild(legDiv);
        }
      });
    }

    // [10] Google 지도 공식 링크 생성 (아이폰 Safari 호환 Universal URLs)
    // =========================================================================
    function buildGoogleMapsPlaceUrl(place) {
      if (!place) return "https://www.google.com/maps";
      if (place.googleMapsURI) {
        return sanitizeUrl(place.googleMapsURI);
      }

      const candidateId = place.googlePlaceId || place.id || "";
      const isGooglePlaceId =
        candidateId &&
        !candidateId.startsWith("osm_") &&
        !candidateId.startsWith("nom_") &&
        !candidateId.startsWith("geo_") &&
        !candidateId.startsWith("my_") &&
        !candidateId.startsWith("leg_") &&
        !candidateId.startsWith("photon_") &&
        !candidateId.startsWith("wiki_");

      // 1순위: 검증된 Google Place ID가 있으면 공식 query_place_id URL로 구글지도의 실제 장소 상세 페이지(리뷰·사진·영업시간) 열기
      if (isGooglePlaceId) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(candidateId)}`;
      }

      // 2순위: Place ID가 없는 경우, 좌표(@위도,경도 또는 ?q=위도,경도)를 넣으면 아이폰 구글지도 앱이 해당 좌표의 도로명('해돋이로' 등)이나 좌표 핀을 띄우므로,
      // 반드시 공식 Universal Search URL(?api=1&query=상호명 + 동/구 지역명)을 사용하여 해당 매장이 직접 검색되도록 처리!
      let areaHint = "";
      if (place.address) {
        const addrMatch = String(place.address).match(/([가-힣]+(시|군|구|동|읍|면))/g);
        if (addrMatch && addrMatch.length > 0) {
          areaHint = " " + addrMatch.slice(0, 2).join(" ");
        }
      }
      const queryStr = `${place.name || "장소"}${areaHint}`.trim();
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
    }

    function buildGoogleMapsDirectionsUrl(place, modeOverride = null, originOverride = null) {
      if (!place || !place.location) return "https://www.google.com/maps";
      const mode = (modeOverride || state.activeRouteMode || "TRANSIT").toLowerCase();
      const travelmode = mode === "walking" ? "walking" : "transit";

      const candidateId = place.googlePlaceId || place.id || "";
      const isGooglePlaceId =
        candidateId &&
        !candidateId.startsWith("osm_") &&
        !place.id.startsWith("nom_") &&
        !place.id.startsWith("geo_") &&
        !place.id.startsWith("my_") &&
        !place.id.startsWith("leg_") &&
        !place.id.startsWith("photon_") &&
        !place.id.startsWith("wiki_");

      // 목적지(destination) 파라미터 핵심 수정:
      // 구글 공식 규격: destination_place_id를 넘길 때는 destination에 장소명을 넘겨야 하며,
      // 좌표로 길을 찾을 때는 comma(,)를 절대 %2C로 인코딩하지 않고 순수 comma(lat,lng)로 전달해야
      // 구글 지도 앱에서 엉뚱한 주소나 다른 장소로 튀는 문제를 100% 방지함!
      let destParam = "";
      if (isGooglePlaceId) {
        destParam = `destination=${encodeURIComponent(place.name)}&destination_place_id=${encodeURIComponent(candidateId)}`;
      } else {
        destParam = `destination=${place.location.lat},${place.location.lng}`;
      }

      // 출발지(origin) 결정:
      // 1) 명시적 originOverride가 있는 경우 우선 적용
      // 2) 사용자가 [출발: 📍내위치]를 선택한 경우 state.currentLocation 적용
      // 3) 기본값은 현재 설정된 기준점 (호텔 / 지도 중심 / 검색 장소)
      let refOrigin = state.searchOrigin || state.currentLocation;
      if (originOverride) {
        refOrigin = originOverride;
      } else if (state.routeOriginMode === "my_location" && state.currentLocation) {
        refOrigin = state.currentLocation;
      }

      // 만약 출발지와 목적지가 30m 이내로 사실상 동일한 경우(예: 숙소 카드에서 길찾기 누를 때),
      // 내 현재 위치(GPS)를 출발지로 자동 전환하여 숙소까지 찾아가는 길 안내!
      if (refOrigin && computeHaversineMeters(refOrigin, place.location) < 30 && state.currentLocation) {
        refOrigin = state.currentLocation;
      }

      const originParam = refOrigin
        ? `origin=${refOrigin.lat},${refOrigin.lng}&`
        : "";

      return `https://www.google.com/maps/dir/?api=1&${originParam}${destParam}&travelmode=${travelmode}`;
    }

    function buildNaverDirectionsUrl(place, originOverride = null) {
      let refOrigin = state.searchOrigin || state.currentLocation;
      if (originOverride) refOrigin = originOverride;
      else if (state.routeOriginMode === "my_location" && state.currentLocation) refOrigin = state.currentLocation;
      const dest = place.location;
      if (!refOrigin || !dest) return `https://map.naver.com/v5/search/${encodeURIComponent(place.name)}`;
      return `https://map.naver.com/v5/directions/${refOrigin.lng},${refOrigin.lat},${encodeURIComponent(state.searchOriginLabel || "출발지")}/${dest.lng},${dest.lat},${encodeURIComponent(place.name)}/-/transit`;
    }

    function buildKakaoDirectionsUrl(place, originOverride = null) {
      const dest = place.location;
      if (!dest) return `https://map.kakao.com/link/search/${encodeURIComponent(place.name)}`;
      return `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${dest.lat},${dest.lng}`;
    }

    function buildGoogleMapsTripUrl(customStopList = null) {
      const targetList = Array.isArray(customStopList) ? customStopList : getCurrentDayTripList();
      if (targetList.length === 0) {
        return "https://www.google.com/maps";
      }
      const mode = state.tripTravelMode === "TRANSIT" ? "transit" : "walking";
      if (targetList.length === 1) {
        return buildGoogleMapsDirectionsUrl(targetList[0], state.tripTravelMode);
      }

      const refOrigin = state.searchOrigin || state.currentLocation;
      const lastStop = targetList[targetList.length - 1];
      const originCoord = refOrigin
        ? `${refOrigin.lat},${refOrigin.lng}`
        : `${targetList[0].location.lat},${targetList[0].location.lng}`;

      if (mode === "transit") {
        const firstStop = targetList[0];
        return buildGoogleMapsDirectionsUrl(firstStop, "TRANSIT");
      }

      const waypointStops = refOrigin
        ? targetList.slice(0, -1)
        : targetList.slice(1, -1);

      const waypointsParam =
        waypointStops.length > 0
          ? `&waypoints=${waypointStops.map((s) => `${s.location.lat},${s.location.lng}`).join("|")}`
          : "";

      const destCoord = `${lastStop.location.lat},${lastStop.location.lng}`;
      return `https://www.google.com/maps/dir/?api=1&origin=${originCoord}&destination=${destCoord}${waypointsParam}&travelmode=${mode}`;
    }
