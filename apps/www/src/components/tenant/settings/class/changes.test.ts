import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Array as Arr, Option, Schema } from "effect";
import {
  archiveClassChange,
  assignTeacherChange,
  createClassChange,
  removeTeacherChange,
  renameClassChange,
  restoreClassChange,
  type SchoolClass,
} from "@/components/tenant/settings/class/changes";
import { isDraft, type Period } from "@/components/tenant/settings/state";
import { createLocalStore } from "@/test/optimistic";
import {
  cohort,
  later,
  otherSlug,
  pageOf,
  paging,
  period,
  person,
  slug,
} from "@/test/settings";

const term = period("ganjil", "2026-07-13", "active").id;
const other = period("genap", "2027-01-18", "planned").id;
const seventh = cohort("c-7a", "7A", 7);
const physics = Schema.decodeUnknownSync(Id("classes"))("k-fis");
const biology = Schema.decodeUnknownSync(Id("classes"))("k-bio");
const ani = person("p-ani", "Ani");
const budi = person("p-budi", "Budi");

/** One classroom of the period as the classrooms list shows it. */
function lesson(
  id: string,
  name: string,
  subject: string | undefined,
  periodId: Period["id"] = term
): SchoolClass {
  return {
    cohortId: seventh.id,
    id: Schema.decodeUnknownSync(Id("classes"))(id),
    name,
    periodId,
    slug: name.toLowerCase().replace(" ", "-"),
    status: "active",
    ...(subject === undefined ? {} : { subject }),
  };
}

/** The classrooms one loaded page of a period holds, or none while it is not loaded. */
function pageAt(
  local: ReturnType<typeof createLocalStore>,
  periodId: Period["id"],
  paginationOpts: typeof paging | typeof later = paging
) {
  return Option.match(
    local.store.getQuery(classroom.classes.list, {
      paginationOpts,
      periodId,
      slug,
    }),
    { onNone: () => [], onSome: (value) => value.page }
  );
}

