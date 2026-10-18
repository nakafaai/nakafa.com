import {
  blocksOf,
  type Keyed,
  keyed,
} from "@repo/design-system/components/editor/blocks";
import {
  isEmptyDocument,
  isEmptyText,
} from "@repo/design-system/components/editor/hint";
import { EditorPane } from "@repo/design-system/components/editor/pane";
import { itemTokens } from "@repo/design-system/components/editor/plain";
import { decodeReferences } from "@repo/design-system/components/editor/references";
import { Array as Arr, Match, String as Str } from "effect";
import type { Token, Tokens } from "marked-tiptap";
import type { ReactNode } from "react";

/**
 * The saved Markdown of a text, drawn as the rich editor draws it: the same bar,
 * the same boxes, spacing and faces, and the same blocks and marks, which the
 * page's own reader reads as the editor does. It takes the place of the editor
 * while the editor's code loads, so the editor replaces it without moving a
 * word. It cannot be edited, and a link keeps no address.
 *
 * The frame comes from `pane.tsx`, whose classes come from `frame.ts`. This
 * module writes the element the editor writes for each node and mark, with the
 * `dir` the editor gives each block.
 */
export function EditorPreview({
  markdown,
  placeholder,
}: {
  markdown: string;
  placeholder: string;
}) {
  const blocks = Arr.filter(
    blocksOf(markdown),
    ({ token }) => token.type !== "space"
  );
  const hint = isEmptyDocument(Arr.map(blocks, ({ token }) => token))
    ? placeholder
    : undefined;

  return (
    <EditorPane>
      {Arr.isReadonlyArrayEmpty(blocks) ? (
        <EmptyParagraph placeholder={placeholder} />
      ) : (
        <Blocks blocks={blocks} hint={hint} />
      )}
    </EditorPane>
  );
}

/** The paragraph the editor shows its hint in, with the hint in its own colour. */
function EmptyParagraph({ placeholder }: { placeholder: string }) {
  return (
    <p className="is-editor-empty" data-placeholder={placeholder} dir="auto">
      <br />
    </p>
  );
}

/** The class and the placeholder that show the editor's hint in an empty block, or none. */
function hintOf(hint: string | undefined) {
  return hint === undefined
    ? {}
    : { className: "is-editor-empty", "data-placeholder": hint };
}

/**
 * The blocks of one level of the document, each with the key of its place. The
 * first block takes `hint`, the placeholder of an empty document.
 */
function Blocks({
  blocks,
  hint,
}: {
  blocks: readonly Keyed<Token>[];
  hint?: string | undefined;
}) {
  return Arr.map(blocks, ({ key, token }, index) => (
    <Block hint={index === 0 ? hint : undefined} key={key} token={token} />
  ));
}

/** One block of the document. A block the editor does not hold, such as spacing, draws nothing. */
function Block({ hint, token }: { hint?: string | undefined; token: Token }) {
  return Match.value(token).pipe(
    Match.when({ type: "paragraph" }, ({ tokens }) => (
      <p dir="auto" {...hintOf(hint)}>
        <Textblock tokens={tokens} />
      </p>
    )),
    Match.when({ type: "text" }, (text) => (
      <p dir="auto">
        <Textblock tokens={text.tokens ?? [text]} />
      </p>
    )),
    Match.when({ type: "heading" }, ({ depth, tokens }) => (
      <Heading depth={depth} hint={hint}>
        <Textblock tokens={tokens} />
      </Heading>
    )),
    Match.when({ type: "list" }, (list) => <List list={list} />),
    Match.when({ type: "blockquote" }, ({ tokens }) => (
      <blockquote dir="auto">
        <Blocks blocks={keyed(tokens)} />
      </blockquote>
    )),
    Match.when({ type: "code" }, ({ lang, text }) => (
      <pre dir="auto" {...hintOf(hint)}>
        <code className={lang ? `language-${lang}` : undefined}>{text}</code>
      </pre>
    )),
    Match.when({ type: "hr" }, () => <hr dir="auto" />),
    Match.when({ type: "html" }, ({ raw }) => <p dir="auto">{raw}</p>),
    // The editor holds a table it cannot read as its Markdown, one paragraph of
    // text in which every line break is a space.
    Match.when({ type: "table" }, ({ raw }) => (
      <p dir="auto">{Str.replaceAll(/\s+/g, " ")(Str.trim(raw))}</p>
    )),
    Match.orElse(() => null)
  );
}

