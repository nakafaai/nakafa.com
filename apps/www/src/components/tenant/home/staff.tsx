import { QueryResult } from "@confect/react";
import { Array as Arr, Option } from "effect";
import { useInbox } from "@/components/notifications/inbox";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { ClassesSection } from "@/components/tenant/home/classes";
import { useHomeExams, useHomeSetup } from "@/components/tenant/home/query";
import { RoomsSection } from "@/components/tenant/home/rooms";
import { HomeColumn, HomeGrid } from "@/components/tenant/home/section";
import { SetupSection, useSetupShown } from "@/components/tenant/home/setup";
import { UpdatesSection } from "@/components/tenant/home/updates";

/**
 * The home of a teacher, a principal, an admin or the owner: the rooms they may watch that run now or open within the
 * next day, and the classes they teach, in the wider column; the school's setup while it is not done, for the owner and
 * the admin, and the school's updates beside them. A section with nothing to show is not drawn, and a viewer with
 * neither rooms nor classes gets the setup and the updates across the whole width. Until every read the home needs has
 * answered nothing shows under the header, and then every section appears at once, so none moves when another arrives.
 */
export function StaffHome() {
  const tenant = useTenant();
  const exams = useHomeExams();
  const classes = useMyClasses();
  const setup = useHomeSetup();
  const viewer = useViewerQuery();
  const setupShown = useSetupShown();
  const updates = useInbox(Option.none(), tenant.slug);

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  if (QueryResult.isFailure(classes)) {
    throw classes.error;
  }
  // A failed read counts as an answer, because its section shows its own failure. The owner's and the admin's setup
  // also waits for the viewer's units, which decide its first step.
  const setupAnswered =
    QueryResult.isSuccess(setup) || QueryResult.isFailure(setup);
  const viewerAnswered =
    QueryResult.isSuccess(viewer) || QueryResult.isFailure(viewer);
  if (
    !(
      QueryResult.isSuccess(exams) &&
      QueryResult.isSuccess(classes) &&
      updates.ready &&
      (!tenant.canManage || (setupAnswered && viewerAnswered))
    )
  ) {
    return null;
  }
  const { live, next } = exams.value;
  const hasRooms =
    Arr.isReadonlyArrayNonEmpty(live) || Arr.isReadonlyArrayNonEmpty(next);
  const hasClasses = Arr.isReadonlyArrayNonEmpty(classes.value);

  return (
    <HomeGrid>
      {hasRooms || hasClasses ? (
        <HomeColumn span="main">
          {hasRooms ? <RoomsSection live={live} next={next} /> : null}
          {hasClasses ? <ClassesSection classes={classes.value} /> : null}
        </HomeColumn>
      ) : null}
      <HomeColumn span={hasRooms || hasClasses ? "side" : "whole"}>
        {setupShown ? <SetupSection /> : null}
        <UpdatesSection />
      </HomeColumn>
    </HomeGrid>
  );
}
