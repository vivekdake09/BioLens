"""
Session management for BioLens backend
Handles user sessions with Redis storage
"""

import json
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import redis
from pydantic import BaseModel, Field

from .config import settings


class PrivacySettings(BaseModel):
    """User privacy settings"""
    data_retention_hours: int = Field(default=24, ge=1, le=168)  # 1 hour to 1 week
    allow_cloud_processing: bool = Field(default=True)
    anonymize_data: bool = Field(default=True)
    delete_images_immediately: bool = Field(default=True)


class ChatMessage(BaseModel):
    """Chat message model"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = Field(..., description="Message type: user, system, analysis")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class UserSession(BaseModel):
    """User session model"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    messages: List[ChatMessage] = Field(default_factory=list)
    analyses: List[str] = Field(default_factory=list, description="Analysis IDs")
    privacy_settings: PrivacySettings = Field(default_factory=PrivacySettings)
    expires_at: datetime = Field(default=None)

    def __init__(self, **data):
        super().__init__(**data)
        if self.expires_at is None:
            self.expires_at = self.created_at + timedelta(
                hours=self.privacy_settings.data_retention_hours
            )

    def is_expired(self) -> bool:
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at

    def update_activity(self) -> None:
        """Update last activity timestamp"""
        self.last_activity = datetime.utcnow()

    def add_message(self, message: ChatMessage) -> None:
        """Add a message to the session"""
        self.messages.append(message)
        self.update_activity()

    def add_analysis(self, analysis_id: str) -> None:
        """Add an analysis ID to the session"""
        self.analyses.append(analysis_id)
        self.update_activity()

    def get_context(self, max_messages: int = 10) -> List[str]:
        """Get recent conversation context"""
        recent_messages = self.messages[-max_messages:] if self.messages else []
        return [msg.content for msg in recent_messages if msg.type == "user"]


class SessionManager:
    """Redis-based session manager"""

    def __init__(self):
        """Initialize Redis connection"""
        self.redis_client = None
        self._connect()

    def _connect(self) -> None:
        """Connect to Redis"""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                password=settings.redis_password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            # Test connection
            self.redis_client.ping()
        except redis.RedisError as e:
            # For development, we'll use a simple in-memory fallback
            print(f"Redis connection failed: {e}. Using in-memory fallback.")
            self.redis_client = None
            self._sessions = {}  # In-memory fallback

    def _get_session_key(self, session_id: str) -> str:
        """Get Redis key for session"""
        return f"session:{session_id}"

    async def create_session(self, privacy_settings: Optional[Dict[str, Any]] = None) -> UserSession:
        """Create a new user session"""
        privacy_config = PrivacySettings(**(privacy_settings or {}))
        session = UserSession(privacy_settings=privacy_config)
        
        await self._store_session(session)
        return session

    async def get_session(self, session_id: str) -> Optional[UserSession]:
        """Get session by ID"""
        if self.redis_client:
            try:
                session_data = self.redis_client.get(self._get_session_key(session_id))
                if session_data:
                    session_dict = json.loads(session_data)
                    session = UserSession(**session_dict)
                    
                    if session.is_expired():
                        await self.delete_session(session_id)
                        return None
                    
                    return session
            except (redis.RedisError, json.JSONDecodeError, ValueError) as e:
                print(f"Error retrieving session {session_id}: {e}")
                return None
        else:
            # In-memory fallback
            session = self._sessions.get(session_id)
            if session and session.is_expired():
                del self._sessions[session_id]
                return None
            return session

        return None

    async def update_session(self, session: UserSession) -> bool:
        """Update existing session"""
        session.update_activity()
        return await self._store_session(session)

    async def delete_session(self, session_id: str) -> bool:
        """Delete session"""
        if self.redis_client:
            try:
                result = self.redis_client.delete(self._get_session_key(session_id))
                return result > 0
            except redis.RedisError as e:
                print(f"Error deleting session {session_id}: {e}")
                return False
        else:
            # In-memory fallback
            if session_id in self._sessions:
                del self._sessions[session_id]
                return True
            return False

    async def _store_session(self, session: UserSession) -> bool:
        """Store session in Redis"""
        if self.redis_client:
            try:
                session_key = self._get_session_key(session.session_id)
                session_data = session.json()
                
                # Calculate TTL based on expiration
                ttl_seconds = int((session.expires_at - datetime.utcnow()).total_seconds())
                if ttl_seconds <= 0:
                    return False
                
                self.redis_client.setex(session_key, ttl_seconds, session_data)
                return True
            except redis.RedisError as e:
                print(f"Error storing session {session.session_id}: {e}")
                return False
        else:
            # In-memory fallback
            self._sessions[session.session_id] = session
            return True

    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions (for scheduled cleanup)"""
        if not self.redis_client:
            # In-memory cleanup
            expired_sessions = [
                sid for sid, session in self._sessions.items()
                if session.is_expired()
            ]
            for sid in expired_sessions:
                del self._sessions[sid]
            return len(expired_sessions)

        # Redis cleanup - expired keys are automatically removed by TTL
        # This method is mainly for manual cleanup if needed
        try:
            pattern = "session:*"
            session_keys = self.redis_client.keys(pattern)
            expired_count = 0
            
            for key in session_keys:
                ttl = self.redis_client.ttl(key)
                if ttl == -2:  # Key doesn't exist (expired)
                    expired_count += 1
                elif ttl == -1:  # Key exists but has no expiration
                    # This shouldn't happen, but clean up just in case
                    session_data = self.redis_client.get(key)
                    if session_data:
                        try:
                            session_dict = json.loads(session_data)
                            session = UserSession(**session_dict)
                            if session.is_expired():
                                self.redis_client.delete(key)
                                expired_count += 1
                        except (json.JSONDecodeError, ValueError):
                            # Invalid session data, delete it
                            self.redis_client.delete(key)
                            expired_count += 1
            
            return expired_count
        except redis.RedisError as e:
            print(f"Error during session cleanup: {e}")
            return 0

    def health_check(self) -> Dict[str, Any]:
        """Check Redis connection health"""
        if self.redis_client:
            try:
                self.redis_client.ping()
                return {
                    "status": "healthy",
                    "backend": "redis",
                    "url": settings.redis_url
                }
            except redis.RedisError as e:
                return {
                    "status": "unhealthy",
                    "backend": "redis",
                    "error": str(e)
                }
        else:
            return {
                "status": "degraded",
                "backend": "in-memory",
                "note": "Using fallback storage"
            }


# Global session manager instance
session_manager = SessionManager()