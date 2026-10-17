import { HttpClient } from "@confect/js";
import { POST_PAGE_SIZE } from "@repo/backend/client/posts/list";
import posts from "@repo/backend/confect/_generated/refs/posts";
import { Clock, Effect, String as Str } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { UserPosts } from "@/components/user/posts/list";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { profileHref } from "@/lib/profile/href";
import { readProfile } from "@/lib/profile/server";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/user/[username]">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, username } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("profile"),
    description: t("profile-description"),
    alternates: {
      canonical: `/${locale}${profileHref(Str.toLowerCase(username))}`,
    },
  };
}

export default function Page({
  params,
}: PageProps<"/[locale]/user/[username]">) {
  return (
    <Suspense fallback={null}>
      <UserPostsRoute params={params} />
    </Suspense>
  );
}

/**
 * Resolves the profile and its first page of posts inside the streaming
 * boundary, with the moment the server read them. The browser shows that page
 * until its own live list answers, so the two show the same posts. A failed
 * read leaves the page to the live list, so the header and the tabs still render.
 */
async function UserPostsRoute({
  params,
}: Pick<PageProps<"/[locale]/user/[username]">, "params">) {
  const { username } = await params;
  const [{ account }, token] = await Promise.all([
    readProfile(username),
    getToken(),
  ]);
  const { first, now } = await Effect.runPromise(
    Effect.all({
      first: HttpClient.HttpClient.pipe(
        Effect.flatMap((client) =>
          client.query(posts.queries.list, {
            authorId: account.appUser._id,
            paginationOpts: { cursor: null, numItems: POST_PAGE_SIZE },
          })
        ),
        Effect.provide(httpLayer(token ? { auth: token } : {})),
        Effect.catch((error) =>
          Effect.logWarning(
            "The first page of posts could not be read on the server.",
            error
          ).pipe(Effect.as(null))
        )
      ),
      now: Clock.currentTimeMillis,
    })
  );
  return <UserPosts account={account} first={first} now={now} />;
}
