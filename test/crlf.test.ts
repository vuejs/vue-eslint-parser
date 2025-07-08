import type { VElement, VText } from "../src/ast"
import { describe, it, assert } from "vitest"
import { parseForESLint } from "../src"

describe("About CRLF tests", () => {
    it("should not contain CR in `<script>` contents.", () => {
        const parsed = parseForESLint(
            `<script>\r
                export default {\r
                    computed: {\r
                        /**\r
                         * @description TEST\r
                         * @param {string} arg - Lorem\r
                         * @return {string} - Some Description\r
                         */\r
                        isForTestingLint (arg) {\r
                            return arg;\r
                        },\r
                    },\r
                };\r
            </script>\r
            `,
            {
                sourceType: "module",
            },
        )
        const script = parsed
            .services!.getDocumentFragment()!
            .children.find(
                (child) => child.type === "VElement" && child.name === "script",
            ) as VElement
        assert.ok(!(script.children[0] as VText).value.includes("\r"))
    })
    it("should contain CRLF in script comment.", () => {
        const parsed = parseForESLint(
            `<script>\r
                export default {\r
                    computed: {\r
                        /**\r
                         * @description TEST\r
                         * @param {string} arg - Lorem\r
                         * @return {string} - Some Description\r
                         */\r
                        isForTestingLint (arg) {\r
                            return arg;\r
                        },\r
                    },\r
                };\r
            </script>\r
            `,
            {
                sourceType: "module",
            },
        )
        assert.ok(parsed.ast.comments![0].value.includes("\r\n"))
    })
})
