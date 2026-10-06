import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx as QueryCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  checkClassAccess,
  loadActiveClass,
  loadClass,
  requireClassAccess,
} from "@repo/backend/confect/classes/access";
import { ClassAccessError } from "@repo/backend/confect/classes/access/spec";
import {
  MAX_CLASS_MEMBER_SEARCH_RESULTS,
  SCHOOL_CLASS_INVITE_CODE_ROLES,
} from "@repo/backend/confect/classes/constants";
import spec, {
  ClassQueryError,
} from "@repo/backend/confect/classes/queries.spec";
import type { ClassRouteResult } from "@repo/backend/confect/classes/validators";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  getSchoolMembership,
  isAdmin,
} from "@repo/backend/confect/schools/membership";
import { getUserMap } from "@repo/backend/confect/users/directory";
import { Array as Arr, Effect, Layer, Order } from "effect";

const getClasses = FunctionImpl.make(
  databaseSchema,
  spec,
  "getClasses",
  Effect.fn("classes.queries.getClasses")(function* (args) {
    const database = yield* DatabaseReader;
    const user = yield* requireAuth();
    const {
      schoolId,
      q: searchQuery,
      isArchived,
      visibility,
      paginationOpts,
    } = args;
    const schoolMembership = yield* getSchoolMembership(
      schoolId,
      user.appUser._id
    );
    if (!schoolMembership) {
      return yield* new ClassAccessError({
        code: "ACCESS_DENIED",
        message: "You must be a member of this school to list its classes.",
      });
    }
    if (searchQuery && searchQuery.trim().length > 0) {
      return yield* database
        .table("schoolClasses")
        .search("search_name", (q) => {
          let builder = q.search("name", searchQuery).eq("schoolId", schoolId);
          if (isArchived !== undefined) {
            builder = builder.eq("isArchived", isArchived);
          }
          if (visibility !== undefined) {
            builder = builder.eq("visibility", visibility);
          }
          return builder;
        })
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    if (visibility !== undefined && isArchived !== undefined) {
      return yield* database
        .table("schoolClasses")
        .index(
          "by_schoolId_and_visibility_and_isArchived",
          (q) =>
            q
              .eq("schoolId", schoolId)
              .eq("visibility", visibility)
              .eq("isArchived", isArchived),
          "desc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    if (visibility !== undefined) {
      return yield* database
        .table("schoolClasses")
        .index(
          "by_schoolId_and_visibility_and_isArchived",
          (q) => q.eq("schoolId", schoolId).eq("visibility", visibility),
          "desc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    if (isArchived !== undefined) {
      return yield* database
        .table("schoolClasses")
        .index(
          "by_schoolId_and_isArchived_and_visibility",
          (q) => q.eq("schoolId", schoolId).eq("isArchived", isArchived),
          "desc"
        )
        .paginate(paginationOpts)
        .pipe(Effect.orDie);
    }
    return yield* database
      .table("schoolClasses")
      .index(
        "by_schoolId_and_isArchived_and_visibility",
        (q) => q.eq("schoolId", schoolId),
        "desc"
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
  })
);
const getClassRoute = FunctionImpl.make(
  databaseSchema,
  spec,
  "getClassRoute",
  Effect.fn("classes.queries.getClassRoute")(function* (args) {
    const ctx = yield* QueryCtxService;
    const user = yield* requireAuth();
    const classId = ctx.db.normalizeId("schoolClasses", args.classId);
    if (!classId) {
      return yield* new ClassAccessError({
        code: "CLASS_NOT_FOUND",
        message: `Class not found for classId: ${args.classId}`,
      });
    }
    const classData = yield* loadActiveClass(classId);
    const { classMembership, schoolMembership } = yield* checkClassAccess(
      classId,
      classData.schoolId,
      user.appUser._id
    );
    if (!schoolMembership) {
      return yield* new ClassAccessError({
        code: "ACCESS_DENIED",
        message: "You must be a member of this school to access this class.",
      });
    }
    if (classMembership || isAdmin(schoolMembership)) {
      const accessibleRoute = {
        kind: "accessible",
        class: classData,
        classMembership,
        schoolMembership,
      } satisfies ClassRouteResult;
      return accessibleRoute;
    }
    const joinRequiredRoute = {
      kind: "joinRequired",
      class: {
        _id: classData._id,
        image: classData.image,
        name: classData.name,
        subject: classData.subject,
        visibility: classData.visibility,
        year: classData.year,
      },
      schoolMembership,
    } satisfies ClassRouteResult;
    return joinRequiredRoute;
  })
);
const getPeople = FunctionImpl.make(
  databaseSchema,
  spec,
  "getPeople",
  Effect.fn("classes.queries.getPeople")(function* (args) {
    const database = yield* DatabaseReader;
    const { classId, q, paginationOpts } = args;
    const user = yield* requireAuth();
    const classData = yield* loadClass(classId);
    yield* requireClassAccess(classId, classData.schoolId, user.appUser._id);
    const normalizedQuery = q?.trim().toLowerCase();
    if (normalizedQuery) {
      const expectedMemberCount =
        classData.studentCount + classData.teacherCount;
      const boundedMemberCount = Math.min(
        expectedMemberCount,
        MAX_CLASS_MEMBER_SEARCH_RESULTS
      );
      const members = yield* database
        .table("schoolClassMembers")
        .index("by_classId_and_userId", (idx) => idx.eq("classId", classId))
        .take(boundedMemberCount + 1)
        .pipe(Effect.orDie);
      if (expectedMemberCount > MAX_CLASS_MEMBER_SEARCH_RESULTS) {
        return yield* new ClassQueryError({
          code: "CLASS_MEMBER_SEARCH_LIMIT_EXCEEDED",
          message: "Class member search exceeds the supported search limit.",
        });
      }
      if (members.length > expectedMemberCount) {
        return yield* new ClassQueryError({
          code: "CLASS_MEMBER_COUNT_EXCEEDED",
          message: "Class member count exceeds the class member totals.",
        });
      }
      const userMap = yield* getUserMap(
        Arr.map(members, (member) => member.userId)
      );
      const matched = Arr.flatMap(members, (member) => {
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
        return [
          {
            ...member,
            user: userData,
          },
        ];
      });
      const people = Arr.sortWith(
        matched,
        (person) => person.role === "teacher",
        Order.flip(Order.Boolean)
      );
      const cursor = paginationOpts.cursor;
      const startIndex = cursor ? Number(cursor) : 0;
      if (!Number.isInteger(startIndex) || startIndex < 0) {
        return yield* new ClassQueryError({
          code: "INVALID_PAGINATION_CURSOR",
          message: "Invalid class people search cursor.",
        });
      }
      const endIndex = Math.min(
        startIndex + paginationOpts.numItems,
        people.length
      );
      return {
        continueCursor: `${endIndex}`,
        isDone: endIndex >= people.length,
        page: people.slice(startIndex, endIndex),
      };
    }
    const membersPage = yield* database
      .table("schoolClassMembers")
      .index("by_classId_and_userId", (idx) => idx.eq("classId", classId))
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const userMap = yield* getUserMap(
      Arr.map(membersPage.page, (m) => m.userId)
    );
    const loaded = Arr.flatMap(membersPage.page, (member) => {
      const userData = userMap.get(member.userId);
      if (!userData) {
        return [];
      }
      return [
        {
          ...member,
          user: userData,
        },
      ];
    });
    return {
      ...membersPage,
      page: Arr.sortWith(
        loaded,
        (person) => person.role === "teacher",
        Order.flip(Order.Boolean)
      ),
    };
  })
);
const getInviteCodes = FunctionImpl.make(
  databaseSchema,
  spec,
  "getInviteCodes",
  Effect.fn("classes.queries.getInviteCodes")(function* (args) {
    const database = yield* DatabaseReader;
    const user = yield* requireAuth();
    const classData = yield* loadClass(args.classId);
    const { classMembership, schoolMembership } = yield* requireClassAccess(
      args.classId,
      classData.schoolId,
      user.appUser._id
    );
    if (isAdmin(schoolMembership) || classMembership?.role === "teacher") {
      const inviteCodes = yield* database
        .table("schoolClassInviteCodes")
        .index("by_classId_and_role", (idx) => idx.eq("classId", args.classId))
        .take(SCHOOL_CLASS_INVITE_CODE_ROLES.length + 1)
        .pipe(Effect.orDie);
      if (inviteCodes.length > SCHOOL_CLASS_INVITE_CODE_ROLES.length) {
        return yield* new ClassQueryError({
          code: "CLASS_INVITE_CODE_LIMIT_EXCEEDED",
          message: "Class invite code count exceeds the supported role count.",
        });
      }
      return inviteCodes;
    }
    return yield* new ClassAccessError({
      code: "ACCESS_DENIED",
      message: "Only teachers or school admins can view class invite codes.",
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getClasses),
  Layer.provide(getClassRoute),
  Layer.provide(getPeople),
  Layer.provide(getInviteCodes),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
