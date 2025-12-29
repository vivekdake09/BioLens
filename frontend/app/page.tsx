"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BioLensHome() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      handleFileSelect(droppedFile)
    }
  }, [])

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
    setResult(null)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleAnalyze = async () => {
    if (!file) return

    setIsProcessing(true)

    // Simulate API call
    setTimeout(() => {
      setResult(
        "Based on the image analysis, the skin condition shows characteristics consistent with contact dermatitis. This appears to be a mild to moderate inflammatory skin reaction. \n\nRecommendations:\n• Keep the affected area clean and dry\n• Apply over-the-counter hydrocortisone cream\n• Avoid scratching the affected area\n• Consult a dermatologist if symptoms persist beyond 7 days\n\nRisk Level: Low to Moderate\n\nDisclaimer: This is not a medical diagnosis. Please consult a healthcare professional for proper evaluation.",
      )
      setIsProcessing(false)
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">B</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">BioLens</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Privacy-Focused Analysis</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* How to Use Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-4 text-balance">How to Use BioLens</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto text-pretty">
            Get AI-powered symptom analysis in three simple steps
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <Card className="p-6 text-center border-2 hover:border-primary/50 transition-colors">
              <div className="mb-6 flex justify-center">
                <div className="relative w-48 h-48 rounded-xl overflow-hidden bg-secondary">
                  <img
                    src="/images/i1.jpeg"
                    alt="Person concerned about skin condition"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Notice Symptoms</h3>
              <p className="text-muted-foreground text-sm">
                Identify any unusual skin conditions or symptoms that concern you
              </p>
            </Card>

            {/* Step 2 */}
            <Card className="p-6 text-center border-2 hover:border-primary/50 transition-colors">
              <div className="mb-6 flex justify-center">
                <div className="relative w-48 h-48 rounded-xl overflow-hidden bg-secondary">
                  <img
                    src="/animated-person-viewing-skin-rash-photos-on-smartpho.jpg"
                    alt="Person viewing skin rash photos on smartphone"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Review Photos</h3>
              <p className="text-muted-foreground text-sm">
                View and select the photo that best shows your skin condition
              </p>
            </Card>

            {/* Step 3 */}
            <Card className="p-6 text-center border-2 hover:border-primary/50 transition-colors">
              <div className="mb-6 flex justify-center">
                <div className="relative w-48 h-48 rounded-xl overflow-hidden bg-secondary">
                  <img
                    src="/animated-person-uploading-medical-image-to-biolens-.jpg"
                    alt="Person uploading medical image to BioLens website"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload & Analyze</h3>
              <p className="text-muted-foreground text-sm">
                Upload your image to BioLens for instant AI-powered analysis
              </p>
            </Card>
          </div>
        </section>

        {/* Upload Section */}
        <section className="mb-16">
          <Card className="max-w-3xl mx-auto p-8 bg-card border-2 border-border shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-center">Upload Your Image</h2>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                isDragging
                  ? "border-primary bg-primary/5 scale-105"
                  : "border-border hover:border-primary/50 bg-muted/30"
              }`}
            >
              {/* Cloud Icon Background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                <svg className="w-64 h-64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
                </svg>
              </div>

              {preview ? (
                <div className="space-y-4">
                  <div className="relative w-64 h-64 mx-auto rounded-lg overflow-hidden">
                    <img src={preview || "/placeholder.svg"} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm text-muted-foreground">{file?.name}</p>
                  <Button onClick={handleAnalyze} disabled={isProcessing} size="lg" className="w-full max-w-xs mx-auto">
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Analyze Image
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-semibold mb-2">Drag and drop your image here</p>
                    <p className="text-sm text-muted-foreground mb-4">or click to browse your files</p>
                  </div>
                  <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleFileInput} />
                  <Button onClick={() => document.getElementById("file-upload")?.click()} size="lg">
                    <Upload className="mr-2 h-5 w-5" />
                    Choose File
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">Supported formats: JPG, PNG, WebP (Max 10MB)</p>
                </div>
              )}
            </div>

            <Alert className="mt-6 bg-accent/10 border-accent">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Privacy First:</strong> Your images are processed securely and never stored on our servers
              </AlertDescription>
            </Alert>
          </Card>
        </section>

        {/* Detection Results Section */}
        <section className="mb-16">
          <Card className="max-w-3xl mx-auto p-8 border-2 border-muted bg-card shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Detection Results</h2>
            </div>

            {result ? (
              <>
                <div className="prose prose-sm max-w-none">
                  <div className="bg-muted/50 rounded-lg p-6 whitespace-pre-line text-sm leading-relaxed border-2 border-border">
                    {result}
                  </div>
                </div>

                <div className="mt-6 flex gap-4">
                  <Button
                    onClick={() => {
                      setFile(null)
                      setPreview(null)
                      setResult(null)
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Analyze Another Image
                  </Button>
                  <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                    Find Nearby Doctors
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-muted/30 rounded-lg p-12 text-center border-2 border-dashed border-muted-foreground/30">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm">
                  Your analysis results will appear here after processing your image
                </p>
                <p className="text-muted-foreground text-xs mt-2">Upload an image above to get started</p>
              </div>
            )}
          </Card>
        </section>

        {/* Footer Info */}
        <section className="text-center max-w-2xl mx-auto">
          <Alert className="bg-muted/50 border-border">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm text-left">
              <strong>Medical Disclaimer:</strong> BioLens is an AI-powered screening tool designed to provide
              preliminary information only. It is not a substitute for professional medical advice, diagnosis, or
              treatment. Always consult a qualified healthcare provider for any health concerns or medical conditions.
            </AlertDescription>
          </Alert>
        </section>
      </main>
    </div>
  )
}
