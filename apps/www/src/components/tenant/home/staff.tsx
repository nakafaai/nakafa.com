import type { Ref } from "@confect/core";
import { QueryResult } from "@confect/react";
import type classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { HomeView } from "@repo/backend/confect/exams/home/contract";
import { Array as Arr } from "effect";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { ClassesSection } from "@/components/tenant/home/classes";
import { useHomeExams } from "@/components/tenant/home/query";
import { RoomsSection } from "@/components/tenant/home/rooms";
import { HomeColumn, HomeGrid } from "@/components/tenant/home/section";
import { UpdatesSection } from "@/components/tenant/home/updates";

/**
 * The home of a teacher, a principal, an admin or the owner. Until the rooms and the classes have answered nothing
 * shows under the header, and then both sections appear at once, so neither moves when the other arrives. The updates
 * come last in their column, so they arrive on their own without moving anything. A failed read of the rooms or the
 * classes shows the home's own sentence and Try again.
 */
export function StaffHome() {
  const exams = useHomeExams();
  const classes = useMyClasses();

  if (QueryResult.isFailure(exams)) {
    throw exams.error;
  }
  if (QueryResult.isFailure(classes)) {
    throw classes.error;
  }
  if (!(QueryResult.isSuccess(exams) && QueryResult.isSuccess(classes))) {
    return null;
  }
  return <StaffColumns classes={classes.value} rooms={exams.value} />;
}

/**
 * The staff home's columns: the rooms the viewer may watch that run now or open within the next day, and the classes
 * they teach, in the wider column, and the school's updates beside them. A section with nothing to show is not drawn,
 * and a viewer with neither rooms nor classes gets the updates across the whole width.
 */
function StaffColumns({
  classes,
  rooms,
}: {
  classes: Ref.Returns<typeof classroom.classes.mine>;
  rooms: typeof HomeView.Type;
}) {
  const hasRooms =
    Arr.isReadonlyArrayNonEmpty(rooms.live) ||
    Arr.isReadonlyArrayNonEmpty(rooms.next);
  const hasClasses = Arr.isReadonlyArrayNonEmpty(classes);
  const wide = hasRooms || hasClasses;

  return (
    <HomeGrid>
      {wide ? (
        <HomeColumn span="main">
          {hasRooms ? (
            <RoomsSection live={rooms.live} next={rooms.next} />
          ) : null}
          {hasClasses ? <ClassesSection classes={classes} /> : null}
        </HomeColumn>
      ) : null}
      <HomeColumn span={wide ? "side" : "whole"}>
        <UpdatesSection />
      </HomeColumn>
    </HomeGrid>
  );
}
