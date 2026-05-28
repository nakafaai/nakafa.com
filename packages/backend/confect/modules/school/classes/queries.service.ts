import { GenericId } from "@confect/core";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import {
  checkClassAccess,
  getSchoolMembership,
  getUserMap,
  isAdmin,
  loadActiveClass,
  loadClass,
  requireClassAccess,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { ClassActionError } from "@repo/backend/confect/modules/school/classErrors";
import { SCHOOL_CLASS_INVITE_CODE_ROLES } from "@repo/backend/confect/modules/school/classes/inviteCodes.service";
import type { SchoolClassVisibility } from "@repo/backend/confect/modules/school/classes.tables";
import type { PaginationOptions } from "convex/server";
import { Effect, Option, Schema } from "effect";

const MAX_CLASS_MEMBER_SEARCH_RESULTS = 500;
const decodeSchoolClassId = Schema.decodeUnknownOption(
  GenericId.GenericId("schoolClasses")
);

/** Sorts teachers before students for class people responses. */
function sortPeopleByRole(
  left: Doc<"schoolClassMembers">,
  right: Doc<"schoolClassMembers">
) {
  if (left.role === "teacher" && right.role === "student") {
    return -1;
  }

  if (left.role === "student" && right.role === "teacher") {
    return 1;
  }

  return 0;
}

/** Lists school classes using the most specific available index. */
export const getClasses = Effect.fn("school.classes.getClasses")(
  function* (args: {
    isArchived?: boolean;
    paginationOpts: PaginationOptions;
    q?: string;
    schoolId: Id<"schools">;
    visibility?: SchoolClassVisibility;
  }) {
    const reader = yield* DatabaseReader;
    const user = yield* requireAppUser();
    const schoolMembership = yield* getSchoolMembership(
      args.schoolId,
      user.appUser._id
    );

    if (!schoolMembership) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "You must be a member of this school to list its classes.",
        })
      );
    }

    const searchQuery = args.q?.trim();
    if (searchQuery) {
      return yield* reader
        .table("schoolClasses")
        .search("search_name", (query) => {
          let builder = query
            .search("name", searchQuery)
            .eq("schoolId", args.schoolId);
          const isArchived = args.isArchived;
          const visibility = args.visibility;

          if (isArchived !== undefined) {
            builder = builder.eq("isArchived", isArchived);
          }

          if (visibility !== undefined) {
            builder = builder.eq("visibility", visibility);
          }

          return builder;
        })
        .paginate(args.paginationOpts);
    }

    if (args.visibility !== undefined && args.isArchived !== undefined) {
      const visibility = args.visibility;
      const isArchived = args.isArchived;

      return yield* reader
        .table("schoolClasses")
        .index(
          "by_schoolId_and_visibility_and_isArchived",
          (query) =>
            query
              .eq("schoolId", args.schoolId)
              .eq("visibility", visibility)
              .eq("isArchived", isArchived),
          "desc"
        )
        .paginate(args.paginationOpts);
    }

    if (args.visibility !== undefined) {
      const visibility = args.visibility;

      return yield* reader
        .table("schoolClasses")
        .index(
          "by_schoolId_and_visibility_and_isArchived",
          (query) =>
            query.eq("schoolId", args.schoolId).eq("visibility", visibility),
          "desc"
        )
        .paginate(args.paginationOpts);
    }

    if (args.isArchived !== undefined) {
      const isArchived = args.isArchived;

      return yield* reader
        .table("schoolClasses")
        .index(
          "by_schoolId_and_isArchived_and_visibility",
          (query) =>
            query.eq("schoolId", args.schoolId).eq("isArchived", isArchived),
          "desc"
        )
        .paginate(args.paginationOpts);
    }

    return yield* reader
      .table("schoolClasses")
      .index(
        "by_schoolId_and_isArchived_and_visibility",
        (query) => query.eq("schoolId", args.schoolId),
        "desc"
      )
      .paginate(args.paginationOpts);
  }
);

/** Resolves whether the current user can enter or must join a class route. */
export const getClassRoute = Effect.fn("school.classes.getClassRoute")(
  function* (args: { classId: string }) {
    const user = yield* requireAppUser();
    const classId = Option.getOrNull(decodeSchoolClassId(args.classId));

    if (!classId) {
      return yield* Effect.fail(
        new ClassActionError({
          code: "CLASS_NOT_FOUND",
          message: `Class not found for classId: ${args.classId}`,
        })
      );
    }

    const classData = yield* loadActiveClass(classId);
    const access = yield* checkClassAccess(
      classId,
      classData.schoolId,
      user.appUser._id
    );

    if (!access.schoolMembership) {
      return yield* Effect.fail(
        new ClassActionError({
          code: "ACCESS_DENIED",
          message: "You must be a member of this school to access this class.",
        })
      );
    }

    if (access.classMembership || isAdmin(access.schoolMembership)) {
      return {
        class: classData,
        classMembership: access.classMembership,
        kind: "accessible" as const,
        schoolMembership: access.schoolMembership,
      };
    }

    return {
      class: {
        _id: classData._id,
        image: classData.image,
        name: classData.name,
        subject: classData.subject,
        visibility: classData.visibility,
        year: classData.year,
      },
      kind: "joinRequired" as const,
      schoolMembership: access.schoolMembership,
    };
  }
);

