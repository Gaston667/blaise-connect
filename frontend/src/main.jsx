import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Charge les styles globaux de toute l'application.
import './styles/variables.css'
import './styles/global.css'
import './styles/App.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
