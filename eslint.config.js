// Flat config — ESLint v10 standard. The strict-type-checked recipe
// from typescript-eslint is the close TS equivalent of mypy --strict +
// ruff's bug-prone rule set.
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `unknown` is preferred over `any`; we ban implicit `any` and
      // require explicit `unknown` for boundary types (mirrors the
      // Python SDK's `dict[str, Any]` + runtime guard pattern).
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Strict-type-checked already enforces consistent type imports.
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Tests can be loose about return types; the body is the contract.
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
  {
    ignores: ["dist", "coverage", "node_modules", "*.config.js", "*.config.ts"],
  },
);
