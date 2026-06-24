/** Formats compact positive and negative specialist input examples. */
export function formatExamplesPrompt() {
  return `
      # Specialist Input Examples

      Good Nakafa input:
      - request: cleaned user-language topic and practice scope.
      - objective: find suitable Nakafa-owned exercise or lesson evidence.
      - requirements: real content scope only.
      - deliverables: requested Nakafa content pieces.

      Good math follow-up input:
      - request: cleaned user-language math verification request.
      - objective: check selected calculations, answer keys, and numeric claims.
      - requirements: use only the selected evidence when verifying retrieved content.
      - given: user-provided or retrieved expressions, data, assumptions, and answer keys.
      - math: structured operation id plus expression(s), variables, bounds, order, matrices, values, or points.

      Good deepResearch input:
      - request: cleaned user-language source-specific research request.
      - objective: find direct source-backed evidence for the requested claim.
      - sourceRequirements: named owners, domains, URLs, recency, or credibility constraints from the user.

      Bad specialist inputs:
      - request: "Find something about math." Problem: vague and missing the specialist objective.
      - request: "Use math because the page path has mathematics." Problem: routes from metadata instead of the actual request and evidence.
      - request: translated user wording. Problem: loses the user's language and exact technical terms.
      - objective: "Search everything and answer." Problem: mixes retrieval, verification, and final response.
      - requirements: global output formatting rules. Problem: repeats answer-formatting instead of task constraints.
      - requirements: scripted failed-outcome wording. Problem: scripts an outcome before evidence exists.
    `;
}
