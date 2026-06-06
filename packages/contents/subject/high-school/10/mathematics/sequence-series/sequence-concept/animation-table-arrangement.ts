const CHAIR_SIZE = 24;
const INITIAL_SIDE_CHAIRS = 2;
const TABLE_WIDTH = 100;
const TABLE_HEIGHT = 80;
const TABLE_SPACING = 4;
const CHAIR_OFFSET = 8;

function createTable(id: number, x: number) {
  return {
    height: TABLE_HEIGHT,
    id,
    width: TABLE_WIDTH,
    x,
    y: 0,
  };
}

function createChair(
  id: number,
  side: "left" | "right" | "top" | "bottom",
  x: number,
  y: number
) {
  return { id, side, x, y };
}

/**
 * Builds the table and chair positions for the sequence visual.
 */
export function getTableChairArrangement(tableCount: number) {
  const sceneWidth =
    tableCount * TABLE_WIDTH + (tableCount - 1) * TABLE_SPACING;

  if (tableCount === 1) {
    return {
      chairSize: CHAIR_SIZE,
      height: TABLE_HEIGHT,
      tables: [createTable(1, 0)],
      width: sceneWidth,
      chairs: [
        createChair(
          1,
          "left",
          -CHAIR_SIZE - CHAIR_OFFSET,
          TABLE_HEIGHT / 2 - CHAIR_SIZE / 2
        ),
        createChair(
          2,
          "right",
          TABLE_WIDTH + CHAIR_OFFSET,
          TABLE_HEIGHT / 2 - CHAIR_SIZE / 2
        ),
        createChair(
          3,
          "top",
          TABLE_WIDTH / 2 - CHAIR_SIZE / 2,
          -CHAIR_SIZE - CHAIR_OFFSET
        ),
        createChair(
          4,
          "bottom",
          TABLE_WIDTH / 2 - CHAIR_SIZE / 2,
          TABLE_HEIGHT + CHAIR_OFFSET
        ),
      ],
    };
  }

  const tables = Array.from({ length: tableCount }, (_, index) =>
    createTable(index + 1, index * (TABLE_WIDTH + TABLE_SPACING))
  );

  const topChairs = Array.from({ length: tableCount }, (_, index) =>
    createChair(
      INITIAL_SIDE_CHAIRS + 1 + index,
      "top",
      index * TABLE_WIDTH +
        TABLE_WIDTH / 2 -
        CHAIR_SIZE / 2 +
        index * TABLE_SPACING,
      -CHAIR_SIZE - CHAIR_OFFSET
    )
  );

  const bottomChairs = Array.from({ length: tableCount }, (_, index) =>
    createChair(
      INITIAL_SIDE_CHAIRS + 1 + tableCount + index,
      "bottom",
      index * TABLE_WIDTH +
        TABLE_WIDTH / 2 -
        CHAIR_SIZE / 2 +
        index * TABLE_SPACING,
      TABLE_HEIGHT + CHAIR_OFFSET
    )
  );

  return {
    chairSize: CHAIR_SIZE,
    chairs: [
      createChair(
        1,
        "left",
        -CHAIR_SIZE - CHAIR_OFFSET,
        TABLE_HEIGHT / 2 - CHAIR_SIZE / 2
      ),
      createChair(
        2,
        "right",
        sceneWidth + CHAIR_OFFSET,
        TABLE_HEIGHT / 2 - CHAIR_SIZE / 2
      ),
      ...topChairs,
      ...bottomChairs,
    ],
    height: TABLE_HEIGHT,
    tables,
    width: sceneWidth,
  };
}
