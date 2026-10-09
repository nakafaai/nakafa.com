import { Array as Arr, Effect, Option, Schema } from "effect";

const RelationElementsSchema = Schema.Array(Schema.String).pipe(
  Schema.check(
    Schema.makeFilter((ids) => Arr.dedupe(ids).length === ids.length, {
      message: "Expected unique element identities within each set.",
    })
  )
);
const RelationMappingSchema = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
});
export type RelationMapping = typeof RelationMappingSchema.Type;

const RelationSchema = Schema.Struct({
  domain: RelationElementsSchema,
  codomain: RelationElementsSchema,
  mappings: Schema.Array(RelationMappingSchema),
}).pipe(
  Schema.check(
    Schema.makeFilter(
      ({ domain, codomain, mappings }) =>
        Arr.every(
          mappings,
          ({ from, to }) =>
            Arr.contains(domain, from) && Arr.contains(codomain, to)
        ),
      {
        message:
          "Expected each mapping to reference its own domain and codomain.",
      }
    )
  )
);

/** An authored relation references an absent or ambiguous set element. */
export class RelationError extends Schema.TaggedError<RelationError>()(
  "RelationError",
  {
    message: Schema.String,
  }
) {}

/** Places a set's elements evenly inside its own ellipse. */
function positions(ids: readonly string[], x: number) {
  return Arr.map(ids, (id, index) => ({
    id,
    x,
    y: 2 - (4 * (index + 0.5)) / ids.length,
    z: 0,
  }));
}

/** Resolves arrows without conflating equal identities in different sets. */
export const resolveRelation = Effect.fn("Relation.resolve")(function* (
  input: unknown
) {
  const relation = yield* Schema.decodeUnknownEffect(RelationSchema)(
    input
  ).pipe(
    Effect.mapError((error) => new RelationError({ message: error.message }))
  );
  const domain = positions(relation.domain, -3);
  const codomain = positions(relation.codomain, 3);
  return {
    domain,
    codomain,
    mappings: Arr.map(relation.mappings, ({ from, to }, index) => {
      const domainIndex = Option.getOrElse(
        Arr.findFirstIndex(relation.domain, (item) => item === from),
        () => -1
      );
      const codomainIndex = Option.getOrElse(
        Arr.findFirstIndex(relation.codomain, (item) => item === to),
        () => -1
      );
      return {
        id: `mapping-${index}`,
        domainIndex,
        codomainIndex,
        points: [
          { x: -2.5, y: domain[domainIndex].y, z: 0 },
          { x: 2.5, y: codomain[codomainIndex].y, z: 0 },
        ],
      };
    }),
  };
});
