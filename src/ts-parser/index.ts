/* eslint eslint-comments/no-use: 0, @typescript-eslint/consistent-type-imports: 0 -- ignore */
import typescript from "typescript"
import { createRequire } from "../common/create-require"
import path from "path"
import { HTMLParser, HTMLTokenizer } from "../html"
import { ParserOptions } from "../common/parser-options"
import { isScriptElement } from "../common/ast-utils"
type TSESLintParser = typeof import("@typescript-eslint/parser")
type TS = typeof typescript
export function createTSESLintParserForVue(): TSESLintParser {
    const tsEslintParser = loadModule<TSESLintParser>(
        "@typescript-eslint/parser",
    )
    const ts = loadModule<TS>("typescript")
    applyTSPatch(ts)
    const ctx = new TSContext(ts)
    return {
        ...tsEslintParser,
        parseForESLint(code, options) {
            // const compilerOptions = createCompilerOptions(options! as any, ts)
            const program = ctx.getProgram(code, options as any)
            const parserOptions = {
                ...options,
                programs: [program],
            }
            return tsEslintParser.parseForESLint(code, parserOptions as any)
        },
    }
}

/** Apply a patch to make `typescript` judge `.vue` files as TSX. */
function applyTSPatch(_ts: TS) {
    const ts = _ts as any as TS & {
        // internal
        ensureScriptKind: (fileName: string) => typescript.ScriptKind
    }
    const { ensureScriptKind } = ts
    if ((ensureScriptKind as any)._patched) {
        return
    }
    ts.ensureScriptKind = function (fileName, ...args) {
        if (fileName.endsWith(".vue")) {
            return ts.ScriptKind.TSX
        }
        return ensureScriptKind.call(this, fileName, ...args)
    }
    ;(ts.ensureScriptKind as any)._patched = true
}

class TSContext {
    private readonly ts: typeof typescript
    private readonly tsServices = new Map<string, TSService>()
    public constructor(ts: TS) {
        this.ts = ts
    }
    public getProgram(
        code: string,
        options: ParserOptions,
    ): typescript.Program {
        if (!options) {
            throw new Error("parserOptions is required.")
        }
        if (!options.project) {
            throw new Error(
                "Specify `parserOptions.project`. Otherwise there is no point in using this parser.",
            )
        }
        if (Array.isArray(options.project)) {
            throw new Error(
                "Specifying an array in `parserOptions.project` is not currently supported.",
            )
        }
        const ts = this.ts
        const tsconfigPath = options.project
        const fileName = options.filePath
            ? normalizeFileName(toAbsolutePath(options.filePath), ts)
            : "input.vue"

        let watch = this.tsServices.get(tsconfigPath)
        if (!watch) {
            watch = new TSService(ts, tsconfigPath)
            this.tsServices.set(tsconfigPath, watch)
        }

        return watch.getProgram(code, fileName)
    }
}

class TSService {
    private readonly watch: typescript.WatchOfConfigFile<typescript.BuilderProgram>
    private currTarget = {
        code: "",
        filePath: "",
    }
    private fileWatchCallbacks = new Map<string, () => void>()
    public constructor(ts: TS, tsconfigPath: string) {
        this.watch = this.createWatch(ts, tsconfigPath)
    }
    public getProgram(code: string, filePath: string): typescript.Program {
        this.currTarget = {
            code,
            filePath,
        }
        getFileNamesIncludingVirtualTSX(filePath).forEach((vFilePath) => {
            this.fileWatchCallbacks.get(vFilePath)?.()
        })

        const program = this.watch.getProgram().getProgram()
        // sets parent pointers in source files
        program.getTypeChecker()
        return program
    }

