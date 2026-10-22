import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { lockZoom } from '@/lib/lock-zoom'
import '@/index.css'

// iOS Safari ignores user-scalable=no, so the gesture events are blocked too.
lockZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
