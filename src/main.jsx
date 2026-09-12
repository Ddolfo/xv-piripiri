import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { PanelError } from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PanelError>
      <App />
    </PanelError>
  </StrictMode>,
)
