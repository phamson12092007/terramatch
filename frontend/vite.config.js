import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

<<<<<<< HEAD
const proxy = { '/api': 'http://127.0.0.1:8000' }

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
=======
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
>>>>>>> 57867d0c2fff0fbaf799359e8f5ffbe1c509c587
})
