import process from "node:process";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the API runs on Flask (backend/app.py, port 5000); proxying
// /api keeps requests same-origin so no CORS setup is needed locally.
export default defineConfig({
  plugins: [react()],
  // Inline (empty) PostCSS config: stops Vite picking up a postcss.config.js
  // from a parent directory outside this repo.
  css: { postcss: {} },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ["src/**/*.test.{js,jsx}"],
  },
  build: {
    rolldownOptions: {
      output: {
        // Keep the router/react runtime in a long-cached vendor chunk.
        codeSplitting: {
          groups: [{ name: "vendor", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ }],
        },
      },
    },
  },
});
