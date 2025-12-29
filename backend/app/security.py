"""
Security utilities and middleware for BioLens backend
"""

import hashlib
import time
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import redis
import logging

from .config import settings

# Configure security logger
security_logger = logging.getLogger("biolens.security")


class RateLimiter:
    """Redis-based rate limiter"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client
        self.fallback_storage: Dict[str, Dict] = {}  # In-memory fallback
        
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Use IP address as primary identifier
        client_ip = request.client.host if request.client else "unknown"
        
        # Add forwarded headers for proxy support
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
            
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            client_ip = real_ip
            
        return client_ip
    
    def _get_rate_limit_key(self, client_id: str, endpoint: str) -> str:
        """Generate rate limit key"""
        return f"rate_limit:{client_id}:{endpoint}"
    
    async def check_rate_limit(
        self, 
        request: Request, 
        max_requests: int = 100, 
        window_seconds: int = 3600,
        endpoint: Optional[str] = None
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check if request is within rate limit
        Returns (is_allowed, rate_info)
        """
        client_id = self._get_client_id(request)
        endpoint = endpoint or request.url.path
        
        current_time = int(time.time())
        window_start = current_time - window_seconds
        
        if self.redis_client:
            try:
                return await self._check_redis_rate_limit(
                    client_id, endpoint, max_requests, window_seconds, current_time, window_start
                )
            except redis.RedisError as e:
                security_logger.warning(f"Redis rate limit check failed: {e}")
                # Fall through to in-memory fallback
        
        return self._check_memory_rate_limit(
            client_id, endpoint, max_requests, window_seconds, current_time, window_start
        )
    
    async def _check_redis_rate_limit(
        self, client_id: str, endpoint: str, max_requests: int, 
        window_seconds: int, current_time: int, window_start: int
    ) -> Tuple[bool, Dict[str, int]]:
        """Redis-based rate limit check"""
        key = self._get_rate_limit_key(client_id, endpoint)
        
        # Use Redis sorted set to track requests in time window
        pipe = self.redis_client.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current requests
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(current_time): current_time})
        
        # Set expiration
        pipe.expire(key, window_seconds)
        
        results = pipe.execute()
        current_requests = results[1]
        
        is_allowed = current_requests < max_requests
        remaining = max(0, max_requests - current_requests - 1)
        
        return is_allowed, {
            "limit": max_requests,
            "remaining": remaining,
            "reset_time": current_time + window_seconds,
            "window_seconds": window_seconds
        }
    
    def _check_memory_rate_limit(
        self, client_id: str, endpoint: str, max_requests: int,
        window_seconds: int, current_time: int, window_start: int
    ) -> Tuple[bool, Dict[str, int]]:
        """In-memory fallback rate limit check"""
        key = f"{client_id}:{endpoint}"
        
        if key not in self.fallback_storage:
            self.fallback_storage[key] = {"requests": [], "reset_time": current_time + window_seconds}
        
        client_data = self.fallback_storage[key]
        
        # Remove old requests
        client_data["requests"] = [
            req_time for req_time in client_data["requests"] 
            if req_time > window_start
        ]
        
        # Check limit
        current_requests = len(client_data["requests"])
        is_allowed = current_requests < max_requests
        
        if is_allowed:
            client_data["requests"].append(current_time)
        
        remaining = max(0, max_requests - current_requests - (1 if is_allowed else 0))
        
        return is_allowed, {
            "limit": max_requests,
            "remaining": remaining,
            "reset_time": client_data["reset_time"],
            "window_seconds": window_seconds
        }


class SecurityValidator:
    """Security validation utilities"""
    
    @staticmethod
    def validate_session_id(session_id: str) -> bool:
        """Validate session ID format"""
        if not session_id or len(session_id) < 10:
            return False
        
        # Check for basic UUID format (allowing for different UUID versions)
        import re
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
            re.IGNORECASE
        )
        return bool(uuid_pattern.match(session_id))
    
    @staticmethod
    def sanitize_input(text: str, max_length: int = 10000) -> str:
        """Sanitize user input"""
        if not text:
            return ""
        
        # Truncate to max length
        text = text[:max_length]
        
        # Remove null bytes and control characters (except newlines and tabs)
        text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')
        
        return text.strip()
    
    @staticmethod
    def hash_sensitive_data(data: str) -> str:
        """Hash sensitive data for logging"""
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    @staticmethod
    def validate_content_type(request: Request, allowed_types: list = None) -> bool:
        """Validate request content type"""
        if allowed_types is None:
            allowed_types = ["application/json", "multipart/form-data"]
        
        content_type = request.headers.get("content-type", "").split(";")[0].strip()
        return content_type.lower() in [t.lower() for t in allowed_types]


class PrivacyAwareLogger:
    """Privacy-aware logging utility"""
    
    def __init__(self, logger_name: str):
        self.logger = logging.getLogger(logger_name)
    
    def log_request(self, request: Request, session_id: Optional[str] = None, 
                   user_data: Optional[str] = None):
        """Log request with privacy protection"""
        client_ip = request.client.host if request.client else "unknown"
        
        # Hash sensitive data
        hashed_session = SecurityValidator.hash_sensitive_data(session_id) if session_id else None
        hashed_data = SecurityValidator.hash_sensitive_data(user_data) if user_data else None
        
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "client_ip_hash": SecurityValidator.hash_sensitive_data(client_ip),
            "session_hash": hashed_session,
            "data_hash": hashed_data,
            "user_agent": request.headers.get("user-agent", "")[:100]  # Truncate UA
        }
        
        self.logger.info(f"Request processed: {log_data}")
    
    def log_security_event(self, event_type: str, details: Dict, severity: str = "WARNING"):
        """Log security events"""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": event_type,
            "severity": severity,
            "details": details
        }
        
        if severity == "ERROR":
            self.logger.error(f"Security event: {log_data}")
        elif severity == "WARNING":
            self.logger.warning(f"Security event: {log_data}")
        else:
            self.logger.info(f"Security event: {log_data}")


# Global instances
rate_limiter = RateLimiter()
security_validator = SecurityValidator()
privacy_logger = PrivacyAwareLogger("biolens.privacy")


async def rate_limit_middleware(request: Request, max_requests: int = 100, window_seconds: int = 3600):
    """Rate limiting middleware"""
    is_allowed, rate_info = await rate_limiter.check_rate_limit(
        request, max_requests, window_seconds
    )
    
    if not is_allowed:
        privacy_logger.log_security_event(
            "rate_limit_exceeded",
            {
                "client_ip_hash": SecurityValidator.hash_sensitive_data(
                    request.client.host if request.client else "unknown"
                ),
                "endpoint": request.url.path,
                "limit": max_requests,
                "window": window_seconds
            },
            "WARNING"
        )
        
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={
                "X-RateLimit-Limit": str(rate_info["limit"]),
                "X-RateLimit-Remaining": str(rate_info["remaining"]),
                "X-RateLimit-Reset": str(rate_info["reset_time"]),
                "Retry-After": str(rate_info["window_seconds"])
            }
        )
    
    return rate_info


def validate_request_security(request: Request):
    """Validate request security"""
    # Check content type for POST/PUT requests
    if request.method in ["POST", "PUT", "PATCH"]:
        if not security_validator.validate_content_type(request):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Unsupported content type"
            )
    
    # Check for suspicious headers
    suspicious_headers = ["x-forwarded-host", "x-original-url", "x-rewrite-url"]
    for header in suspicious_headers:
        if header in request.headers:
            privacy_logger.log_security_event(
                "suspicious_header",
                {"header": header, "value": request.headers[header][:100]},
                "WARNING"
            )
    
    return True