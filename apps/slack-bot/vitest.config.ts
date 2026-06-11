import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    // DB-integration tests share state via the real Postgres instance (e.g. "latest" row
    // queries) — run test files sequentially to avoid cross-file races.
    fileParallelism: false,
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
