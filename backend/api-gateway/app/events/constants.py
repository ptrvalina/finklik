"""Типы событий гибридного слоя (имена стабильны для подписок и обработчиков)."""

# Транзакции
EV_TRANSACTION_CREATED = "TransactionCreated"
EV_TRANSACTION_UPDATED = "TransactionUpdated"
EV_TRANSACTION_DELETED = "TransactionDeleted"
EV_TRANSACTION_CATEGORIZED = "TransactionCategorized"

# Документы / OCR
EV_DOCUMENT_OCR_PROCESSED = "DocumentOcrProcessed"
EV_OCR_LINKED = "OCRLinked"

# Сверка
EV_RECONCILIATION_MATCH_RECORDED = "ReconciliationMatchRecorded"
EV_RECONCILIATION_SUGGESTED = "ReconciliationSuggested"
EV_RECONCILIATION_CONFIRMED = "ReconciliationConfirmed"

# ИИ (только как события, без прямой мутации state обработчиками)
EV_AI_SUGGESTION = "AISuggestion"
EV_AI_SUGGESTION_RECORDED = "AISuggestionRecorded"  # API /analyze + dual-write
EV_AI_INSIGHT = "AIInsight"

# Проекции
EV_BUSINESS_STATE_STALE = "BusinessStateStale"
