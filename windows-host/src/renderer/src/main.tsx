import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { isPhone } from './lib/platform'
import './assets/index.css'

if (isPhone()) document.documentElement.classList.add('phone')

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
