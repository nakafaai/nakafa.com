export default {
  ignore: {
    overrides: [
      {
        // Next.js 16.3 documents variable MDX imports for bounded dynamic routes.
        // https://nextjs.org/docs/app/guides/mdx#using-dynamic-imports
        files: ["_lib/module.ts"],
        rules: ["react-doctor/no-dynamic-import-path"],
      },
    ],
  },
};
