import { lte } from "semver"
import {
    getEcmaVersionIfUseEspree,
    getEspreeFromLinter,
} from "../common/espree"
import type { ParserOptions } from "../common/parser-options"
/**
 * Get parser options for <script setup>
 */
export function getScriptSetupParserOptions(
    parserOptions: ParserOptions,
): ParserOptions {
    const espreeEcmaVersion = getEcmaVersionIfUseEspree(
        parserOptions,
        getDefaultEcmaVersion,
    )

    return {
        // Script setup requires module support, so set module to sourceType.
        sourceType: "module",
        ...parserOptions,
        ecmaVersion: espreeEcmaVersion,
    }
}

function getDefaultEcmaVersion(def: number) {
    if (lte("8.0.0", getEspreeFromLinter().version)) {
        // Script setup requires top level await support, so default the ecma version to 2022.
        return getEspreeFromLinter().latestEcmaVersion!
    }
    return Math.max(def, 2015)
}
