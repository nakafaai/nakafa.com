import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { AppProviders } from "@/components/providers/app";
import { SchoolSettingsHeader } from "@/components/tenant/settings/header";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** A viewer the school does not list gets no school, and the settings page answers not found. */
const notInSchool = () => Effect.succeedNone;

/**
 * The layout of the school settings. Only a viewer who may manage the school
 * reads these pages: a signed-out viewer, a viewer who is not a member, and a
 * member without `tenant.manage` all get not found. The settings pages are client
 * components, so this layout mounts the client providers of the app layout, and
 * the rest of the school shell stays read on the server.
 */
export default async function SchoolSettingsLayout({
  children,
  params,
}: LayoutProps<"/[locale]/school/[slug]/settings">) {
  const { slug: slugParam } = await params;
  if (!Schema.is(TenantSlug)(slugParam)) {
    notFound();
  }
  const slug = slugParam;
  const token = await getToken();
  if (token === undefined) {
    notFound();
  }

  const viewer = await Effect.runPromise(
    HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
      Effect.asSome,
      Effect.catchTags({ AccessDenied: notInSchool, NotMember: notInSchool }),
      Effect.provide(httpLayer({ auth: token }))
    )
  );
  if (
    Option.isNone(viewer) ||
    !Arr.contains(viewer.value.can, "tenant.manage")
  ) {
    notFound();
  }

  return (
    <AppProviders pageNavigation={null}>
      <SchoolSettingsHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
        {children}
      </div>
    </AppProviders>
  );
}
