import { HttpClient } from "@confect/js";
import { Id } from "@repo/backend/confect/_generated/id";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { Effect, Schema } from "effect";
import { Suspense } from "react";
import { UserHeader } from "@/components/user/header";
import { UserTabs } from "@/components/user/tabs";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Layout(props: LayoutProps<"/[locale]/user/[id]">) {
  return (
    <Suspense fallback={null}>
      <UserLayoutContent {...props} />
    </Suspense>
  );
}

/** Resolves the URL-specific profile shell inside its streaming boundary. */
async function UserLayoutContent(props: LayoutProps<"/[locale]/user/[id]">) {
  const { children, params } = props;
  const [{ id, locale }, token] = await Promise.all([params, getToken()]);
  getLocaleOrThrow(locale);

  const { userId, profile, account } = await Effect.runPromise(
    Schema.decodeUnknownEffect(Id("users"))(id).pipe(
      Effect.flatMap((userId) =>
        HttpClient.HttpClient.pipe(
          Effect.flatMap((client) =>
            Effect.all(
              {
                userId: Effect.succeed(userId),
                profile: client.query(auth.queries.getUserById, {
                  userId,
                }),
                account: token
                  ? client.query(auth.queries.getCurrentUser, {})
                  : Effect.succeed(null),
              },
              { concurrency: "unbounded" }
            )
          )
        )
      ),
      Effect.provide(httpLayer(token ? { auth: token } : {}))
    )
  );

  return (
    <ErrorBoundary fallback={null}>
      <main className="relative mx-auto min-h-[calc(100svh-4rem)] max-w-3xl px-6 py-10 sm:py-20 lg:min-h-svh">
        <div className="flex flex-col gap-6">
          <UserHeader
            initialOwnerEmail={
              account?.appUser._id === userId ? account.authUser.email : null
            }
            initialProfile={profile}
            userId={userId}
          />
          <UserTabs userId={userId} />
          {children}
        </div>
      </main>
    </ErrorBoundary>
  );
}
