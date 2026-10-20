import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";
import {
  getPostAuthProviderRetrySearch,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { TextSearchParam } from "@/lib/entry/search";

/** The provider failure and the intent that the sign-in resumes after it. */
const AuthErrorSearch = Schema.Struct({
  intent: TextSearchParam,
});

/**
 * The provider failure page keeps no raw provider diagnostics. It answers with
 * a redirect to one generic retry on the sign-in page, in the same locale.
 */
export const Route = createFileRoute("/$locale/_entry/auth/error")({
  validateSearch: Schema.toStandardSchemaV1(AuthErrorSearch),
  beforeLoad: ({ params, search }) => {
    const resolution = resolvePostAuthIntent(search.intent, params.locale);
    throw redirect({
      params: { locale: params.locale },
      search: getPostAuthProviderRetrySearch(resolution),
      statusCode: 307,
      to: "/$locale/auth",
    });
  },
});
