import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Charge les styles globaux de toute l'application.
import './styles/variables.css'
import './styles/global.css'
import './styles/App.css'
import './styles/feedback.css'
import './styles/public_pages.css'
import { ToastProvider } from './components/feedback/ToastProvider.jsx'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  </StrictMode>,
)
