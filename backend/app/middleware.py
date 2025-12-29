"""
Custom middleware for BioLens backend
"""

import time
from typing import Callable
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse

from .security import rate_limit_middleware, validate_request_security, privacy_logger
from .models import ErrorResponse


async def security_middleware(request: Request, call_next: Callable) -> Response:
    """Security middleware for request validation and rate limiting"""
    start_time = time.time()
    
    try:
        # Skip security checks for health endpoints
        if request.url.path in ["/", "/health", "/health/detailed"]:
            response = await call_next(request)
            return response
        
        # Validate request security
        validate_request_security(request)
        
        # Apply rate limiting based on endpoint
        if request.url.path.startswith("/api/"):
            # API endpoints have stricter rate limits
            if request.method == "POST":
                # POST requests (creating sessions, analyses) are more limited
                await rate_limit_middleware(request, max_requests=20, window_seconds=3600)
            else:
                # GET requests have higher limits
                await rate_limit_middleware(request, max_requests=100, window_seconds=3600)
        else:
            # General endpoints
            await rate_limit_middleware(request, max_requests=200, window_seconds=3600)
        
        # Process request
        response = await call_next(request)
        
        # Log successful request (privacy-aware)
        processing_time = time.time() - start_time
        if processing_time > 5.0:  # Log slow requests
            privacy_logger.log_security_event(
                "slow_request",
                {
                    "path": request.url.path,
                    "method": request.method,
                    "processing_time": processing_time
                },
                "INFO"
            )
        
        # Add security headers to response
        response.headers["X-Request-ID"] = str(int(time.time() * 1000))
        response.headers["X-Processing-Time"] = f"{processing_time:.3f}s"
        
        return response
        
    except HTTPException as e:
        # Handle known HTTP exceptions
        processing_time = time.time() - start_time
        
        # Log security-related errors
        if e.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
            privacy_logger.log_security_event(
                "rate_limit_violation",
                {
                    "path": request.url.path,
                    "status_code": e.status_code,
                    "processing_time": processing_time
                },
                "WARNING"
            )
        elif e.status_code in [400, 401, 403, 415]:
            privacy_logger.log_security_event(
                "security_violation",
                {
                    "path": request.url.path,
                    "status_code": e.status_code,
                    "detail": str(e.detail)[:200],  # Truncate detail
                    "processing_time": processing_time
                },
                "WARNING"
            )
        
        # Return structured error response
        error_response = ErrorResponse(
            error_code=f"HTTP_{e.status_code}",
            message=str(e.detail),
            user_message="Request could not be processed",
            retry_possible=e.status_code >= 500,
            suggested_action="Please check your request and try again" if e.status_code < 500 else "Please try again later"
        )
        
        return JSONResponse(
            status_code=e.status_code,
            content=error_response.dict(),
            headers=getattr(e, 'headers', {})
        )
        
    except Exception as e:
        # Handle unexpected errors
        processing_time = time.time() - start_time
        
        privacy_logger.log_security_event(
            "unexpected_error",
            {
                "path": request.url.path,
                "error_type": type(e).__name__,
                "error_message": str(e)[:200],  # Truncate error message
                "processing_time": processing_time
            },
            "ERROR"
        )
        
        error_response = ErrorResponse(
            error_code="INTERNAL_ERROR",
            message="An unexpected error occurred",
            user_message="We're experiencing technical difficulties. Please try again later.",
            retry_possible=True,
            suggested_action="Please try again in a few minutes"
        )
        
        return JSONResponse(
            status_code=500,
            content=error_response.dict()
        )


async def logging_middleware(request: Request, call_next: Callable) -> Response:
    """Privacy-aware logging middleware"""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Log request with privacy protection
    processing_time = time.time() - start_time
    
    # Extract session ID from headers or query params (if present)
    session_id = request.headers.get("X-Session-ID") or request.query_params.get("session_id")
    
    # Log the request
    privacy_logger.log_request(
        request=request,
        session_id=session_id,
        user_data=None  # We don't log actual user data for privacy
    )
    
    return response