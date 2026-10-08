/** How long a page may take to become ready before a suite reports it stuck. */
export const readinessTimeoutMilliseconds = 15_000;

/** How long a deferred card, scene, or chart may take to reveal its content. */
export const revealTimeoutMilliseconds = 30_000;

/** How long a page may take to fill the Next.js cache before a suite gives up. */
export const cacheTimeoutMilliseconds = 30_000;
