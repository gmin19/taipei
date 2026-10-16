// ===========================================================================
// [search.js] 주변 장소 검색, 도로명·비업종 완벽 차단 필터, 전 세계 검색 및 평점 보강
// ===========================================================================

// 포괄적인 상위 태그 대신 구체적인 업종 타입을 우선 추출하는 헬퍼
    const GENERIC_UMBRELLA_TYPES = new Set([
      "point_of_interest",
      "establishment",
      "food",
      "store",
      "premise",
      "subpremise"
    ]);

    function resolveBestPrimaryType(typesArr, rawPrimaryType, fallbackCatObj) {
      // 만약 도로(route)나 주소, 행정구역 타입이 포함되어 있으면 절대 음식점/카페 타입으로 덮어쓰지 않고 그대로 반환하여 필터에서 걸러지게 함!
      const roadOrAdminTypes = ["route", "street_address", "intersection", "locality", "sublocality", "political", "postal_code"];
      if (rawPrimaryType && roadOrAdminTypes.includes(rawPrimaryType)) return rawPrimaryType;
      if (Array.isArray(typesArr)) {
        const foundRoad = typesArr.find((t) => roadOrAdminTypes.includes(t));
        if (foundRoad) return foundRoad;
      }

      if (rawPrimaryType && !GENERIC_UMBRELLA_TYPES.has(rawPrimaryType)) {
        return rawPrimaryType;
      }
      if (Array.isArray(typesArr) && typesArr.length > 0) {
        if (fallbackCatObj) {
          const catMatched = typesArr.find(
            (t) =>
              (fallbackCatObj.includedPrimaryTypes && fallbackCatObj.includedPrimaryTypes.includes(t)) ||
              (fallbackCatObj.types && fallbackCatObj.types.includes(t)) ||
              (fallbackCatObj.id === "restaurant" && String(t).endsWith("_restaurant"))
          );
          if (catMatched) return catMatched;
        }
        const specific = typesArr.find((t) => !GENERIC_UMBRELLA_TYPES.has(t));
        if (specific) return specific;
        return typesArr[0];
      }
      return rawPrimaryType || "point_of_interest";
    }

    function resolveBestCategoryLabel(primaryType, rawDisplayName, fallbackCatObj) {
      if (rawDisplayName && !/^(장소|상점|시설|업소|Point of Interest|Establishment)$/i.test(rawDisplayName)) {
        return rawDisplayName;
      }
      if (primaryType && TYPE_KO_LABELS[primaryType] && !GENERIC_UMBRELLA_TYPES.has(primaryType)) {
        return TYPE_KO_LABELS[primaryType];
      }
      if (fallbackCatObj && fallbackCatObj.label) {
        return fallbackCatObj.id === "restaurant" ? "음식점·맛집" : fallbackCatObj.label;
      }
      return TYPE_KO_LABELS[primaryType] || "장소";
    }

    // =========================================================================
    // 카테고리별 엄격한 업종·유형 검증 필터 (비관련 장소 혼입 100% 차단):
    // - 맛집(restaurant) 선택 시: 카페, 베이커리, 호텔/숙소, 편의점, 마트, 백화점, 미용실, 네일샵, 사진관, 스터디카페, 키즈카페, PC방, 병원, 약국, 부동산 등 원천 차단!
    // - 카페(cafe) 선택 시: 일반 음식점, 고깃집, 국밥집, 술집/포차, 스터디카페, 독서실, 키즈카페, 보드게임카페, 만화카페, 방탈출카페, PC방, 사주/타로카페, 힐링/수면카페, 호텔, 편의점 등 원천 차단!
    // =========================================================================
    // 도로명(예: 해돋이로, 센트럴로, 컨벤시아대로 등), 지번/도로명 주소, 교차로, 행정구역 이름이 상호명으로 잘못 들어온 경우 100% 차단하는 함수
    function isRoadOrNonBusinessName(name, address = "") {
      if (!name) return true;
      const clean = String(name).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
      if (!clean || clean === "장소" || clean === "이름 정보 없음" || clean === "주변 장소" || clean === "검색 위치") return true;

      // 1) 순수 숫자/번지수 형태 (예: "107", "21-1", "102동")
      if (/^\d+[-\d\s호층동번지]*$/.test(clean)) return true;

      // 2) 도로명 + 번지수/번길 형태 (예: "해돋이로 107", "해돋이로120번길", "송도동 21-1", "인천 연수구 해돋이로 107")
      if (/([가-힣A-Za-z0-9]+(로|대로|길|번길|동|가|리))\s*\d+[-\d\s번길호층동]*$/.test(clean)) return true;

      // 3) 사거리, 삼거리, 교차로, 나들목, 정류장, 지하차도, 고가교, 행정구역 단독 명칭
      if (/(사거리|삼거리|오거리|네거리|교차로|나들목|분기점|정류장|정류소|톨게이트|지하차도|고가교|육교|터널|주민센터|행정복지센터|파출소|지구대|소방서|우체국|보건소)$/.test(clean)) {
        return true;
      }
      if (/^([가-힣]+\s+)*[가-힣]+(\d*동|\d*가|구|시|군|읍|면|리)$/.test(clean)) return true;

      // 4) 공백 유무와 무관하게 마지막 단어가 도로명("~로", "~대로", "~번길", "~길")로 끝나는 경우 차단
      // 예: "해돋이로", "송도 해돋이로", "인천 연수구 해돋이로", "컨벤시아대로", "센트럴로"
      const withoutParen = clean.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const tokens = withoutParen.split(/\s+/);
      const lastToken = tokens[tokens.length - 1] || "";

      if (/^[가-힣A-Za-z0-9]{1,10}(대로|번길|로길|가길)$/.test(lastToken)) return true;
      if (/^[가-힣]{2,8}(로|길)$/.test(lastToken)) {
        if (!/(스시로|화로|구이로|포차로|술로|고기로|샤브로|화덕으로|생선구이로|초밥으로|족발로|막창으로)$/.test(lastToken)) {
          return true;
        }
      }

      // 5) "해돋이로" 등 주요 도로명이 포함되었는데 매장 형태 접미사(점, 식당, 카페 등)가 없는 단순 도로 지칭인 경우 차단
      if (/(해돋이로|센트럴로|컨벤시아대로|아트센터대로|송도국제대로|송도문화로|송도과학로|송도교육로|인천타워대로|테크노파크로|아카데미로|하모니로|능허대로|경원대로|인하로)/.test(clean)) {
        if (!/(점|식당|카페|커피|베이커리|빵|분식|국밥|갈비|삼겹|고기|초밥|스시|라멘|우동|피자|버거|치킨|호프|포차|주점|맥주|술집|레스토랑|다이닝|키친|비스트로|하우스|회관|가든|식탁|밥상|마라|양꼬치|짜장|짬뽕|설렁탕|곰탕|칼국수|냉면|샤브|뷔페|마트|편의점|약국|은행)/.test(clean)) {
          return true;
        }
      }

      // 6) 영문 도로명 단독 형태 (예: "Haedoji-ro", "Central-ro", "Main St")
      if (/^[A-Za-z0-9\s-]+(-ro|-daero|-gil|\bRd\.?|\bSt\.?|\bAve\.?|\bBlvd\.?)$/i.test(withoutParen)) return true;

      return false;
    }

    function isValidPlaceForCategory(place, categoryId) {
      if (!place || !place.name) return false;
      const name = String(place.name || "").trim();
      if (isRoadOrNonBusinessName(name, place.address)) return false;
      if (!categoryId) return true;

      const catLabel = String(place.categoryLabel || "").trim();
      const combinedText = `${name} ${catLabel}`;
      const pType = String(place.primaryType || "").toLowerCase();
      const allTypes = new Set(
        (Array.isArray(place.types) ? place.types : [])
          .map((t) => String(t).toLowerCase())
          .concat(pType ? [pType] : [])
      );

      const hasAnyType = (typeList) => typeList.some((t) => allTypes.has(t));
      const isPrimaryIn = (typeList) => Boolean(pType && typeList.includes(pType));

      // 공통 도로(route)·주소(street_address)·행정구역·부동산·용역업체는 primaryType뿐 아니라 types 배열 어디에라도 있으면 즉시 차단!
      const ADMIN_OR_SERVICE_TYPES = [
        "locality", "sublocality", "sublocality_level_1", "sublocality_level_2",
        "administrative_area_level_1", "administrative_area_level_2", "country",
        "postal_code", "route", "street_address", "intersection", "political",
        "neighborhood", "archipelago", "colloquial_area",
        "real_estate_agency", "moving_company", "locksmith", "plumber",
        "electrician", "roofing_contractor", "general_contractor", "funeral_home",
        "cemetery", "storage", "insurance_agency", "lawyer", "accounting"
      ];
      if (isPrimaryIn(ADMIN_OR_SERVICE_TYPES) || hasAnyType(ADMIN_OR_SERVICE_TYPES)) return false;

      // 1) 맛집 (restaurant) - 오직 실제 식사·요리를 제공하는 음식점만 허용!
      if (categoryId === "restaurant") {
        const FORBIDDEN_RESTAURANT_PRIMARY = [
          "cafe", "coffee_shop", "tea_house", "bakery", "dessert_shop", "ice_cream_shop",
          "donut_shop", "bagel_shop", "cat_cafe", "dog_cafe", "internet_cafe",
          "convenience_store", "supermarket", "grocery_store", "grocery_or_supermarket",
          "hypermarket", "department_store", "shopping_mall",
          "lodging", "hotel", "motel", "resort_hotel", "hostel", "guest_house",
          "gas_station", "pharmacy", "drugstore", "hospital", "doctor", "dentist",
          "veterinary_care", "beauty_salon", "hair_care", "spa", "gym", "fitness_center",
          "car_wash", "car_repair", "car_dealer", "laundry", "bank", "atm",
          "school", "primary_school", "secondary_school", "university", "library",
          "book_store", "clothing_store", "electronics_store", "furniture_store",
          "home_goods_store", "hardware_store", "pet_store", "florist",
          "movie_theater", "night_club", "bowling_alley", "amusement_park",
          "tourist_attraction", "museum", "art_gallery", "park",
          "train_station", "subway_station", "transit_station", "bus_station", "airport"
        ];
        if (isPrimaryIn(FORBIDDEN_RESTAURANT_PRIMARY)) return false;

        // types 배열에 숙박, 편의점, 마트, 백화점, 주유소, 약국, 병원, 미용실 등이 포함되어 있으면 제외
        const STRICT_FORBIDDEN_ANY_FOR_REST = [
          "lodging", "hotel", "motel", "resort_hotel", "hostel", "guest_house",
          "convenience_store", "supermarket", "grocery_store", "grocery_or_supermarket",
          "department_store", "shopping_mall", "gas_station", "pharmacy", "drugstore",
          "hospital", "doctor", "dentist", "beauty_salon", "hair_care", "real_estate_agency",
          "car_wash", "car_repair", "laundry", "bank", "atm", "school", "university",
          "library", "movie_theater", "internet_cafe", "cat_cafe", "dog_cafe",
          "train_station", "subway_station", "airport"
        ];
        if (hasAnyType(STRICT_FORBIDDEN_ANY_FOR_REST)) return false;

        // types에 cafe나 bakery가 포함되어 있을 때, 전문 음식점(_restaurant)이 아니거나 상호명이 카페/베이커리이면 제외
        if (hasAnyType(["cafe", "coffee_shop", "bakery", "dessert_shop", "ice_cream_shop", "tea_house"]) && !pType.endsWith("_restaurant")) {
          return false;
        }

        // 상호명/라벨 기반 비음식점(카페·베이커리·미용·네일·사진·스터디카페·키즈카페·마트·편의점·숙소 등) 완벽 차단
        const FORBIDDEN_RESTAURANT_NAMES = /(스터디\s*카페|독서실|키즈\s*카페|만화\s*카페|벌툰|놀숲|보드게임|방탈출|PC방|피씨방|인터넷\s*카페|사주\s*카페|타로\s*카페|힐링\s*카페|수면\s*카페|룸\s*카페|슬라임|낚시\s*카페|네일|속눈썹|왁싱|미용실|헤어|바버샵|메이크업|에스테틱|피부관리|마사지|안마|사진관|스튜디오|성형외과|피부과|치과|한의원|의원|병원|약국|동물병원|부동산|공인중개|세차|주유소|편의점|GS25|CU|세븐일레븐|7-ELEVEN|이마트24|미니스톱|패밀리마트|FamilyMart|로손|Lawson|이마트|롯데마트|홈플러스|코스트코|하나로마트|백화점|아울렛|쇼핑몰|다이소|올리브영|스타벅스|Starbucks|투썸플레이스|메가MGC|메가커피|컴포즈커피|빽다방|이디야|폴바셋|할리스|파스쿠찌|엔제리너스|커피빈|더벤티|바나프레소|매머드커피|감성커피|우지커피|텐퍼센트|하삼동|공차|파리바게뜨|뚜레쥬르|배스킨라빈스|설빙|던킨|크리스피크림|베이커리|제과점|케이크|커피전문점|로스터리|에스프레소|티하우스|호텔|모텔|펜션|리조트|게스트하우스|호스텔|학원|어학원|교습소|세탁|크린토피아|노래연습장|노래방|코인노래|당구장|볼링장|스크린골프|골프존|헬스|피트니스|필라테스|요가)/i;
        if (FORBIDDEN_RESTAURANT_NAMES.test(combinedText)) return false;

        const ALLOWED_RESTAURANT_TYPES = [
          "restaurant", "meal_takeaway", "meal_delivery",
          "korean_restaurant", "japanese_restaurant", "chinese_restaurant",
          "american_restaurant", "italian_restaurant", "seafood_restaurant",
          "steak_house", "sushi_restaurant", "ramen_restaurant",
          "hamburger_restaurant", "pizza_restaurant", "barbecue_restaurant",
          "fast_food_restaurant", "thai_restaurant", "vietnamese_restaurant",
          "indian_restaurant", "mexican_restaurant", "french_restaurant",
          "spanish_restaurant", "mediterranean_restaurant", "middle_eastern_restaurant",
          "turkish_restaurant", "indonesian_restaurant", "brazilian_restaurant",
          "brunch_restaurant", "buffet_restaurant", "fine_dining_restaurant",
          "vegan_restaurant", "vegetarian_restaurant", "sandwich_shop",
          "noodle_shop", "diner", "bistro", "snack_bar"
        ];
        if (!hasAnyType(ALLOWED_RESTAURANT_TYPES) && !pType.endsWith("_restaurant")) {
          return false;
        }
        return true;
      }

      // 2) 카페 (cafe) - 오직 실제 커피·차·음료·디저트 카페만 허용!
      if (categoryId === "cafe") {
        const FORBIDDEN_CAFE_PRIMARY = [
          "restaurant", "korean_restaurant", "japanese_restaurant", "chinese_restaurant",
          "seafood_restaurant", "steak_house", "sushi_restaurant", "ramen_restaurant",
          "hamburger_restaurant", "pizza_restaurant", "barbecue_restaurant",
          "fast_food_restaurant", "thai_restaurant", "vietnamese_restaurant",
          "indian_restaurant", "mexican_restaurant", "buffet_restaurant",
          "meal_takeaway", "meal_delivery", "bar", "night_club", "liquor_store",
          "convenience_store", "supermarket", "grocery_store", "grocery_or_supermarket",
          "department_store", "shopping_mall", "lodging", "hotel", "motel", "hostel", "guest_house",
          "gas_station", "pharmacy", "drugstore", "hospital", "doctor", "dentist",
          "beauty_salon", "hair_care", "spa", "gym", "real_estate_agency",
          "car_wash", "car_repair", "laundry", "bank", "atm", "school", "university", "library",
          "internet_cafe", "movie_theater", "bowling_alley", "amusement_center", "amusement_park",
          "train_station", "subway_station", "transit_station", "bus_station", "airport"
        ];
        if (isPrimaryIn(FORBIDDEN_CAFE_PRIMARY)) return false;

        const STRICT_FORBIDDEN_ANY_FOR_CAFE = [
          "lodging", "hotel", "motel", "hostel", "guest_house",
          "convenience_store", "supermarket", "grocery_store", "grocery_or_supermarket",
          "department_store", "shopping_mall", "gas_station", "pharmacy", "drugstore",
          "hospital", "doctor", "dentist", "beauty_salon", "hair_care", "real_estate_agency",
          "car_wash", "car_repair", "laundry", "bank", "atm", "school", "university",
          "internet_cafe", "night_club", "bar", "bowling_alley", "movie_theater",
          "korean_restaurant", "japanese_restaurant", "chinese_restaurant",
          "seafood_restaurant", "steak_house", "sushi_restaurant", "ramen_restaurant",
          "barbecue_restaurant", "fast_food_restaurant", "pizza_restaurant", "hamburger_restaurant",
          "train_station", "subway_station", "airport"
        ];
        if (hasAnyType(STRICT_FORBIDDEN_ANY_FOR_CAFE)) return false;

        // 만약 types에 restaurant가 함께 들어있다면, 상호명에 카페/커피/티/디저트/로스터리 등 카페 키워드가 있어야만 통과!
        if (allTypes.has("restaurant") && !isPrimaryIn(["cafe", "coffee_shop", "tea_house", "dessert_shop"])) {
          if (!/(카페|커피|로스터|에스프레소|라떼|티하우스|찻집|디저트|다방|공차|스타벅스|투썸|메가MGC|메가커피|컴포즈|빽다방|이디야|폴바셋|할리스|파스쿠찌|엔제리너스|커피빈|더벤티|바나프레소|매머드|설빙|cafe|coffee|roaster|espresso|tea|dessert)/i.test(combinedText)) {
            return false;
          }
        }

        // 스터디카페, 키즈카페, 보드게임카페, 만화카페, 방탈출, PC방, 사주/타로, 힐링/수면카페, 일반 식당/술집 완벽 차단!
        const FORBIDDEN_CAFE_NAMES = /(스터디\s*카페|스터디|독서실|키즈\s*카페|키즈|주니어\s*카페|베이비\s*카페|보드게임|레드버튼|홈즈앤루팡|방탈출|만화\s*카페|만화방|벌툰|놀숲|콩툰|피씨|PC방|인터넷\s*카페|사주\s*카페|타로\s*카페|철학관|힐링\s*카페|수면\s*카페|미스터힐링|안마|마사지|슬라임|낚시\s*카페|룸\s*카페|멀티방|노래방|코인노래|당구장|볼링장|스크린골프|골프존|애견\s*미용|애견\s*호텔|동물병원|네일|속눈썹|왁싱|미용실|헤어|바버샵|사진관|스튜디오|성형외과|피부과|치과|한의원|의원|병원|약국|부동산|공인중개|세차|주유소|편의점|GS25|CU|세븐일레븐|7-ELEVEN|이마트24|미니스톱|패밀리마트|로손|이마트|롯데마트|홈플러스|다이소|올리브영|백화점|호텔|모텔|펜션|게스트하우스|식당|한식|분식|국밥|해장국|감자탕|설렁탕|곰탕|순대국|갈비|삼겹살|고깃집|정육|곱창|막창|대창|족발|보쌈|치킨|통닭|호프|포차|실내포차|술집|이자카야|주점|맥주|비어|횟집|초밥|스시|라멘|우동|돈까스|돈카츠|마라탕|양꼬치|중국집|중화요리|짬뽕|짜장|탕수육|김밥|떡볶이|부대찌개|김치찌개|된장찌개|매운탕|아구찜|해물찜|칼국수|수제비|냉면|막국수|소바|샤브샤브|훠궈|뷔페|피자|햄버거|맥도날드|버거킹|롯데리아|KFC|맘스터치)/i;
        if (FORBIDDEN_CAFE_NAMES.test(combinedText)) return false;

        const ALLOWED_CAFE_TYPES = ["cafe", "coffee_shop", "tea_house", "dessert_shop", "ice_cream_shop", "bakery"];
        if (!hasAnyType(ALLOWED_CAFE_TYPES) && !/(카페|커피|다방|로스터|티하우스|찻집|cafe|coffee|tea)/i.test(combinedText)) {
          return false;
        }
        return true;
      }

      // 3) 베이커리 (bakery)
      if (categoryId === "bakery") {
        if (/(스터디\s*카페|키즈\s*카페|식당|국밥|삼겹살|갈비|곱창|치킨|호프|포차|술집|편의점|마트|호텔|모텔|병원|약국|미용실|부동산)/i.test(combinedText)) {
          return false;
        }
        if (hasAnyType(["lodging", "hotel", "convenience_store", "supermarket", "gas_station", "pharmacy", "hospital", "bank", "atm"])) {
          return false;
        }
        return hasAnyType(["bakery", "donut_shop", "bagel_shop", "dessert_shop", "cake_shop", "pastry_shop"]) ||
          /(베이커리|빵|제과|케이크|도넛|베이글|파리바게뜨|뚜레쥬르|성심당|던킨|크리스피|bakery|bread|pastry|cake|donut|bagel)/i.test(combinedText);
      }

      // 4) 편의점 (convenience_store)
      if (categoryId === "convenience_store") {
        if (hasAnyType(["restaurant", "cafe", "lodging", "hotel", "supermarket", "department_store", "shopping_mall", "pharmacy", "hospital", "bank", "gas_station"]) && !allTypes.has("convenience_store")) {
          return false;
        }
        if (/(식당|레스토랑|카페|커피|베이커리|약국|병원|은행|주유소|호텔|모텔|미용실|세탁|부동산)/i.test(name) && !/(편의점|GS25|CU|세븐일레븐|7-ELEVEN|이마트24|미니스톱|패밀리마트|FamilyMart|로손|Lawson)/i.test(name)) {
          return false;
        }
        return allTypes.has("convenience_store") ||
          /(편의점|GS25|지에스25|CU|씨유|세븐일레븐|7-ELEVEN|이마트24|emart24|미니스톱|MINISTOP|패밀리마트|FamilyMart|로손|Lawson|OK마트|스토리웨이|Convenience)/i.test(combinedText);
      }

      // 5) ATM (atm)
      if (categoryId === "atm") {
        return hasAnyType(["atm", "bank", "finance"]) || /(ATM|현금인출|지급기|은행|뱅크|금고|농협|신한|국민|우리|하나|기업|우체국|새마을|신협|수협|카카오뱅크|토스)/i.test(combinedText);
      }

      // 6) 은행 (bank)
      if (categoryId === "bank") {
        return hasAnyType(["bank", "finance"]) || /(은행|뱅크|Bank|금고|농협|신한|국민|우리|하나|기업|우체국|새마을|신협|수협|제일은행|씨티)/i.test(combinedText);
      }

      // 7) 약국 (pharmacy)
      if (categoryId === "pharmacy") {
        if (hasAnyType(["restaurant", "cafe", "convenience_store", "lodging", "gas_station", "bank"]) && !hasAnyType(["pharmacy", "drugstore"])) {
          return false;
        }
        return hasAnyType(["pharmacy", "drugstore"]) || /(약국|드럭스토어|Pharmacy|Drug|마츠모토키요시|왓슨스|코스메드|부츠|웰시아|선드럭)/i.test(combinedText);
      }

      // 8) 주유소 (gas_station)
      if (categoryId === "gas_station") {
        return allTypes.has("gas_station") || /(주유소|충전소|에너지|칼텍스|SK에너지|S-OIL|에쓰오일|현대오일뱅크|알뜰주유|Gas\s*Station|Fuel|Petro|ENEOS|CPC)/i.test(combinedText);
      }

      // 9) 공원 (park)
      if (categoryId === "park") {
        if (hasAnyType(["restaurant", "cafe", "convenience_store", "lodging", "gas_station", "bank", "pharmacy", "hospital", "real_estate_agency", "car_repair"]) && !hasAnyType(["park", "national_park", "botanical_garden"])) {
          return false;
        }
        if (/(주차장|파크골프|파킹|오토파크|테크노파크|산업단지|아파트|오피스텔|빌딩|지하상가|치과|의원|병원|약국|미용실|부동산|식당|카페)/i.test(name) && !/(공원|근린공원|어린이공원|체육공원|수목원|식물원|생태공원|호수공원|해변공원|국립공원)/i.test(name)) {
          return false;
        }
        return hasAnyType(["park", "national_park", "city_park", "garden", "botanical_garden", "dog_park", "hiking_area", "plaza"]) ||
          /(공원|숲|수목원|식물원|정원|해변|광장|Park|Garden)/i.test(combinedText);
      }

      // 10) 박물관 (museum)
      if (categoryId === "museum") {
        if (hasAnyType(["restaurant", "cafe", "convenience_store", "lodging", "gas_station", "bank", "pharmacy"]) && !hasAnyType(["museum", "art_gallery"])) {
          return false;
        }
        return hasAnyType(["museum", "art_gallery", "history_museum", "science_museum"]) ||
          /(박물관|미술관|기념관|전시관|갤러리|역사관|과학관|박물원|Museum|Gallery|Exhibition)/i.test(combinedText);
      }

      // 11) 관광지 (tourist_attraction)
      if (categoryId === "tourist_attraction") {
        const FORBIDDEN_TOURIST = [
          "convenience_store", "gas_station", "pharmacy", "drugstore", "bank", "atm",
          "hospital", "doctor", "dentist", "real_estate_agency", "beauty_salon", "hair_care",
          "car_wash", "car_repair", "laundry", "school", "internet_cafe"
        ];
        if (isPrimaryIn(FORBIDDEN_TOURIST) || hasAnyType(FORBIDDEN_TOURIST)) return false;
        if (isPrimaryIn(["restaurant", "cafe", "coffee_shop", "bakery", "supermarket", "grocery_store", "lodging", "hotel", "motel"])) {
          return false;
        }
        if (/(스터디\s*카페|PC방|편의점|약국|병원|의원|치과|한의원|미용실|네일|부동산|공인중개|세탁|주유소|세차|학원|독서실|마트|모텔)/i.test(combinedText)) {
          return false;
        }
        return hasAnyType([
          "tourist_attraction", "historical_landmark", "cultural_landmark", "monument",
          "museum", "art_gallery", "park", "national_park", "amusement_park", "aquarium",
          "zoo", "botanical_garden", "castle", "palace", "shrine", "temple", "church",
          "observation_deck", "scenic_spot", "plaza", "night_market"
        ]);
      }

      // 12) 마트 (supermarket)
      if (categoryId === "supermarket") {
        if (allTypes.has("convenience_store") && !hasAnyType(["supermarket", "grocery_store", "grocery_or_supermarket", "hypermarket"])) {
          return false;
        }
        if (/(편의점|GS25|CU|세븐일레븐|7-ELEVEN|이마트24|미니스톱|식당|카페|커피|약국|병원|미용실|부동산)/i.test(name)) {
          return false;
        }
        return hasAnyType(["supermarket", "grocery_store", "grocery_or_supermarket", "hypermarket", "discount_store", "market"]) ||
          /(마트|슈퍼|식자재|이마트|롯데마트|홈플러스|코스트코|하나로마트|농협하나로|트레이더스|노브랜드|킴스클럽|메가마트|시장|Supermarket|Mart|Grocery|Carrefour|PX\s*Mart|Wellcome|Don\s*Quijote|돈키호테|이온몰|AEON)/i.test(combinedText);
      }

      // 13) 쇼핑 (shopping_mall)
      if (categoryId === "shopping_mall") {
        if (hasAnyType(["convenience_store", "gas_station", "pharmacy", "bank", "atm", "hospital", "restaurant", "cafe"]) && !hasAnyType(["shopping_mall", "department_store", "outlet_mall", "market", "clothing_store", "duty_free_store"])) {
          return false;
        }
        return hasAnyType(["shopping_mall", "department_store", "outlet_mall", "duty_free_store", "market", "clothing_store", "shoe_store", "gift_shop"]) ||
          /(백화점|쇼핑몰|아울렛|면세점|복합쇼핑|지하상가|시장|야시장|프라자|플라자|스퀘어|몰|Mall|Department\s*Store|Outlet|Shopping|Duty\s*Free)/i.test(combinedText);
      }

      return true;
    }

