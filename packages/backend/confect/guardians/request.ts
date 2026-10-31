import { Id } from "@repo/backend/confect/_generated/id";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** What a parent asks the school office for: a copy of a report, or a correction of the child's data. */
export const RequestKind = Schema.Literals(["reportCopy", "dataCorrection"]);

/** A request waits until Staff answers it, once. */
export const RequestState = Schema.Literals([
  "waiting",
  "approved",
  "declined",
]);

/** What Staff answers. */
export const RequestDecision = Schema.Literals(["approved", "declined"]);

/** What a parent writes: trimmed, 1 to 500 characters. */
export const RequestText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(500)
);

/** One request of a parent about their child (ADR 0034), sealed with the school key. */
export const guardianRequestValidator = Schema.Struct({
  createdAt: Schema.Finite,
  kind: RequestKind,
  linkId: Id("guardianLinks"),
  sealedText: Sealed,
  state: RequestState,
  studentPersonId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});

/** The sealed field of a request, bound to its link and its time. */
export const requestField = (
  row: Pick<typeof guardianRequestValidator.Type, "createdAt" | "linkId">
) => ({
  field: "sealedText",
  row: [row.linkId, row.createdAt],
  table: "guardianRequests",
});

/** One request as its parent reads it. */
export const RequestView = Schema.Struct({
  createdAt: Schema.Finite,
  id: Id("guardianRequests"),
  kind: RequestKind,
  state: RequestState,
  text: Schema.String,
});

/** One waiting request as Staff reads it, with the child's name and the link that answers it. */
export const WaitingRequest = Schema.Struct({
  ...RequestView.fields,
  linkId: Id("guardianLinks"),
  student: Schema.String,
});
