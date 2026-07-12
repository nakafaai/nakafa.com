"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { SchoolClassImage } from "@repo/backend/convex/classes/schema";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { updateClassImageState } from "@/components/school/classes/image/state";
import { useClass } from "@/lib/context/use-class";

/** Replace the class image across every loaded school class page. */
function updateClassLists(
  localStore: OptimisticLocalStore,
  classId: string,
  image: SchoolClassImage
) {
  for (const query of localStore.getAllQueries(
    api.classes.queries.getClasses
  )) {
    if (!query.value) {
      continue;
    }

    localStore.setQuery(api.classes.queries.getClasses, query.args, {
      ...query.value,
      page: query.value.page.map((schoolClass) =>
        schoolClass._id === classId ? { ...schoolClass, image } : schoolClass
      ),
    });
  }
}

/** Return a class-image mutation that updates the hydrated route immediately. */
export function useClassImageMutation() {
  const preloadedRoute = useClass((state) => state);

  return useMutation(
    api.classes.mutations.updateClassImage
  ).withOptimisticUpdate((localStore, args) => {
    const queryArgs = { classId: args.classId };
    const cachedRoute = localStore.getQuery(
      api.classes.queries.getClassRoute,
      queryArgs
    );

    if (cachedRoute && cachedRoute.kind !== "accessible") {
      return;
    }
    const route = cachedRoute ?? preloadedRoute;

    localStore.setQuery(
      api.classes.queries.getClassRoute,
      queryArgs,
      updateClassImageState(route, args.image)
    );
    updateClassLists(localStore, args.classId, args.image);
  });
}
