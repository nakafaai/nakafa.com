import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReportHash, VerifyAnswer } from "@repo/backend/confect/records/report";

/**
 * The public check of a report card's QR code (ADR 0033, S5): whether a hash belongs to
 * a locked report, with the school, the kind of document, the period, and the approval
 * date, and nothing about the student. It is a mutation so every check counts against
 * the one rate limit of the checks.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "report",
    args: () => ({ hash: ReportHash }),
    returns: () => VerifyAnswer,
  })
);
