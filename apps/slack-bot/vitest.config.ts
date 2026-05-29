import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: [
      {
        find: /^@schemas\/zod\/(.+)$/,
        replacement: resolve(__dirname, "../../packages/schemas/zod/$1.ts"),
      },
      {
        find: "@schemas/zod",
        replacement: resolve(__dirname, "../../packages/schemas/zod/index.ts"),
      },
    ],
  },
});
