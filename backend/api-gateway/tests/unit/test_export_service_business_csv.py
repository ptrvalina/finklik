"""CSV экспорт: колонки для интеграций и Business OS."""

from app.services.export_service import export_transactions_csv


def test_export_transactions_csv_includes_business_context_columns():
    raw = export_transactions_csv(
        [
            {
                "id": "tx-1",
                "transaction_date": "2026-01-15",
                "type": "expense",
                "amount": 10.5,
                "vat_amount": 0.0,
                "category": "office",
                "description": "Test",
                "status": "posted",
                "counterparty_id": "cp-1",
                "cost_center_id": "cc-1",
                "revenue_stream_id": None,
            }
        ]
    )
    text = raw.decode("utf-8-sig")
    assert "ID операции" in text
    assert "ID центра затрат" in text
    assert "tx-1" in text
    assert "cc-1" in text
    assert "cp-1" in text
