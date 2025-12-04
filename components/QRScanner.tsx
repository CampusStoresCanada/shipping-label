import { useState, useRef, useEffect } from 'react'
import jsQR from 'jsqr'

type QRScannerProps = {
  onScan: (email: string, name: string, organization: string) => void
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualOrg, setManualOrg] = useState('')
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  const lookupContact = async (vcardUrl: string) => {
    try {
      setScanning(true)
      setError(null)

      console.log('🔍 Looking up contact:', vcardUrl)

      const response = await fetch(`/api/lookup-vcard?url=${encodeURIComponent(vcardUrl)}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Contact not found. Please use manual entry.')
        setScanning(false)
        return
      }

      const contact = result.contact
      const organizationName = contact.organization?.name || 'Unknown'

      console.log('✅ Found contact:', contact.name, contact.email, organizationName)

      onScan(contact.email, contact.name, organizationName)
    } catch (err: any) {
      console.error('Lookup error:', err)
      setError('Failed to lookup contact. Please use manual entry.')
      setScanning(false)
    }
  }

  const handleManualSubmit = () => {
    if (manualEmail && manualName && manualOrg) {
      onScan(manualEmail, manualName, manualOrg)
    }
  }

  const startCamera = async () => {
    try {
      setError(null)
      setScanning(true)

      console.log('📷 Requesting camera access...')

      // Request camera access (rear camera preferred for mobile)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Prefer rear camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      console.log('✅ Camera stream obtained:', stream.getVideoTracks()[0].label)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // Start scanning after video is ready
        videoRef.current.onloadedmetadata = () => {
          console.log('✅ Video metadata loaded')
          console.log('   Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight)
          console.log('   Video element dimensions:', videoRef.current?.offsetWidth, 'x', videoRef.current?.offsetHeight)
          scanQRCode()
        }

        // Set camera active BEFORE playing
        setIsCameraActive(true)
        setScanning(false)

        // Wait for video to be ready before playing
        try {
          await videoRef.current.play()
          console.log('✅ Video.play() succeeded')
          console.log('   Video paused?', videoRef.current.paused)
          console.log('   Video readyState:', videoRef.current.readyState)
        } catch (playErr) {
          console.error('❌ Video.play() failed:', playErr)
        }
      }
    } catch (err: any) {
      console.error('Camera access error:', err)
      setError(err.name === 'NotAllowedError'
        ? 'Camera access denied. Please enable camera permissions.'
        : `Failed to access camera: ${err.message}. Please try manual entry.`)
      setScanning(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    setIsCameraActive(false)
    setScanning(false)
  }

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) {
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode)
      return
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data from canvas
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

    // Scan for QR code using jsQR (works on all browsers including Safari)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code) {
      // QR code detected!
      console.log('QR Code detected:', code.data)

      // Stop scanning immediately to prevent multiple reads
      stopCamera()

      // Lookup contact by vCard URL
      lookupContact(code.data)
    }

    // Continue scanning
    animationRef.current = requestAnimationFrame(scanQRCode)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Restart scanning when camera becomes active
  useEffect(() => {
    if (isCameraActive && !animationRef.current) {
      scanQRCode()
    }
  }, [isCameraActive])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">📷</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Scan Conference Badge
        </h2>
        <p className="text-gray-600">
          Point the camera at the QR code on the back of the badge
        </p>
      </div>

      {/* Camera View */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden min-h-[400px]">
        {!isCameraActive && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="text-6xl">📱</div>
            <button
              onClick={startCamera}
              disabled={scanning}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {scanning ? 'Starting Camera...' : 'Start Camera'}
            </button>
          </div>
        )}

        {isCameraActive && (
          <>
            <video
              ref={videoRef}
              className="w-full h-auto"
              playsInline
              muted
              autoPlay
              style={{
                display: 'block',
                minHeight: '400px',
                backgroundColor: '#1f2937',
                width: '100%'
              }}
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* Scanning indicator */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold animate-pulse">
              Scanning for QR Code...
            </div>

            {/* Stop button */}
            <button
              onClick={stopCamera}
              className="absolute bottom-4 right-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
            >
              Stop Camera
            </button>
          </>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="text-5xl">⚠️</div>
            <p className="text-white font-semibold">{error}</p>
            <button
              onClick={() => {
                setError(null)
                startCamera()
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* QR Code Format Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>QR Code Format:</strong> Scan the QR code on the back of your conference badge. The system will automatically look up your contact information.
        </p>
      </div>

      {/* Manual entry fallback */}
      <div className="border-t pt-6">
        <p className="text-sm text-gray-600 mb-4">
          Or enter contact info manually:
        </p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Full Name"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            placeholder="Email Address"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Organization"
            value={manualOrg}
            onChange={(e) => setManualOrg(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualEmail || !manualName || !manualOrg}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
