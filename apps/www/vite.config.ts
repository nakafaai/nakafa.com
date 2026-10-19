import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: "app",
      importProtection: { behavior: { dev: "error", build: "error" } },
    }),
    // Decision 14: no skew route (__vdpl). Server-function calls carry the
    // pinned deployment through Start's client fetch seam instead.
    nitro({ vercel: { skewProtection: false } }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
