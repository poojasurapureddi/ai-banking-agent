import os
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Banking Agent"
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/banking_db",
        env="DATABASE_URL"
    )
    
    # JWT Auth
    JWT_SECRET: str = Field(
        default="supersecretjwtkeyforbankingapplication12345!",
        env="JWT_SECRET"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # LLM keys
    GEMINI_API_KEY: str | None = Field(default=None, env="GEMINI_API_KEY")
    OPENAI_API_KEY: str | None = Field(default=None, env="OPENAI_API_KEY")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
