import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/components.css'
import './styles/app.css'
import App from './App.tsx'
import { useStore } from './store/useStore'

if (import.meta.env.DEV) (window as unknown as { useStore: typeof useStore }).useStore = useStore

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
