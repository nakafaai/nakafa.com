import { localeRewrite } from "@repo/internationalization/src/rewrite";
import { profileRewrite } from "@/lib/profile/rewrite";
import { schoolRewrite } from "@/lib/routing/school/rewrite";

/**
 * Maps the browser's addresses to the router's and back, as `createRouter`
 * calls it. On input the school host comes first, so the locale spelling sits
 * inside the school tree's path, and a profile address becomes its router path
 * before the locale is read. The output runs the same steps in reverse, so a
 * router path is always written as the address the browser shows.
 */
export const routeRewrite = {
  input: ({ url }: { url: URL }) =>
    localeRewrite.input({
      url: profileRewrite.input({ url: schoolRewrite.input({ url }) }),
    }),
  output: ({ url }: { url: URL }) =>
    schoolRewrite.output({
      url: localeRewrite.output({ url: profileRewrite.output({ url }) }),
    }),
};
