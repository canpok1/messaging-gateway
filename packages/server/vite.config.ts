import { defineConfig } from "vite";
import { VitePluginNode } from "vite-plugin-node";

export default defineConfig({
  resolve: {
    alias: {
      "@": "src",
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
});
