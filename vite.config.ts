/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // relative asset paths so the build works on any static host (GitHub Pages, Netlify, a file share)
  base: "./",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
