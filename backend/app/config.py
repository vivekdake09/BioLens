"""
Configuration settings for BioLens backend
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    api_title: str = "BioLens API"
    api_version: str = "0.1.0"
    debug: bool = True  # Default to True for development
    
    # Database Configuration
    redis_url: str = "redis://localhost:6379"
    redis_password: Optional[str] = None
    
    # Security Configuration
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # External Services
    firebase_credentials_path: Optional[str] = None
    gemini_api_key: Optional[str] = None
    
    # ML Services
    biobert_service_url: str = "http://localhost:8001"
    image_analysis_service_url: str = "http://localhost:8002"
    
    # Privacy Settings
    default_session_expire_hours: int = 24
    max_image_size_mb: int = 10
    supported_image_formats: list[str] = ["image/jpeg", "image/png", "image/webp"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()