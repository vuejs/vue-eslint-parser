import type {
    ESLintExtendedProgram,
    HasLocation,
    LocationRange,
    Node,
    ParseError,
} from "../ast"
import { traverseNodes } from "../ast"
import type { LocationFixCalculator } from "./location-fix-calculator"

/**
 * Do post-process of parsing an expression.
 *
 * 1. Set `node.parent`.
 * 2. Fix `node.range` and `node.loc` for HTML entities.
 *
 * @param result The parsing result to modify.
 * @param locationCalculator The location calculator to modify.
 */
export function fixLocations(
    result: ESLintExtendedProgram,
    locationCalculator: LocationFixCalculator,
): void {
    // There are cases which the same node instance appears twice in the tree.
    // E.g. `let {a} = {}` // This `a` appears twice at `Property#key` and `Property#value`.
    const traversed = new Set<Node | number[] | LocationRange>()

    traverseNodes(result.ast, {
        visitorKeys: result.visitorKeys,

        enterNode(node, parent) {
            if (!traversed.has(node)) {
                traversed.add(node)
                node.parent = parent

                // `babel-eslint@8` has shared `Node#range` with multiple nodes.
                // See also: https://github.com/vuejs/eslint-plugin-vue/issues/208
                if (traversed.has(node.range)) {
                    if (!traversed.has(node.loc)) {
                        // However, `Node#loc` may not be shared.
                        // See also: https://github.com/vuejs/vue-eslint-parser/issues/84
                        node.loc.start = locationCalculator.getLocFromIndex(
                            node.range[0],
                        )
                        node.loc.end = locationCalculator.getLocFromIndex(
                            node.range[1],
                        )
                        traversed.add(node.loc)
                    }
                } else {
                    fixLocation(node, locationCalculator)
                    traversed.add(node.range)
                    traversed.add(node.loc)
                }
            }
        },

        leaveNode() {
            // Do nothing.
        },
    })

    for (const token of result.ast.tokens || []) {
        fixLocation(token, locationCalculator)
    }
    for (const comment of result.ast.comments || []) {
        fixLocation(comment, locationCalculator)
    }
}

/**
 * Modify the location information of the given node with using the base offset and gaps of this calculator.
 * @param node The node to modify their location.
 */
export function fixLocation<T extends HasLocation>(
    node: T,
    locationCalculator: LocationFixCalculator,
): T {
    const range = node.range
    const loc = node.loc
    const d0 = locationCalculator.getFixOffset(range[0], "start")
    const d1 = locationCalculator.getFixOffset(range[1], "end")

    if (d0 !== 0) {
        range[0] += d0
        if (node.start != null) {
            node.start += d0
        }
        loc.start = locationCalculator.getLocFromIndex(range[0])
    }
    if (d1 !== 0) {
        range[1] += d1
        if (node.end != null) {
            node.end += d0
        }
        loc.end = locationCalculator.getLocFromIndex(range[1])
    }

    return node
}

/**
 * Modify the location information of the given error with using the base offset and gaps of this calculator.
 * @param error The error to modify their location.
 */
export function fixErrorLocation(
    error: ParseError,
    locationCalculator: LocationFixCalculator,
) {
    const diff = locationCalculator.getFixOffset(error.index, "start")

    error.index += diff

    const loc = locationCalculator.getLocFromIndex(error.index)
    error.lineNumber = loc.line
    error.column = loc.column
}
