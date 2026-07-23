import {
  makeTrustedKeyResolver,
  TRUSTED_CONTENT_KEYS,
} from "@nakafa/aksara-contracts/signature/trusted";

/** Resolves only reviewed retained keys from the shared contracts package. */
export const trustedKeyResolver = makeTrustedKeyResolver(TRUSTED_CONTENT_KEYS);
