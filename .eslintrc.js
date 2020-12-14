module.exports = {
  extends: ['standard', 'prettier', 'plugin:node/recommended'],
  plugins: ['jest', 'import'],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  overrides: [
    {
      files: ['**/__tests__/**'],
      extends: ['plugin:jest/recommended'],
    },
  ],
  env: { es6: true },
};
