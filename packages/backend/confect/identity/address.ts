/**
 * The domain of the placeholder address that an account made from a school
 * login holds. RFC 2606 reserves `.invalid`, so no mail ever reaches it. The
 * address is a stable internal key, not personal data, because Better Auth
 * needs an email for every user and the school never gives one.
 */
const LOGIN_ADDRESS_DOMAIN = "login.nakafa.invalid";

const LOGIN_ADDRESS_SUFFIX = `@${LOGIN_ADDRESS_DOMAIN}`;

/** The placeholder address of the account with this global username. */
export const loginAddress = (username: string) =>
  `${username}${LOGIN_ADDRESS_SUFFIX}`;

/** Whether an address is a placeholder of this kind, which no sender may mail. */
export const isLoginAddress = (address: string) =>
  address.endsWith(LOGIN_ADDRESS_SUFFIX);
