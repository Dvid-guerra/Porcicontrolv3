import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../design-system/tokens.css'
import '../index.css'
import EmpleadosApp from './EmpleadosApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EmpleadosApp />
  </StrictMode>,
)

// Mismo Service Worker que la app principal: deja abrir la app sin señal en el galpón.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('No se pudo registrar el Service Worker offline:', err)
    })
  })
}