/** A heading. The editor has three levels, and a deeper heading is drawn as the first. */
function Heading({
  children,
  depth,
  hint,
}: {
  children: ReactNode;
  depth: number;
  hint?: string | undefined;
}) {
  return Match.value(depth).pipe(
    Match.when(2, () => (
      <h2 dir="auto" {...hintOf(hint)}>
        {children}
      </h2>
    )),
    Match.when(3, () => (
      <h3 dir="auto" {...hintOf(hint)}>
        {children}
      </h3>
    )),
    Match.orElse(() => (
      <h1 dir="auto" {...hintOf(hint)}>
        {children}
      </h1>
    ))
  );
}

/** A list: numbered, bulleted, or a task list when every item is a task. */
function List({ list }: { list: Tokens.List }) {
  const items = keyed(list.items);

  if (list.ordered) {
    return (
      <ol
        dir="auto"
        start={
          typeof list.start === "number" && list.start !== 1
            ? list.start
            : undefined
        }
      >
        {Arr.map(items, ({ key, token }) => (
          <ListItem item={token} key={key} />
        ))}
      </ol>
    );
  }

  const tasks = Arr.every(list.items, (item) => item.task);

  return (
    <ul data-type={tasks ? "taskList" : undefined} dir="auto">
      {Arr.map(items, ({ key, token }) => (
        <ListItem item={token} key={key} />
      ))}
    </ul>
  );
}

/**
 * One item of a list: a task with its check box, or the blocks the item holds.
 * The preview changes no check: a controlled box with no change handler takes a
 * click back, as the editor's own box does when the editor is read-only.
 */
function ListItem({ item }: { item: Tokens.ListItem }) {
  if (!item.task) {
    return (
      <li dir="auto">
        <Blocks blocks={keyed(itemTokens(item))} />
      </li>
    );
  }

  const checked = item.checked === true;

  return (
    <li data-checked={checked} data-type="taskItem" dir="auto">
      <label>
        <input checked={checked} readOnly tabIndex={-1} type="checkbox" />
        <span />
      </label>
      <div>
        <Blocks
          blocks={keyed(
            Arr.filter(item.tokens, (token) => token.type !== "checkbox")
          )}
        />
      </div>
    </li>
  );
}

/** The inline words of a block. A block with no words holds a break, as the editor's block does. */
function Textblock({ tokens }: { tokens: readonly Token[] }) {
  if (isEmptyText(tokens)) {
    return <br />;
  }

  return <Inlines tokens={tokens} />;
}

/** A run of inline words, each piece with the mark or the element the editor writes for it. */
function Inlines({ tokens }: { tokens: readonly Token[] }) {
  return Arr.map(keyed(tokens), ({ key, token }) => (
    <Inline key={key} token={token} />
  ));
}

/** One inline piece of words, with the mark or the element the editor writes for it. */
function Inline({ token }: { token: Token }) {
  return Match.value(token).pipe(
    Match.when({ type: "text" }, ({ text, tokens }) =>
      tokens === undefined ? (
        decodeReferences(text)
      ) : (
        <Inlines tokens={tokens} />
      )
    ),
    Match.when({ type: "escape" }, ({ text }) => text),
    Match.when({ type: "codespan" }, ({ text }) => <code>{text}</code>),
    Match.when({ type: "strong" }, ({ tokens }) => (
      <strong>
        <Inlines tokens={tokens} />
      </strong>
    )),
    Match.when({ type: "em" }, ({ tokens }) => (
      <em>
        <Inlines tokens={tokens} />
      </em>
    )),
    Match.when({ type: "del" }, ({ tokens }) => (
      <s>
        <Inlines tokens={tokens} />
      </s>
    )),
    Match.when({ type: "underline" }, ({ tokens }) => (
      <u>
        <Inlines tokens={tokens} />
      </u>
    )),
    Match.when({ type: "highlight" }, ({ tokens }) => (
      <mark>
        <Inlines tokens={tokens} />
      </mark>
    )),
    Match.when({ type: "link" }, ({ tokens }) => (
      <span data-link="">
        <Inlines tokens={tokens} />
      </span>
    )),
    Match.when({ type: "br" }, () => <br />),
    Match.when({ type: "html" }, ({ raw }) => raw),
    Match.orElse((other) => {
      if (!("tokens" in other && Arr.isArray(other.tokens))) {
        return null;
      }
      return <Inlines tokens={other.tokens} />;
    })
  );
}
