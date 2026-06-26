import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: https://<user>.github.io/gym-log/
export default defineConfig({
  base: '/gym-log/',
  plugins: [react()],
})
