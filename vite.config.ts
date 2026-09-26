/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Installable + offline: the service worker caches the whole app on first visit,
    // and quietly picks up new versions next time the app is opened online.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Shaft Alignment",
        short_name: "Alignment",
        description: "Gap & offset shaft alignment calculator with saved jobs and reports.",
        theme_color: "#0E1116",
        background_color: "#0E1116",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png}"] },
    }),
  ],
  // relative asset paths so the build works on any static host (GitHub Pages, Netlify, a file share)
  base: "./",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
