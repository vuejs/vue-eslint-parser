import * as path from "path"

export interface ParserOptions {
    // vue-eslint-parser options
    parser?: boolean | string
    vueFeatures?: {
        interpolationAsNonHTML?: boolean // default false
        filter?: boolean // default true
    }

    // espree options
    ecmaVersion?: number | "latest"
    sourceType?: "script" | "module"
    ecmaFeatures?: { [key: string]: any }

    // @typescript-eslint/parser options
    jsxPragma?: string
    jsxFragmentName?: string | null
    lib?: string[]

    project?: string | string[]
    projectFolderIgnoreList?: string[]
    tsconfigRootDir?: string
    extraFileExtensions?: string[]
    warnOnUnsupportedTypeScriptVersion?: boolean

    // set by eslint
    filePath?: string
    // enables by eslint
    comment?: boolean
    loc?: boolean
    range?: boolean
    tokens?: boolean

    // others
    // [key: string]: any
}

export function isSFCFile(parserOptions: ParserOptions) {
    if (parserOptions.filePath === "<input>") {
        return true
    }
    return path.extname(parserOptions.filePath || "unknown.vue") === ".vue"
}
