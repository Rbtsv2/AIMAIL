// src/renderer/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './design-system/ErrorBoundary'
import './styles/tokens.css'
import './styles/themes/light.css'
import './styles/themes/dark.css'
import './styles/base.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>)