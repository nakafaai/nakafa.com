/** How long a page may take to become ready before a suite reports it stuck. */
export const readinessTimeoutMilliseconds = 15_000;

/** How long a deferred card, scene, or chart may take to reveal its content. */
export const revealTimeoutMilliseconds = 30_000;

/** How long a page may take to answer with its whole body before a suite gives up. */
export const servedTimeoutMilliseconds = 30_000;
