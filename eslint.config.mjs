import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  {
    ignores: [
      '.expo/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'supabase/.branches/**',
      'supabase/.temp/**',
    ],
  },
  ...expoConfig,
  {
    rules: {
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always',
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
        },
      ],
    },
  },
]);
