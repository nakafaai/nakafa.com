import type { ResearchOutput } from "@repo/ai/agents/research/schema";
import { isPublicHttpUrlSyntax } from "@repo/ai/agents/research/url";

/** Normalizes public research URLs before citation eligibility checks. */
export function normalizeResearchCitationUrl(url: string) {
  if (!(URL.canParse(url) && isPublicHttpUrlSyntax(url))) {
    return;
  }

  const parsed = new URL(url);
  parsed.hash = "";

  return parsed.href;
}

/** Adds one eligible URL to the shared citation whitelist. */
export function addEligibleCitationUrl(urls: Set<string>, url: string) {
  const normalized = normalizeResearchCitationUrl(url);

  if (!normalized) {
    return;
  }

  urls.add(normalized);
}

/** Adds each returned search source URL to the citation whitelist. */
export function addEligibleSourceUrls(
  urls: Set<string>,
  sources: readonly { url: string }[]
) {
  for (const source of sources) {
    addEligibleCitationUrl(urls, source.url);
  }
}

/** Removes findings that cite sources outside the retrieved direct evidence. */
export function filterResearchOutputCitations(
  output: ResearchOutput,
  eligibleUrls: ReadonlySet<string>
) {
  let changed = false;
  const findings = output.findings.flatMap((finding) => {
    const citations = finding.citations.filter((citation) => {
      const normalized = normalizeResearchCitationUrl(citation.url);

      return normalized ? eligibleUrls.has(normalized) : false;
    });

    if (citations.length !== finding.citations.length) {
      changed = true;
    }

    if (citations.length === 0) {
      changed = true;
      return [];
    }

    return [{ ...finding, citations }];
  });

  if (!changed) {
    return output;
  }

  return {
    findings,
    limitations: output.limitations,
    noEvidenceAnswer: output.noEvidenceAnswer,
  } satisfies ResearchOutput;
}
