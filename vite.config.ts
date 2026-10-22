// ============================================================================
// FILE:       frontend-test/vite.config.ts
// PURPOSE:    Vite build and development server configuration.
//             Configures the React plugin, path aliases, the dev proxy to the
//             local backend, the API base URL injection and the production
//             build optimizations used by the Vercel deployment.
// HOW IT WORKS: `loadEnv` reads the .env files so API_BASE_URL can be used
//             both from a file and from the Vercel build environment.
//             `envPrefix` additionally exposes API_* variables to the browser
//             bundle, so `import.meta.env.API_BASE_URL` always works.
// USED BY / DEPENDS ON: npm run dev, npm run build, npm run preview.
// KEY CONCEPTS: envPrefix, define, manual chunks, dev proxy.
// ============================================================================

import path from "path";
import { defineConfig, loadEnv, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }): UserConfig => {
  // Load every variable from the .env files (prefix "" = all of them).
  // `process.env` alone would miss values that only exist in the .env file.
  const env = loadEnv(mode, process.cwd(), "");

  // Resolve the API base URL once, in priority order:
  //   1. API_BASE_URL       (real build environment / .env file)
  //   2. VITE_API_BASE_URL  (real build environment / .env file)
  // The real environment must win over the .env file — otherwise a leftover
  // local .env silently overrides the Vercel dashboard value.
  // `loadEnv` already merges process.env over the .env file, but the
  // explicit process.env checks keep that order obvious.
  // Falls back to "" so the runtime `||` chain can still use the relative
  // "/api/v1" default — an inlined "/api/v1" would win over VITE_API_BASE_URL.
  const apiBaseUrl =
    process.env.API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    env.API_BASE_URL ||
    env.VITE_API_BASE_URL ||
    "";

  return {
    plugins: [react()],

    // Expose API_* variables (not only VITE_*) to the browser bundle, so
    // `import.meta.env.API_BASE_URL` resolves without a custom define.
    envPrefix: ["VITE_", "API_"],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        "/api": {
          target: env.VITE_DEV_API_TARGET || "https://todo-b-nu.vercel.app",
          changeOrigin: true,
        },
      },
    },

    // `vite preview` serves the production build — proxy it too, so the
    // production bundle can be tested locally against a real backend.
    preview: {
      port: 4173,
      proxy: {
        "/api": {
          target: env.VITE_DEV_API_TARGET || "https://todo-b-nu.vercel.app/",
          changeOrigin: true,
        },
      },
    },

    // Inject API_BASE_URL at build time so client.ts can read it.
    define: {
      "import.meta.env.API_BASE_URL": JSON.stringify(apiBaseUrl),
      "import.meta.env.VITE_APP_ENV": JSON.stringify(mode),
    },

    build: {
      outDir: "dist",
      // No source maps in production — smaller upload, no source leak.
      sourcemap: false,
      // esbuild is the fastest minifier and is already a Vite dependency.
      minify: "esbuild",
      // Modern browsers only; drops the legacy down-level transforms.
      target: "es2020",
      // Skip the gzip size report — it doubles the build time for no gain.
      reportCompressedSize: false,
      // Split the vendor code out of the app chunk so it can be cached
      // forever (the file name contains a content hash).
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: [
              "react",
              "react-dom",
              "react-router-dom",
              "sonner",
              "framer-motion",
            ],
            ui: [
              "lucide-react",
              "@tanstack/react-query",
              "@dnd-kit/core",
              "@dnd-kit/sortable",
              "@dnd-kit/utilities",
            ],
          },
        },
      },
    },
  };
});
