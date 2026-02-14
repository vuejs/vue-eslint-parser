module.exports = [
    {
        files: ["**/*.vue"],
        languageOptions: {
            parser: require("../../../../src/index.ts"),
            ecmaVersion: 2022,
            sourceType: "module",
        },
    },
    {
        files: ["no-undef/**/*.vue"],
        rules: {
            "no-undef": "error",
        },
        languageOptions: {
            parserOptions: {
                parser: {
                    ts: "@typescript-eslint/parser",
                },
                vueFeatures: {
                    customMacros: ["userMacro"],
                },
            },
        },
    },
    {
        files: ["no-unused-vars/**/*.vue"],
        rules: {
            "no-unused-vars": "error",
        },
    },
    {
        files: ["no-useless-assignment/**/*.vue"],
        rules: {
            "no-useless-assignment": "error",
        },
    }
]