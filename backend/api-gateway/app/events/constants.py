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
EV_DOCUMENT_SIGNED = "DocumentSigned"

# Коллаборация / бух. контур
EV_ORGANIZATION_SWITCHED = "OrganizationSwitched"
EV_COMMENT_ADDED = "CommentAdded"

# Безопасность / сессии (append-only; обработчики workflow не подписаны — skip_workflow при записи)
EV_USER_LOGGED_IN = "UserLoggedIn"
EV_USER_LOGGED_OUT = "UserLoggedOut"
EV_REFRESH_TOKEN_ROTATED = "RefreshTokenRotated"
EV_REFRESH_TOKEN_REUSE_DETECTED = "RefreshTokenReuseDetected"
EV_SESSION_REVOKED = "SessionRevoked"
EV_FAILED_LOGIN_ATTEMPT = "FailedLoginAttempt"
EV_PASSWORD_CHANGED = "PasswordChanged"
EV_APPROVAL_REQUESTED = "ApprovalRequested"
EV_APPROVAL_COMPLETED = "ApprovalCompleted"
EV_DOCUMENT_REQUESTED = "DocumentRequested"

# Профиль организации / учётный контур
EV_OKED_SELECTED = "OkedSelected"
EV_TAX_MODE_SELECTED = "TaxModeSelected"
EV_BUSINESS_PROFILE_COMPLETED = "BusinessProfileCompleted"
EV_ACCOUNT_CREATED = "AccountCreated"
EV_SUBACCOUNT_CREATED = "SubaccountCreated"
EV_AMORTIZATION_GENERATED = "AmortizationGenerated"
EV_WORK_PACK_ACKNOWLEDGED = "WorkPackAcknowledged"
