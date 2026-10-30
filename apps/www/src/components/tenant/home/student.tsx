import { QueryResult } from "@confect/react";
import { Array as Arr } from "effect";
import { useEffect } from "react";
import { forgetSubmittedKept } from "@/components/exams/sitting/forget";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant } from "@/components/tenant/context";
import { ClassesSection } from "@/components/tenant/home/classes";
import { ExamsSection } from "@/components/tenant/home/exams";
import {
  studentSittingsRead,
  useStudentSittings,
} from "@/components/tenant/home/query";
import { HomeColumn, HomeGrid } from "@/components/tenant/home/section";
import { UpdatesSection } from "@/components/tenant/home/updates";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { orderSittings } from "@/components/tenant/sittings";

/**
 * The home of a student: the student's exams, open now, still to open, and done with their results, and the student's
 * classes in the wider column, and the school's updates beside them. A student with no exam sees the classes first,
 * and a student in no class reads one sentence there. While the reads load nothing shows below the header, and a
 * failed read shows its own sentence and Try again.
 */
export function StudentHome() {
  const tenant = useTenant();

  return (
    <ReadBoundary read={studentSittingsRead(tenant.slug)}>
      <StudentSections />
    </ReadBoundary>
  );
}

/**
 * The student's sections, drawn at once from the sittings and the classes once both answer. The updates come last in
 * their column, so they arrive on their own without moving anything.
 */
function StudentSections() {
  const listed = useStudentSittings();
  const classes = useMyClasses();

  useEffect(() => {
    if (QueryResult.isSuccess(listed)) {
      forgetSubmittedKept(listed.value);
    }
  }, [listed]);

  if (QueryResult.isFailure(listed)) {
    throw listed.error;
  }
  if (QueryResult.isFailure(classes)) {
    throw classes.error;
  }
  if (!(QueryResult.isSuccess(listed) && QueryResult.isSuccess(classes))) {
    return null;
  }
  const sittings = orderSittings(listed.value);
  const upcoming = Arr.filter(
    sittings,
    (sitting) => sitting.state !== "closed"
  );
  // The closed sittings come oldest first in the order of the list, so the results read newest first.
  const finished = Arr.reverse(
    Arr.filter(sittings, (sitting) => sitting.state === "closed")
  );

  return (
    <HomeGrid>
      <HomeColumn span="main">
        {Arr.isReadonlyArrayNonEmpty(sittings) ? (
          <ExamsSection finished={finished} upcoming={upcoming} />
        ) : null}
        <ClassesSection classes={classes.value} />
      </HomeColumn>
      <HomeColumn span="side">
        <UpdatesSection />
      </HomeColumn>
    </HomeGrid>
  );
}
