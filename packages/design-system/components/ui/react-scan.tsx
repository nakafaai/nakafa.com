export function ReactScan() {
  // We use vercel for prod
  if (process.env.VERCEL_ENV === "production") {
    return null;
  }

  return (
    // biome-ignore lint/nursery/noSyncScripts: we need to sync this script
    <script
      crossOrigin="anonymous"
      src="https://unpkg.com/react-scan/dist/auto.global.js"
    />
  );
}
