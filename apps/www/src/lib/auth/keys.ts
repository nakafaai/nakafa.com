/**
 * Where the browser keeps the id of the session it last had. The key starts
 * with the prefix of account state, so signing out and deleting the account
 * remove it with the rest of what the browser holds for the account.
 */
export const KNOWN_SESSION_KEY = "nakafa-session";

/**
 * Where the browser keeps the account row the sidebar last showed for that
 * session (`saveKnownAccount`). It goes when the session does.
 */
export const KNOWN_ACCOUNT_KEY = "nakafa-account";

/**
 * Where the browser keeps the schools the account menu last showed for that
 * session (`saveKnownSchools`). They go when the session does.
 */
export const KNOWN_SCHOOLS_KEY = "nakafa-schools";

/**
 * Where a school host keeps the frame its school layout last drew, with the
 * session it drew it for (`lib/tenant/kept.ts`). It goes when the session does.
 */
export const KEPT_SCHOOL_KEY = "nakafa-school";

/**
 * Stands for a session whose id the browser cannot know yet: the one a
 * sign-in that just left for the provider will come back with.
 */
export const EXPECTED_SESSION = "expected";
