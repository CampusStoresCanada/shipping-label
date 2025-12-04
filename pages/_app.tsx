import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Script from 'next/script'

export default function App({ Component, pageProps }: AppProps) {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || ''

  return (
    <>
      {/* Inject Google Maps API key to window for client-side use */}
      <Script
        id="google-maps-config"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.__GOOGLE_MAPS_API_KEY__ = "${googleMapsApiKey}";`
        }}
      />
      <Component {...pageProps} />
    </>
  )
}
