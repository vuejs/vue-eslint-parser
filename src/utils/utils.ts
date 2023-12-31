/**
 * @see https://github.com/vuejs/vue-next/blob/48de8a42b7fed7a03f7f1ff5d53d6a704252cafe/packages/shared/src/index.ts#L109
 */
export function camelize(str: string) {
    return str.replace(/-(\w)/gu, (_, c) => (c ? c.toUpperCase() : ""))
}
