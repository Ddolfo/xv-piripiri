import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './vitrine.css'
import App, { PanelError } from './App.jsx'
import SyncEa from './components/SyncEa.jsx'

// ?receber abre a tela do envio manual da EA (aberta pelo favorito "Enviar para o XV").
const receiving = new URLSearchParams(window.location.search).has('receber')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PanelError>
      {receiving ? <SyncEa /> : <App />}
    </PanelError>
  </StrictMode>,
)
