import { Duration } from "effect";

/**
 * How long a try-out attempt stays open from its start. The attempt's deadline, the access a free start
 * records, and the start dialog's words all read it, so they cannot disagree.
 */
export const TRYOUT_ATTEMPT_WINDOW = Duration.days(3);
