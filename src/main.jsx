import { createRoot } from 'react-dom/client'
import { ProjectProvider } from './store/ProjectContext'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <ProjectProvider>
    <App />
  </ProjectProvider>,
)
