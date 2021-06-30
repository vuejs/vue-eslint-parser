import { lt } from "semver"
import type { VElement } from "../ast"
import {
    getEcmaVersionIfUseEspree,
    getEspreeFromEcmaVersion,
    getEspreeFromLinter,
} from "../common/espree"
import type { ParserOptions } from "../common/parser-options"
/**
 * Get parser options for <script setup>
 */
export function getScriptSetupParserOptions(
    parserOptions: ParserOptions,
    scriptSetupNode: VElement,
): ParserOptions {
    const espreeEcmaVersion = getEcmaVersionIfUseEspree(parserOptions)
    const moduleParserOptions: ParserOptions = {
        ...parserOptions,
        // Script setup requires module support, so set module to sourceType.
        sourceType: "module",
        ecmaVersion:
            espreeEcmaVersion != null && espreeEcmaVersion < 2015
                ? 2015
                : parserOptions.ecmaVersion,
    }
    if (
        // User don't use espree.
        espreeEcmaVersion == null ||
        espreeEcmaVersion >= 2022
    ) {
        return moduleParserOptions
    }

    const text = scriptSetupNode.children[0]
    if (text != null && text.type === "VText") {
        const code = text.value
        if (code.includes("await")) {
            if (lt(getEspreeFromLinter().version, "8.0.0")) {
                return {
                    ...moduleParserOptions,
                    // Script setup requires top level await support, so set the ecma version to 2022.
                    ecmaVersion: 2022,
                }
            }
            // espree v8.x is not compatible with eslint v7.x, so use espree < v8.x whenever possible.
            // To determine that, parse it once and check if an error occurs.
            try {
                getEspreeFromEcmaVersion(espreeEcmaVersion).parse(
                    code,
                    moduleParserOptions,
                )
            } catch {
                return {
                    ...moduleParserOptions,
                    // Script setup requires top level await support, so set the ecma version to 2022.
                    ecmaVersion: 2022,
                }
            }
        }
    }

    return moduleParserOptions
}
