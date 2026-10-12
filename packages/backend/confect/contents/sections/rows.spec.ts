import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import {
  finishInputValidator,
  finishResultValidator,
  knownInputValidator,
  lessonsInputValidator,
  lessonsResultValidator,
  pageInputValidator,
  pageResultValidator,
  pruneInputValidator,
  pruneResultValidator,
  storeInputValidator,
  storeResultValidator,
  surahInputValidator,
  surahResultValidator,
} from "@repo/backend/confect/contents/sections/schema";
import { Schema } from "effect";

/**
 * What a section build reads from the active release and writes to the index.
 * The reads return the source of the documents whose sections the index lacks
 * or holds at another version; the writes keep the index equal to the active
 * release, one document at a time, or a bounded number of whole documents in
 * the clean up, and the last one records that the index is complete. One more
 * read gives back the stored sections of a language for the model test.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "lessons",
      args: () => lessonsInputValidator.fields,
      returns: () => lessonsResultValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "surah",
      args: () => surahInputValidator.fields,
      returns: () => surahResultValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "stored",
      args: () => knownInputValidator.fields,
      returns: () => Schema.mutable(Schema.Array(Schema.Boolean)),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "save",
      args: () => storeInputValidator.fields,
      returns: () => storeResultValidator,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "prune",
      args: () => pruneInputValidator.fields,
      returns: () => pruneResultValidator,
      error: () => ReleaseError,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "finish",
      args: () => finishInputValidator.fields,
      returns: () => finishResultValidator,
    })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "page",
      args: () => pageInputValidator.fields,
      returns: () => pageResultValidator,
    })
  );
