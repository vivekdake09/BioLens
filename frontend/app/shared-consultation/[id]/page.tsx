"use client"

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Brain, 
  Shield, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  ExternalLink,
  Eye,
  Calendar,
  User,
  Stethoscope,
  FileText,
  Download,
  Lock
} from 'lucide-react'
import { ConsultationResponse } from '@/lib/api-client'

interface SharedConsultationData {
  consultation: ConsultationResponse
  symptoms: string
  sessionId: string
  analysisResult?: any
  createdAt: string
  expiresAt: string
  viewCount?: number
}

interface SharedConsultationPageProps {
  params: {
    id: string
  }
}

export default function SharedConsultationPage({ params }: SharedConsultationPageProps) {
  const [consultationData, setConsultationData] = useState<SharedConsultationData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewCount, setViewCount] = useState(0)

  useEffect(() => {
    loadSharedConsultation()
  }, [params.id])

  const loadSharedConsultation = async () => {
    try {
      // In a real implementation, this would fetch from an API
      // For demo purposes, we'll check localStorage
      const stored = localStorage.getItem(`shared-consultation-${params.id}`)
      
      if (!stored) {
        setError('Consultation not found or has expired')
        return
      }

      const data: SharedConsultationData = JSON.parse(stored)
      
      // Check if expired
      const expiresAt = new Date(data.expiresAt)
      if (new Date() > expiresAt) {
        setError('This consultation link has expired')
        localStorage.removeItem(`shared-consultation-${params.id}`)
        return
      }

      // Increment view count
      const currentViews = (data.viewCount || 0) + 1
      data.viewCount = currentViews
      localStorage.setItem(`shared-consultation-${params.id}`, JSON.stringify(data))
      
      setConsultationData(data)
      setViewCount(currentViews)
    } catch (error) {
      console.error('Failed to load shared consultation:', error)
      setError('Failed to load consultation data')
    } finally {
      setIsLoading(false)
    }
  }

  const getUrgencyConfig = (urgencyLevel: string) => {
    switch (urgencyLevel) {
      case 'immediate':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: AlertTriangle,
          label: 'Immediate Attention',
          description: 'Seek medical care immediately'
        }
      case 'within_week':
        return {
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          icon: Clock,
          label: 'Within a Week',
          description: 'Schedule appointment within 1-2 weeks'
        }
      case 'routine':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: CheckCircle,
          label: 'Routine Care',
          description: 'Schedule routine appointment'
        }
      case 'monitor':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: Info,
          label: 'Monitor',
          description: 'Continue monitoring condition'
        }
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Info,
          label: 'Assessment Needed',
          description: 'Consult healthcare provider'
        }
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Loading Consultation</h3>
          <p className="text-muted-foreground">Retrieving shared consultation data...</p>
        </Card>
      </div>
    )
  }

  if (error || !consultationData || !consultationData.consultation.consultation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Card className="p-8 max-w-md mx-auto text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold mb-2 text-foreground">Access Denied</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.href = '/'}>
            Return to BioLens
          </Button>
        </Card>
      </div>
    )
  }

  const { consultation, symptoms, sessionId, createdAt, expiresAt } = consultationData
  const consultationData_consultation = consultation.consultation
  if (!consultationData_consultation) return null
  
  const urgencyConfig = getUrgencyConfig(consultationData_consultation.urgencyLevel)
  const UrgencyIcon = urgencyConfig.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <nav className="border-b border-border/40 bg-card/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">BioLens</h1>
                <p className="text-xs text-muted-foreground">Shared Consultation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                View {viewCount}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Secure
              </Badge>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Consultation Header */}
        <Card className="p-6 mb-8 bg-gradient-to-br from-card to-card/80 border-2 border-border/50 shadow-lg">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">AI Medical Consultation</h2>
                  <p className="text-muted-foreground">Powered by {consultation.metadata?.modelUsed || 'BioLens AI'}</p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Created</p>
                  <p className="text-muted-foreground">{formatDate(createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Expires</p>
                  <p className="text-muted-foreground">{formatDate(expiresAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Session</p>
                  <p className="text-muted-foreground font-mono text-xs">{sessionId.substring(0, 12)}...</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Security</p>
                  <p className="text-green-600">Validated</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Urgency Level */}
        <div className="flex justify-center mb-8">
          <Badge 
            variant="outline" 
            className={`px-6 py-3 text-base font-semibold border-2 ${urgencyConfig.color}`}
          >
            <div className="flex items-center gap-3">
              <UrgencyIcon className="w-5 h-5" />
              <div className="text-left">
                <div className="font-semibold">{urgencyConfig.label}</div>
                <div className="text-sm opacity-80">{urgencyConfig.description}</div>
              </div>
            </div>
          </Badge>
        </div>

        {/* Consultation Content */}
        <div className="space-y-8">
          {/* Symptoms */}
          {symptoms && (
            <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-200">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                Reported Symptoms
              </h3>
              <p className="text-foreground leading-relaxed">{symptoms}</p>
            </Card>
          )}

          {/* Condition Assessment */}
          <Card className="p-6 bg-gradient-to-br from-muted/30 to-muted/50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-primary" />
              Condition Assessment
            </h3>
            <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line">
              {consultationData_consultation.conditionAssessment}
            </div>
          </Card>

          {/* Symptom Correlation */}
          {consultationData_consultation.symptomCorrelation && (
            <Card className="p-6 bg-gradient-to-r from-purple-50 to-purple-50/50 border border-purple-200">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-purple-600" />
                Symptom Analysis
              </h3>
              <p className="text-foreground leading-relaxed">
                {consultationData_consultation.symptomCorrelation}
              </p>
            </Card>
          )}

          {/* Recommendations */}
          <Card className="p-6 bg-gradient-to-r from-green-50 to-green-50/50 border border-green-200">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Recommendations ({consultationData_consultation.recommendations.length})
            </h3>
            <div className="space-y-3">
              {consultationData_consultation.recommendations.map((recommendation, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-4 bg-white/50 rounded-lg border border-green-100"
                >
                  <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-semibold mt-0.5 flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {recommendation}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Educational Information */}
          {consultationData_consultation.educationalInfo && (
            <Card className="p-6 bg-gradient-to-br from-amber-50/50 to-transparent border border-amber-200">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-600" />
                Educational Information
              </h3>
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line">
                {consultationData_consultation.educationalInfo}
              </div>
            </Card>
          )}

          {/* Medical Disclaimer */}
          <Alert className="bg-amber-50 border-amber-200 shadow-sm">
            <Shield className="h-5 w-5 text-amber-600" />
            <AlertDescription className="text-sm leading-relaxed text-amber-800">
              {consultationData_consultation.medicalDisclaimer}
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button
              onClick={() => window.print()}
              variant="outline"
              className="flex-1 h-12 font-semibold border-2"
            >
              <Download className="mr-2 h-5 w-5" />
              Print Report
            </Button>
            <Button 
              className="flex-1 h-12 font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300" 
              onClick={() => window.open('https://www.practo.com/search/doctors?results_type=doctor&q=%5B%7B%22word%22%3A%22Dermatologist%22%2C%22autocompleted%22%3Atrue%2C%22category%22%3A%22subspeciality%22%7D%5D&city=Bangalore', '_blank')}
            >
              <Stethoscope className="mr-2 h-5 w-5" />
              Find Healthcare Provider
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border/50 text-center">
          <p className="text-sm text-muted-foreground">
            This consultation was generated by BioLens AI and shared securely. 
            For your own analysis, visit{' '}
            <a href="/" className="text-primary hover:underline">
              BioLens.com
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}