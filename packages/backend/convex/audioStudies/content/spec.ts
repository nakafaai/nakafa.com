import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import { audioContentTypeValidator } from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { type Infer, v } from "convex/values";

export const audioContentIdentityFields = {
  ...learningGraphIdentityValidator.fields,
  content_id: graphContentIdValidator,
  contentType: audioContentTypeValidator,
  locale: localeValidator,
  route: v.string(),
};

export const audioContentIdentityValidator = v.object(
  audioContentIdentityFields
);

export type AudioContentIdentity = Infer<typeof audioContentIdentityValidator>;
