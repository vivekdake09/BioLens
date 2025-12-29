export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center">
        <h1 className="text-4xl font-bold mb-4">
          BioLens Symptom Checker
        </h1>
        <p className="text-gray-600 text-lg">
          Privacy-focused healthcare accessibility application
        </p>
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-blue-800">
            🚀 Frontend is running successfully!
          </p>
          <p className="text-sm text-blue-600 mt-2">
            Ready for symptom analysis and medical image processing
          </p>
        </div>
      </div>
    </main>
  )
}