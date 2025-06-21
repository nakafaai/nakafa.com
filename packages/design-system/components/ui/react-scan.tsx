/* eslint-disable @next/next/no-sync-scripts */
export function ReactScan() {
  // We use vercel for prod
  if (process.env.VERCEL_ENV === "production") {
    return null;
  }

  return (
    <script
      crossOrigin="anonymous"
      src="https://unpkg.com/react-scan/dist/auto.global.js"
    />
  );
}
