import { modelSlotValidator } from "@repo/backend/confect/contentRelease/models/slot";
import {
  appLocaleValidator,
  rendererDomainValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export const articleFields = {
  appLocale: appLocaleValidator,
  assetId: Schema.String,
  bucket: Schema.String,
  category: Schema.String,
  categoryTitle: Schema.String,
  contentKey: Schema.String,
  projectionHash: Schema.String,
  publicPath: Schema.String,
  releaseId: Schema.String,
  rendererDomain: rendererDomainValidator,
  sequence: Schema.Finite,
  slot: modelSlotValidator,
};
