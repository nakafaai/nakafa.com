import { TryoutExamSourceSchema } from "@repo/contents/_types/tryout/schema";
import { snbtTryoutSource } from "@repo/contents/tryout/indonesia/snbt/source";
import { tkaTryoutSource } from "@repo/contents/tryout/indonesia/tka/source";
import { Schema } from "effect";

const tryoutSourceInput = [snbtTryoutSource, tkaTryoutSource];

/**
 * Source-controlled try-out exam registry.
 *
 * This is the public program source of truth. Question bodies live in the
 * neutral question bank and are attached through section placements here.
 */
export const TRYOUT_SOURCES = Schema.decodeUnknownSync(
  Schema.Array(TryoutExamSourceSchema)
)(tryoutSourceInput);
