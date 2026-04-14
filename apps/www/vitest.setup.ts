declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

/** Mark the Vitest jsdom environment as React act-aware. */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export {};
