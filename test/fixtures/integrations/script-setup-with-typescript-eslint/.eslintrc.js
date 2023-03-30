"use strict";

module.exports = {
  root: true,
  parser: require.resolve("../../../../src/index.ts"),
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    parser: "@typescript-eslint/parser",
    project: require.resolve("./tsconfig.test.json"),
    extraFileExtensions: ['.vue']
  },
  plugins: ["@typescript-eslint"],
};
