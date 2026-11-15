import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadPubData } from './data'

const root = createRoot(document.getElementById('root')!)

// The page shows "Loading pubs…" (in index.html) until the data arrives
loadPubData()
  .then((data) => {
    root.render(
      <StrictMode>
        <App data={data} />
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error(error)
    root.render(
      <p className="app-load-error" role="alert">
        Couldn't load the pubs. Check your connection and reload the page.
      </p>,
    )
  })
