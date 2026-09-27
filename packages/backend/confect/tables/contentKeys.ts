import { Table } from "@confect/core";
import {
  artifactLocaleValidator,
  contentFamilyValidator,
} from "@repo/backend/confect/contentRelease/spec";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    artifactLocale: artifactLocaleValidator,
    contentKey: Schema.String,
    createdSequence: Schema.Finite,
    family: contentFamilyValidator,
  })
)
  .index("by_contentKey_and_artifactLocale", ["contentKey", "artifactLocale"])
  .index("by_createdSequence_and_contentKey_and_artifactLocale", [
    "createdSequence",
    "contentKey",
    "artifactLocale",
  ])
  .index("by_family_and_contentKey_and_artifactLocale", [
    "family",
    "contentKey",
    "artifactLocale",
  ])
  .index("by_family_and_artifactLocale_and_createdSequence_and_contentKey", [
    "family",
    "artifactLocale",
    "createdSequence",
    "contentKey",
  ]);
