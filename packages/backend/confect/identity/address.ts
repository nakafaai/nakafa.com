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

/** Whether an address is a placeholder of this kind, which no sender may mail. */
export const isLoginAddress = (address: string) =>
  address.endsWith(LOGIN_ADDRESS_SUFFIX);
