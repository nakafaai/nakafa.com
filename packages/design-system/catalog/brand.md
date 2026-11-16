Nakafa teaches one learner at a time, so it looks and talks like a patient teacher: calm navy and white, flat shapes, Nina and the animals for warmth, and nothing on a screen that does not help the learner.

This book is generated from the Nakafa design system's code. Every token, card and guideline comes from the components and stylesheets themselves, so a design built from it matches what ships.

## Using the components

Every card is a live export of the `Nakafa` bundle. The core components are exported by name (`Nakafa.Button`); the others live under their card's name, so the parts of one chart never meet another's (`Nakafa.BarChart.EvilBarChart`, `Nakafa.VisualCard.VisualCardHeader`). A design that renders Nakafa components wraps them once in `Nakafa.Root`, which gives them the product's English copy, its locale and the theme this page shows. Compose the parts a card lists; color, radius and spacing come from the components and tokens, so a class only places things.

The light and dark pair are this system's own themes. Every named theme a learner can pick is in the Themes section and the Themes card.

## Principles

- **Show, not tell.** A surface shows the thing itself: the real control, the list, the chart, the product. A label of one or two words or an icon with a tooltip names a control; no sentence explains one. No eyebrow above a heading, no caption text, no fact said twice.
- **Header, body, footer.** Every surface, from a page to a toast, reads as these three, one concern each. A dialog's header holds its title, its sentence and its close; its body shows what the action changes; its footer holds Cancel beside the action.
- **One line each.** A title and its description are one line each. A description, a card footer or an empty state is one sentence that ends with a period.
- **One primary action.** Each page has one end goal, labelled in two or three words, and it is the only place the primary color fills. Other actions sit beside it in one group of one variant.
- **Cards earn their place.** A card holds one thing with its action. No card inside a card, no grid of icon cards, no wall of setting cards outside settings.
- **Nothing touches, everything aligns.** Neighbours keep a gap, controls on one surface share a height and a radius, padding is equal on four sides, and a marker sits on its text's first line.
- **Still.** No flicker and no layout shift: what a surface needs is ready before it opens, and a page keeps its content while the next one loads.

## Voice

- Talk to one learner, warm and casual, never formal and never cringe: English plain with contractions, Indonesian and Malay *kamu*, German *du*.
- Nina speaks in the first person: "Tanya aku aja ya, jangan ragu-ragu!"
- Actions lead with a verb in two or three words: "Start learning", "View exams".
- A confirmation is a question with its consequence below it: "Delete account?" then "This can't be undone."
- An error says what failed and what to do next, as "we", without blame.
- Sentence case. No emoji in product copy. An exclamation mark only for a small confirmation or a greeting.
- A headline may mark one phrase in `primary`.

## Color

- Semantic tokens only. `primary` is the brand ink, navy in light and sky in dark; `secondary` is its swap partner, a fill and never text.
- The neutral grounds are `background`, `card`, `popover`, `muted` and `sidebar`; text on them is `foreground`, `muted-foreground`, `primary` or `destructive`.
- A fill carries its own foreground: everything on `accent`, `primary`, `secondary`, a status fill or `sidebar-accent` uses that fill's `-foreground`, on hover and focus too.
- `destructive` is an error or a wrong chosen answer, `success` a correct answer or a met requirement, `warning` the emphasis marker, `info` a neutral notice. A status always carries a word or an icon.
- `border` and `input` stay subtle by design; a field reads by its placeholder and its focus ring.
- Nina's colors and the `pop-*` colors stay the same in every theme. `pop-*` are flat highlights, never error colors.
- Charts use `chart-1` to `chart-5` in order, each series with its own dash, marker or hatch.

## Type

- Inter sets everything; Geist Mono sets code, timers, scores and status codes.
- `text-sm` is the interface default, `text-xs` badges, tooltips and metadata, `text-base` card titles. Headings are medium weight, tight leading and tight tracking. Nina's answers and lesson prose use `text-chat`.
- Headlines balance their lines, paragraphs avoid orphans, and numbers that change or align are tabular.

## Shape and depth

- Spacing follows the 4px grid. A label sits tight on its value, fields stand wider apart, sections wider again.
- Controls take `radius-md`, cards, dialogs and tables `radius-xl`, chips and menu items `radius-sm`, people, pills and switches `radius-full`.
- Hairlines separate before shadows do. A card lifts with `shadow-xs` and a faint ring.
- Buttons stay at the default size.

## Motion

- Interface motion enters and leaves on `ease-out`; a thing that moves from one place to another uses `ease-in-out`.
- `press` answers a press, `ui` covers menus, popovers and tooltips, `surface` covers dialogs, sheets and the sidebar. Interface motion stays under 300ms.
- Reduced motion is honored everywhere, and theme changes never animate.

## Icons

- One set, Hugeicons, at `size-4`, stroke 2, in the text's color. `size-4` is the largest an icon is drawn; a picture that needs more room is drawn artwork.
- A bare icon beside two lines of text sits on the first line; an icon centred on a block is a tile as tall as the block.
- An icon labels: pair it with words, or give its button a tooltip.

## Identity

- Flat and two-dimensional: solid fills, no gradients, gloss, shaders or grain. Every character is drawn in code, never generated by an image model.
- **Nina** is the only mascot and the only AI name a learner sees: a hammerhead shark's head with cat ears, an octopus body and a shark's fin. She is always doing something that fits the place, and never the same act twice on a page.
- **People are animals.** A person shows as their animal or their photo, always in a circle, never as initials. A page draws its animals from one cast, so none appears twice. Circles are for people; content tiles are rounded squares.
- **Things** are the small drawn objects Nina and the animals hold, and they can be picked up and thrown.
- Every empty state shows a mascot act that fits the place, never text alone.
- The logo is the letter η in dark gray on a white square, kept white in every theme, never recolored and never put on Nina.

## Marketing pages

- One screen per section with its content in the middle. The hero holds one headline, one line and the action.
- Text on one side and the real product on the other, running by itself: nothing to click to see the value, and lists load as their end comes near.
- Every page ends with the final call to action, and the main site and School share one header and one footer.
