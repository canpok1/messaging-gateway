import { resolve } from "path";
import { defineConfig } from "vite";
import { VitePluginNode } from "vite-plugin-node";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  plugins: [
    ...VitePluginNode({
      adapter: "express",
      appPath: "./src/Index.ts",
    }),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: "./src/Index.ts",
      },
      external: [],
    },
  },
});
