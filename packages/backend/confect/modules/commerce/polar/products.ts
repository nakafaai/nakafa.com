const productsByServer = {
  production: {
    pro: {
      id: "db602388-ef0c-4a88-92fa-c785f3230c45",
      slug: "pro",
    },
  },
  sandbox: {
    pro: {
      id: "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
      slug: "pro",
    },
  },
} as const;

/** Returns public Polar product ids for a validated Polar server target. */
export function getProductsForServer(server: keyof typeof productsByServer) {
  return productsByServer[server];
}
