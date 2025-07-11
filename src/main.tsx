import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n/config.ts'
import { Buffer } from 'buffer'
import process from 'process'

// Make these available globally
window.Buffer = Buffer
window.process = process

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)