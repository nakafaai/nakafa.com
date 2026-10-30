import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/connectors/drive.spec";
import { readPickerKeys } from "@repo/backend/confect/connectors/google/client";
import { ownDriveAccess } from "@repo/backend/confect/connectors/google/grant";
import { connectionToken } from "@repo/backend/confect/connectors/secret";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The most active connections of an account read to find its Drive. */
const CONNECTION_READ = 10;

/** A fresh Picker token of the signed-in account's Drive connection with the Picker's keys, or none without a connection. */
const pickerToken = FunctionImpl.make(
  databaseSchema,
  spec,
  "pickerToken",
  Effect.fn("connectors.drive.pickerToken")(function* () {
    const { appUser } = yield* requireAuth();
    const keys = yield* readPickerKeys();
    const access = yield* ownDriveAccess(appUser._id);
    return Option.match(access, {
      onNone: () => null,
      onSome: (accessToken) => ({ ...keys, accessToken }),
    });
  })
);

/** The account's active Drive connection and its refresh token, opened with the account's key. */
const ownTarget = FunctionImpl.make(
  databaseSchema,
  spec,
  "ownTarget",
  Effect.fn("connectors.drive.ownTarget")(function* ({ userId }) {
    const connections = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .index("by_userId_and_status", (query) =>
        query.eq("owner.userId", userId).eq("status", "active")
      )
      .take(CONNECTION_READ)
      .pipe(Effect.orDie);
    const drive = Arr.findFirst(
      connections,
      (row) => row.connector === "drive"
    );
    if (Option.isNone(drive)) {
      return null;
    }
    const refreshToken = yield* connectionToken(drive.value);
    if (Option.isNone(refreshToken)) {
      return null;
    }
    return {
      connectionId: drive.value._id,
      refreshToken: refreshToken.value,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(pickerToken),
  Layer.provide(ownTarget),
  Layer.provide(session),
  GroupImpl.finalize
);
