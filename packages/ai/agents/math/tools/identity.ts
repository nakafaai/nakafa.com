/**
 * Derives a bounded stable artifact id from the AI SDK tool call id.
 */
export function readCoordinateArtifactId(toolCallId: string) {
  const suffix = readToolCallSuffix(toolCallId);
  return `math-${suffix.slice(0, 120)}-coordinate`;
}

/**
 * Derives a bounded evidence anchor from the AI SDK tool call id.
 */
export function readCoordinateProofAnchor(toolCallId: string) {
  const suffix = readToolCallSuffix(toolCallId);
  return `math:${suffix.slice(0, 120)}`;
}

/**
 * Normalizes AI SDK tool-call ids before they enter durable artifact keys.
 */
function readToolCallSuffix(toolCallId: string) {
  const normalized = toolCallId.trim().replaceAll(/\s+/g, "-");
  return normalized.length > 0 ? normalized : "tool-call";
}
