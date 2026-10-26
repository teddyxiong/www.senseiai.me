function runwayTravel({ runwayHeight, stickyHeight }) {
  return Math.max(0, runwayHeight - stickyHeight);
}

export function runwayGeometryFromMeasurements({
  runwayDocumentTop,
  stickyTop,
  ...geometry
}) {
  return {
    ...geometry,
    runwayTop: runwayDocumentTop - stickyTop,
  };
}

export function capabilityIndexFromScroll(scrollTop, geometry) {
  const travel = runwayTravel(geometry);
  const count = Math.max(1, geometry.capabilityCount);
  if (travel === 0 || count === 1) return 0;

  const progress = Math.min(
    1,
    Math.max(0, (scrollTop - geometry.runwayTop) / travel),
  );
  return Math.min(count - 1, Math.floor(progress * count));
}

export function stickyTopForViewport({
  viewportHeight,
  stickyHeight,
  reservedTop = 0,
  minimumTop = 72,
}) {
  const availableHeight = Math.max(0, viewportHeight - reservedTop);
  const centeredTop =
    reservedTop + Math.max(0, availableHeight - stickyHeight) / 2;
  return Math.max(minimumTop, centeredTop);
}

export function runwayTravelForLogoVisibility({
  viewportHeight,
  stickyTop,
  stickyHeight,
  trailingGap,
  minimumTravel,
  logoClearance = 80,
  maximumTravel = 640,
}) {
  const requiredTravel =
    2 *
    (viewportHeight + logoClearance - stickyTop - stickyHeight - trailingGap);
  return Math.min(maximumTravel, Math.max(minimumTravel, requiredTravel));
}

export function minimumRunwayTravel(viewportHeight, viewportWidth = Infinity) {
  if (viewportWidth < 768) {
    return Math.min(440, Math.max(360, viewportHeight * 0.42));
  }
  return Math.min(640, Math.max(480, viewportHeight * 0.5));
}

export function scrollTopForCapability(index, geometry) {
  const travel = runwayTravel(geometry);
  const count = Math.max(1, geometry.capabilityCount);
  if (travel === 0 || count === 1) return geometry.runwayTop;

  const safeIndex = Math.min(count - 1, Math.max(0, index));
  const segment = travel / count;
  return Math.min(
    geometry.runwayTop + travel,
    geometry.runwayTop + segment * (safeIndex + 0.5),
  );
}

export function switchMountedCapability({
  tabs,
  panels,
  animations,
  activeIndex,
  nextIndex,
  focus = false,
}) {
  const boundedIndex = Math.min(tabs.length - 1, Math.max(0, nextIndex));
  if (boundedIndex === activeIndex) return activeIndex;

  const previousAnimation = animations[activeIndex];
  if (previousAnimation) {
    previousAnimation.classList.remove("is-active");
    previousAnimation.setAttribute("aria-hidden", "true");
    previousAnimation.dispatchEvent(new Event("capability:deactivate"));
  }

  animations.forEach((animation, index) => {
    if (index !== boundedIndex) animation.remove();
  });
  panels.forEach((panel) => {
    panel.classList.remove("is-active");
    panel.hidden = true;
  });

  tabs.forEach((tab, index) => {
    const active = index === boundedIndex;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus({ preventScroll: true });
  });

  const nextPanel = panels[boundedIndex];
  const nextAnimation = animations[boundedIndex];
  nextPanel.append(nextAnimation);
  nextPanel.hidden = false;
  nextPanel.classList.add("is-active");
  nextAnimation.classList.add("is-active");
  nextAnimation.setAttribute("aria-hidden", "false");
  nextAnimation.dispatchEvent(new Event("capability:activate"));

  return boundedIndex;
}