    private createWatch(
        ts: TS,
        tsconfigPath: string,
    ): typescript.WatchOfConfigFile<typescript.BuilderProgram> {
        const watchCompilerHost = ts.createWatchCompilerHost(
            tsconfigPath,
            {
                noEmit: true,
                jsx: ts.JsxEmit.Preserve,

                // This option is required if `includes` only includes `*.vue` files.
                // However, the option is not in the documentation.
                // https://github.com/microsoft/TypeScript/issues/28447
                allowNonTsExtensions: true,
            },
            ts.sys,
            ts.createAbstractBuilder,
            (diagnostic) => {
                throw new Error(formatDiagnostics([diagnostic], ts))
            },
            () => {
                // Not reported in reportWatchStatus.
            },
            undefined,
            [
                {
                    extension: ".vue",
                    isMixedContent: true,
                    scriptKind: ts.ScriptKind.Deferred,
                },
            ],
        )
        const original = {
            readFile: watchCompilerHost.readFile,
            fileExists: watchCompilerHost.fileExists,
        }
        watchCompilerHost.readFile = (fileName, ...args) => {
            const realFileName = toRealFileName(fileName)
            const normalized = normalizeFileName(realFileName, ts)
            if (this.currTarget.filePath === normalized) {
                // It is the file currently being parsed.
                return this.currTarget.code
            }

            const code = original.readFile.call(this, realFileName, ...args)
            if (code && path.extname(normalized) === ".vue") {
                const newCode = extractScript(code)
                return newCode
            }
            return code
        }
        // Modify it so that it can be determined that the virtual file actually exists.
        watchCompilerHost.fileExists = (fileName, ...args) =>
            original.fileExists.call(this, toRealFileName(fileName), ...args)

        // It keeps a callback to mark the parsed file as changed so that it can be reparsed.
        watchCompilerHost.watchFile = (fileName, callback) => {
            const normalized = normalizeFileName(fileName, ts)
            this.fileWatchCallbacks.set(normalized, () =>
                callback(fileName, ts.FileWatcherEventKind.Changed),
            )

            return {
                close: () => {
                    this.fileWatchCallbacks.delete(normalized)
                },
            }
        }
        // Use watchCompilerHost but don't actually watch the files and directories.
        watchCompilerHost.watchDirectory = () => ({
            close() {
                // noop
            },
        })

        /**
         * It heavily references typescript-eslint.
         * @see https://github.com/typescript-eslint/typescript-eslint/blob/84e316be33dac5302bd0367c4d1960bef40c484d/packages/typescript-estree/src/create-program/createWatchProgram.ts#L297-L309
         */
        watchCompilerHost.afterProgramCreate = (program) => {
            const originalDiagnostics =
                program.getConfigFileParsingDiagnostics()
            const configFileDiagnostics = originalDiagnostics.filter(
                (diag) =>
                    diag.category === ts.DiagnosticCategory.Error &&
                    diag.code !== 18003,
            )
            if (configFileDiagnostics.length > 0) {
                throw new Error(formatDiagnostics(configFileDiagnostics, ts))
            }
        }

        const watch = ts.createWatchProgram(watchCompilerHost)
        return watch
    }
}

/** If the given filename is a `.vue` file, return a list of filenames containing virtual filename (.vue.tsx). */
function getFileNamesIncludingVirtualTSX(fileName: string) {
    if (fileName.endsWith(".vue")) {
        return [`${fileName}.tsx`, fileName]
    }
    return [fileName]
}

/** If the given filename is a virtual filename (.vue.tsx), returns the real filename. */
function toRealFileName(fileName: string) {
    if (fileName.endsWith(".vue.tsx")) {
        return fileName.slice(0, -4)
    }
    return fileName
}

/** Extract <script> blocks script from SFC. */
function extractScript(sfcCode: string) {
    try {
        const options: ParserOptions = {
            parser: false,
        }
        const tokenizer = new HTMLTokenizer(sfcCode, options)
        const rootAST = new HTMLParser(tokenizer, options).parse()

        return rootAST.children
            .filter(isScriptElement)
            .map((scriptElement) => {
                const textNode = scriptElement.children[0]
                if (textNode == null || textNode.type !== "VText") {
                    return ""
                }
                return textNode.value
            })
            .join("\n\n")
    } catch (_e) {
        // ignore
    }
    return sfcCode
}

function formatDiagnostics(diagnostics: typescript.Diagnostic[], ts: TS) {
    return ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: process.cwd,
        getNewLine: () => "\n",
    })
}

function normalizeFileName(fileName: string, ts: TS) {
    let normalized = path.normalize(fileName)
    if (normalized.endsWith(path.sep)) {
        normalized = normalized.slice(0, -1)
    }
    if (ts.sys.useCaseSensitiveFileNames) {
        return normalized
    }
    return normalized.toLowerCase()
}

function toAbsolutePath(filePath: string) {
    return path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath)
}

/**
 * Load module from the user dir.
 */
function loadModule<T>(module: string): T {
    try {
        const cwd = process.cwd()
        const relativeTo = path.join(cwd, "__placeholder__.js")
        return createRequire(relativeTo)(module)
    } catch {
        // ignore
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(module)
}
