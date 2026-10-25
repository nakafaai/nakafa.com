/**
 * The build-time flag of the static release, which `vite.config.ts` defines. It is
 * true only in the build that deploys the Worker with its prerendered assets.
 */
declare const __NAKAFA_STATIC_RELEASE__: boolean;

/** Whether this Worker serves the static release, so a locale path that no route renders names no page. */
export const HAS_STATIC_RELEASE: boolean = __NAKAFA_STATIC_RELEASE__;
