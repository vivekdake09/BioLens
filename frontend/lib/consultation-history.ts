/**
 * Consultation History Management
 * Handles tracking, storage, and retrieval of consultation history
 * Requirement 7.1: Allow users to regenerate consultation with additional symptom information
 */

import { ConsultationResponse } from '@/lib/api-client'

export interface ConsultationHistoryEntry {
  id: string
  timestamp: Date
  symptoms: string
  consultation: ConsultationResponse
  regenerationReason?: string
  sessionId: string
  analysisResultHash: string // Hash of analysis result for grouping
}

export interface ConsultationHistoryStats {
  totalConsultations: number
  regenerationCount: number
  averageRegenerationTime: number
  mostCommonReasons: Array<{ reason: string; count: number }>
}

class ConsultationHistoryManager {
  private readonly storageKey = 'biolens-consultation-history'
  private readonly maxHistoryEntries = 50
  private readonly maxSessionEntries = 10
  private history: ConsultationHistoryEntry[] = []

  constructor() {
    this.loadHistory()
  }

  /**
   * Add a new consultation to history
   */
  addConsultation(
    consultation: ConsultationResponse,
    symptoms: string,
    sessionId: string,
    analysisResultHash: string,
    regenerationReason?: string
  ): string {
    const entry: ConsultationHistoryEntry = {
      id: this.generateEntryId(),
      timestamp: new Date(),
      symptoms: symptoms.trim(),
      consultation,
      regenerationReason,
      sessionId,
      analysisResultHash
    }

    // Add to beginning of history (most recent first)
    this.history.unshift(entry)

    // Limit total history size
    if (this.history.length > this.maxHistoryEntries) {
      this.history = this.history.slice(0, this.maxHistoryEntries)
    }

    this.saveHistory()
    return entry.id
  }

