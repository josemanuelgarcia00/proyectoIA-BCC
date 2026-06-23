import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Sin backend propio: ajusta esto al nombre real del repo de GitHub Pages
  // (https://<usuario>.github.io/<repo>/).
  base: '/proyectoIA-BCC/',
  plugins: [react()],
})
