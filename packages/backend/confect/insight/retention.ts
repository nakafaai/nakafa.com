import { Duration } from "effect";

/**
 * How long an archived period keeps its Insight. A school can restore a period it archived by mistake, and a restored
 * period keeps everything, so the deletion waits as long as a school that leaves has to export (ADR 0033).
 */
export const INSIGHT_RETENTION = Duration.days(30);
