module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['standard', 'prettier', 'plugin:node/recommended'],
  plugins: ['jest', 'import', '@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'node/no-unsupported-features/es-syntax': 'off',
    // ts handles this
    'node/no-missing-import': 'off',
    'no-use-before-define': 'off',
  },
  overrides: [
    {
      files: ['**/__tests__/**'],
      extends: ['plugin:jest/recommended'],
    },
    {
      files: ['**.ts'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-this-alias': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
  ],
  env: { es6: true },
};
