import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: `${process.cwd()}/` }],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
