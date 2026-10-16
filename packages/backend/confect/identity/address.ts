import { pipe, String as Str } from "effect";

/**
 * The domain of the placeholder address that an account made from a school
 * login holds. RFC 2606 reserves `.invalid`, so no mail ever reaches it. The
 * address is a stable internal key, not personal data: its local part is a random
 * key drawn for the account, so it never holds the name of the student (ADR 0009).
 */
const LOGIN_ADDRESS_DOMAIN = "login.nakafa.invalid";

const LOGIN_ADDRESS_SUFFIX = `@${LOGIN_ADDRESS_DOMAIN}`;

/** The placeholder address whose local part is this key, drawn for one account. */
export const loginAddress = (key: string) => `${key}${LOGIN_ADDRESS_SUFFIX}`;

/**
 * Whether a recipient names the placeholder domain, in any written form: in any
 * case, inside angle brackets, after a display name, or with a trailing root
 * dot. The domain is looked for anywhere in the text, so a longer name that
 * starts with it is refused as well. No real recipient is written that way.
 */
export const isLoginAddress = (address: string) =>
  pipe(address, Str.toLowerCase, Str.includes(LOGIN_ADDRESS_SUFFIX));
