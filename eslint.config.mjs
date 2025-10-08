import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: { globals: globals.browser },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "ignore",
      "@typescript-eslint/no-unused-vars": "ignore",
    },
  },
  tseslint.configs.recommended,
]);
