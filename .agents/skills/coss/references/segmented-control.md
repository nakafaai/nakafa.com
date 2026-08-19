# coss Segmented Control Pattern

A segmented control is a shared visual treatment, not a standalone behavior. Choose the underlying primitive from the interaction before applying the styling.

## Choose the behavior

| Intent | Use | State model |
| --- | --- | --- |
| Choose one value, especially in a form | Radio Group | Exactly one mutually exclusive value |
| Navigate to another URL or route | Links | Browser navigation with `aria-current="page"` on the current link |
| Apply an exclusive filter or reversible mode | Toggle Group | At most one pressed item by default; the current item may be cleared |
| Switch between associated content panels | Tabs | Each tab controls a matching panel |

Do not use Tabs for navigation links, form values, or filters merely because the result should look segmented. Do not use Toggle Group when one value must always remain selected; use Radio Group instead.

## Install a particle

| Implementation | Small | Default | Large |
| --- | --- | --- | --- |
| Radio Group | `@coss/p-radio-group-7` | `@coss/p-radio-group-8` | `@coss/p-radio-group-9` |
| Navigation links | `@coss/p-navigation-2` | `@coss/p-navigation-1` | `@coss/p-navigation-3` |

The CLI installs the relevant primitive and the shared `@coss/segmented-control` styling library automatically.

COSS does not publish a Toggle Group segmented particle. Use the shared styling directly only when a reversible mode genuinely allows no active option.

## Custom composition

Install the styling library directly when none of the particles matches:

```bash
npx shadcn@latest add @coss/segmented-control
```

```tsx
import {
  segmentedControlItemVariants,
  segmentedControlRootClassName,
} from "@/lib/segmented-control"
```

Apply `segmentedControlRootClassName` to the group surface. Generate one item class with the matching state selector:

```tsx
const itemClassName = segmentedControlItemVariants({
  size: "default",
  state: "checked",
})
```

- `state: "checked"` for Radio Group
- `state: "current"` for navigation links
- `state: "pressed"` for Toggle Group
- `size: "sm" | "default" | "lg"`

Use the exported Radio Group primitives for a custom segmented radio presentation so the native radio indicator is not rendered. Keep a default or controlled value when the interface requires one option to remain selected.

Tabs do not use the shared state recipe because they retain their animated indicator. They import the shared size map and `segmentedControlItemLayoutClassName`: set `size="sm" | "default" | "lg"` on `TabsList`, and use a `TabsTab` size only as an item-level override.

Reuse the shared root, item, and layout recipes instead of copying their classes into a new segmented particle. This keeps Tabs and the radio, navigation, and toggle implementations optically aligned.