  /**
   * Get consultation history for a specific session
   */
  getSessionHistory(sessionId: string): ConsultationHistoryEntry[] {
    return this.history
      .filter(entry => entry.sessionId === sessionId)
      .slice(0, this.maxSessionEntries)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get consultation history for a specific analysis result
   */
  getAnalysisHistory(analysisResultHash: string): ConsultationHistoryEntry[] {
    return this.history
      .filter(entry => entry.analysisResultHash === analysisResultHash)
      .slice(0, this.maxSessionEntries)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get full consultation history (limited)
   */
  getFullHistory(limit: number = 20): ConsultationHistoryEntry[] {
    return this.history
      .slice(0, limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get a specific consultation by ID
   */
  getConsultationById(id: string): ConsultationHistoryEntry | null {
    return this.history.find(entry => entry.id === id) || null
  }

  /**
   * Remove a consultation from history
   */
  removeConsultation(id: string): boolean {
    const initialLength = this.history.length
    this.history = this.history.filter(entry => entry.id !== id)
    
    if (this.history.length < initialLength) {
      this.saveHistory()
      return true
    }
    return false
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history = []
    this.saveHistory()
  }

  /**
   * Clear history for a specific session
   */
  clearSessionHistory(sessionId: string): void {
    this.history = this.history.filter(entry => entry.sessionId !== sessionId)
    this.saveHistory()
  }

  /**
   * Get consultation statistics
   */
  getStatistics(): ConsultationHistoryStats {
    const regenerations = this.history.filter(entry => entry.regenerationReason)
    const reasonCounts = new Map<string, number>()

    regenerations.forEach(entry => {
      if (entry.regenerationReason) {
        const reason = entry.regenerationReason.toLowerCase()
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1)
      }
    })

    const mostCommonReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Calculate average regeneration time (time between consultations in same session)
    let totalRegenerationTime = 0
    let regenerationTimeCount = 0

    const sessionGroups = new Map<string, ConsultationHistoryEntry[]>()
    this.history.forEach(entry => {
      if (!sessionGroups.has(entry.sessionId)) {
        sessionGroups.set(entry.sessionId, [])
      }
      sessionGroups.get(entry.sessionId)!.push(entry)
    })

    sessionGroups.forEach(entries => {
      if (entries.length > 1) {
        entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        for (let i = 1; i < entries.length; i++) {
          const timeDiff = entries[i].timestamp.getTime() - entries[i - 1].timestamp.getTime()
          totalRegenerationTime += timeDiff
          regenerationTimeCount++
        }
      }
    })

    const averageRegenerationTime = regenerationTimeCount > 0 
      ? totalRegenerationTime / regenerationTimeCount 
      : 0

    return {
      totalConsultations: this.history.length,
      regenerationCount: regenerations.length,
      averageRegenerationTime,
      mostCommonReasons
    }
  }

  /**
   * Export history for backup or sharing
   */
  exportHistory(): string {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      history: this.history.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString()
      }))
    }
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import history from backup
   */
  importHistory(jsonData: string): { success: boolean; imported: number; errors: string[] } {
    try {
      const data = JSON.parse(jsonData)
      const errors: string[] = []
      let imported = 0

      if (!data.history || !Array.isArray(data.history)) {
        return { success: false, imported: 0, errors: ['Invalid history format'] }
      }

      const validEntries: ConsultationHistoryEntry[] = []

      data.history.forEach((entry: any, index: number) => {
        try {
          const validEntry: ConsultationHistoryEntry = {
            id: entry.id || this.generateEntryId(),
            timestamp: new Date(entry.timestamp),
            symptoms: entry.symptoms || '',
            consultation: entry.consultation,
            regenerationReason: entry.regenerationReason,
            sessionId: entry.sessionId || 'imported',
            analysisResultHash: entry.analysisResultHash || 'unknown'
          }

          // Validate required fields
          if (!validEntry.consultation || !validEntry.sessionId) {
            errors.push(`Entry ${index + 1}: Missing required fields`)
            return
          }

          validEntries.push(validEntry)
          imported++
        } catch (error) {
          errors.push(`Entry ${index + 1}: ${error instanceof Error ? error.message : 'Invalid format'}`)
        }
      })

      // Merge with existing history (avoid duplicates by ID)
      const existingIds = new Set(this.history.map(entry => entry.id))
      const newEntries = validEntries.filter(entry => !existingIds.has(entry.id))

      this.history = [...newEntries, ...this.history]
      
      // Limit total size
      if (this.history.length > this.maxHistoryEntries) {
        this.history = this.history.slice(0, this.maxHistoryEntries)
      }

      this.saveHistory()

      return {
        success: true,
        imported: newEntries.length,
        errors
      }
    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse JSON']
      }
    }
  }

  /**
   * Generate analysis result hash for grouping consultations
   */
  generateAnalysisResultHash(analysisResult: any): string {
    // Create a simple hash based on key analysis properties
    const keyData = {
      topPrediction: analysisResult.topPrediction,
      confidence: Math.round(analysisResult.overallConfidence * 100) / 100,
      riskLevel: analysisResult.riskLevel,
      predictionsCount: analysisResult.predictions?.length || 0
    }
    
    return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '').substring(0, 16)
  }

  /**
   * Check if symptoms have changed significantly
   */
  hasSignificantSymptomChange(oldSymptoms: string, newSymptoms: string): boolean {
    const normalize = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ')
    const oldNorm = normalize(oldSymptoms)
    const newNorm = normalize(newSymptoms)
    
    // Consider significant if:
    // 1. Length difference > 20%
    // 2. More than 30% of words are different
    const lengthDiff = Math.abs(oldNorm.length - newNorm.length) / Math.max(oldNorm.length, 1)
    if (lengthDiff > 0.2) return true

    const oldWords = new Set(oldNorm.split(' ').filter(w => w.length > 2))
    const newWords = new Set(newNorm.split(' ').filter(w => w.length > 2))
    
    const intersection = new Set([...oldWords].filter(w => newWords.has(w)))
    const union = new Set([...oldWords, ...newWords])
    
    const similarity = intersection.size / Math.max(union.size, 1)
    return similarity < 0.7 // Less than 70% similarity
  }

  /**
   * Get regeneration suggestions based on history
   */
  getRegenerationSuggestions(sessionId: string): string[] {
    const sessionHistory = this.getSessionHistory(sessionId)
    const suggestions: string[] = []

    if (sessionHistory.length === 0) {
      return [
        "Add more specific symptom details",
        "Include timing information (when symptoms started)",
        "Describe symptom severity or progression",
        "Add any related symptoms or concerns"
      ]
    }

    const lastEntry = sessionHistory[0]
    const hasSymptoms = lastEntry.symptoms && lastEntry.symptoms.trim().length > 0

    if (!hasSymptoms) {
      suggestions.push("Add symptom descriptions for more personalized consultation")
    }

    if (sessionHistory.length === 1) {
      suggestions.push("Request different perspective or focus area")
      suggestions.push("Ask for more detailed recommendations")
    }

    if (sessionHistory.length > 1) {
      suggestions.push("Provide updates on symptom changes")
      suggestions.push("Request reassessment of urgency level")
    }

    // Add common regeneration reasons from statistics
    const stats = this.getStatistics()
    stats.mostCommonReasons.slice(0, 2).forEach(({ reason }) => {
      if (!suggestions.some(s => s.toLowerCase().includes(reason.toLowerCase()))) {
        suggestions.push(`Consider: ${reason}`)
      }
    })

    return suggestions.slice(0, 5)
  }

  /**
   * Private methods
   */
  private generateEntryId(): string {
    return `consultation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private loadHistory(): void {
    try {
      if (typeof window === 'undefined') return // SSR safety

      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        this.history = data.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp)
        }))
      }
    } catch (error) {
      console.warn('Failed to load consultation history:', error)
      this.history = []
    }
  }

  private saveHistory(): void {
    try {
      if (typeof window === 'undefined') return // SSR safety

      const data = this.history.map(entry => ({
        ...entry,
        timestamp: entry.timestamp.toISOString()
      }))
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save consultation history:', error)
    }
  }
}

// Global instance
export const consultationHistoryManager = new ConsultationHistoryManager()

// Utility functions for easy access
export function addConsultationToHistory(
  consultation: ConsultationResponse,
  symptoms: string,
  sessionId: string,
  analysisResult: any,
  regenerationReason?: string
): string {
  const hash = consultationHistoryManager.generateAnalysisResultHash(analysisResult)
  return consultationHistoryManager.addConsultation(
    consultation,
    symptoms,
    sessionId,
    hash,
    regenerationReason
  )
}

export function getConsultationHistory(sessionId: string): ConsultationHistoryEntry[] {
  return consultationHistoryManager.getSessionHistory(sessionId)
}

export function getConsultationById(id: string): ConsultationHistoryEntry | null {
  return consultationHistoryManager.getConsultationById(id)
}

export function clearConsultationHistory(): void {
  consultationHistoryManager.clearHistory()
}

export function getConsultationStatistics(): ConsultationHistoryStats {
  return consultationHistoryManager.getStatistics()
}

export function getRegenerationSuggestions(sessionId: string): string[] {
  return consultationHistoryManager.getRegenerationSuggestions(sessionId)
}

export function hasSignificantSymptomChange(oldSymptoms: string, newSymptoms: string): boolean {
  return consultationHistoryManager.hasSignificantSymptomChange(oldSymptoms, newSymptoms)
}