import type { Ref } from "@confect/core";
import { QueryResult } from "@confect/react";
import type consents from "@repo/backend/confect/_generated/refs/consents";
import type { AnalyticsConsentAccount } from "@/lib/analytics/consent/model";

/** The account's consent answer: its decision, which is null until a choice is stored. */
type AccountConsentAnswer = Pick<
  Ref.Returns<typeof consents.current.get>,
  "decision"
>;

/**
 * Names the account's consent query for the consent model: its decision once it
 * answers, its failure, or nothing yet while it is pending or skipped.
 */
export function readAccountConsentQuery<E>(
  query: QueryResult.QueryResult<AccountConsentAnswer, E>
): AnalyticsConsentAccount["accountQuery"] {
  if (QueryResult.isSuccess(query)) {
    return { decision: query.value.decision, status: "success" };
  }
  if (QueryResult.isFailure(query)) {
    return { status: "failure" };
  }
  return { status: "pending" };
}
