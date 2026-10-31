import { getRouteApi } from "@tanstack/react-router";
import { Curricula } from "@/components/marketing/about/curricula";
import { CurriculumList } from "@/components/marketing/about/curricula/list";

const homeRoute = getRouteApi("/$locale/_marketing/");

/** The curricula part of the home page with its list. */
export function HomeCurricula() {
  const { curricula } = homeRoute.useLoaderData();
  return (
    <Curricula>
      <CurriculumList curricula={curricula} />
    </Curricula>
  );
}
