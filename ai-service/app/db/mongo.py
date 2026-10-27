from pymongo import MongoClient

from app.core.config import settings

_client: MongoClient | None = None


def get_db():
    """Tra ve database MongoDB (dung chung voi backend). Ket noi duoc tao khi can."""
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
    return _client.get_default_database()
