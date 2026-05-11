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

# Отчётность (операционный контур)
EV_REPORT_PREPARATION_STARTED = "ReportPreparationStarted"
EV_REPORT_VALIDATED = "ReportValidated"
EV_REPORT_GENERATED = "ReportGenerated"
EV_OBLIGATION_CREATED = "ObligationCreated"
EV_SUBMISSION_COMPLETED = "SubmissionCompleted"

# Коллаборация / бух. контур
EV_ORGANIZATION_SWITCHED = "OrganizationSwitched"
EV_COMMENT_ADDED = "CommentAdded"
EV_APPROVAL_REQUESTED = "ApprovalRequested"
EV_APPROVAL_COMPLETED = "ApprovalCompleted"
EV_DOCUMENT_REQUESTED = "DocumentRequested"
