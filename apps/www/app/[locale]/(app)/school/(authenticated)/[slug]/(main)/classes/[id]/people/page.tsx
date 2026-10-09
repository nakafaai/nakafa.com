import { SchoolClassesPeopleHeader } from "@/components/school/classes/people/header";
import { SchoolClassesPeopleList } from "@/components/school/classes/people/list";
import { SchoolLayoutContent } from "@/components/school/content";
import { getToken } from "@/lib/auth/server";
import { searchParsers } from "@/lib/nuqs/search";
import { getClassRouteSnapshot } from "@/lib/school/server";

const loadSearch = createLoader(searchParsers);

/** Sends the real first roster page with the class shell before hydration. */
export default async function Page(
  props: PageProps<"/[locale]/school/[slug]/classes/[id]/people">
) {
  const [{ id }, { q }, token] = await Promise.all([
    props.params,
    loadSearch(props.searchParams),
    getToken(),
  ]);
  const route = await getClassRouteSnapshot(id);
  if (!token || route?.kind !== "accessible") {
    return null;
  }
  const initialPage = await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(classes.roster.list, {
        classId: route.class._id,
        q,
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).pipe(Effect.provide(httpLayer({ auth: token })))
  );

  return (
    <SchoolLayoutContent>
      <SchoolClassesPeopleHeader />
      <SchoolClassesPeopleList initialPage={initialPage} initialQuery={q} />
    </SchoolLayoutContent>
  );
}

import { HttpClient } from "@confect/js";
import classes from "@repo/backend/confect/_generated/refs/classes";
import { Effect } from "effect";
import { createLoader } from "nuqs/server";
import { httpLayer } from "@/lib/convex/http";
