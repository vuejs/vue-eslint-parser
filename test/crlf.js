const assert = require("assert")
const parser = require("../src")

describe("About CRLF tests", () => {
    it("should not contain CR in `<script>` contents.", () => {
        const parsed = parser.parseForESLint(
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
        const script = parsed.services
            .getDocumentFragment()
            .children.find(
                (child) => child.type === "VElement" && child.name === "script",
            )
        assert.ok(!script.children[0].value.includes("\r"))
    })
    it("should contain CRLF in script comment.", async () => {
        const parsed = parser.parseForESLint(
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
        assert.ok(parsed.ast.comments[0].value.includes("\r\n"))
    })
})
