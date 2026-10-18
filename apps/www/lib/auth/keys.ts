/**
 * Where the browser keeps the id of the session it last had. The key starts
 * with the prefix of account state, so signing out and deleting the account
 * remove it with the rest of what the browser holds for the account.
 */
export const KNOWN_SESSION_KEY = "nakafa-session";

/**
 * Stands for a session whose id the browser cannot know yet: the one a
 * sign-in that just left for the provider will come back with.
 */
export const EXPECTED_SESSION = "expected";
