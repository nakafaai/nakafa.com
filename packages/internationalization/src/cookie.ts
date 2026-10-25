import { Array as Arr, Option } from "effect";

/** Splits one cookie pair at its first `=`. The value keeps any `=` that it contains. */
function splitCookie(pair: string): readonly [string, string] {
  const [name, ...value] = pair.trim().split("=");
  return [name, Arr.join(value, "=")];
}

/**
 * The value of one cookie in a request's `Cookie` header, or none. The first
 * cookie with that name wins, and a request without a `Cookie` header has none.
 */
export function readCookie(
  headers: Headers,
  name: string
): Option.Option<string> {
  return Option.fromNullishOr(headers.get("cookie")).pipe(
    Option.flatMap((header) =>
      Arr.findFirst(Arr.map(header.split(";"), splitCookie), ([key, value]) =>
        key === name ? Option.some(value) : Option.none()
      )
    )
  );
}
