import { Number as Num, Option, String as Str } from "effect";

/** How many letters before a name's extension stay beside it, so a cut name still shows how it ends. */
const KEPT = 5;

/**
 * Where a name is cut when it does not fit: before the last letters of its stem, so its end and its extension, the
 * dot included, always show. A name without an extension keeps its last letters the same way.
 */
function splitName(name: string) {
  const end = Option.match(Str.lastIndexOf(".")(name), {
    onNone: () => name.length,
    onSome: (dot) => (dot > 0 ? dot : name.length),
  });
  const cut = Num.max(0, end - KEPT);
  return {
    head: Str.slice(0, cut)(name),
    tail: Str.slice(cut)(name),
  };
}

/**
 * A file's name on one line, as a file manager writes it: a name too long for its place is cut in its middle, so the
 * reader still sees its end and its extension. The whole name shows on hover.
 */
export function FileName({ name }: { name: string }) {
  const { head, tail } = splitName(name);

  return (
    <span className="flex min-w-0" title={name}>
      <span className="overflow-hidden text-ellipsis whitespace-pre">
        {head}
      </span>
      <span className="shrink-0 whitespace-pre">{tail}</span>
    </span>
  );
}
