import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { notFound } from "next/navigation";
import { Authenticated } from "@/components/auth/gate";
import { getToken } from "@/lib/auth/server";
import { httpLayer } from "@/lib/convex/http";

/** A viewer the school does not list gets no school, and the settings page answers not found. */
const notInSchool = () => Effect.succeedNone;

/**
 * The layout of the school settings. Only a viewer who may manage the school
 * reads these pages: a signed-out viewer, a viewer who is not a member, and a
 * member without `tenant.manage` all get not found. The school shell mounts the
 * client providers that the settings pages need, and this layout keeps the pages
 * behind the session gate.
 *
 * The pages draw once Convex has confirmed the session. The server read the
 * session from the cookie, but a browser that has not signed in on this school's
 * host before learns of it one request after the page loads, and every query of
 * these pages needs it: one sent before would be refused as signed out.
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

  return <Authenticated>{children}</Authenticated>;
}
