import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Generated output, plus .claude, which holds Claude Code worktrees
  // (other checkouts of this repository, not this project's source).
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'tools/harness/out/**', '.claude/**']),
]);

export default eslintConfig;
