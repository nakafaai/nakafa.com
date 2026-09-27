import { FunctionImpl, GroupImpl, QueryStream } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  loadClass,
  requireClassAccess,
} from "@repo/backend/confect/classes/access";
import spec from "@repo/backend/confect/classes/roster.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer, Struct } from "effect";

const MAXIMUM_ROWS_READ = 400;

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("classes.roster.list")(function* ({ classId, q, paginationOpts }) {
    const viewer = yield* requireAuth();
    const classData = yield* loadClass(classId);
    yield* requireClassAccess(classId, classData.schoolId, viewer.appUser._id);
    const reader = yield* DatabaseReader;
    const query = q?.trim().toLowerCase();
    const users = reader.table("users");
    const innerKeyLayout = users.stream("by_id", "desc").keyLayout;

    // Both sides of the join count toward the page's physical read budget.
    return yield* reader
      .table("schoolClassMembers")
      .stream(
        "by_classId_and_role_and_userId",
        (index) => index.eq("classId", classId),
        "desc"
      )
      .pipe(
        QueryStream.flatMap(
          (member) =>
            users
              .stream(
                "by_id",
                (index) =>
                  index.gte("_id", member.userId).lte("_id", member.userId),
                "desc"
              )
              .pipe(
                QueryStream.filter(
                  (user) =>
                    !query ||
                    user.name.toLowerCase().includes(query) ||
                    user.email.toLowerCase().includes(query)
                ),
                QueryStream.map((user) => ({
                  ...member,
                  user: Struct.pick(user, ["_id", "name", "email", "image"]),
                }))
              ),
          { innerKeyLayout }
        ),
        QueryStream.paginate({
          ...paginationOpts,
          maximumRowsRead: Math.min(
            paginationOpts.maximumRowsRead ?? MAXIMUM_ROWS_READ,
            MAXIMUM_ROWS_READ
          ),
        }),
        Effect.orDie
      );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