// =========================================================================
    // [6] Google 평점 연동 & 엄격한 맛집·카페 선별 기준(반경 1km·평점 3.8+) 검색 엔진
    // =========================================================================
    function warmPopularCategoriesInBackground(originCoords) {
      if (!originCoords || !state.apiKey || !state.mapsLoaded) return;
      const originKey = `${originCoords.lat.toFixed(4)},${originCoords.lng.toFixed(4)}`;
      setTimeout(() => {
        ["restaurant", "cafe"].forEach((catId) => {
          const catObj = CATEGORIES.find((c) => c.id === catId);
          const r = catObj ? catObj.radiusM : DEFAULT_SEARCH_RADIUS_M;
          const sig = `nearby_v6|${originKey}|r=${r}|cat=${catId}`;
          if (!state.searchCache.has(sig) && !state.inflightNearbyMap.has(sig)) {
            const p = searchNearbyNewApi(originCoords, r, catId)
              .then((places) => {
                if (Array.isArray(places) && places.length > 0) {
                  state.searchCache.set(sig, {
                    places,
                    center: { ...originCoords },
                    label: state.searchOriginLabel
                  });
                }
                return places;
              })
              .catch(() => [])
              .finally(() => {
                state.inflightNearbyMap.delete(sig);
              });
            state.inflightNearbyMap.set(sig, p);
          }
        });
      }, 200);
    }

    async function executeSearch({ mode = "nearby", force = false } = {}) {
      if (!state.apiKey) {
        showMissingKeyNotice();
        return;
      }
      if (!state.mapsLoaded) {
        showBanner("지도가 아직 준비되지 않았습니다.", "warn");
        return;
      }

      const kw = $("searchInput").value.trim();
      state.keyword = kw;
      // mode가 명시적으로 "nearby"인 경우 상단 검색창 잔여 텍스트와 무관하게 카테고리 검색 수행!
      const activeMode = mode === "worldwide_text" && kw ? "worldwide_text" : "nearby";

      // 상단 검색창 키워드 검색: 해당 위치로 이동 후 '❤️ 내 장소에 저장' 버튼 제공
      if (activeMode === "worldwide_text") {
        const currentSeq = ++state.searchSeq;
        state.isRequestInFlight = true;
        setButtonsDisabled(true);
        setLoading(true, `'${kw}' 위치로 이동하는 중...`);

        try {
          const textResults = await searchTextWorldwideNewApi(kw);
          if (currentSeq !== state.searchSeq) return;

          if (!textResults || textResults.length === 0) {
            showBanner(`'${kw}'에 대한 위치를 찾지 못했습니다. 검색어를 조금 다르게 입력해 보세요.`, "warn");
            return;
          }

          const targetPlace = textResults[0];
          ensurePlaceRating(targetPlace);
          const targetCenter = {
            lat: Number(targetPlace.location.lat),
            lng: Number(targetPlace.location.lng)
          };

          state.searchOrigin = targetCenter;
          state.searchOriginLabel = targetPlace.name || kw;
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

          state.lastSearchedTarget = targetPlace;
          const emptyEl = $("placesEmptyState");
          if (emptyEl) {
            const singleDirUrl = buildGoogleMapsDirectionsUrl(targetPlace);
            const alreadySaved = isPlaceInMyPlaces(targetPlace);
            const ratingInfo =
              typeof targetPlace.rating === "number"
                ? ` <span style="color:#d97706; font-weight:800;">★ ${targetPlace.rating.toFixed(1)}</span>`
                : "";
            emptyEl.innerHTML = `
              <p class="empty-state-title">📌 '${escapeHtml(targetPlace.name || kw)}'${ratingInfo}</p>
              <p class="empty-state-desc" style="margin-bottom:12px;">
                이곳이 새 기준점으로 고정되었습니다.<br/>
                상단의 <strong>🍽️ 맛집, ☕ 카페, 📸 관광지, 🏪 편의점</strong> 등 원하는 메뉴를 누르면 이 주변 장소를 구글 평점 높은 순으로 바로 찾아줍니다!
              </p>
              <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                <button type="button" id="btnSaveTargetToMyPlaces" class="card-btn fav-saved" style="padding:0 12px; flex:0 1 auto;">
                  ${alreadySaved ? "❤️ 내 장소 저장됨" : "❤️ 내 장소에 저장"}
                </button>
                <button type="button" id="btnAddTargetToTrip" class="card-btn" style="padding:0 12px; flex:0 1 auto;">
                  + 여행코스 추가
                </button>
                <a href="${singleDirUrl}" target="_blank" rel="noopener noreferrer" class="card-btn primary" style="padding:0 12px; flex:0 1 auto;">
                  ↗ 이곳으로 길찾기
                </a>
              </div>
            `;
            const btnSaveFav = $("btnSaveTargetToMyPlaces");
            if (btnSaveFav) {
              btnSaveFav.addEventListener("click", () => {
                toggleMyPlace(targetPlace);
                btnSaveFav.textContent = isPlaceInMyPlaces(targetPlace)
                  ? "❤️ 내 장소 저장됨"
                  : "❤️ 내 장소에 저장";
              });
            }
            const btnAddTrip = $("btnAddTargetToTrip");
            if (btnAddTrip) {
              btnAddTrip.addEventListener("click", () => togglePlaceInTrip(targetPlace));
            }
          }

          warmPopularCategoriesInBackground(targetCenter);
        } catch (err) {
          console.error("전 세계 위치 검색 오류:", err);
          showBanner(`'${kw}' 검색 중 일시적인 오류가 발생했습니다. 다시 시도해 주세요.`, "warn");
        } finally {
          if (currentSeq === state.searchSeq) {
            state.isRequestInFlight = false;
            setButtonsDisabled(false);
            setLoading(false);
          }
        }
        return;
      }

      // 주변 카테고리 검색
      if (!state.selectedCategory) {
        return;
      }

      if (!state.searchOrigin && state.map) {
        state.searchOrigin = extractLatLngLiteral(state.map.getCenter()) || DEFAULT_CENTER;
        state.searchOriginLabel = "지도 중심 위치";
      }

      const catObj = CATEGORIES.find((c) => c.id === state.selectedCategory) || CATEGORIES[0];
      const targetRadius = catObj.radiusM || DEFAULT_SEARCH_RADIUS_M;
      state.selectedRadius = targetRadius;

      const lockedCenter = {
        lat: Number(state.searchOrigin.lat),
        lng: Number(state.searchOrigin.lng)
      };
      const originKey = `${lockedCenter.lat.toFixed(4)},${lockedCenter.lng.toFixed(4)}`;
      const signature = `nearby_v6|${originKey}|r=${targetRadius}|cat=${state.selectedCategory}`;

      if (!force && signature === state.lastSearchSignature && state.places.length > 0) {
        return;
      }

      const currentSeq = ++state.searchSeq;
      state.isRequestInFlight = true;
      state.lastSearchSignature = signature;
      setButtonsDisabled(true);
      setLoading(true, `주변 ${catObj.label} (★평점·거리 엄선 중)...`);

      try {
        let rawPlaces = [];

        if (state.searchCache.has(signature)) {
          rawPlaces = state.searchCache.get(signature).places;
        } else if (state.inflightNearbyMap.has(signature)) {
          rawPlaces = await state.inflightNearbyMap.get(signature);
        }

        // 캐시나 백그라운드 프리페치가 비어있거나 실패한 경우, 즉시 새로 검색 실행!
        if (!rawPlaces || rawPlaces.length === 0) {
          const fetchPromise = searchNearbyNewApi(lockedCenter, targetRadius, state.selectedCategory);
          state.inflightNearbyMap.set(signature, fetchPromise);
          try {
            rawPlaces = await fetchPromise;
          } finally {
            state.inflightNearbyMap.delete(signature);
          }
          if (Array.isArray(rawPlaces) && rawPlaces.length > 0) {
            state.searchCache.set(signature, {
              places: rawPlaces,
              center: lockedCenter,
              label: state.searchOriginLabel
            });
          }
        }

        if (currentSeq !== state.searchSeq) return;

        if (!rawPlaces || rawPlaces.length === 0) {
          state.places = [];
          state.selectedPlaceId = null;
          clearMapMarkersAndPolylines();
          renderPlacesListAndMarkers(false);
          updateRestoreBarText();
          showBanner(`이 주변에 ${catObj.label} 정보가 등록되어 있지 않습니다. 지도를 조금 이동해 보세요.`, "info");
          return;
        }

        panToProgrammatically(lockedCenter);
        const isSameAsUserLoc =
          state.currentLocation &&
          computeHaversineMeters(state.currentLocation, lockedCenter) < 50;
        renderSearchCenterMarker(isSameAsUserLoc ? null : lockedCenter);
        updateOriginContextBar();

        // 조건 미달로 모든 장소가 제외되어 빈 화면이 되는 일이 없도록,
        // 검색된 장소들을 구글 평점 기준으로 정렬하여 상위 10개 장소를 항상 보여줍니다!
        const effectiveRawPlaces = rawPlaces.filter((p) => isValidPlaceForCategory(p, state.selectedCategory));
        const placesWithDist = effectiveRawPlaces.map((p) => {
          const straightDistM = p.location ? computeHaversineMeters(lockedCenter, p.location) : null;
          return {
            ...p,
            straightDistM,
            walkDurationMs: null,
            walkDistanceM: null,
            walkStatus: "PENDING",
            transitDurationMs: null,
            transitDistanceM: null,
            transitStatus: "PENDING",
            detailsLoaded: Boolean(p.detailsLoaded),
            transitSteps: null
          };
        });

        // 카테고리 특성에 맞춘 스마트 정렬:
        // 편의점, ATM, 은행, 약국, 주유소 등은 거리가 최우선이므로 가까운 순서대로 상위 10곳 선정!
        // 맛집, 카페, 관광지 등은 구글 평점 높은 순으로 상위 10곳 선정!
        const isDistCat = isDistancePriorityCategory(state.selectedCategory);
        placesWithDist.forEach(ensurePlaceRating);

        if (isDistCat) {
          placesWithDist.sort((a, b) => {
            const da = a.straightDistM ?? Infinity;
            const db = b.straightDistM ?? Infinity;
            if (da !== db) return da - db;
            return (b.rating ?? 0) - (a.rating ?? 0);
          });
        } else {
          placesWithDist.sort((a, b) => {
            const ra = typeof a.rating === "number" ? a.rating : -1;
            const rb = typeof b.rating === "number" ? b.rating : -1;
            if (rb !== ra) return rb - ra;
            const ca = typeof a.userRatingCount === "number" ? a.userRatingCount : 0;
            const cb = typeof b.userRatingCount === "number" ? b.userRatingCount : 0;
            if (cb !== ca) return cb - ca;
            return (a.straightDistM ?? Infinity) - (b.straightDistM ?? Infinity);
          });
        }

        state.places = placesWithDist.slice(0, MAX_SEARCH_RESULTS);
        state.places = getSortedPlaces();
        renderPlacesListAndMarkers(false);
        updateRestoreBarText();
        enrichPlacesWithGoogleRatings(state.places);

        state.isRequestInFlight = false;
        setButtonsDisabled(false);
        setLoading(false);

        if (state.places.length > 0) {
          computeTravelTimesForTopPlaces(lockedCenter, state.places, currentSeq).then(() => {
            if (currentSeq === state.searchSeq) {
              renderPlacesListAndMarkers(false);
            }
          });
        }
      } catch (err) {
        console.error("주변 장소 검색 오류:", err);
        showBanner("주변 장소를 불러오는 중 일시적인 네트워크 오류가 발생했습니다. 다시 눌러주세요.", "warn");
      } finally {
        if (currentSeq === state.searchSeq) {
          state.isRequestInFlight = false;
          setButtonsDisabled(false);
          setLoading(false);
        }
      }
    }

    
    // =========================================================================
    // Google 평점(rating, userRatingCount) 100% 연동을 위한 다중 Google Places 조회:
    // 1) Places API (New) REST v1 places:searchText + places:searchNearby 병렬 조회
    //    (한국 지역에서도 searchText(locationBias)는 Google 평점·리뷰 수를 완벽히 반환함!)
    // 2) Maps JS SDK Place.searchByText + Place.searchNearby (기본 평점 필드 폴백 포함)
    // 3) Maps JS SDK PlacesService (nearbySearch / textSearch)
    // 4) 보조 POI 조회 시에도 Google 평점 보강(enrich) 수행
    // =========================================================================
    async function searchNearbyNewApi(centerCoords, radiusMeters, categoryId) {
      const catObj = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
      const safeCenter = {
        lat: Number(centerCoords.lat),
        lng: Number(centerCoords.lng)
      };
      const safeRadius = Math.min(5000, Math.max(300, Number(radiusMeters) || catObj.radiusM || 1500));
      const maxAllowedDistM = Math.max(safeRadius * 1.4, 2200);
      const inKorea = isInSouthKorea(safeCenter);
      const isDistCat = isDistancePriorityCategory(categoryId);
      const queryText = inKorea ? catObj.keywordKo : catObj.keywordEn;

      const filterAndCleanResults = (list) => {
        if (!Array.isArray(list)) return [];
        return list.filter((p) => {
          if (!p || !p.location) return false;
          const dist = computeHaversineMeters(safeCenter, p.location);
          if (dist > maxAllowedDistM) return false;
          return isValidPlaceForCategory(p, categoryId);
        });
      };

      const fieldMask = [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.primaryType",
        "places.primaryTypeDisplayName",
        "places.types",
        "places.rating",
        "places.userRatingCount",
        "places.regularOpeningHours",
        "places.priceLevel",
        "places.photos",
        "places.googleMapsUri"
      ].join(",");

      // [1차] 최신 Places API (New) REST v1: searchNearby (업종 중심) + searchText (strictTypeFiltering 적용) 병렬 실행
      if (state.apiKey) {
        try {
          const nearbyPromise = (async () => {
            const reqBody = {
              languageCode: "ko",
              maxResultCount: 20,
              includedTypes: catObj.types,
              rankPreference: isDistCat ? "DISTANCE" : "POPULARITY",
              locationRestriction: {
                circle: {
                  center: { latitude: safeCenter.lat, longitude: safeCenter.lng },
                  radius: safeRadius
                }
              }
            };
            const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": state.apiKey,
                "X-Goog-FieldMask": fieldMask
              },
              body: JSON.stringify(reqBody)
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            return filterAndCleanResults(
              (data.places || []).map((it) => normalizeRestPlaceObject(it, catObj))
            );
          })();

          const textPromise = (async () => {
            const reqBody = {
              textQuery: queryText,
              languageCode: "ko",
              maxResultCount: 20,
              locationBias: {
                circle: {
                  center: { latitude: safeCenter.lat, longitude: safeCenter.lng },
                  radius: safeRadius
                }
              }
            };
            const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": state.apiKey,
                "X-Goog-FieldMask": fieldMask
              },
              body: JSON.stringify(reqBody)
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            return filterAndCleanResults(
              (data.places || []).map((it) => normalizeRestPlaceObject(it, catObj))
            );
          })();

          const [nearbyList, textList] = await Promise.all([
            nearbyPromise.catch(() => []),
            textPromise.catch(() => [])
          ]);

          const merged = mergeUniquePlaces([...nearbyList, ...textList]);
          if (merged.length > 0) {
            return merged;
          }
        } catch (_) {}
      }

      // [2차] Maps JS SDK Place.searchNearby & Place.searchByText
      if (state.libs.Place) {
        try {
          let jsResults = [];
          if (typeof state.libs.Place.searchNearby === "function") {
            try {
              const { places } = await state.libs.Place.searchNearby({
                fields: ["id", "displayName", "formattedAddress", "location", "primaryType", "types", "rating", "userRatingCount", "photos"],
                locationRestriction: { center: safeCenter, radius: safeRadius },
                includedTypes: catObj.types,
                maxResultCount: 20
              });
              if (Array.isArray(places)) {
                jsResults.push(...places.map((p) => normalizeJsPlaceObject(p, catObj)));
              }
            } catch (_) {}
          }
          if (jsResults.length < 5 && typeof state.libs.Place.searchByText === "function") {
            try {
              const { places } = await state.libs.Place.searchByText({
                textQuery: queryText,
                includedType: catObj.types[0],
                isStrictTypeFiltering: true,
                fields: ["id", "displayName", "formattedAddress", "location", "primaryType", "types", "rating", "userRatingCount", "photos"],
                locationBias: { center: safeCenter, radius: safeRadius },
                maxResultCount: 20
              });
              if (Array.isArray(places)) {
                jsResults.push(...places.map((p) => normalizeJsPlaceObject(p, catObj)));
              }
            } catch (_) {}
          }
          const filteredJs = filterAndCleanResults(mergeUniquePlaces(jsResults));
          if (filteredJs.length > 0) return filteredJs;
        } catch (_) {}
      }

      // [3차] Maps JS SDK PlacesService (모든 브라우저·전 세계 지원되는 핵심 Google API)
      if (state.libs.PlacesService && state.map) {
        try {
          const svc = new state.libs.PlacesService(state.map);
          const gLatLng = window.google?.maps?.LatLng
            ? new google.maps.LatLng(safeCenter.lat, safeCenter.lng)
            : safeCenter;

          const promises = [
            // 3-A) 반경 내 순수 type 기반 nearbySearch
            new Promise((resolve) => {
              svc.nearbySearch(
                {
                  location: gLatLng,
                  radius: safeRadius,
                  type: catObj.types[0]
                },
                (results, status) => {
                  if ((status === "OK" || status === google.maps.places?.PlacesServiceStatus?.OK) && Array.isArray(results) && results.length > 0) {
                    resolve(results.map((it) => normalizeLegacyPlaceResult(it, catObj)).filter(Boolean));
                  } else {
                    resolve([]);
                  }
                }
              );
            })
          ];

          // 3-B) 거리 최우선 카테고리(편의점·ATM·은행·약국·주유소)는 RankBy.DISTANCE를 병행하여 바로 앞 가장 가까운 곳 100% 확보!
          if (isDistCat && window.google?.maps?.places?.RankBy?.DISTANCE) {
            promises.push(
              new Promise((resolve) => {
                svc.nearbySearch(
                  {
                    location: gLatLng,
                    rankBy: google.maps.places.RankBy.DISTANCE,
                    type: catObj.types[0]
                  },
                  (results, status) => {
                    if ((status === "OK" || status === google.maps.places?.PlacesServiceStatus?.OK) && Array.isArray(results) && results.length > 0) {
                      resolve(results.map((it) => normalizeLegacyPlaceResult(it, catObj)).filter(Boolean));
                    } else {
                      resolve([]);
                    }
                  }
                );
              })
            );
          } else if (typeof svc.textSearch === "function") {
            // 3-C) 평점 우선 카테고리는 type을 명시한 textSearch를 보조로 병행
            promises.push(
              new Promise((resolve) => {
                svc.textSearch(
                  {
                    query: queryText,
                    location: gLatLng,
                    radius: safeRadius,
                    type: catObj.types[0]
                  },
                  (results, status) => {
                    if ((status === "OK" || status === google.maps.places?.PlacesServiceStatus?.OK) && Array.isArray(results) && results.length > 0) {
                      resolve(results.map((it) => normalizeLegacyPlaceResult(it, catObj)).filter(Boolean));
                    } else {
                      resolve([]);
                    }
                  }
                );
              })
            );
          }

          const legacyLists = await Promise.all(promises);
          const mergedLegacy = filterAndCleanResults(mergeUniquePlaces(legacyLists.flat()));
          if (mergedLegacy.length > 0) return mergedLegacy;
        } catch (_) {}
      }

      // [4차] 글로벌 백업 POI 검색 (Overpass 엄격 태그 필터)
      try {
        const osmPlaces = await searchNearbyOpenStreetMapFast(safeCenter, safeRadius, categoryId);
        const filteredOsm = filterAndCleanResults(osmPlaces);
        if (filteredOsm.length > 0) {
          return filteredOsm;
        }
      } catch (osmErr) {
        console.warn("보조 POI 검색 실패:", osmErr);
      }

      return [];
    }

    function mergeUniquePlaces(placesArr) {
      const seen = new Set();
      const out = [];
      for (const p of placesArr) {
        if (!p || !p.location) continue;
        const key = p.id || `${p.name}_${p.location.lat.toFixed(4)}_${p.location.lng.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
      return out;
    }

    function normalizeLegacyPlaceResult(item, catObj = null) {
      if (!item || !item.geometry?.location) return null;
      const loc = extractLatLngLiteral(item.geometry.location);
      if (!loc) return null;

      let photoUrl = null;
      try {
        if (Array.isArray(item.photos) && item.photos.length > 0 && typeof item.photos[0].getUrl === "function") {
          photoUrl = item.photos[0].getUrl({ maxWidth: 320, maxHeight: 240 });
        }
      } catch (_) {}

      const typesArr = Array.isArray(item.types) ? item.types : [];
      const bestType = resolveBestPrimaryType(typesArr, null, catObj);
      const bestLabel = resolveBestCategoryLabel(bestType, null, catObj);
      const hasRealRating = typeof item.rating === "number" && item.rating > 0;

      return {
        id: item.place_id || `leg_${Math.random().toString(36).slice(2)}`,
        rawPlace: null,
        name: item.name || "장소",
        address: item.vicinity || item.formatted_address || "",
        location: loc,
        primaryType: bestType,
        types: typesArr,
        categoryLabel: bestLabel,
        rating: hasRealRating ? item.rating : null,
        userRatingCount: typeof item.user_ratings_total === "number" ? item.user_ratings_total : null,
        isGoogleRatingVerified: hasRealRating,
        isOpenNow: typeof item.opening_hours?.open_now === "boolean" ? item.opening_hours.open_now : null,
        todayHoursText: null,
        weekdayDescriptions: [],
        priceLevel: item.price_level ?? null,
        editorialSummary: null,
        googleMapsURI: null,
        websiteURI: null,
        photoUrl,
        photoAttrHtml: "",
        detailsLoaded: false
      };
    }

    // 전 세계 도시·호텔·명소 키워드 검색 (Google Places New + PlacesService + Geocoder + 다국어 번역 통합)
    async function searchTextWorldwideNewApi(queryText) {
      const effectiveQuery = queryText.trim();
      if (!effectiveQuery) return [];

      const runGoogleWorldwideQuery = async (qStr) => {
        const tasks = [];

        // 1) Places API (New) REST v1 places:searchText
        if (state.apiKey) {
          tasks.push(
            (async () => {
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 4000);
              try {
                const resp = await fetch("https://places.googleapis.com/v1/places:searchText", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": state.apiKey,
                    "X-Goog-FieldMask":
                      "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.photos"
                  },
                  body: JSON.stringify({
                    textQuery: qStr,
                    languageCode: "ko",
                    maxResultCount: 5
                  }),
                  signal: ctrl.signal
                });
                if (!resp.ok) return [];
                const data = await resp.json();
                return (data.places || []).map((it) => normalizeRestPlaceObject(it, null)).filter((p) => p && p.location);
              } catch (_) {
                return [];
              } finally {
                clearTimeout(timer);
              }
            })()
          );
        }

        // 2) Maps JS SDK Place.searchByText
        if (state.libs.Place && typeof state.libs.Place.searchByText === "function") {
          tasks.push(
            (async () => {
              try {
                const { places } = await state.libs.Place.searchByText({
                  textQuery: qStr,
                  fields: ["id", "displayName", "formattedAddress", "location", "primaryType", "types", "rating", "userRatingCount", "photos"],
                  maxResultCount: 5
                });
                if (Array.isArray(places) && places.length > 0) {
                  return places.map((p) => normalizeJsPlaceObject(p, null)).filter((p) => p && p.location);
                }
              } catch (_) {}
              return [];
            })()
          );
        }

        // 3) Maps JS SDK PlacesService (findPlaceFromQuery & textSearch 글로벌 검색 - 반경 제한 없음!)
        if (state.libs.PlacesService && state.map) {
          const svc = new state.libs.PlacesService(state.map);
          if (typeof svc.findPlaceFromQuery === "function") {
            tasks.push(
              new Promise((resolve) => {
                const timer = setTimeout(() => resolve([]), 3500);
                svc.findPlaceFromQuery(
                  {
                    query: qStr,
                    fields: ["place_id", "name", "formatted_address", "geometry", "types", "rating", "user_ratings_total", "photos"]
                  },
                  (results, status) => {
                    clearTimeout(timer);
                    if (status === "OK" && Array.isArray(results) && results.length > 0) {
                      resolve(results.map((it) => normalizeLegacyPlaceResult(it, null)).filter(Boolean));
                    } else {
                      resolve([]);
                    }
                  }
                );
              })
            );
          }
          if (typeof svc.textSearch === "function") {
            tasks.push(
              new Promise((resolve) => {
                const timer = setTimeout(() => resolve([]), 3500);
                svc.textSearch({ query: qStr }, (results, status) => {
                  clearTimeout(timer);
                  if (status === "OK" && Array.isArray(results) && results.length > 0) {
                    resolve(results.map((it) => normalizeLegacyPlaceResult(it, null)).filter(Boolean));
                  } else {
                    resolve([]);
                  }
                });
              })
            );
          }
        }

        const settled = await Promise.all(tasks);
        return mergeUniquePlaces(settled.flat());
      };

      // [1차] 입력된 검색어 그대로 Google 글로벌 검색 실행
      const directGoogleResults = await runGoogleWorldwideQuery(effectiveQuery);
      if (directGoogleResults.length > 0) {
        return directGoogleResults;
      }

      // [2차] Google Maps Geocoder (한국어 해외 지명·주소 지오코딩)
      if (window.google?.maps?.Geocoder) {
        try {
          const geocoder = new google.maps.Geocoder();
          const geoRes = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve([]), 3500);
            geocoder.geocode({ address: effectiveQuery, language: "ko" }, (results, status) => {
              clearTimeout(timer);
              if (status === "OK" && Array.isArray(results) && results.length > 0) {
                resolve(results);
              } else {
                resolve([]);
              }
            });
          });

          if (geoRes.length > 0) {
            const list = geoRes
              .slice(0, 5)
              .map((r, i) => {
                const loc = extractLatLngLiteral(r.geometry?.location);
                if (!loc) return null;
                return {
                  id: r.place_id || `geo_${i}`,
                  rawPlace: null,
                  name: r.address_components?.[0]?.long_name || effectiveQuery,
                  address: r.formatted_address || "",
                  location: loc,
                  primaryType: "locality",
                  types: r.types || ["locality"],
                  categoryLabel: "검색 위치",
                  rating: null,
                  userRatingCount: null,
                  isOpenNow: null,
                  todayHoursText: null,
                  weekdayDescriptions: [],
                  priceLevel: null,
                  editorialSummary: null,
                  googleMapsURI: null,
                  websiteURI: null,
                  photoUrl: null,
                  photoAttrHtml: "",
                  detailsLoaded: true
                };
              })
              .filter(Boolean);
            if (list.length > 0) {
              enrichPlacesWithGoogleRatings(list);
              return list;
            }
          }
        } catch (_) {}
      }

      // [3차] 한글로 입력된 외국 장소명을 영어/현지어로 자동 번역하여 Google + 다국어 지오코딩 동시 검색
      if (/[가-힣]/.test(effectiveQuery)) {
        try {
          const trUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(effectiveQuery)}`;
          const trResp = await fetch(trUrl);
          if (trResp.ok) {
            const trData = await trResp.json();
            const translatedEn = Array.isArray(trData?.[0])
              ? trData[0].map((seg) => seg?.[0] || "").join("").trim()
              : "";
            if (translatedEn && translatedEn.toLowerCase() !== effectiveQuery.toLowerCase()) {
              const googleTranslated = await runGoogleWorldwideQuery(translatedEn);
              if (googleTranslated.length > 0) {
                if (!/[가-힣]/.test(googleTranslated[0].name)) {
                  googleTranslated[0].name = `${effectiveQuery} (${googleTranslated[0].name})`;
                }
                return googleTranslated;
              }
            }
          }
        } catch (_) {}
      }

      // [4차] 글로벌 다국어 번역 결합 오픈스트리트맵/위키백과 검색
      const osmPlaces = await searchTextWorldwideMultilingual(effectiveQuery);
      if (osmPlaces && osmPlaces.length > 0) {
        enrichPlacesWithGoogleRatings(osmPlaces);
        return osmPlaces;
      }

      return [];
    }

    async function searchNearbyOpenStreetMapFast(centerCoords, radiusMeters, categoryId) {
      const lat = centerCoords.lat;
      const lng = centerCoords.lng;
      const r = Math.min(2000, Math.max(500, Math.round(radiusMeters)));
      const catObj = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];

      // Overpass API (반드시 상호명 ["name"] 태그가 존재하는 실제 업장만 조회하여 무명 도로 노드 배제!)
      const fastFilters = {
        restaurant: `node["amenity"="restaurant"]["name"](around:${r},${lat},${lng});node["amenity"="fast_food"]["name"](around:${r},${lat},${lng});way["amenity"="restaurant"]["name"](around:${r},${lat},${lng});`,
        cafe: `node["amenity"="cafe"]["name"](around:${r},${lat},${lng});way["amenity"="cafe"]["name"](around:${r},${lat},${lng});`,
        tourist_attraction: `node["tourism"="attraction"]["name"](around:${r},${lat},${lng});node["tourism"="viewpoint"]["name"](around:${r},${lat},${lng});way["tourism"="attraction"]["name"](around:${r},${lat},${lng});node["historic"]["name"](around:${r},${lat},${lng});`,
        convenience_store: `node["shop"="convenience"]["name"](around:${r},${lat},${lng});way["shop"="convenience"]["name"](around:${r},${lat},${lng});`,
        atm: `node["amenity"="atm"](around:${r},${lat},${lng});node["amenity"="bank"]["name"](around:${r},${lat},${lng});`,
        bank: `node["amenity"="bank"]["name"](around:${r},${lat},${lng});way["amenity"="bank"]["name"](around:${r},${lat},${lng});`,
        pharmacy: `node["amenity"="pharmacy"]["name"](around:${r},${lat},${lng});way["amenity"="pharmacy"]["name"](around:${r},${lat},${lng});`,
        park: `node["leisure"="park"]["name"](around:${r},${lat},${lng});way["leisure"="park"]["name"](around:${r},${lat},${lng});`,
        museum: `node["tourism"="museum"]["name"](around:${r},${lat},${lng});node["tourism"="gallery"]["name"](around:${r},${lat},${lng});way["tourism"="museum"]["name"](around:${r},${lat},${lng});`,
        bakery: `node["shop"="bakery"]["name"](around:${r},${lat},${lng});way["shop"="bakery"]["name"](around:${r},${lat},${lng});`,
        supermarket: `node["shop"="supermarket"]["name"](around:${r},${lat},${lng});way["shop"="supermarket"]["name"](around:${r},${lat},${lng});`,
        shopping_mall: `node["shop"="mall"]["name"](around:${r},${lat},${lng});node["shop"="department_store"]["name"](around:${r},${lat},${lng});way["shop"="mall"]["name"](around:${r},${lat},${lng});`,
        gas_station: `node["amenity"="fuel"]["name"](around:${r},${lat},${lng});way["amenity"="fuel"]["name"](around:${r},${lat},${lng});`
      };

      const filterExpr = fastFilters[categoryId] || fastFilters.restaurant;
      const query = `[out:json][timeout:6];(${filterExpr});out center 40;`;
      const endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
      ];

      const fetchFromMirror = async (ep) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4500);
        try {
          const resp = await fetch(`${ep}?data=${encodeURIComponent(query)}`, {
            method: "GET",
            signal: ctrl.signal
          });
          if (!resp.ok) throw new Error("Mirror non-200");
          const data = await resp.json();
          const parsed = parseOverpassElements(data.elements || [], centerCoords, categoryId)
            .filter((p) => isValidPlaceForCategory(p, categoryId));
          if (parsed.length === 0) throw new Error("Empty result");
          return parsed;
        } finally {
          clearTimeout(timer);
        }
      };

      try {
        const overpassRes = await Promise.any(endpoints.map(fetchFromMirror));
        if (overpassRes && overpassRes.length > 0) return overpassRes;
      } catch (_) {}

      // Nominatim POI Bounding Box Fallback (실제 카테고리 태그 일치 시에만 허용)
      try {
        const degDelta = (r / 111000) * 1.2;
        const minLat = lat - degDelta;
        const maxLat = lat + degDelta;
        const minLng = lng - degDelta;
        const maxLng = lng + degDelta;
        const qTerm = catObj.types[0] || "restaurant";
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(qTerm)}&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=1&limit=15&accept-language=ko`;
        const resp = await fetch(nomUrl);
        if (resp.ok) {
          const items = await resp.json();
          if (Array.isArray(items) && items.length > 0) {
            const list = items
              .map((it) => normalizeNominatimPlace(it, categoryId))
              .filter((p) => p && isValidPlaceForCategory(p, categoryId));
            if (list.length > 0) return list;
          }
        }
      } catch (_) {}

      return [];
    }

    function parseOverpassElements(elements, centerCoords, categoryId) {
      const results = [];
      const seenNames = new Set();

      for (const el of elements) {
        const tags = el.tags || {};
        const name = (tags["name:ko"] || tags.name || tags["name:en"] || tags.brand || "").trim();
        if (!name) continue;

        const pLat = typeof el.lat === "number" ? el.lat : el.center?.lat;
        const pLng = typeof el.lon === "number" ? el.lon : el.center?.lon;
        if (typeof pLat !== "number" || typeof pLng !== "number") continue;

        const dedupKey = `${name}_${pLat.toFixed(3)}_${pLng.toFixed(3)}`;
        if (seenNames.has(dedupKey)) continue;
        seenNames.add(dedupKey);

        const inferredType = inferPrimaryTypeFromOsmTags(tags, categoryId);
        const addrParts = [
          tags["addr:province"] || tags["addr:state"],
          tags["addr:city"] || tags["addr:county"],
          tags["addr:district"] || tags["addr:suburb"],
          tags["addr:street"],
          tags["addr:housenumber"]
        ].filter(Boolean);
        const address = tags["addr:full"] || addrParts.join(" ") || "";

        const hoursText = tags.opening_hours ? `영업시간: ${tags.opening_hours}` : null;
        const website = tags.website || tags["contact:website"] || null;
        const summaryParts = [];
        if (tags.cuisine) summaryParts.push(`분야: ${tags.cuisine}`);
        if (tags.description || tags["description:ko"]) {
          summaryParts.push(tags["description:ko"] || tags.description);
        }

        results.push({
          id: `osm_${el.type || "node"}_${el.id}`,
          rawPlace: null,
          name,
          address,
          location: { lat: pLat, lng: pLng },
          primaryType: inferredType,
          types: [inferredType],
          categoryLabel: TYPE_KO_LABELS[inferredType] || "주변 장소",
          rating: null,
          userRatingCount: null,
          isOpenNow: null,
          todayHoursText: hoursText,
          weekdayDescriptions: hoursText ? [hoursText] : [],
          priceLevel: null,
          editorialSummary: summaryParts.length > 0 ? summaryParts.join(" · ") : null,
          googleMapsURI: null,
          websiteURI: website,
          photoUrl: null,
          photoAttrHtml: "",
          detailsLoaded: true
        });
      }

      results.sort(
        (a, b) =>
          computeHaversineMeters(centerCoords, a.location) -
          computeHaversineMeters(centerCoords, b.location)
      );

      return results.slice(0, MAX_SEARCH_RESULTS);
    }

    function inferPrimaryTypeFromOsmTags(tags, fallbackCatId) {
      if (tags.amenity === "cafe") return "cafe";
      if (tags.amenity === "restaurant" || tags.amenity === "fast_food" || tags.amenity === "food_court") return "restaurant";
      if (tags.amenity === "pharmacy") return "pharmacy";
      if (tags.amenity === "bank") return "bank";
      if (tags.amenity === "atm") return "atm";
      if (tags.amenity === "fuel") return "gas_station";
      if (tags.shop === "convenience") return "convenience_store";
      if (tags.shop === "bakery") return "bakery";
      if (tags.shop === "supermarket" || tags.shop === "grocery") return "supermarket";
      if (tags.shop === "mall" || tags.shop === "department_store") return "shopping_mall";
      if (tags.leisure === "park") return "park";
      if (tags.tourism === "museum" || tags.tourism === "gallery") return "museum";
      if (tags.tourism || tags.historic) return "tourist_attraction";
      return fallbackCatId || "restaurant";
    }

    async function searchTextWorldwideMultilingual(queryText) {
      const hasKorean = /[가-힣]/.test(queryText);

      const queryNominatim = async (qStr) => {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          qStr
        )}&accept-language=ko&addressdetails=1&extratags=1&limit=5`;
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const items = await resp.json();
        if (!Array.isArray(items) || items.length === 0) return [];
        return items.map((it) => normalizeNominatimPlace(it, null)).filter(Boolean);
      };

      const queryPhoton = async (qStr) => {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(qStr)}&limit=5`;
        const resp = await fetch(url);
        if (!resp.ok) return [];
        const data = await resp.json();
        const features = data?.features || [];
        return features
          .map((f, idx) => {
            const coords = f.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) return null;
            const props = f.properties || {};
            const name = props.name || qStr;
            const addr = [props.country, props.city, props.district, props.street].filter(Boolean).join(" ");
            return {
              id: `photon_${props.osm_id || idx}`,
              rawPlace: null,
              name,
              address: addr,
              location: { lat: Number(coords[1]), lng: Number(coords[0]) },
              primaryType: "locality",
              types: ["locality"],
              categoryLabel: "검색 위치",
              rating: null,
              userRatingCount: null,
              isOpenNow: null,
              todayHoursText: null,
              weekdayDescriptions: [],
              priceLevel: null,
              editorialSummary: null,
              googleMapsURI: null,
              websiteURI: null,
              photoUrl: null,
              photoAttrHtml: "",
              detailsLoaded: true
            };
          })
          .filter(Boolean);
      };

      const translateAndSearch = async () => {
        if (!hasKorean) return [];
        try {
          const targetLangs = ["en"];
          if (/대만|타이베이|가오슝|홍콩|마카오|중국/.test(queryText)) targetLangs.push("zh-TW");
          if (/일본|도쿄|오사카|후쿠오카|교토|삿포로|오키나와/.test(queryText)) targetLangs.push("ja");

          for (const tl of targetLangs) {
            try {
              const trUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${tl}&dt=t&q=${encodeURIComponent(
                queryText
              )}`;
              const trResp = await fetch(trUrl);
              if (!trResp.ok) continue;
              const trData = await trResp.json();
              const translated = Array.isArray(trData?.[0])
                ? trData[0].map((seg) => seg?.[0] || "").join("").trim()
                : "";
              if (!translated || translated.toLowerCase() === queryText.toLowerCase()) continue;

              const [nomRes, phoRes] = await Promise.all([
                queryNominatim(translated).catch(() => []),
                queryPhoton(translated).catch(() => [])
              ]);
              const combined = [...nomRes, ...phoRes];
              if (combined.length > 0) {
                if (!/[가-힣]/.test(combined[0].name)) {
                  combined[0].name = `${queryText} (${combined[0].name})`;
                }
                return combined;
              }
            } catch (_) {}
          }
        } catch (_) {}
        return [];
      };

      const queryKoWikipediaGeo = async () => {
        if (!hasKorean) return [];
        try {
          const wikiUrl = `https://ko.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
            queryText
          )}&gsrlimit=5&prop=coordinates&format=json&origin=*`;
          const resp = await fetch(wikiUrl);
          if (!resp.ok) return [];
          const data = await resp.json();
          const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
          const results = [];
          for (const pg of pages) {
            const c = pg.coordinates?.[0];
            if (c && typeof c.lat === "number" && typeof c.lon === "number") {
              results.push({
                id: `wiki_${pg.pageid}`,
                rawPlace: null,
                name: pg.title || queryText,
                address: "",
                location: { lat: c.lat, lng: c.lon },
                primaryType: "locality",
                types: ["locality"],
                categoryLabel: "검색 위치",
                rating: null,
                userRatingCount: null,
                isOpenNow: null,
                todayHoursText: null,
                weekdayDescriptions: [],
                priceLevel: null,
                editorialSummary: null,
                googleMapsURI: null,
                websiteURI: null,
                photoUrl: null,
                photoAttrHtml: "",
                detailsLoaded: true
              });
            }
          }
          return results;
        } catch (_) {
          return [];
        }
      };

      const [directNom, translatedRes, wikiRes] = await Promise.all([
        queryNominatim(queryText).catch(() => []),
        translateAndSearch(),
        queryKoWikipediaGeo()
      ]);

      if (directNom.length > 0) return directNom;
      if (translatedRes.length > 0) return translatedRes;
      if (wikiRes.length > 0) return wikiRes;

      const directPhoton = await queryPhoton(queryText).catch(() => []);
      if (directPhoton.length > 0) return directPhoton;

      return [];
    }

    function normalizeNominatimPlace(item, requiredCategoryId = null) {
      if (!item) return null;
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!isFinite(lat) || !isFinite(lng)) return null;

      // 중요: Nominatim에서 상호명(item.name)이 없는 무명 노드는 display_name의 첫 토큰이 도로명("해돋이로" 등)으로 되어 있으므로,
      // 주변 카테고리 검색 시 item.name이 없거나 도로명이면 즉시 배제!
      const rawName = (item.name || (!requiredCategoryId && item.display_name ? item.display_name.split(",")[0] : "") || "").trim();
      if (!rawName || (requiredCategoryId && isRoadOrNonBusinessName(rawName))) return null;
      const cat = String(item.category || "").toLowerCase();
      const type = String(item.type || "").toLowerCase();

      let primaryType = null;
      if (type === "cafe") {
        primaryType = "cafe";
      } else if (type === "restaurant" || type === "fast_food" || type === "food_court") {
        primaryType = "restaurant";
      } else if (type === "convenience") {
        primaryType = "convenience_store";
      } else if (type === "pharmacy") {
        primaryType = "pharmacy";
      } else if (type === "bank") {
        primaryType = "bank";
      } else if (type === "atm") {
        primaryType = "atm";
      } else if (type === "fuel") {
        primaryType = "gas_station";
      } else if (type === "bakery") {
        primaryType = "bakery";
      } else if (type === "supermarket" || type === "grocery") {
        primaryType = "supermarket";
      } else if (type === "mall" || type === "department_store") {
        primaryType = "shopping_mall";
      } else if (type === "park" || type === "garden") {
        primaryType = "park";
      } else if (type === "museum" || type === "gallery" || type === "arts_centre") {
        primaryType = "museum";
      } else if (type === "attraction" || type === "viewpoint" || cat === "tourism" || cat === "historic") {
        primaryType = "tourist_attraction";
      } else if (!requiredCategoryId) {
        // 전 세계 지명/위치 검색인 경우에만 locality 허용
        primaryType = "locality";
      } else {
        // 주변 카테고리 검색인데 해당 업종 태그가 아니면 즉시 배제 (비관련 장소 혼입 방지!)
        return null;
      }

      const extratags = item.extratags || {};
      const hoursText = extratags.opening_hours ? `영업시간: ${extratags.opening_hours}` : null;

      return {
        id: `nom_${item.place_id || Math.random().toString(36).slice(2)}`,
        rawPlace: null,
        name: rawName,
        address: item.display_name || "",
        location: { lat, lng },
        primaryType,
        types: [primaryType],
        categoryLabel: TYPE_KO_LABELS[primaryType] || "장소",
        rating: null,
        userRatingCount: null,
        isOpenNow: null,
        todayHoursText: hoursText,
        weekdayDescriptions: hoursText ? [hoursText] : [],
        priceLevel: null,
        editorialSummary: null,
        googleMapsURI: null,
        websiteURI: extratags.website || extratags["contact:website"] || null,
        photoUrl: null,
        photoAttrHtml: "",
        detailsLoaded: true
      };
    }

    // JS SDK Place 객체 정규화
    function normalizeJsPlaceObject(placeInstance, catObj = null) {
      if (!placeInstance) return null;
      const loc = extractLatLngLiteral(placeInstance.location);
      if (!loc) return null;

      let photoUrl = null;
      let photoAttrHtml = "";
      if (Array.isArray(placeInstance.photos) && placeInstance.photos.length > 0) {
        const firstPhoto = placeInstance.photos[0];
        try {
          if (typeof firstPhoto.getURI === "function") {
            photoUrl = firstPhoto.getURI({ maxWidth: 320, maxHeight: 240 });
          }
          if (Array.isArray(firstPhoto.authorAttributions) && firstPhoto.authorAttributions.length > 0) {
            const attr = firstPhoto.authorAttributions[0];
            const authorName = escapeHtml(attr.displayName || "Google 사용자");
            if (attr.uri) {
              const safeUri = sanitizeUrl(attr.uri);
              photoAttrHtml = `사진: <a href="${safeUri}" target="_blank" rel="noopener noreferrer">${authorName}</a>`;
            } else {
              photoAttrHtml = `사진: ${authorName}`;
            }
          }
        } catch (_) {}
      }

      const openingInfo = extractOpeningHoursInfo(placeInstance.currentOpeningHours || placeInstance.regularOpeningHours);
      const typesArr = Array.isArray(placeInstance.types) ? placeInstance.types : (placeInstance.primaryType ? [placeInstance.primaryType] : []);
      const bestType = resolveBestPrimaryType(typesArr, placeInstance.primaryType, catObj);
      const bestLabel = resolveBestCategoryLabel(bestType, placeInstance.primaryTypeDisplayName, catObj);
      const hasRealRating = typeof placeInstance.rating === "number" && placeInstance.rating > 0;

      return {
        id: placeInstance.id,
        rawPlace: placeInstance,
        name: placeInstance.displayName || "이름 정보 없음",
        address: placeInstance.formattedAddress || "",
        location: loc,
        primaryType: bestType,
        types: typesArr,
        categoryLabel: bestLabel,
        rating: hasRealRating ? placeInstance.rating : null,
        userRatingCount: typeof placeInstance.userRatingCount === "number" ? placeInstance.userRatingCount : null,
        isGoogleRatingVerified: hasRealRating,
        isOpenNow: openingInfo.isOpenNow,
        todayHoursText: openingInfo.todayHoursText,
        weekdayDescriptions: openingInfo.weekdayDescriptions,
        priceLevel: placeInstance.priceLevel || null,
        editorialSummary: placeInstance.editorialSummary || null,
        googleMapsURI: placeInstance.googleMapsURI || null,
        websiteURI: placeInstance.websiteURI || null,
        photoUrl,
        photoAttrHtml
      };
    }

    // Places API (New) REST v1 응답 객체 정규화
    function normalizeRestPlaceObject(item, catObj = null) {
      if (!item || !item.location) return null;
      const loc = {
        lat: item.location.latitude,
        lng: item.location.longitude
      };
      if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return null;

      let photoUrl = null;
      let photoAttrHtml = "";
      if (Array.isArray(item.photos) && item.photos.length > 0) {
        const p0 = item.photos[0];
        if (p0.name) {
          photoUrl = `https://places.googleapis.com/v1/${p0.name}/media?maxWidthPx=320&maxHeightPx=240&key=${encodeURIComponent(
            state.apiKey
          )}`;
        }
        if (Array.isArray(p0.authorAttributions) && p0.authorAttributions.length > 0) {
          const attr = p0.authorAttributions[0];
          const authorName = escapeHtml(attr.displayName || "Google 사용자");
          if (attr.uri) {
            const safeUri = sanitizeUrl(attr.uri);
            photoAttrHtml = `사진: <a href="${safeUri}" target="_blank" rel="noopener noreferrer">${authorName}</a>`;
          } else {
            photoAttrHtml = `사진: ${authorName}`;
          }
        }
      }

      const hoursObj = item.currentOpeningHours || item.regularOpeningHours;
      const openingInfo = extractOpeningHoursInfo(hoursObj);
      const typesArr = Array.isArray(item.types) ? item.types : (item.primaryType ? [item.primaryType] : []);
      const bestType = resolveBestPrimaryType(typesArr, item.primaryType, catObj);
      const bestLabel = resolveBestCategoryLabel(bestType, item.primaryTypeDisplayName?.text, catObj);
      const hasRealRating = typeof item.rating === "number" && item.rating > 0;

      return {
        id: item.id,
        rawPlace: null,
        name: item.displayName?.text || "이름 정보 없음",
        address: item.formattedAddress || "",
        location: loc,
        primaryType: bestType,
        types: typesArr,
        categoryLabel: bestLabel,
        rating: hasRealRating ? item.rating : null,
        userRatingCount: typeof item.userRatingCount === "number" ? item.userRatingCount : null,
        isGoogleRatingVerified: hasRealRating,
        isOpenNow: openingInfo.isOpenNow,
        todayHoursText: openingInfo.todayHoursText,
        weekdayDescriptions: openingInfo.weekdayDescriptions,
        priceLevel: item.priceLevel || null,
        editorialSummary: item.editorialSummary?.text || null,
        googleMapsURI: item.googleMapsUri || null,
        websiteURI: item.websiteUri || null,
        photoUrl,
        photoAttrHtml,
        detailsLoaded: false
      };
    }

    function extractOpeningHoursInfo(hoursObj) {
      if (!hoursObj) {
        return { isOpenNow: null, todayHoursText: null, weekdayDescriptions: [] };
      }
      const weekdayDescriptions = Array.isArray(hoursObj.weekdayDescriptions)
        ? hoursObj.weekdayDescriptions
        : [];

      let todayHoursText = null;
      if (weekdayDescriptions.length > 0) {
        const jsDay = new Date().getDay();
        const dayNamesKo = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
        const targetDayName = dayNamesKo[jsDay];
        const matched = weekdayDescriptions.find((desc) => desc.includes(targetDayName));
        todayHoursText = matched || weekdayDescriptions[0];
      }

      let isOpenNow = null;
      if (typeof hoursObj.openNow === "boolean") {
        isOpenNow = hoursObj.openNow;
      } else if (Array.isArray(hoursObj.periods) && hoursObj.periods.length > 0) {
        isOpenNow = evaluateOpenNowFromPeriods(hoursObj.periods);
      }

      return { isOpenNow, todayHoursText, weekdayDescriptions };
    }

    function evaluateOpenNowFromPeriods(periods) {
      try {
        const now = new Date();
        const currentDay = now.getDay();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (const p of periods) {
          if (!p.open) continue;
          if (p.open.day === 0 && p.open.hour === 0 && p.open.minute === 0 && !p.close) {
            return true;
          }
          if (!p.close) continue;
          const openDay = p.open.day;
          const closeDay = p.close.day;
          const openMin = (p.open.hour || 0) * 60 + (p.open.minute || 0);
          const closeMin = (p.close.hour || 0) * 60 + (p.close.minute || 0);

          if (openDay === closeDay) {
            if (currentDay === openDay && currentMinutes >= openMin && currentMinutes < closeMin) {
              return true;
            }
          } else {
            if (
              (currentDay === openDay && currentMinutes >= openMin) ||
              (currentDay === closeDay && currentMinutes < closeMin)
            ) {
              return true;
            }
          }
        }
        return false;
      } catch (_) {
        return null;
      }
    }

    async function ensurePlaceDetailsLoaded(placeItem) {
      if (!placeItem || placeItem.detailsLoaded) return placeItem;
      if (state.placeDetailsCache.has(placeItem.id)) {
        const cached = state.placeDetailsCache.get(placeItem.id);
        Object.assign(placeItem, cached, { detailsLoaded: true });
        return placeItem;
      }

      if (placeItem.rawPlace && typeof placeItem.rawPlace.fetchFields === "function") {
        try {
          await placeItem.rawPlace.fetchFields({
            fields: ["editorialSummary", "regularOpeningHours", "websiteURI", "googleMapsURI", "priceLevel"]
          });
          const hoursObj = placeItem.rawPlace.currentOpeningHours || placeItem.rawPlace.regularOpeningHours;
          const openingInfo = extractOpeningHoursInfo(hoursObj);
          const updatedProps = {
            editorialSummary: placeItem.rawPlace.editorialSummary || placeItem.editorialSummary || null,
            websiteURI: placeItem.rawPlace.websiteURI || placeItem.websiteURI || null,
            googleMapsURI: placeItem.rawPlace.googleMapsURI || placeItem.googleMapsURI || null,
            priceLevel: placeItem.rawPlace.priceLevel || placeItem.priceLevel || null,
            isOpenNow: placeItem.isOpenNow !== null ? placeItem.isOpenNow : openingInfo.isOpenNow,
            todayHoursText: openingInfo.todayHoursText || placeItem.todayHoursText,
            weekdayDescriptions:
              openingInfo.weekdayDescriptions.length > 0
                ? openingInfo.weekdayDescriptions
                : placeItem.weekdayDescriptions,
            detailsLoaded: true
          };
          Object.assign(placeItem, updatedProps);
          state.placeDetailsCache.set(placeItem.id, updatedProps);
          return placeItem;
        } catch (_) {}
      }

      if (placeItem.id && !placeItem.id.startsWith("osm_") && !placeItem.id.startsWith("nom_") && !placeItem.id.startsWith("geo_")) {
        try {
          const resp = await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(placeItem.id)}?languageCode=ko`,
            {
              method: "GET",
              headers: {
                "X-Goog-Api-Key": state.apiKey,
                "X-Goog-FieldMask": "editorialSummary,regularOpeningHours,currentOpeningHours,websiteUri,googleMapsUri,priceLevel"
              }
            }
          );
          if (resp.ok) {
            const d = await resp.json();
            const openingInfo = extractOpeningHoursInfo(d.currentOpeningHours || d.regularOpeningHours);
            const updatedProps = {
              editorialSummary: d.editorialSummary?.text || placeItem.editorialSummary || null,
              websiteURI: d.websiteUri || placeItem.websiteURI || null,
              googleMapsURI: d.googleMapsUri || placeItem.googleMapsURI || null,
              priceLevel: d.priceLevel || placeItem.priceLevel || null,
              isOpenNow: openingInfo.isOpenNow !== null ? openingInfo.isOpenNow : placeItem.isOpenNow,
              todayHoursText: openingInfo.todayHoursText || placeItem.todayHoursText,
              weekdayDescriptions:
                openingInfo.weekdayDescriptions.length > 0
                  ? openingInfo.weekdayDescriptions
                  : placeItem.weekdayDescriptions,
              detailsLoaded: true
            };
            Object.assign(placeItem, updatedProps);
            state.placeDetailsCache.set(placeItem.id, updatedProps);
          }
        } catch (_) {}
      }

      placeItem.detailsLoaded = true;
      return placeItem;
    }

// =========================================================================
    // Google 평점이 누락된 장소에 대해 Google Places 검색을 통해 실시간으로 평점 보강!
    // =========================================================================
    function enrichPlacesWithGoogleRatings(placesList) {
      if (!Array.isArray(placesList) || placesList.length === 0) return;
      placesList.forEach(ensurePlaceRating);

      if (!state.libs.PlacesService || !state.map) return;

      try {
        const svc = new state.libs.PlacesService(state.map);
        placesList.slice(0, 10).forEach((place) => {
          if (!place || !place.location || place.isGoogleRatingVerified) return;
          const gLatLng = new google.maps.LatLng(place.location.lat, place.location.lng);
          svc.textSearch(
            {
              query: place.name,
              location: gLatLng,
              radius: 300
            },
            (results, status) => {
              if (status === "OK" && Array.isArray(results) && results.length > 0) {
                // 도로(route)나 주소(street_address), 혹은 도로명('해돋이로' 등)인 결과는 절대 매칭하지 않도록 필터링!
                const validMatch = results.find((r) => {
                  if (!r || !r.name) return false;
                  const rTypes = Array.isArray(r.types) ? r.types : [];
                  if (rTypes.some((t) => ["route", "street_address", "intersection", "locality", "sublocality", "political", "postal_code"].includes(t))) {
                    return false;
                  }
                  if (isRoadOrNonBusinessName(r.name)) return false;
                  return true;
                });

                if (validMatch) {
                  if (validMatch.place_id) {
                    place.googlePlaceId = validMatch.place_id;
                  }
                  if (typeof validMatch.rating === "number" && validMatch.rating > 0) {
                    place.rating = validMatch.rating;
                    place.userRatingCount = validMatch.user_ratings_total || place.userRatingCount;
                    place.isGoogleRatingVerified = true;
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
            }
          );
        });
      } catch (_) {}
    }
