/**
 * @see https://prettier.io/docs/configuration
 * @typedef {import("prettier").Config} Config
 */

/**
 * @type {Config}
 */
const defaultConfig = {
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  objectWrap: 'preserve',
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 100,
      },
    },
  ],
};

/**
 * @param {Config} [config]
 * @returns {Config}
 */
export const defineExtraConfig = (config) => ({
  ...defaultConfig,
  ...config,
});

export default defaultConfig;
