Скриншоты для product-presentation/index.html
=============================================

Сняты скриптом scripts/capture-presentation-screenshots.mjs с актуального UI
(локальный dev: vite + api-gateway). Раздел «Учёт» намеренно не включён.

  dashboard.png      — Главная
  bank.png           — Банк (ВТБ)
  scanner.png        — Сканер
  documents.png      — Документы
  calendar.png       — Календарь
  reports.png        — Отчёты (вкладки Обзор / Журнал / КУДиР / Налоги / Отчёты)
  employees.png      — Команда
  counterparties.png — Контрагенты
  settings.png       — Настройки
  assistant.png      — AI-консультант

Переснять:
  FC_API_URL=http://127.0.0.1:8000/api/v1 node scripts/capture-presentation-screenshots.mjs http://127.0.0.1:5173 browser
