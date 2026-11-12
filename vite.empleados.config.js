import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'

// Build de la app de empleados: un sitio aparte (dist-empleados/) que no incluye
// nada del código de la app principal. Se despliega como otro proyecto.
//   npm run dev:empleados     -> http://localhost:5173/empleados.html
//   npm run build:empleados   -> dist-empleados/
const SALIDA = 'dist-empleados'

// El sitio de empleados se sirve desde "/", así que su página debe llamarse index.html.
const publicarComoIndex = () => ({
  name: 'empleados-como-index',
  closeBundle() {
    const origen = resolve(SALIDA, 'empleados.html')
    if (existsSync(origen)) renameSync(origen, resolve(SALIDA, 'index.html'))
  },
})

export default defineConfig({
  plugins: [react(), publicarComoIndex()],
  base: './',
  server: { open: '/empleados.html' },
  build: {
    outDir: SALIDA,
    rollupOptions: { input: resolve('empleados.html') },
  },
})
