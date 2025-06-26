/**
 * @see https://github.com/vuejs/vue-next/blob/48de8a42b7fed7a03f7f1ff5d53d6a704252cafe/packages/shared/src/index.ts#L109
 */
export function camelize(str: string) {
    return str.replace(/-(\w)/gu, (_, c) => (c ? c.toUpperCase() : ""))
}

/**
 * A binary search implementation that finds the index at which `predicate`
 * stops returning `true` and starts returning `false` (consistently) when run
 * on the items of the array. It **assumes** that mapping the array via the
 * predicate results in the shape `[...true[], ...false[]]`. *For any other case
 * the result is unpredictable*.
 *
 * This is the base implementation of the `sortedIndex` functions which define
 * the predicate for the user, for common use-cases.
 *
 * It is similar to `findIndex`, but runs at O(logN), whereas the latter is
 * general purpose function which runs on any array and predicate, but runs at
 * O(N) time.
 *
 * MIT License | Copyright (c) 2018 remeda | https://remedajs.com/
 *
 * The implementation is copied from remeda package:
 * https://github.com/remeda/remeda/blob/df5fe74841c07bc356bbaa2c89bc7ba0cafafd0a/packages/remeda/src/internal/binarySearchCutoffIndex.ts#L15
 */
function binarySearchCutoffIndex<T>(
    array: readonly T[],
    predicate: (value: T, index: number, data: readonly T[]) => boolean,
): number {
    let lowIndex = 0
    let highIndex = array.length

    while (lowIndex < highIndex) {
        const pivotIndex = (lowIndex + highIndex) >>> 1
        const pivot = array[pivotIndex]

        if (predicate(pivot, pivotIndex, array)) {
            lowIndex = pivotIndex + 1
        } else {
            highIndex = pivotIndex
        }
    }

    return highIndex
}

/**
 * Find the insertion position (index) of an item in an array with items sorted
 * in ascending order; so that `splice(sortedIndex, 0, item)` would result in
 * maintaining the array's sort-ness. The array can contain duplicates.
 * If the item already exists in the array the index would be of the *last*
 * occurrence of the item.
 *
 * Runs in O(logN) time.
 *
 * @param item - The item to insert.
 * @returns Insertion index (In the range 0..data.length).
 * @signature
 *    R.sortedLastIndex(item)(data)
 * @example
 *    R.pipe(['a','a','b','c','c'], sortedLastIndex('c')) // => 5
 *
 * MIT License | Copyright (c) 2018 remeda | https://remedajs.com/
 *
 * The implementation is copied from remeda package:
 * https://github.com/remeda/remeda/blob/df5fe74841c07bc356bbaa2c89bc7ba0cafafd0a/packages/remeda/src/sortedLastIndex.ts#L51
 */
export function sortedLastIndex<T>(array: readonly T[], item: T): number {
    return binarySearchCutoffIndex(array, (pivot) => pivot <= item)
}

/**
 * Find the insertion position (index) of an item in an array with items sorted
 * in ascending order using a value function; so that
 * `splice(sortedIndex, 0, item)` would result in maintaining the arrays sort-
 * ness. The array can contain duplicates.
 * If the item already exists in the array the index would be of the *first*
 * occurrence of the item.
 *
 * Runs in O(logN) time.
 *
 * See also:
 * * `findIndex` - scans a possibly unsorted array in-order (linear search).
 * * `sortedIndex` - like this function, but doesn't take a callbackfn.
 * * `sortedLastIndexBy` - like this function, but finds the last suitable index.
 * * `sortedLastIndex` - like `sortedIndex`, but finds the last suitable index.
 * * `rankBy` - scans a possibly unsorted array in-order, returning the index based on a sorting criteria.
 *
 * @param data - The (ascending) sorted array.
 * @param item - The item to insert.
 * @param valueFunction - All comparisons would be performed on the result of
 * calling this function on each compared item. Preferably this function should
 * return a `number` or `string`. This function should be the same as the one
 * provided to sortBy to sort the array. The function is called exactly once on
 * each items that is compared against in the array, and once at the beginning
 * on `item`. When called on `item` the `index` argument is `undefined`.
 * @returns Insertion index (In the range 0..data.length).
 * @signature
 *    R.sortedIndexBy(data, item, valueFunction)
 * @example
 *    R.sortedIndexBy([{age:20},{age:22}],{age:21},prop('age')) // => 1
 *
 * MIT License | Copyright (c) 2018 remeda | https://remedajs.com/
 *
 * The implementation is copied from remeda package:
 * https://github.com/remeda/remeda/blob/df5fe74841c07bc356bbaa2c89bc7ba0cafafd0a/packages/remeda/src/sortedIndexBy.ts#L37
 */
export function sortedIndexBy<T>(
    array: readonly T[],
    item: T,
    valueFunction: (
        item: T,
        index: number | undefined,
        data: readonly T[],
    ) => number,
): number {
    const value = valueFunction(item, undefined, array)

    return binarySearchCutoffIndex(
        array,
        (pivot, index) => valueFunction(pivot, index, array) < value,
    )
}

/**
 * Find the insertion position (index) of an item in an array with items sorted
 * in ascending order using a value function; so that
 * `splice(sortedIndex, 0, item)` would result in maintaining the arrays sort-
 * ness. The array can contain duplicates.
 * If the item already exists in the array the index would be of the *last*
 * occurrence of the item.
 *
 * Runs in O(logN) time.
 *
 * See also:
 * * `findIndex` - scans a possibly unsorted array in-order (linear search).
 * * `sortedLastIndex` - a simplified version of this function, without a callbackfn.
 * * `sortedIndexBy` - like this function, but returns the first suitable index.
 * * `sortedIndex` - like `sortedLastIndex` but without a callbackfn.
 * * `rankBy` - scans a possibly unsorted array in-order, returning the index based on a sorting criteria.
 *
 * @param data - The (ascending) sorted array.
 * @param item - The item to insert.
 * @param valueFunction - All comparisons would be performed on the result of
 * calling this function on each compared item. Preferably this function should
 * return a `number` or `string`. This function should be the same as the one
 * provided to sortBy to sort the array. The function is called exactly once on
 * each items that is compared against in the array, and once at the beginning
 * on `item`. When called on `item` the `index` argument is `undefined`.
 * @returns Insertion index (In the range 0..data.length).
 * @signature
 *    R.sortedLastIndexBy(data, item, valueFunction)
 * @example
 *    R.sortedLastIndexBy([{age:20},{age:22}],{age:21},prop('age')) // => 1
 * MIT License | Copyright (c) 2018 remeda | https://remedajs.com/
 *
 * The implementation is copied from remeda package:
 * https://github.com/remeda/remeda/blob/df5fe74841c07bc356bbaa2c89bc7ba0cafafd0a/packages/remeda/src/sortedLastIndexBy.ts#L37
 */
export function sortedLastIndexBy<T>(
    array: readonly T[],
    item: T,
    valueFunction: (
        item: T,
        index: number | undefined,
        data: readonly T[],
    ) => number,
): number {
    const value = valueFunction(item, undefined, array)

    return binarySearchCutoffIndex(
        array,
        (pivot, index) => valueFunction(pivot, index, array) <= value,
    )
}
