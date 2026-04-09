@echo off
chcp 65001 >nul
title ФинКлик — Запуск

echo.
echo  ====================================
echo       ФИНКЛИК — ЗАПУСК СЕРВИСОВ
echo  ====================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не найден!
    echo Скачай: https://python.org/downloads
    echo При установке отметь: "Add Python to PATH"
    pause & exit /b 1
)
echo [OK] Python найден

node --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден!
    echo Скачай: https://nodejs.org ^(версия 20 LTS^)
    pause & exit /b 1
)
echo [OK] Node.js найден

echo.
echo [1/4] Создаём виртуальное окружение Python...
if not exist "%~dp0backend\api-gateway\venv" (
    python -m venv "%~dp0backend\api-gateway\venv"
    echo      Окружение создано
) else (
    echo      Уже существует
)

echo [2/4] Устанавливаем зависимости бэкенда...
call "%~dp0backend\api-gateway\venv\Scripts\activate.bat"
pip install -q fastapi "uvicorn[standard]" "python-jose[cryptography]" "passlib[bcrypt]" "sqlalchemy[asyncio]" aiosqlite pydantic "pydantic-settings" python-multipart httpx structlog
echo      Готово

echo [3/4] Устанавливаем зависимости фронтенда...
if not exist "%~dp0frontend\web\node_modules" (
    cd /d "%~dp0frontend\web"
    call npm install --silent
    cd /d "%~dp0"
    echo      Установлено
) else (
    echo      Уже установлено
)

echo [4/4] Запускаем сервисы...
echo.

start "API Gateway :8000" cmd /k "cd /d %~dp0backend\api-gateway && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

timeout /t 2 /nobreak >nul

start "Mock Банк :8001" cmd /k "cd /d %~dp0backend\mock-bank && call ..\api-gateway\venv\Scripts\activate.bat && uvicorn main:app --port 8001"

timeout /t 1 /nobreak >nul

start "Mock 1С :8002" cmd /k "cd /d %~dp0onec-mock && call ..\backend\api-gateway\venv\Scripts\activate.bat && uvicorn main:app --port 8002"

timeout /t 1 /nobreak >nul

start "Фронтенд :5173" cmd /k "cd /d %~dp0frontend\web && npm run dev"

timeout /t 5 /nobreak >nul

echo  ====================================
echo  ВСЕ СЕРВИСЫ ЗАПУЩЕНЫ!
echo  ====================================
echo.
echo  Дашборд:   http://localhost:5173
echo  API Docs:  http://localhost:8000/docs
echo  Mock Банк: http://localhost:8001/docs
echo  Mock 1С:   http://localhost:8002/docs
echo.
echo  Открываю браузер...
start http://localhost:5173
echo.
echo  Нажми любую клавишу чтобы закрыть это окно.
echo  Остальные окна с сервисами оставь открытыми!
pause >nul
