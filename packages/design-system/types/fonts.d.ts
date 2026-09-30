/** Next.js serves an imported font file as a static asset and returns its URL. */
declare module "*.woff2" {
  const url: string;
  export default url;
}
