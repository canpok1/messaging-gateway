/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/Index.ts"],
      reporter: ["text", "html"],
      reportsDirectory: "../../public/coverage/lib",
    },
  },
});
