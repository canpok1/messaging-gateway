/// <reference types="vitest" />
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/Index.ts"],
      reporter: ["text", "html"],
      reportsDirectory: "../../public/coverage/server",
    },
  },
});
