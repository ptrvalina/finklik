from app.services.assistant_knowledge import append_demo_sources_footer, retrieve_for_query


def test_retrieve_finds_imns_related():
    chunks, block = retrieve_for_query("Как подать декларацию по НДС в ИМНС?", limit=5)
    assert block
    assert any("kb-imns" in (c.get("id") or "") for c in chunks)


def test_retrieve_nbrb_for_fx_query():
    chunks, _ = retrieve_for_query("курс доллара НБ РБ", limit=8)
    ids = [c.get("id") for c in chunks]
    assert "kb-nbrb" in ids or any("nbrb" in str(i) for i in ids)


def test_catalog_virtual_chunk_for_egr():
    chunks, block = retrieve_for_query("проверка контрагента по УНП в егр", limit=10)
    assert block
    assert any(c.get("id") == "kb-egr-unp" or str(c.get("id", "")).startswith("cat-") for c in chunks)


def test_demo_footer_non_empty_for_tax_query():
    foot = append_demo_sources_footer("УСН и сроки в налоговой")
    assert "Ориентиры" in foot or "Pravo" in foot or "nalog" in foot.lower()


def test_retrieve_fallback_when_no_token_match():
    """При отсутствии совпадений возвращаются первые чанки как общий ориентир."""
    chunks, block = retrieve_for_query("@@@", limit=3)
    assert isinstance(chunks, list)
    assert isinstance(block, str)
