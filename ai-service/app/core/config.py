from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Doc tu bien moi truong / file .env (xem .env.example o thu muc goc)
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    mongo_uri: str = "mongodb://localhost:27017/supermarket"
    internal_api_key: str = ""  # backend goi sang phai kem header X-Internal-Key
    llm_provider: str = ""
    llm_api_key: str = ""
    llm_model: str = ""


settings = Settings()
