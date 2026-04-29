from app.models.transaction import Transaction


PIPELINE_STEPS = ("new", "parsed", "categorized", "verified", "reported")


def get_transaction_validation_issues(tx: Transaction) -> list[str]:
    issues: list[str] = []
    if not tx.description or not str(tx.description).strip():
        issues.append("Добавьте описание операции")
    if tx.type == "expense" and not tx.category:
        issues.append("Для расхода требуется категория")
    if tx.source == "scan" and not tx.receipt_image_url:
        issues.append("Для операции из скана нужен файл документа")
    return issues


def get_transaction_pipeline_status(tx: Transaction) -> str:
    if tx.status == "synced":
        return "reported"
    if tx.category:
        if not get_transaction_validation_issues(tx):
            return "verified"
        return "categorized"
    if tx.description and str(tx.description).strip():
        return "parsed"
    return "new"
