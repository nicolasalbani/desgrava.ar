import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // The useEffect(() => setMounted(true), []) hydration guard is a
      // standard pattern with next-themes / SSR and is perfectly safe.
      "react-hooks/set-state-in-effect": "off",
      // Allow underscore-prefixed unused vars (intentional destructuring)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Automation code interfaces with ARCA's dynamic DOM — strict typing
    // is impractical for browser-injected evaluate() callbacks.
    files: ["src/lib/automation/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
