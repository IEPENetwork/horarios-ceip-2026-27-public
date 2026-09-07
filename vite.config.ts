import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error Local JavaScript Vite plugin intentionally loaded at build time.
import schedulePatchPlugin from "./schedule-patch.mjs";

export default defineConfig({
  plugins: [schedulePatchPlugin(), react()],
  base: "/horarios-ceip-2026-27-public/",
});