/** Lists class members with joined public user details. */
export const getPeople = Effect.fn("school.classes.getPeople")(
  function* (args: {
    classId: Id<"schoolClasses">;
    paginationOpts: PaginationOptions;
    q?: string;
  }) {
    const reader = yield* DatabaseReader;
    const user = yield* requireAppUser();
    const classData = yield* loadClass(args.classId);
    yield* requireClassAccess(
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

    const normalizedQuery = args.q?.trim().toLowerCase();
    if (normalizedQuery) {
      const expectedMemberCount =
        classData.studentCount + classData.teacherCount;
      const boundedMemberCount = Math.min(
        expectedMemberCount,
        MAX_CLASS_MEMBER_SEARCH_RESULTS
      );
      const members = yield* reader
        .table("schoolClassMembers")
        .index("by_classId_and_userId", (index) =>
          index.eq("classId", args.classId)
        )
        .take(boundedMemberCount + 1);

      if (expectedMemberCount > MAX_CLASS_MEMBER_SEARCH_RESULTS) {
        return yield* Effect.fail(
          new ClassActionError({
            message: "Class member search exceeds the supported search limit.",
          })
        );
      }

      if (members.length > expectedMemberCount) {
        return yield* Effect.fail(
          new ClassActionError({
            message: "Class member count exceeds the class member totals.",
          })
        );
      }

      const userMap = yield* getUserMap(members.map((member) => member.userId));
      const people = members.flatMap((member) => {
        const userData = userMap.get(member.userId);

        if (!userData) {
          return [];
        }

        const matchesQuery =
          userData.name.toLowerCase().includes(normalizedQuery) ||
          userData.email.toLowerCase().includes(normalizedQuery);

        if (!matchesQuery) {
          return [];
        }

        return [{ ...member, user: userData }];
      });
      people.sort(sortPeopleByRole);

      const cursor = args.paginationOpts.cursor;
      const startIndex = cursor ? Number(cursor) : 0;

      if (!Number.isInteger(startIndex) || startIndex < 0) {
        return yield* Effect.fail(
          new ClassActionError({
            message: "Invalid class people search cursor.",
          })
        );
      }

      const endIndex = Math.min(
        startIndex + args.paginationOpts.numItems,
        people.length
      );

      return {
        continueCursor: `${endIndex}`,
        isDone: endIndex >= people.length,
        page: people.slice(startIndex, endIndex),
      };
    }

    const membersPage = yield* reader
      .table("schoolClassMembers")
      .index("by_classId_and_userId", (index) =>
        index.eq("classId", args.classId)
      )
      .paginate(args.paginationOpts);
    const userMap = yield* getUserMap(
      membersPage.page.map((member) => member.userId)
    );
    const people = membersPage.page.flatMap((member) => {
      const userData = userMap.get(member.userId);

      if (!userData) {
        return [];
      }

      return [{ ...member, user: userData }];
    });
    people.sort(sortPeopleByRole);

    return { ...membersPage, page: people };
  }
);

/** Lists class invite codes for teachers and school admins. */
export const getInviteCodes = Effect.fn("school.classes.getInviteCodes")(
  function* (args: { classId: Id<"schoolClasses"> }) {
    const user = yield* requireAppUser();
    const classData = yield* loadClass(args.classId);
    const access = yield* requireClassAccess(
      args.classId,
      classData.schoolId,
      user.appUser._id
    );

    if (
      !isAdmin(access.schoolMembership) &&
      access.classMembership?.role !== "teacher"
    ) {
      return yield* Effect.fail(
        new ClassActionError({
          message:
            "Only teachers or school admins can view class invite codes.",
        })
      );
    }

    const reader = yield* DatabaseReader;
    const inviteCodes = yield* reader
      .table("schoolClassInviteCodes")
      .index("by_classId_and_role", (index) =>
        index.eq("classId", args.classId)
      )
      .take(SCHOOL_CLASS_INVITE_CODE_ROLES.length + 1);

    if (inviteCodes.length > SCHOOL_CLASS_INVITE_CODE_ROLES.length) {
      return yield* Effect.fail(
        new ClassActionError({
          message: "Class invite code count exceeds the supported role count.",
        })
      );
    }

    return inviteCodes;
  }
);
