/**
 * Автоматическое определение страны, региона и района из адреса
 */

// Словарь стран с ключевыми словами
const COUNTRIES: Record<string, string[]> = {
  'Узбекистан': ['узбекистан', 'uzbekistan', 'tashkent', 'ташкент', 'samarkand', 'самарканд', 'бухара', 'bukhara', 'наманган', 'андижан', 'фергана', 'хорезм', 'навои', 'карши', 'термез', 'нукус'],
  'Россия': ['россия', 'russia', 'москва', 'moscow', 'санкт-петербург', 'spb', 'новосибирск', 'екатеринбург', 'казань', 'нижний новгород', 'челябинск', 'самара', 'уфа', 'ростов', 'краснодар'],
  'Казахстан': ['казахстан', 'kazakhstan', 'алматы', 'almaty', 'астана', 'astana', 'нур-султан', 'шымкент', 'караганда', 'актобе', 'тараз', 'павлодар', 'семей'],
  'Кыргызстан': ['кыргызстан', 'kyrgyzstan', 'бишкек', 'bishkek', 'ош', 'джалал-абад', 'каракол'],
  'Таджикистан': ['таджикистан', 'tajikistan', 'душанбе', 'dushanbe', 'худжанд', 'хорог'],
  'Туркменистан': ['туркменистан', 'turkmenistan', 'ашхабад', 'ashgabat', 'туркменабад', 'мары'],
  'Азербайджан': ['азербайджан', 'azerbaijan', 'баку', 'baku', 'гянджа', 'сумгаит'],
  'Грузия': ['грузия', 'georgia', 'тбилиси', 'tbilisi', 'батуми', 'кутаиси'],
  'Армения': ['армения', 'armenia', 'ереван', 'yerevan', 'гюмри'],
  'Беларусь': ['беларусь', 'belarus', 'минск', 'minsk', 'гомель', 'могилёв', 'витебск', 'гродно', 'брест'],
};

// Регионы Узбекистана
const UZ_REGIONS: Record<string, string[]> = {
  'Ташкент': ['ташкент', 'tashkent', 'тошкент'],
  'Ташкентская область': ['ташкентская', 'tashkent region', 'чирчик', 'алмалык', 'ангрен', 'бекабад'],
  'Самаркандская область': ['самарканд', 'samarkand'],
  'Бухарская область': ['бухара', 'bukhara'],
  'Ферганская область': ['фергана', 'fergana', 'коканд', 'маргилан'],
  'Андижанская область': ['андижан', 'andijan'],
  'Наманганская область': ['наманган', 'namangan'],
  'Хорезмская область': ['хорезм', 'ургенч', 'хива', 'urgench', 'khiva'],
  'Навоийская область': ['навои', 'navoi', 'зарафшан'],
  'Кашкадарьинская область': ['кашкадарья', 'карши', 'karshi', 'shahrisabz', 'шахрисабз'],
  'Сурхандарьинская область': ['сурхандарья', 'термез', 'termez', 'denau', 'денау'],
  'Джизакская область': ['джизак', 'jizzakh'],
  'Сырдарьинская область': ['сырдарья', 'гулистан', 'gulistan'],
  'Республика Каракалпакстан': ['каракалпакстан', 'нукус', 'nukus', 'karakalpakstan'],
};

// Районы Ташкента
const TASHKENT_DISTRICTS: Record<string, string[]> = {
  'Алмазарский район': ['алмазар', 'almazar'],
  'Бектемирский район': ['бектемир', 'bektemir'],
  'Мирабадский район': ['мирабад', 'mirabad'],
  'Мирзо-Улугбекский район': ['мирзо-улугбек', 'mirzo ulugbek', 'мирзо улугбек', 'mirzo-ulugbek'],
  'Сергелийский район': ['сергели', 'sergeli'],
  'Учтепинский район': ['учтепа', 'uchtepa'],
  'Чиланзарский район': ['чиланзар', 'chilanzar', 'чилонзор'],
  'Шайхантаурский район': ['шайхантаур', 'shaykhantaur', 'шайхонтохур'],
  'Юнусабадский район': ['юнусабад', 'yunusabad', 'юнусобод'],
  'Яккасарайский район': ['яккасарай', 'yakkasaray', 'яккасарой'],
  'Яшнабадский район': ['яшнабад', 'yashnabad', 'яшнобод'],
};

// Районы других городов Узбекистана
const OTHER_DISTRICTS: Record<string, string[]> = {
  // Самарканд
  'Самаркандский район': ['самаркандский', 'samarkand district'],
  // Бухара
  'Бухарский район': ['бухарский', 'bukhara district'],
  // Фергана
  'Ферганский район': ['ферганский', 'fergana district'],
};

/**
 * Определяет страну из адреса или города
 */
export function detectCountry(address: string, city?: string): string | null {
  const text = `${address} ${city || ''}`.toLowerCase();
  
  for (const [country, keywords] of Object.entries(COUNTRIES)) {
    if (keywords.some(kw => text.includes(kw))) {
      return country;
    }
  }
  
  return null;
}

/**
 * Определяет регион из адреса или города
 */
export function detectRegion(address: string, city?: string): string | null {
  const text = `${address} ${city || ''}`.toLowerCase();
  
  // Сначала проверяем регионы Узбекистана
  for (const [region, keywords] of Object.entries(UZ_REGIONS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return region;
    }
  }
  
  // Для России и других стран - извлекаем область из адреса
  const regionPatterns = [
    /(\w+ская область)/i,
    /(\w+ский край)/i,
    /(\w+ область)/i,
    /(\w+ region)/i,
  ];
  
  for (const pattern of regionPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Определяет район из адреса
 */
export function detectDistrict(address: string, city?: string): string | null {
  const text = `${address} ${city || ''}`.toLowerCase();
  
  // Проверяем районы Ташкента
  for (const [district, keywords] of Object.entries(TASHKENT_DISTRICTS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return district;
    }
  }
  
  // Проверяем другие районы
  for (const [district, keywords] of Object.entries(OTHER_DISTRICTS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return district;
    }
  }
  
  // Пытаемся извлечь район из адреса паттерном
  const districtPatterns = [
    /(\w+ский район)/i,
    /(\w+ий район)/i,
    /(\w+ район)/i,
    /(\w+ district)/i,
    /район\s+(\w+)/i,
  ];
  
  for (const pattern of districtPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return null;
}

/**
 * Определяет все географические данные из адреса
 */
export function parseGeoFromAddress(address: string, city?: string): {
  country: string | null;
  region: string | null;
  district: string | null;
} {
  return {
    country: detectCountry(address, city),
    region: detectRegion(address, city),
    district: detectDistrict(address, city),
  };
}

/**
 * Нормализует город (убирает приставки типа "г.", "city" и т.д.)
 */
export function normalizeCity(city: string): string {
  return city
    .replace(/^(г\.|город|city|c\.)\s*/i, '')
    .replace(/\s+(г\.|город|city)$/i, '')
    .trim();
}

