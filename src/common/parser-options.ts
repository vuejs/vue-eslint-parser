export interface ParserOptions {
    // vue-eslint-parser options
    parser?: boolean | string
    vueFeatures?: {
        interpolationAsNonHTML?: boolean // default false
        filter?: boolean // default true
    }

    // espree options
    ecmaVersion?: number
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