describe("components/tenant/settings/class/changes", () => {
  it("lists a new classroom on the first page of its period, as active, by subject and then by name within a subject", () => {
    const local = createLocalStore();
    local.seed(tenancy.cohorts.list, { periodId: other, slug }, undefined);
    local.seed(tenancy.cohorts.list, { periodId: term, slug }, [seventh]);
    local.seed(
      classroom.classes.list,
      { paginationOpts: paging, periodId: term, slug },
      pageOf([
        lesson("k-bio", "Biologi 7A", "Biologi"),
        lesson("k-fis-b", "Fisika 7B", "Fisika"),
      ])
    );
    local.seed(
      classroom.classes.list,
      { paginationOpts: later, periodId: term, slug },
      pageOf([lesson("k-mat", "Matematika 7A", "Matematika")])
    );
    local.seed(
      classroom.classes.list,
      { paginationOpts: paging, periodId: other, slug },
      pageOf([lesson("k-ipa", "IPA 7A", "IPA", other)])
    );
    local.seed(
      classroom.classes.list,
      { paginationOpts: paging, periodId: other, slug: otherSlug },
      undefined
    );
    createClassChange(local.store, {
      cohortId: seventh.id,
      slug,
      subject: "Fisika",
    });
    expect(
      Arr.map(pageAt(local, term), (row) => [
        row.name,
        row.slug,
        row.subject,
        row.status,
        isDraft(row.id),
      ])
    ).toEqual([
      ["Biologi 7A", "biologi-7a", "Biologi", "active", false],
      ["Fisika 7A", "fisika-7a", "Fisika", "active", true],
      ["Fisika 7B", "fisika-7b", "Fisika", "active", false],
    ]);
    expect(Arr.map(pageAt(local, term, later), (row) => row.name)).toEqual([
      "Matematika 7A",
    ]);
    expect(Arr.map(pageAt(local, other), (row) => row.name)).toEqual([
      "IPA 7A",
    ]);
  });

  it("names a classroom without a subject for its cohort alone, first in its period", () => {
    const local = createLocalStore();
    local.seed(tenancy.cohorts.list, { periodId: term, slug }, [seventh]);
    local.seed(
      classroom.classes.list,
      { paginationOpts: paging, periodId: term, slug },
      pageOf([lesson("k-bio", "Biologi 7A", "Biologi")])
    );
    createClassChange(local.store, { cohortId: seventh.id, slug });
    expect(
      Arr.map(pageAt(local, term), (row) => [row.name, "subject" in row])
    ).toEqual([
      ["7A", false],
      ["Biologi 7A", true],
    ]);
  });

  it("waits for the server when no loaded list of cohorts holds the cohort", () => {
    const local = createLocalStore();
    local.seed(tenancy.cohorts.list, { periodId: term, slug }, [
      cohort("c-8a", "8A", 8),
    ]);
    local.seed(
      classroom.classes.list,
      { paginationOpts: paging, periodId: term, slug },
      pageOf([lesson("k-bio", "Biologi 7A", "Biologi")])
    );
    createClassChange(local.store, {
      cohortId: seventh.id,
      slug,
      subject: "Fisika",
    });
    expect(Arr.map(pageAt(local, term), (row) => row.name)).toEqual([
      "Biologi 7A",
    ]);
    expect(local.written()).toEqual([]);
  });

  it("renames, archives and restores one classroom on every loaded page, and keeps the others", () => {
    const local = createLocalStore();
    local.seed(
      classroom.classes.list,
      { paginationOpts: paging, periodId: term, slug },
      pageOf([
        lesson("k-bio", "Biologi 7A", "Biologi"),
        lesson("k-fis", "Fisika 7A", "Fisika"),
      ])
    );
    renameClassChange(local.store, {
      classId: physics,
      name: "Fisika Lanjut 7A",
      slug,
    });
    archiveClassChange(local.store, { classId: physics, slug });
    expect(
      Arr.map(pageAt(local, term), (row) => [row.name, row.status])
    ).toEqual([
      ["Biologi 7A", "active"],
      ["Fisika Lanjut 7A", "archived"],
    ]);
    restoreClassChange(local.store, { classId: physics, slug });
    expect(Arr.map(pageAt(local, term), (row) => row.status)).toEqual([
      "active",
      "active",
    ]);
  });

  it("lists an assigned teacher at the end of the classroom's first page, named as the loaded people name them, once", () => {
    const local = createLocalStore();
    local.seed(
      tenancy.people.list,
      { paginationOpts: paging, slug, status: "suspended" },
      undefined
    );
    local.seed(
      tenancy.people.list,
      { paginationOpts: paging, slug, status: "active" },
      pageOf([ani, budi])
    );
    local.seed(
      classroom.teachers.list,
      { classId: physics, paginationOpts: paging, slug },
      pageOf([{ id: ani.id, name: ani.name }])
    );
    local.seed(
      classroom.teachers.list,
      { classId: physics, paginationOpts: later, slug },
      pageOf([])
    );
    local.seed(
      classroom.teachers.list,
      { classId: biology, paginationOpts: paging, slug },
      pageOf([])
    );
    local.seed(
      classroom.teachers.list,
      { classId: physics, paginationOpts: paging, slug: otherSlug },
      undefined
    );
    assignTeacherChange(local.store, {
      classId: physics,
      personId: budi.id,
      slug,
    });
    assignTeacherChange(local.store, {
      classId: physics,
      personId: ani.id,
      slug,
    });
    const teachersOf = (
      classId: SchoolClass["id"],
      paginationOpts: typeof paging | typeof later = paging
    ) =>
      Option.match(
        local.store.getQuery(classroom.teachers.list, {
          classId,
          paginationOpts,
          slug,
        }),
        {
          onNone: () => [],
          onSome: (value) => Arr.map(value.page, (row) => row.name),
        }
      );
    expect(teachersOf(physics)).toEqual(["Ani", "Budi"]);
    expect(teachersOf(physics, later)).toEqual([]);
    expect(teachersOf(biology)).toEqual([]);
  });

  it("waits for the server when no loaded page of people names the teacher", () => {
    const local = createLocalStore();
    local.seed(
      classroom.teachers.list,
      { classId: physics, paginationOpts: paging, slug },
      pageOf([])
    );
    assignTeacherChange(local.store, {
      classId: physics,
      personId: budi.id,
      slug,
    });
    expect(local.written()).toEqual([]);
  });

  it("takes a removed teacher off every loaded page of the classroom, and leaves other classrooms", () => {
    const local = createLocalStore();
    const teacher = { id: ani.id, name: ani.name };
    local.seed(
      classroom.teachers.list,
      { classId: physics, paginationOpts: paging, slug },
      pageOf([teacher, { id: budi.id, name: budi.name }])
    );
    local.seed(
      classroom.teachers.list,
      { classId: biology, paginationOpts: paging, slug },
      pageOf([teacher])
    );
    removeTeacherChange(local.store, {
      classId: physics,
      personId: ani.id,
      slug,
    });
    const names = (classId: SchoolClass["id"]) =>
      Option.match(
        local.store.getQuery(classroom.teachers.list, {
          classId,
          paginationOpts: paging,
          slug,
        }),
        {
          onNone: () => [],
          onSome: (value) => Arr.map(value.page, (row) => row.name),
        }
      );
    expect(names(physics)).toEqual(["Budi"]);
    expect(names(biology)).toEqual(["Ani"]);
  });
});
