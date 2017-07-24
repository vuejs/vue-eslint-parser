/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import {HasLocation} from "./locations"

/**
 * Tokens.
 */
export interface Token extends HasLocation {
    /**
     * Token types.
     */
    type: string

    /**
     * Processed values.
     */
    value: string
}
