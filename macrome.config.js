'use strict';

module.exports = {
  generators: [
    [
      '@macrome/generator-typescript',
      { include: 'lib/**/*.ts', exclude: 'lib/**/internal/**/*.ts' },
    ],
    ['@macrome/generator-typescript', { include: 'lib/**/internal/**/*.ts', defs: false }],
  ],
};
