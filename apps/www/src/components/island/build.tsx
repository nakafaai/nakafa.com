import {
  ArrowUpDoubleIcon,
  Delete02Icon,
  Move01Icon,
  Plant02Icon,
  Redo02Icon,
  RotateRight01Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { Item, stagesOf } from "@repo/backend/confect/island/item";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { VisualCardToolbar } from "@repo/design-system/components/visual/card";
import { Array as Arr, Option } from "effect";
import { useTranslations } from "use-intl";
import { useEditIsland } from "@/components/island/edit";
import { useHarvestIsland } from "@/components/island/farm";
import { useToolStore, useTools } from "@/components/island/tools";
import { useIsland } from "@/lib/island/context";
import { ripeYield } from "@/lib/island/farm";

/** Starts and ends building: the island page's one main action. */
export function BuildToggle() {
  const t = useTranslations("Island");
  const building = useTools((state) => state.building);
  const toggle = useTools((state) => state.toggle);
  return <Button onClick={toggle}>{building ? t("done") : t("build")}</Button>;
}

/** Undo and redo of the owner's edits, newest first. */
function History() {
  const t = useTranslations("Island");
  const tools = useToolStore();
  const canUndo = useTools((state) => state.past.length > 0);
  const canRedo = useTools((state) => state.future.length > 0);
  const edit = useEditIsland();
  return (
    <ButtonGroup>
      <Button
        disabled={!canUndo}
        onClick={() =>
          Option.map(tools.getState().takeUndo(), (batch) =>
            edit(batch, "undo")
          )
        }
        size="icon"
        tooltip={t("undo")}
      >
        <HugeIcons icon={Undo02Icon} />
      </Button>
      <Button
        disabled={!canRedo}
        onClick={() =>
          Option.map(tools.getState().takeRedo(), (batch) =>
            edit(batch, "redo")
          )
        }
        size="icon"
        tooltip={t("redo")}
      >
        <HugeIcons icon={Redo02Icon} />
      </Button>
    </ButtonGroup>
  );
}

/** What can be done with the picked placement: turn it, move it, upgrade it, remove it. */
function Picked() {
  const t = useTranslations("Island");
  const { layout } = useIsland();
  const selected = useTools((state) => state.selected);
  const tools = useToolStore();
  const edit = useEditIsland();
  const harvest = useHarvestIsland();
  const picked = Option.flatMap(selected, (at) =>
    Arr.findFirst(
      layout,
      (placement) =>
        placement.x === at.x && placement.y === at.y && placement.z === at.z
    )
  );
  if (Option.isNone(picked)) {
    return null;
  }
  const placement = picked.value;
  const at = { x: placement.x, y: placement.y, z: placement.z };
  const next = Arr.get(stagesOf(placement.item), placement.stage + 1);
  return (
    <ButtonGroup>
      <Button
        onClick={() =>
          edit(
            [
              {
                _tag: "move",
                from: at,
                rotation: (placement.rotation + 1) % 4,
                to: at,
              },
            ],
            "edit"
          )
        }
        size="icon"
        tooltip={t("rotate")}
      >
        <HugeIcons icon={RotateRight01Icon} />
      </Button>
      <Button
        onClick={() => tools.getState().move()}
        size="icon"
        tooltip={t("move")}
      >
        <HugeIcons icon={Move01Icon} />
      </Button>
      <Button
        disabled={Option.isNone(next)}
        onClick={() => edit([{ _tag: "upgrade", at }], "edit")}
        size="icon"
        tooltip={t("upgrade")}
      >
        <HugeIcons icon={ArrowUpDoubleIcon} />
      </Button>
      <Button
        disabled={Option.isNone(ripeYield(placement))}
        onClick={() => harvest(placement)}
        size="icon"
        tooltip={t("harvest")}
      >
        <HugeIcons icon={Plant02Icon} />
      </Button>
      <Button
        onClick={() => {
          if (edit([{ _tag: "remove", at }], "edit")) {
            tools.getState().select(Option.none());
          }
        }}
        size="icon"
        tooltip={t("remove")}
      >
        <HugeIcons icon={Delete02Icon} />
      </Button>
    </ButtonGroup>
  );
}

/** The items the owner can place, each with its price, locked ones with the level that opens them. */
function Inventory() {
  const t = useTranslations("Island");
  const { owner } = useIsland();
  const choice = useTools((state) => state.choice);
  const choose = useTools((state) => state.choose);
  const level = Option.match(owner, {
    onNone: () => 0,
    onSome: (facts) => facts.level,
  });
  return (
    <div
      aria-label={t("items")}
      className="flex w-full gap-2 overflow-x-auto pb-1"
      role="toolbar"
    >
      {Arr.map(Item.literals, (item) => {
        const first = stagesOf(item)[0];
        const locked = first.level > level;
        const chosen = Option.contains(choice, item);
        return (
          <Button
            aria-pressed={chosen}
            className="shrink-0"
            disabled={locked}
            key={item}
            onClick={() => choose(chosen ? Option.none() : Option.some(item))}
            size="sm"
            variant={chosen ? "secondary" : "outline"}
          >
            {t(`item-${item}`)}
            <span className="tabular-nums">
              {locked
                ? t("locked", { level: first.level })
                : Option.match(Option.fromNullishOr(first.materials), {
                    onNone: () => t("price", { stars: first.price }),
                    onSome: (cost) =>
                      t("price-wood", { stars: first.price, wood: cost.wood }),
                  })}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

/**
 * The build band of the island frame (ADR 0042, D12): undo and redo, what can be
 * done with the picked placement or a turn for what is about to be placed, and
 * the items to place. It shows only while the owner builds.
 */
export function BuildBand() {
  const t = useTranslations("Island");
  const building = useTools((state) => state.building);
  const choosing = useTools((state) => Option.isSome(state.choice));
  const rotate = useTools((state) => state.rotate);
  if (!building) {
    return null;
  }
  return (
    <VisualCardToolbar>
      <History />
      {choosing ? (
        <Button
          onClick={rotate}
          size="icon"
          tooltip={t("rotate")}
          variant="outline"
        >
          <HugeIcons icon={RotateRight01Icon} />
        </Button>
      ) : (
        <Picked />
      )}
      <Inventory />
    </VisualCardToolbar>
  );
}
