import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { toContentViewIoError } from "@repo/backend/confect/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/confect/contents/views/target";
import { Effect, flow, Option, Schema } from "effect";

const ContentViewerSchema = Schema.Union([
  Schema.Struct({
    deviceId: Schema.optionalKey(Schema.String),
    kind: Schema.Literal("account"),
    userId: IdSchema("users"),
  }),
  Schema.Struct({
    deviceId: Schema.String,
    kind: Schema.Literal("device"),
  }),
]);

/**
 * The one identity a content view is attributed to.
 *
 * A browser sends its device identifier only after analytics consent, so an
 * account view may arrive without one, and a signed-out view without one has
 * no identity to count.
 */
export type ContentViewer = typeof ContentViewerSchema.Type;

/** Attributes one view to the signed-in account, or else to a consented device. */
export function resolveContentViewer(input: {
  readonly deviceId?: string;
  readonly userId?: Docs["users"]["_id"];
}): Option.Option<ContentViewer> {
  if (input.userId) {
    return Option.some({
      ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
      kind: "account",
      userId: input.userId,
    });
  }
  if (input.deviceId === undefined) {
    return Option.none();
  }
  return Option.some({ deviceId: input.deviceId, kind: "device" });
}

/** Loads the latest view row recorded for a device/content/context tuple. */
const loadLatestDeviceView = Effect.fn("contents.views.loadLatestDeviceView")(
  function* (
    contentId: ContentViewTarget["content_id"],
    contextKey: string,
    deviceId: string
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningViews")
      .index(
        "by_deviceId_and_content_id_and_contextKey_and_lastViewedAt",
        (q) =>
          q
            .eq("deviceId", deviceId)
            .eq("content_id", contentId)
            .eq("contextKey", contextKey),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/**
 * Loads the view row owned by an account on one device.
 *
 * An undefined device selects the account's row recorded without consent.
 */
const loadAccountView = Effect.fn("contents.views.loadAccountView")(
  function* (
    contentId: ContentViewTarget["content_id"],
    contextKey: string,
    input: {
      readonly deviceId: string | undefined;
      readonly userId: Docs["users"]["_id"];
    }
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningViews")
      .index("by_userId_and_deviceId_and_content_id_and_contextKey", (q) =>
        q
          .eq("userId", input.userId)
          .eq("deviceId", input.deviceId)
          .eq("content_id", contentId)
          .eq("contextKey", contextKey)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/**
 * Loads the only existing view row this viewer may mutate.
 *
 * An account touches its exact row for the device, or claims the anonymous
 * row of its consented device. It never mutates a row owned by another
 * account or a row from another device.
 */
export const loadViewerView = Effect.fn("contents.views.loadViewerView")(
  function* (
    contentId: ContentViewTarget["content_id"],
    contextKey: string,
    viewer: ContentViewer
  ) {
    if (viewer.kind === "device") {
      return yield* loadLatestDeviceView(
        contentId,
        contextKey,
        viewer.deviceId
      );
    }
    const accountView = yield* loadAccountView(contentId, contextKey, {
      deviceId: viewer.deviceId,
      userId: viewer.userId,
    });
    if (accountView || viewer.deviceId === undefined) {
      return accountView;
    }
    const deviceView = yield* loadLatestDeviceView(
      contentId,
      contextKey,
      viewer.deviceId
    );
    if (deviceView?.userId) {
      return null;
    }
    return deviceView;
  }
);
