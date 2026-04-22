/**
 * @typedef {import("@eslint/config-helpers").ConfigWithExtendsArray} ConfigWithExtendsArray
 * @typedef {import("@eslint/config-helpers").Config} Config
 */

import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import perfectionist from 'eslint-plugin-perfectionist';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * @type {ConfigWithExtendsArray}
 */
const defaultConfig = [
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      'no-console': [
        'error',
        {
          allow: ['warn', 'error'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          disallowTypeAnnotations: true,
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        },
      ],
    },
  },
];

/**
 * @type {ConfigWithExtendsArray}
 */
const perfectionistConfig = [
  {
    plugins: {
      perfectionist,
    },
    rules: {
      'perfectionist/sort-exports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          fallbackSort: { type: 'alphabetical' },
          ignoreCase: true,
          specialCharacters: 'keep',
          partitionByComment: false,
          partitionByNewLine: false,
          newlinesBetween: 'ignore',
          newlinesInside: 'ignore',
          groups: [],
          customGroups: [],
        },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          fallbackSort: { type: 'alphabetical' },
          ignoreCase: true,
          specialCharacters: 'keep',
          sortBy: 'path',
          internalPattern: ['^~/.+', '^@/.+', '^#.+'],
          partitionByComment: false,
          partitionByNewLine: false,
          newlinesBetween: 1,
          newlinesInside: 0,
          maxLineLength: undefined,
          groups: [
            'react',
            'type-import',
            ['value-builtin', 'value-external'],
            'type-internal',
            'value-internal-pkg',
            'value-internal',
            ['type-parent', 'type-sibling', 'type-index'],
            ['value-parent', 'value-sibling', 'value-index'],
            'ts-equals-import',
            'unknown',
          ],
          customGroups: [
            {
              groupName: 'react',
              elementNamePattern: ['^react$', '^react-.+'],
            },
            {
              groupName: 'value-internal-pkg',
              elementNamePattern: '^#pkg/.+',
            },
          ],
          environment: 'bun',
          useExperimentalDependencyDetection: true,
        },
      ],
      'perfectionist/sort-named-exports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          fallbackSort: { type: 'alphabetical' },
          ignoreAlias: false,
          ignoreCase: true,
          specialCharacters: 'keep',
          partitionByNewLine: false,
          partitionByComment: false,
          newlinesBetween: 'ignore',
          newlinesInside: 'ignore',
          groups: [],
          customGroups: [],
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          fallbackSort: { type: 'unsorted' },
          ignoreAlias: false,
          ignoreCase: true,
          specialCharacters: 'keep',
          partitionByNewLine: false,
          partitionByComment: false,
          newlinesBetween: 'ignore',
          newlinesInside: 'ignore',
          groups: [],
          customGroups: [],
        },
      ],
    },
  },
];

/**
 * @param {ConfigWithExtendsArray} config
 * @returns {Config[]}
 */
export const defineExtraConfig = (...config) =>
  defineConfig([...defaultConfig, ...perfectionistConfig, ...config, prettier]);

export default defineExtraConfig();
