# 🔧 Настройка скреперов (Apify Actors)

## 🗺️ Google Maps (Рекомендуется)

### Используемый актер
**[compass/crawler-google-places](https://apify.com/compass/crawler-google-places)**

### Как протестировать

1. Откройте [apify.com/compass/crawler-google-places](https://apify.com/compass/crawler-google-places)
2. Нажмите **Try for free**
3. Введите настройки:

```json
{
  "searchStringsArray": ["рестораны Москва"],
  "maxCrawledPlacesPerSearch": 20,
  "language": "ru",
  "deeperCityScrape": false
}
```

4. Нажмите **Start**
5. Дождитесь завершения и посмотрите результаты

### Формат данных

Актер возвращает данные в формате:

```json
{
  "title": "Название ресторана",
  "address": "Полный адрес",
  "city": "Москва",
  "location": {
    "lat": 55.7558,
    "lng": 37.6173
  },
  "phone": "+7 495 123-45-67",
  "website": "https://example.com",
  "totalScore": 4.5,
  "reviewsCount": 123,
  "price": "$$",
  "placeId": "ChIJxxxxxx",
  "url": "https://www.google.com/maps/place/...",
  "imageUrls": ["https://..."],
  "categories": ["Ресторан", "Кафе"],
  "openingHours": [...],
  "reviews": [...]
}
```

---

## 🔴 Яндекс.Карты

### Вариант 1: Web Scraper (простой)

Используем [apify/web-scraper](https://apify.com/apify/web-scraper) с кастомным скриптом.

#### Настройки:

```json
{
  "startUrls": [
    { "url": "https://yandex.ru/maps/213/moscow/category/restaurant/" }
  ],
  "pageFunction": "async function pageFunction(context) { ... }",
  "maxRequestsPerCrawl": 100
}
```

### Вариант 2: Cheerio Scraper (быстрый)

Используем [apify/cheerio-scraper](https://apify.com/apify/cheerio-scraper).

### Вариант 3: Кастомный актер

Можно создать свой актер специально для Яндекс.Карт.

---

## 🟢 2ГИС

### Настройки для Web Scraper:

```json
{
  "startUrls": [
    { "url": "https://2gis.ru/moscow/search/рестораны" }
  ],
  "maxRequestsPerCrawl": 100
}
```

---

## ⚙️ Настройка в Vercel

Можно переопределить ID актеров через переменные окружения:

| Переменная | Описание | Пример |
|------------|----------|--------|
| `APIFY_ACTOR_GOOGLE` | Актер для Google Maps | `compass/crawler-google-places` |
| `APIFY_ACTOR_YANDEX` | Актер для Яндекс.Карт | `your-username/yandex-maps` |
| `APIFY_ACTOR_2GIS` | Актер для 2ГИС | `your-username/2gis-scraper` |

---

## 💰 Стоимость

### Бесплатный план Apify
- $5 compute units в месяц
- Хватает примерно на **500-1000 мест**

### Примерная стоимость парсинга
| Количество | Compute Units | Время |
|------------|---------------|-------|
| 50 мест | ~$0.10 | ~2 мин |
| 200 мест | ~$0.40 | ~8 мин |
| 1000 мест | ~$2.00 | ~40 мин |

---

## 🚀 Запуск парсинга

### Через админ-панель
1. Откройте `/admin`
2. Выберите источник
3. Введите запрос и город
4. Нажмите "Запустить парсинг"

### Через API

```bash
# Google Maps
curl -X POST https://your-site.vercel.app/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "source": "google",
    "searchQuery": "рестораны",
    "location": "Москва",
    "maxResults": 50
  }'

# Проверка статуса
curl https://your-site.vercel.app/api/sync?jobId=JOB_ID
```

### Через Apify напрямую

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
  token: 'YOUR_API_TOKEN',
});

const run = await client.actor('compass/crawler-google-places').call({
  searchStringsArray: ['рестораны Москва'],
  maxCrawledPlacesPerSearch: 50,
  language: 'ru',
});

console.log('Results:', run.defaultDatasetId);
```

---

## 🔍 Полезные ссылки

- [Apify Store](https://apify.com/store) - магазин актеров
- [Google Maps Scraper](https://apify.com/compass/crawler-google-places)
- [Web Scraper](https://apify.com/apify/web-scraper)
- [Apify Documentation](https://docs.apify.com)

