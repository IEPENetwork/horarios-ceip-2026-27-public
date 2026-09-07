import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import schedulePatchPlugin from "./schedule-patch.mjs";

export default defineConfig({
  plugins: [schedulePatchPlugin(), react()],
  base: "/horarios-ceip-2026-27-public/",
});
