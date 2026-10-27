import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const src = fileURLToPath(new URL("./src", import.meta.url));

/** Static build for https://varun1012.github.io/gusheng/ — not the live preview. */
export default defineConfig({
  base: "/gusheng/",
  root: "pages",
  publicDir: "../public",
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: { "@": src },
  },
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
  },
});
