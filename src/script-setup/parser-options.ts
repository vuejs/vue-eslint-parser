import { lte } from "semver"
import { getEcmaVersionIfUseEspree, getEspreeFromUser } from "../common/espree"
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
        ...parserOptions,
        ecmaVersion: espreeEcmaVersion,
    }
}

function getDefaultEcmaVersion(def: number) {
    if (lte("8.0.0", getEspreeFromUser().version)) {
        // Script setup requires top level await support, so default the ecma version to 2022.
        return getEspreeFromUser().latestEcmaVersion!
    }
    return Math.max(def, 2017)
}
