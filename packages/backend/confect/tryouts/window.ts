import { Duration } from "effect";

/**
 * How long a try-out attempt stays open from its start: a day, so a learner who leaves comes back while the
 * paper is fresh. When it ends, the answers given so far are scored. The attempt's deadline, the access a
 * free start records, and the start dialog's words all read it, so they cannot disagree.
 */
export const TRYOUT_ATTEMPT_WINDOW = Duration.hours(24);
