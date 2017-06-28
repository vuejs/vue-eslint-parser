/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import EventEmitter from "events"

declare class NodeEventGenerator {
    constructor(emitter: EventEmitter)
    enterNode(node: any): void
    leaveNode(node: any): void
}

export default NodeEventGenerator
