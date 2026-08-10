import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Charge les styles globaux de toute l'application.
import './styles/variables.css'
import './styles/global.css'
import './styles/connexion.css'
import './styles/students_shared.css'
import './styles/layout.css'
import './styles/dashboard.css'
import './styles/accounts_overview.css'
import './styles/account_create.css'
import './styles/accounts_list.css'
import './styles/account_details.css'
import './styles/school_years.css'
import './styles/feedback.css'
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
