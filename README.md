# boblox

Минимальная версия под GitHub Pages: полностью статический сайт без backend и без сборки.

## Новая архитектура

- `index.html` — UI (редактор, кнопка Run, canvas).
- `app.js` — локальный runtime + 3D-сцена Babylon.js.
- `styles.css` — стили.
- `README.md` — краткая документация.

## Деплой на GitHub Pages

1. Загрузи эти файлы в репозиторий.
2. В GitHub: `Settings -> Pages`.
3. `Source: Deploy from a branch`.
4. Выбери `main` и папку `/ (root)`.
5. Открой `https://<user>.github.io/<repo>/`.

## Команды в скрипте

- `print("text")`
- `createPlayer("Noob")`
- `createFloor(80, "#4f8f4f")`
- `setSky("day" | "sunset" | "night" | "#87ceeb")`
- `setSpeed(10)`
- `movePlayer(2, 0)`
- `jump(8)`
- `teleport(0, 3, 0)`
- `spawnPart("Box", 2, 1, 0, 2, "#ff8844")`
- `createPart(...)` (alias для `spawnPart`)

## Управление

- `W A S D` — движение персонажа
- `Space` — прыжок
