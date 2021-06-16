// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

/**
 * Capitalize a string.
 */
export function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Checks whether the given string has symbols.
 */
function hasSymbols(str: string) {
    return /[!"#%&'()*+,./:;<=>?@[\\\]^`{|}]/u.exec(str) // without " ", "$", "-" and "_"
}

/**
 * Checks whether the given string has upper.
 */
function hasUpper(str: string) {
    return /[A-Z]/u.exec(str)
}

/**
 * Convert text to kebab-case
 * @param str Text to be converted
 */
export function kebabCase(str: string) {
    return str
        .replace(/_/gu, "-")
        .replace(/\B([A-Z])/gu, "-$1")
        .toLowerCase()
}

/**
 * Checks whether the given string is kebab-case.
 */
export function isKebabCase(str: string) {
    if (
        hasUpper(str) ||
        hasSymbols(str) ||
        /^-/u.exec(str) || // starts with hyphen is not kebab-case
        /_|--|\s/u.exec(str)
    ) {
        return false
    }
    return true
}

/**
 * Convert text to snake_case
 * @param str Text to be converted
 */
export function snakeCase(str: string) {
    return str
        .replace(/\B([A-Z])/gu, "_$1")
        .replace(/-/gu, "_")
        .toLowerCase()
}

/**
 * Checks whether the given string is snake_case.
 */
export function isSnakeCase(str: string) {
    if (hasUpper(str) || hasSymbols(str) || /-|__|\s/u.exec(str)) {
        return false
    }
    return true
}

/**
 * Convert text to camelCase
 * @param str Text to be converted
 * @return Converted string
 */
export function camelCase(str: string) {
    if (isPascalCase(str)) {
        return str.charAt(0).toLowerCase() + str.slice(1)
    }
    return str.replace(/[-_](\w)/gu, (_, c) => (c ? c.toUpperCase() : ""))
}

/**
 * Checks whether the given string is camelCase.
 */
export function isCamelCase(str: string) {
    if (
        hasSymbols(str) ||
        /^[A-Z]/u.exec(str) ||
        /-|_|\s/u.exec(str) // kebab or snake or space
    ) {
        return false
    }
    return true
}

/**
 * Convert text to PascalCase
 * @param str Text to be converted
 * @return Converted string
 */
export function pascalCase(str: string) {
    return capitalize(camelCase(str))
}

/**
 * Checks whether the given string is PascalCase.
 */
export function isPascalCase(str: string) {
    if (
        hasSymbols(str) ||
        /^[a-z]/u.exec(str) ||
        /-|_|\s/u.exec(str) // kebab or snake or space
    ) {
        return false
    }
    return true
}

const convertersMap = {
    "kebab-case": kebabCase,
    // eslint-disable-next-line @mysticatea/ts/camelcase
    snake_case: snakeCase,
    camelCase,
    PascalCase: pascalCase,
}

const checkersMap = {
    "kebab-case": isKebabCase,
    // eslint-disable-next-line @mysticatea/ts/camelcase
    snake_case: isSnakeCase,
    camelCase: isCamelCase,
    PascalCase: isPascalCase,
}

/**
 * Return case checker
 */
function getChecker(name: keyof typeof checkersMap) {
    return checkersMap[name] || isPascalCase
}

/**
 * Return case converter
 */
function getConverter(name: keyof typeof convertersMap) {
    return convertersMap[name] || pascalCase
}

export const allowedCaseOptions = ["camelCase", "kebab-case", "PascalCase"]

/**
 * Return case exact converter.
 * If the converted result is not the correct case, the original value is returned.
 */
export function getExactConverter(name: keyof typeof convertersMap) {
    const converter = getConverter(name)
    const checker = getChecker(name)
    return (str: string) => {
        const result = converter(str)
        return checker(result) ? result : str /* cannot convert */
    }
}
