/**
 * Marks MDX source text that is only meant for agent retrieval.
 *
 * The raw MDX stays readable for agent markdown, while learner-facing React
 * rendering intentionally omits this content.
 */
export function AgentContext() {
  return null;
}
