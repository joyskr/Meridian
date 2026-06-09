import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.git/**',
      '.next/**',
      '**/.next/**',
      'coverage/**',
      'dist/**',
      '**/dist/**',
      'build/**',
      '**/build/**',
      'node_modules/**',
      '**/node_modules/**',
      'apps/web/next-env.d.ts',
      'apps/web/tsconfig.tsbuildinfo'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  }
);
