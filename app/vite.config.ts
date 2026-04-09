import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace font-display:swap → optional so IBM Plex Mono swap never triggers a
// late LCP update. With "optional" the browser uses the font only if it lands
// within the ~100ms block period; otherwise it commits to the fallback.
const fontDisplayOptional = {
  postcssPlugin: 'font-display-optional',
  Declaration(decl: { prop: string; value: string }) {
    if (decl.prop === 'font-display' && decl.value === 'swap') {
      decl.value = 'optional'
    }
  },
}

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [fontDisplayOptional] } },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
