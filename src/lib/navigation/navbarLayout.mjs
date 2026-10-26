const MIN_DESKTOP_WIDTH = 1024;
const COLLISION_GAP = 8;

export function needsCompactNavbar({
  viewportWidth,
  logoRight,
  firstNavLeft,
  lastNavRight,
  actionsLeft,
}) {
  return (
    viewportWidth < MIN_DESKTOP_WIDTH ||
    firstNavLeft < logoRight + COLLISION_GAP ||
    lastNavRight > actionsLeft - COLLISION_GAP
  );
}
