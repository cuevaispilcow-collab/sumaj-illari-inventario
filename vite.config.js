import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANTE: cambia "sumaj-illari-inventario" por el nombre EXACTO
// de tu repositorio en GitHub si es distinto. Esto le dice a la app
// en qué "carpeta" del enlace de GitHub Pages va a vivir.
export default defineConfig({
  plugins: [react()],
  base: "/sumaj-illari-inventario/",
  build: {
    rollupOptions: {
      output: {
        // Todo en la raíz, sin carpetas (más fácil de subir a GitHub
        // arrastrando archivos sueltos, sin preocuparse por carpetas).
        entryFileNames: "app.js",
        chunkFileNames: "app.js",
        assetFileNames: "app.css",
      },
    },
  },
});
