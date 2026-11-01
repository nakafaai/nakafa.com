import { ReportHash } from "@repo/backend/confect/records/hash";
import { Schema } from "effect";

/** The hash a report card's QR code names, which the public check reads. */
export const CheckInput = Schema.Struct({ hash: ReportHash });
