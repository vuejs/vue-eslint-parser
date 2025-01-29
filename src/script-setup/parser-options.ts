import { getEcmaVersionIfUseEspree, getEspree } from "../common/espree"
import type { ParserOptions } from "../common/parser-options"

export const DEFAULT_ECMA_VERSION = 2017

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
        ecmaVersion: espreeEcmaVersion || parserOptions.ecmaVersion,
    }
}

function getDefaultEcmaVersion() {
    return getEspree().latestEcmaVersion
}
