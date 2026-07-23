import "server-only";

import {
  makeTrustedKeyResolver,
  TRUSTED_CONTENT_KEYS,
} from "@nakafa/aksara-contracts/signature/trusted";

/** Resolves only code-reviewed content keys retained by the shared contract. */
export const contentKeyResolver = makeTrustedKeyResolver(TRUSTED_CONTENT_KEYS);
