import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand:
    "pnpm --dir ../../packages/backend typecheck && pnpm --dir ../../packages/backend exec convex deploy --yes --typecheck disable --typecheck-components --cmd 'NEXT_PUBLIC_CONVEX_SITE_URL=\"$VITE_CONVEX_SITE_URL\" pnpm --dir ../../apps/www build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL",
  git: {
    deploymentEnabled: {
      "**": false,
      "changeset-release/main": false,
      main: true,
    },
  },
};
