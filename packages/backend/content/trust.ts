import {
  makeTrustedKeyResolver,
  TRUSTED_CONTENT_KEYS,
} from "@nakafa/aksara-contracts/signature/trusted";

/** Resolves only content keys retained by the reviewed contracts package. */
export const contentKeyResolver = makeTrustedKeyResolver(TRUSTED_CONTENT_KEYS);
