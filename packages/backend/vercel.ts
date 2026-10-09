/**
 * Vercel Git deployments for every TypeScript app: only the main branch
 * deploys. Each app's vercel.ts sets this as its git deploymentEnabled.
 */
export const NAKAFA_VERCEL_DEPLOYMENT_ENABLED = {
  "**": false,
  main: true,
};
