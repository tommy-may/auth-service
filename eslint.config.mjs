import { defineExtraConfig } from '#pkg/config/eslint-config/index.js';

export default defineExtraConfig([
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
