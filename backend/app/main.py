"""
BioLens FastAPI Backend
Main application entry point
"""

from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
import uvicorn
import logging
from dotenv import load_dotenv

from .config import settings
from .models import HealthResponse, ErrorResponse
from .session import session_manager
from .routers import sessions
from .middleware import security_middleware, logging_middleware
from .security import rate_limiter

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize rate limiter with Redis connection
if session_manager.redis_client:
    rate_limiter.redis_client = session_manager.redis_client

# Create FastAPI application
app = FastAPI(
    title=settings.api_title,
    description="Privacy-focused healthcare accessibility API for symptom analysis",
    version=settings.api_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None
)

# Security scheme
security = HTTPBearer(auto_error=False)

# Configure CORS with more restrictive settings for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "https://localhost:3000"
    ] if settings.debug else [],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=[
        "Accept",
        "Accept-Language", 
        "Content-Language",
        "Content-Type",
        "Authorization"
    ],
    expose_headers=["X-Request-ID"]
)

# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost", "testserver"] if settings.debug else ["yourdomain.com"]
)

# Include routers
app.include_router(sessions.router, prefix="/api/v1")


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    # HSTS header for HTTPS (only in production)
    if not settings.debug:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "font-src 'self'; "
        "object-src 'none'; "
        "media-src 'self'; "
        "frame-src 'none';"
    )
    
    return response


@app.middleware("http")
async def security_and_logging_middleware(request: Request, call_next):
    """Combined security and logging middleware"""
    return await security_middleware(request, call_next)


@app.get("/", response_model=dict, tags=["Health"])
async def root():
    """Root endpoint for basic API information"""
    return {
        "message": "BioLens API is running",
        "version": settings.api_version,
        "timestamp": datetime.utcnow().isoformat(),
        "docs_url": "/docs" if settings.debug else None
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Comprehensive health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="biolens-backend",
        version=settings.api_version
    )


@app.get("/health/detailed", response_model=dict, tags=["Health"])
async def detailed_health_check():
    """Detailed health check with service dependencies"""
    redis_health = session_manager.health_check()
    
    # Check rate limiter status
    rate_limiter_status = {
        "status": "healthy" if rate_limiter.redis_client else "degraded",
        "backend": "redis" if rate_limiter.redis_client else "in-memory"
    }
    
    return {
        "status": "healthy",
        "service": "biolens-backend",
        "version": settings.api_version,
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {
            "redis": redis_health,
            "rate_limiter": rate_limiter_status,
            "biobert_service": "not_checked",  # Will be implemented in task 3
            "image_analysis_service": "not_checked"  # Will be implemented in task 4
        }
    }


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with structured error response"""
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error_code=f"HTTP_{exc.status_code}",
            message=str(exc.detail),
            user_message="An error occurred while processing your request",
            retry_possible=exc.status_code >= 500,
            suggested_action="Please try again later" if exc.status_code >= 500 else None
        ).dict()
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Handle validation errors"""
    logger.warning(f"Validation error: {str(exc)}")
    
    return JSONResponse(
        status_code=400,
        content=ErrorResponse(
            error_code="VALIDATION_ERROR",
            message=str(exc),
            user_message="Invalid input provided",
            retry_possible=True,
            suggested_action="Please check your input and try again"
        ).dict()
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors"""
    logger.error(f"Unhandled exception: {type(exc).__name__}: {str(exc)}")
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error_code="INTERNAL_ERROR",
            message="An unexpected error occurred",
            user_message="We're experiencing technical difficulties. Please try again later.",
            retry_possible=True,
            suggested_action="Please try again in a few minutes"
        ).dict()
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )