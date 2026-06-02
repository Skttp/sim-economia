import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' hace que funcione tanto en Vercel/Netlify (raíz)
// como en GitHub Pages (subcarpeta /nombre-repo/).
export default defineConfig({
  plugins: [react()],
  base: './',
})
