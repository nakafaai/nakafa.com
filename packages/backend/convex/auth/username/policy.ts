import type { GoogleProfile } from "better-auth/social-providers";

const USERNAME_FALLBACK_BASE = "user";
const USERNAME_GENERATED_PREFIX = "g";
const USERNAME_MAX_LENGTH = 30;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_SEPARATOR = "_";
const USERNAME_VALID_PATTERN = /^[a-zA-Z0-9_.]+$/;
const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const DECIMAL_PATTERN = /^\d+$/;
const INVALID_USERNAME_BASE_PATTERN = /[^a-z0-9_.]+/g;
const INVALID_USERNAME_SUFFIX_PATTERN = /[^a-z0-9]/g;
const REPEATED_USERNAME_SEPARATOR_PATTERN = /[_.]{2,}/g;
const TRAILING_USERNAME_SEPARATOR_PATTERN = /[_.]+$/g;
const USERNAME_EDGE_SEPARATOR_PATTERN = /^[_.]+|[_.]+$/g;

/**
 * Keeps Better Auth username validation explicit and shared with generation.
 *
 * Sources:
 * - Better Auth username docs:
 *   https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/username.mdx
 * - Installed username plugin defaults:
 *   better-auth@1.6.12/dist/plugins/username/index.mjs
 */
export const usernameOptions = {
  minUsernameLength: USERNAME_MIN_LENGTH,
  maxUsernameLength: USERNAME_MAX_LENGTH,
  usernameValidator: isValidUsername,
};

/** Returns true when a username matches the configured Better Auth policy. */
export function isValidUsername(username: string) {
  return USERNAME_VALID_PATTERN.test(username);
}

/**
 * Builds valid Better Auth username fields for a Google OAuth user.
 *
 * Sources:
 * - Better Auth mapProfileToUser docs:
 *   https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/oauth.mdx
 * - Google OpenID Connect `sub` docs:
 *   https://developers.google.com/identity/openid-connect/openid-connect
 */
export function createGoogleUsernameFields(
  profile: Pick<GoogleProfile, "email" | "sub">
) {
  const displayUsername = createUsernameBase(profile.email);
  const suffix = createUsernameSuffix(profile.sub);

  return {
    username: createUsername(displayUsername, suffix),
    displayUsername,
  };
}

/** Builds the next generated username candidate after a collision. */
export function createCollisionUsername(
  username: string,
  email: string,
  displayUsername: string,
  attempt: number
) {
  const suffix = createCollisionSuffix(username, email, attempt);

  return createUsername(displayUsername, suffix);
}

/**
 * Returns true when a Better Auth request is completing Google OAuth.
 *
 * Source: better-auth@1.6.12/dist/api/routes/callback.mjs
 */
export function isGoogleCallbackPath(path: string | undefined) {
  return path?.startsWith("/callback/") ?? false;
}

/** Returns true when the username belongs to the generated username namespace. */
export function isGeneratedUsername(username: string) {
  return username.startsWith(
    `${USERNAME_GENERATED_PREFIX}${USERNAME_SEPARATOR}`
  );
}

/** Builds the readable username base from the email local part. */
function createUsernameBase(email: string) {
  const localPart = getEmailLocalPart(email);
  const baseWithoutAlias = getBaseWithoutAlias(localPart);
  const normalizedBase = baseWithoutAlias
    .normalize("NFKD")
    .replace(COMBINING_MARKS_PATTERN, "")
    .toLowerCase()
    .replace(INVALID_USERNAME_BASE_PATTERN, "_")
    .replace(REPEATED_USERNAME_SEPARATOR_PATTERN, "_")
    .replace(USERNAME_EDGE_SEPARATOR_PATTERN, "");

  if (normalizedBase.length >= USERNAME_MIN_LENGTH) {
    return normalizedBase;
  }

  return USERNAME_FALLBACK_BASE;
}

/**
 * Builds a compact stable suffix from the Google account subject.
 *
 * Source: https://developers.google.com/identity/openid-connect/openid-connect
 */
function createUsernameSuffix(subject: string) {
  const cleanSubject = subject
    .toLowerCase()
    .replace(INVALID_USERNAME_SUFFIX_PATTERN, "");

  if (!cleanSubject) {
    return "0";
  }

  if (isDecimalString(cleanSubject)) {
    return limitSuffixLength(BigInt(cleanSubject).toString(36), cleanSubject);
  }

  return limitSuffixLength(cleanSubject, cleanSubject);
}

/** Builds a deterministic suffix for a generated username collision. */
function createCollisionSuffix(
  username: string,
  email: string,
  attempt: number
) {
  const attemptKey = attempt.toString(36);
  const seed = `${username}:${email}:${attemptKey}`;
  const hash = createStableHash(seed);
  const maxHashLength = getMaxSuffixLength() - attemptKey.length - 1;
  const hashPart = hash.slice(-maxHashLength);

  return `${hashPart}${USERNAME_SEPARATOR}${attemptKey}`;
}

/** Returns true when the value is safe for exact decimal-number encoding. */
function isDecimalString(value: string) {
  return DECIMAL_PATTERN.test(value);
}

/** Returns the maximum suffix length that leaves room for the fallback base. */
function getMaxSuffixLength() {
  return (
    USERNAME_MAX_LENGTH -
    USERNAME_GENERATED_PREFIX.length -
    USERNAME_SEPARATOR.length -
    USERNAME_FALLBACK_BASE.length -
    USERNAME_SEPARATOR.length
  );
}

/** Builds a compact deterministic hash for generated username fallbacks. */
function createStableHash(value: string) {
  let hash = 0xcbf29ce484222325n;

  for (const character of value) {
    hash = BigInt.asUintN(
      64,
      (hash + BigInt(character.charCodeAt(0))) * 0x100000001b3n
    );
  }

  return hash.toString(36);
}

/** Keeps the suffix short enough for Better Auth's default username length. */
function limitSuffixLength(suffix: string, source: string) {
  const maxSuffixLength = getMaxSuffixLength();

  if (suffix.length <= maxSuffixLength) {
    return suffix;
  }

  return createStableHash(source).slice(-maxSuffixLength);
}

/** Combines the readable base and stable suffix into one valid username. */
function createUsername(base: string, suffix: string) {
  const maxBaseLength =
    USERNAME_MAX_LENGTH -
    USERNAME_GENERATED_PREFIX.length -
    USERNAME_SEPARATOR.length -
    USERNAME_SEPARATOR.length -
    suffix.length;
  const limitedBase = trimUsernameBase(base.slice(0, maxBaseLength));

  return `${USERNAME_GENERATED_PREFIX}${USERNAME_SEPARATOR}${limitedBase}${USERNAME_SEPARATOR}${suffix}`;
}

/** Reads the local part from an email-like value. */
function getEmailLocalPart(email: string) {
  const atIndex = email.indexOf("@");

  if (atIndex === -1) {
    return email;
  }

  return email.slice(0, atIndex);
}

/** Removes plus-addressing from the readable username base. */
function getBaseWithoutAlias(localPart: string) {
  const plusIndex = localPart.indexOf("+");

  if (plusIndex === -1) {
    return localPart;
  }

  return localPart.slice(0, plusIndex);
}

/** Removes trailing separators introduced by length limiting. */
function trimUsernameBase(base: string) {
  return base.replace(TRAILING_USERNAME_SEPARATOR_PATTERN, "");
}
