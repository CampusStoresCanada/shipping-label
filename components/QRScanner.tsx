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
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-start camera on desktop
  useEffect(() => {
    if (!isMobile && !isCameraActive && !streamRef.current) {
      startCamera()
    }
  }, [isMobile])

  const lookupContact = async (vcardUrl: string) => {
    try {
      setScanning(true)
      setError(null)

      const response = await fetch(`/api/lookup-vcard?url=${encodeURIComponent(vcardUrl)}`)
      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Contact not found. Please use manual entry.')
        setScanning(false)
        return
      }

      const contact = result.contact
      const organizationName = contact.organization?.name || 'Unknown'

      onScan(contact.email, contact.name, organizationName)
    } catch (err: any) {
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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      streamRef.current = stream
      setIsCameraActive(true)
      setScanning(false)

    } catch (err: any) {
      setError(err.name === 'NotAllowedError'
        ? 'Camera access denied'
        : 'Failed to access camera')
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

    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code) {
        stopCamera()
        lookupContact(code.data)
        return
      }
    } catch (scanErr) {
      // Ignore scan errors
    }

    animationRef.current = requestAnimationFrame(scanQRCode)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Attach stream to video element when camera becomes active
  useEffect(() => {
    if (!isCameraActive || !streamRef.current || !videoRef.current) {
      return
    }

    const video = videoRef.current
    const stream = streamRef.current

    video.srcObject = stream

    video.onloadedmetadata = () => {
      scanQRCode()
    }

    video.oncanplay = () => {
      if (!animationRef.current) {
        scanQRCode()
      }
    }

    video.play().catch(() => {
      // Ignore play errors
    })
  }, [isCameraActive])

  // Backup: Start scanning after a brief delay
  useEffect(() => {
    if (isCameraActive && !animationRef.current) {
      const timer = setTimeout(() => {
        scanQRCode()
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [isCameraActive])

  return (
    <div className="h-screen flex" style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="w-96 bg-gray-50 border-r border-gray-200 p-8 flex flex-col">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Shipping Station
            </h1>
            <p className="text-base text-gray-600">
              Scan your conference badge to create a shipping label
            </p>
          </div>

          <div className="flex-1">
            <div className="mb-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">Instructions</h3>
              <ol className="text-base text-gray-600 space-y-3">
                <li>1. Position QR code in frame</li>
                <li>2. Hold steady until scanned</li>
                <li>3. Follow on-screen prompts</li>
              </ol>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-base">
                {error}
              </div>
            )}

            {/* Manual Entry (collapsed by default) */}
            <details className="group">
              <summary className="text-base font-medium text-gray-700 cursor-pointer hover:text-gray-900 mb-4">
                Manual Entry
              </summary>
              <div className="space-y-3 mt-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                />
                <input
                  type="text"
                  placeholder="Organization"
                  value={manualOrg}
                  onChange={(e) => setManualOrg(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualEmail || !manualName || !manualOrg}
                  className="w-full bg-gray-900 hover:bg-black text-white font-medium px-6 py-3 rounded text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </details>
          </div>

          <div className="text-sm text-gray-500 mt-8">
            Need help? google@campusstores.ca
          </div>
        </div>
      )}

      {/* Mobile Hamburger Menu */}
      {isMobile && (
        <>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded shadow-lg flex items-center justify-center"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className="w-full h-0.5 bg-gray-900 block"></span>
              <span className="w-full h-0.5 bg-gray-900 block"></span>
              <span className="w-full h-0.5 bg-gray-900 block"></span>
            </div>
          </button>

          {menuOpen && (
            <div className="fixed inset-0 z-40 bg-white p-6 overflow-y-auto">
              <button
                onClick={() => setMenuOpen(false)}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-gray-600"
              >
                <span className="text-2xl">&times;</span>
              </button>

              <div className="mt-12">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Shipping Station
                </h2>

                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Instructions</h3>
                  <ol className="text-sm text-gray-600 space-y-2">
                    <li>1. Position QR code in frame</li>
                    <li>2. Hold steady until scanned</li>
                    <li>3. Follow on-screen prompts</li>
                  </ol>
                </div>

                {error && (
                  <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Manual Entry</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                    />
                    <input
                      type="text"
                      placeholder="Organization"
                      value={manualOrg}
                      onChange={(e) => setManualOrg(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
                    />
                    <button
                      onClick={() => {
                        handleManualSubmit()
                        setMenuOpen(false)
                      }}
                      disabled={!manualEmail || !manualName || !manualOrg}
                      className="w-full bg-gray-900 hover:bg-black text-white font-medium px-4 py-2 rounded text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Need help? google@campusstores.ca
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Camera View */}
      <div className="flex-1 relative bg-black">
        {!isCameraActive && !error && isMobile && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startCamera}
              disabled={scanning}
              className="bg-white text-gray-900 font-medium px-8 py-3 rounded shadow-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
            >
              {scanning ? 'Starting...' : 'Start Camera'}
            </button>
          </div>
        )}

        {isCameraActive && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="relative z-10 pointer-events-auto"
                style={{
                  width: '320px',
                  height: '320px',
                  border: '3px solid white',
                  borderRadius: '8px',
                }}
              >
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-white text-base font-medium whitespace-nowrap bg-black bg-opacity-70 px-4 py-2 rounded">
                  Position QR code here
                </div>
              </div>
            </div>

            {/* Stop button (desktop only) */}
            {!isMobile && (
              <button
                onClick={stopCamera}
                className="absolute top-6 right-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium shadow-lg transition-all duration-200"
              >
                Stop Camera
              </button>
            )}
          </>
        )}

        {error && !menuOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
            <div className="text-center p-8">
              <p className="text-white mb-4">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  if (isMobile) {
                    startCamera()
                  }
                }}
                className="bg-white text-gray-900 px-6 py-2 rounded font-medium hover:bg-gray-100 transition-all duration-200"
              >
                {isMobile ? 'Try Again' : 'Dismiss'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
