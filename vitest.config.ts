import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // tsconfig の "@/*" -> "./*" を再現（スラッシュ落ち回避のため正規表現で）
    alias: [{ find: /^@\/(.*)$/, replacement: `${root}/$1` }],
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
