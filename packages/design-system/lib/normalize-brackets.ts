/**
 * Normalizes specific full-width brackets that appear in AI responses
 *
 * Specifically handles:
 * - U+3010 (【) -> [ (LEFT BLACK LENTICULAR BRACKET)
 * - U+3011 (】) -> ] (RIGHT BLACK LENTICULAR BRACKET)
 */
export function normalizeBrackets(str: string): string {
  return str.replace(/\u3010/g, "[").replace(/\u3011/g, "]");
}
