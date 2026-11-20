import { Table } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { Across, Chunk, Region } from "@repo/backend/confect/island/chunk";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    /** What the learner changed in the chunk: its points and its things (ADR 0050, W3). */
    ...Chunk.fields,
    /** The chunk's place, in chunks of 32 by 32 lattice points from the origin. */
    cx: Across,
    cz: Across,
    /** The region the chunk lies in, 8 by 8 chunks: its place divided by 8, rounded down. */
    rx: Region,
    rz: Region,
    /** The world's owner. */
    userId: IdSchema("users"),
  })
)
  /** A region is read whole as the learner or a visitor nears it. */
  .index("by_userId_and_rx_and_rz", ["userId", "rx", "rz"])
  /** A change reads the one chunk it touches. */
  .index("by_userId_and_cx_and_cz", ["userId", "cx", "cz"]);
