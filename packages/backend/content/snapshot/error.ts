import { Schema } from "effect";
export class ContentSnapshotError extends Schema.TaggedError<ContentSnapshotError>()(
  "ContentSnapshotError",
  {
    message: Schema.String,
  }
) {}

export const contentSnapshotError = (message: string) =>
  new ContentSnapshotError({ message });
