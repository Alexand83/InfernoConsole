module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-console': 'off',
    'no-undef': 'off',
    'no-empty': 'off',
    'no-extra-semi': 'off',
    'no-case-declarations': 'off',
    'no-dupe-keys': 'off',
    'no-dupe-class-members': 'off',
  },
  ignorePatterns: [
    'dist/',
    'dist-electron/',
    'build/',
    'node_modules/',
    '*.config.js',
    '*.config.ts',
    'electron/',
    'public/',
  ],
};
