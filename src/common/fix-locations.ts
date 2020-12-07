import {
    ESLintExtendedProgram,
    LocationRange,
    Node,
    traverseNodes,
} from "../ast"
import { LocationCalculator } from "./location-calculator"

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
    locationCalculator: LocationCalculator,
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
                    locationCalculator.fixLocation(node)
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
        locationCalculator.fixLocation(token)
    }
    for (const comment of result.ast.comments || []) {
        locationCalculator.fixLocation(comment)
    }
}
