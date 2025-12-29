"""
Pydantic models for BioLens API
Request and response models for all endpoints
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, validator


class HealthResponse(BaseModel):
    """Health check response model"""
    status: str = Field(..., description="Service health status")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseModel):
    """Standard error response model"""
    error_code: str = Field(..., description="Error code identifier")
    message: str = Field(..., description="Technical error message")
    user_message: str = Field(..., description="User-friendly error message")
    retry_possible: bool = Field(..., description="Whether retry is possible")
    suggested_action: Optional[str] = Field(None, description="Suggested user action")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class RiskLevel(str, Enum):
    """Risk assessment levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EMERGENCY = "emergency"


class ProcessingStatus(str, Enum):
    """Processing status for async operations"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class MedicalEntity(BaseModel):
    """Medical entity extracted from text"""
    text: str = Field(..., description="Original text of the entity")
    label: str = Field(..., description="Entity type (SYMPTOM, CONDITION, etc.)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    start_pos: int = Field(..., ge=0, description="Start position in text")
    end_pos: int = Field(..., ge=0, description="End position in text")
    normalized_form: Optional[str] = Field(None, description="Normalized entity form")

    @validator('end_pos')
    def end_pos_must_be_greater_than_start(cls, v, values):
        if 'start_pos' in values and v <= values['start_pos']:
            raise ValueError('end_pos must be greater than start_pos')
        return v


class DetectedCondition(BaseModel):
    """Detected medical condition from image analysis"""
    condition_name: str = Field(..., description="Name of detected condition")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence")
    severity: str = Field(..., description="Condition severity level")
    category: str = Field(..., description="Medical category")
    description: str = Field(..., description="Condition description")
    requires_attention: bool = Field(..., description="Whether immediate attention needed")


class SymptomAnalysisRequest(BaseModel):
    """Request model for symptom analysis"""
    text: str = Field(..., min_length=1, max_length=10000, description="Symptom description")
    session_id: str = Field(..., description="User session identifier")
    context: Optional[List[str]] = Field(None, description="Previous conversation context")

    @validator('text')
    def text_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Symptom text cannot be empty or whitespace only')
        return v.strip()


class SymptomAnalysisResponse(BaseModel):
    """Response model for symptom analysis"""
    analysis_id: str = Field(..., description="Unique analysis identifier")
    entities: List[MedicalEntity] = Field(..., description="Extracted medical entities")
    risk_score: float = Field(..., ge=0.0, le=1.0, description="Preliminary risk score")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Analysis confidence")
    processing_time: float = Field(..., ge=0.0, description="Processing time in seconds")
    status: ProcessingStatus = Field(..., description="Processing status")


class ImageAnalysisRequest(BaseModel):
    """Request model for image analysis"""
    image_id: str = Field(..., description="Uploaded image identifier")
    session_id: str = Field(..., description="User session identifier")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional image metadata")


class ImageAnalysisResponse(BaseModel):
    """Response model for image analysis"""
    analysis_id: str = Field(..., description="Unique analysis identifier")
    conditions: List[DetectedCondition] = Field(..., description="Detected conditions")
    confidence_scores: Dict[str, float] = Field(..., description="Confidence scores by condition")
    processing_time: float = Field(..., ge=0.0, description="Processing time in seconds")
    status: ProcessingStatus = Field(..., description="Processing status")


class Recommendation(BaseModel):
    """Medical recommendation"""
    type: str = Field(..., description="Recommendation type")
    priority: int = Field(..., ge=1, le=5, description="Priority level (1=highest)")
    description: str = Field(..., description="Recommendation description")
    timeframe: Optional[str] = Field(None, description="Recommended timeframe")


class ReferralSuggestion(BaseModel):
    """Medical referral suggestion"""
    specialty: str = Field(..., description="Medical specialty")
    urgency: str = Field(..., description="Urgency level")
    reason: str = Field(..., description="Reason for referral")
    location_based: bool = Field(True, description="Whether location-based")


class AssessmentRequest(BaseModel):
    """Request model for combined assessment"""
    session_id: str = Field(..., description="User session identifier")
    symptom_analysis_id: Optional[str] = Field(None, description="Symptom analysis ID")
    image_analysis_id: Optional[str] = Field(None, description="Image analysis ID")

    @validator('symptom_analysis_id', 'image_analysis_id')
    def at_least_one_analysis_required(cls, v, values):
        # This will be called for each field, so we need to check if at least one is provided
        if not v and not any(values.values()):
            raise ValueError('At least one analysis ID must be provided')
        return v


class AssessmentResponse(BaseModel):
    """Response model for combined assessment"""
    assessment_id: str = Field(..., description="Unique assessment identifier")
    risk_level: RiskLevel = Field(..., description="Overall risk level")
    summary: str = Field(..., description="Assessment summary")
    recommendations: List[Recommendation] = Field(..., description="Medical recommendations")
    disclaimers: List[str] = Field(..., description="Medical disclaimers")
    referral_suggestions: List[ReferralSuggestion] = Field(..., description="Referral suggestions")
    processing_time: float = Field(..., ge=0.0, description="Total processing time")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SessionCreateRequest(BaseModel):
    """Request model for creating a new session"""
    privacy_settings: Optional[Dict[str, Any]] = Field(None, description="User privacy preferences")


class SessionResponse(BaseModel):
    """Response model for session operations"""
    session_id: str = Field(..., description="Session identifier")
    created_at: datetime = Field(..., description="Session creation time")
    expires_at: datetime = Field(..., description="Session expiration time")
    status: str = Field(..., description="Session status")