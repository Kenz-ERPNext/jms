import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// The dashboard runs inside the Frappe desk (Page "jms-dashboard"), so it is
// built as one classic script + one stylesheet that the page loads.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // frappe-ui's package exports hide its source files; see src/frappe.js
      'frappe-ui-src': path.resolve(__dirname, 'node_modules/frappe-ui/src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: '../jms/public/dashboard',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'JMSDashboard',
      formats: ['iife'],
      fileName: () => 'jms-dashboard.js',
    },
    rollupOptions: {
      output: { assetFileNames: 'jms-dashboard[extname]' },
    },
  },
})
