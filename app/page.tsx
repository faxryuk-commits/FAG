export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          🍽️ Справочник ресторанов
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Найдите лучшие рестораны в вашем городе
        </p>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Добро пожаловать!</h2>
          <p className="text-gray-700 mb-4">
            Проект настроен и готов к разработке. Следующие шаги:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Настройте переменные окружения в файле .env</li>
            <li>Запустите миграции Prisma: <code className="bg-gray-100 px-2 py-1 rounded">npx prisma migrate dev</code></li>
            <li>Создайте Apify актеры для парсинга данных</li>
            <li>Начните разработку компонентов интерфейса</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

