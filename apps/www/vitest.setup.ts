declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

process.env.NEXT_PUBLIC_APP_URL ??= "https://nakafa.com";

/** Mark the Vitest jsdom environment as React act-aware. */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
