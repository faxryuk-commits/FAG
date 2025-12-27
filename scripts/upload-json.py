#!/usr/bin/env python3
"""
Скрипт для загрузки JSON файла на сервер
Использование: python3 scripts/upload-json.py /path/to/file.json
"""

import json
import sys
import urllib.request
import time

def upload_file(file_path):
    print(f"📂 Загружаю файл: {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"📊 Всего записей: {len(data)}")
    
    # Разбиваем на чанки по 200 записей
    chunk_size = 200
    chunks = [data[i:i+chunk_size] for i in range(0, len(data), chunk_size)]
    print(f"📦 Разбито на {len(chunks)} чанков по {chunk_size} записей")
    
    api_url = "https://fag-pi818ieid-delever.vercel.app/api/import"
    total_processed = 0
    total_errors = 0
    total_skipped = 0
    
    start_time = time.time()
    
    for i, chunk in enumerate(chunks):
        print(f"\n🚀 Чанк {i+1}/{len(chunks)} ({len(chunk)} записей)...", end=" ", flush=True)
        
        try:
            req = urllib.request.Request(
                api_url,
                data=json.dumps({"data": chunk, "source": "google"}).encode('utf-8'),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            with urllib.request.urlopen(req, timeout=180) as response:
                result = json.loads(response.read().decode('utf-8'))
                stats = result.get('stats', {})
                processed = stats.get('processed', 0)
                errors = stats.get('errors', 0)
                skipped = stats.get('skipped', 0)
                total_processed += processed
                total_errors += errors
                total_skipped += skipped
                print(f"✓ {processed} OK, {errors} ошибок, {skipped} пропущено")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            print(f"✗ HTTP {e.code}: {error_body[:100]}")
            total_errors += len(chunk)
        except Exception as e:
            print(f"✗ {str(e)[:80]}")
            total_errors += len(chunk)
        
        # Пауза между чанками
        if i < len(chunks) - 1:
            time.sleep(0.5)
    
    elapsed = time.time() - start_time
    
    print(f"\n{'='*50}")
    print(f"✅ ИМПОРТ ЗАВЕРШЁН за {elapsed:.1f} сек")
    print(f"{'='*50}")
    print(f"📊 Всего в файле:    {len(data)}")
    print(f"✓  Импортировано:    {total_processed}")
    print(f"⏭  Пропущено:        {total_skipped}")
    print(f"✗  Ошибок:           {total_errors}")
    print(f"{'='*50}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Укажите путь к JSON файлу")
        print("Использование: python3 scripts/upload-json.py /path/to/file.json")
        sys.exit(1)
    
    upload_file(sys.argv[1])


