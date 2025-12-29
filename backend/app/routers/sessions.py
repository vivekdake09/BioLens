"""
Session management API endpoints
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer

from ..models import SessionCreateRequest, SessionResponse, ErrorResponse
from ..session import session_manager, UserSession

router = APIRouter(prefix="/sessions", tags=["Sessions"])
security = HTTPBearer(auto_error=False)


@router.post("/", response_model=SessionResponse)
async def create_session(request: SessionCreateRequest):
    """Create a new user session"""
    try:
        session = await session_manager.create_session(request.privacy_settings)
        
        return SessionResponse(
            session_id=session.session_id,
            created_at=session.created_at,
            expires_at=session.expires_at,
            status="active"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create session: {str(e)}"
        )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Get session information"""
    session = await session_manager.get_session(session_id)
    
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found or expired"
        )
    
    return SessionResponse(
        session_id=session.session_id,
        created_at=session.created_at,
        expires_at=session.expires_at,
        status="active" if not session.is_expired() else "expired"
    )


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    success = await session_manager.delete_session(session_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )
    
    return {"message": "Session deleted successfully"}


@router.get("/{session_id}/context")
async def get_session_context(session_id: str, max_messages: int = 10):
    """Get conversation context for a session"""
    session = await session_manager.get_session(session_id)
    
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found or expired"
        )
    
    context = session.get_context(max_messages)
    
    return {
        "session_id": session_id,
        "context": context,
        "message_count": len(session.messages),
        "analysis_count": len(session.analyses)
    }


@router.post("/cleanup")
async def cleanup_expired_sessions():
    """Manual cleanup of expired sessions (admin endpoint)"""
    try:
        cleaned_count = await session_manager.cleanup_expired_sessions()
        return {
            "message": f"Cleaned up {cleaned_count} expired sessions",
            "cleaned_count": cleaned_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cleanup failed: {str(e)}"
        )


async def get_current_session(session_id: str) -> UserSession:
    """Dependency to get current session"""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session"
        )
    return session