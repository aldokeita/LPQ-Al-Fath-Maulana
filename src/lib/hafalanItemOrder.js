// Pure ordering helpers for the admin hafalan curriculum board.
// Items without a jilid are shown in the first column, so they are treated as belonging there.
export const resolveItemLevel = (item, levels) => {
  const value = String(item?.jilid || '');
  return levels.map(String).includes(value) ? value : String(levels[0]);
};

export const groupItemsByLevel = (items, levels) => Object.fromEntries(
  levels.map((level) => [
    String(level),
    items.filter((item) => resolveItemLevel(item, levels) === String(level)),
  ])
);

// Moves one item to a column (before/after a target item, or to the end when no target),
// renumbers item_order across the board and returns only the rows that actually changed.
export const moveHafalanItem = ({ items, levels, draggedId, targetJilid, targetId = null, position = 'before' }) => {
  const dragged = items.find((item) => item.id === draggedId);
  if (!dragged || (targetId && targetId === draggedId)) return { items, updates: [] };

  const toLevel = String(targetJilid);
  const columns = groupItemsByLevel(items, levels);
  if (!columns[toLevel]) return { items, updates: [] };

  const fromLevel = resolveItemLevel(dragged, levels);
  columns[fromLevel] = columns[fromLevel].filter((item) => item.id !== draggedId);

  const column = columns[toLevel];
  let index = column.length;
  if (targetId) {
    const targetIndex = column.findIndex((item) => item.id === targetId);
    if (targetIndex >= 0) index = position === 'after' ? targetIndex + 1 : targetIndex;
  }
  const levelChanged = String(dragged.jilid || '') !== toLevel;
  column.splice(index, 0, levelChanged ? { ...dragged, jilid: toLevel } : dragged);

  const ordered = levels.flatMap((level) => columns[String(level)]);
  const updates = [];
  const nextItems = ordered.map((item, orderIndex) => {
    const itemOrder = orderIndex + 1;
    const original = items.find((row) => row.id === item.id);
    const change = {};
    if (Number(original.item_order) !== itemOrder) change.item_order = itemOrder;
    if (item.id === draggedId && levelChanged) change.jilid = toLevel;
    if (Object.keys(change).length) updates.push({ id: item.id, ...change });
    return { ...item, item_order: itemOrder };
  });

  return { items: nextItems, updates };
};
