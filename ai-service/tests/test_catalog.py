from collections import Counter

from app.services import catalog


def _fake_db(monkeypatch):
    class Coll:
        def __init__(self, rows):
            self.rows = rows

        def find(self, *args, **kwargs):
            return list(self.rows)

    data = {
        "categories": [{"categoryId": "c1", "categoryName": "Sữa"}, {"categoryId": "c2", "categoryName": "Rau củ"}],
        "products": [
            {"productId": "p1", "productName": "Sữa tươi Vinamilk 1L", "categoryId": "c1", "description": "sữa tươi tiệt trùng", "price": 30000, "soldCount": 5},
            {"productId": "p2", "productName": "Sữa tươi TH True Milk", "categoryId": "c1", "description": "sữa tươi sạch", "price": 32000, "soldCount": 9},
            {"productId": "p3", "productName": "Cải thìa", "categoryId": "c2", "description": "rau xanh", "price": 10000, "soldCount": 1},
        ],
        "inventories": [{"productId": p, "quantity": 5, "reservedQuantity": 0} for p in ("p1", "p2", "p3")],
    }
    monkeypatch.setattr(catalog, "get_db", lambda: {k: Coll(v) for k, v in data.items()})
    catalog._cache.update(at=0.0, docs=[])
    catalog._stock_cache.clear()


def test_similar_prefers_same_category(monkeypatch):
    _fake_db(monkeypatch)
    rows = catalog.similar("p1", "s1", 2)
    assert rows[0]["productId"] == "p2"


def test_search_handles_accents(monkeypatch):
    _fake_db(monkeypatch)
    assert catalog.search("sua tuoi", "s1")[0]["productId"] in ("p1", "p2")
    assert catalog.search("xyz khong co", "s1") == []


def test_best_sellers_order(monkeypatch):
    _fake_db(monkeypatch)
    assert catalog.best_sellers("s1", 1)[0]["productId"] == "p2"
