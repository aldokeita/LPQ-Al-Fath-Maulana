export const getDragScrollVelocity = (position, start, end, edgeSize, maxSpeed) => {
  if (position < start || position > end || end <= start) return 0;
  const edge = Math.min(edgeSize, (end - start) / 3);
  const topDistance = position - start;
  const bottomDistance = end - position;
  if (topDistance < edge) return -Math.max(60, maxSpeed * (1 - topDistance / edge) ** 1.5);
  if (bottomDistance < edge) return Math.max(60, maxSpeed * (1 - bottomDistance / edge) ** 1.5);
  return 0;
};

const canScroll = (element, direction) => direction < 0
  ? element.scrollTop > 0
  : element.scrollTop < element.scrollHeight - element.clientHeight - 1;

export const createDragAutoScroller = ({ monitor, doc = document, view = window, onDraggingChange = () => {} }) => {
  let active = false;
  let pointer = null;
  let frame = null;
  let lastTime = null;
  let wheelPauseUntil = 0;

  const scrollParentsAt = (point) => {
    const parents = [];
    let element = doc.elementFromPoint(point.x, point.y);
    while (element && element !== doc.body && element !== doc.documentElement) {
      const overflow = view.getComputedStyle(element).overflowY;
      if (/^(auto|scroll|overlay)$/.test(overflow) && element.scrollHeight > element.clientHeight + 1) {
        parents.push(element);
      }
      element = element.parentElement;
    }
    return parents;
  };

  const scrollBy = (element, amount) => {
    element.scrollTo({ top: element.scrollTop + amount, behavior: 'instant' });
  };

  const tick = (time) => {
    frame = null;
    if (!active) return;
    const delta = Math.min(32, lastTime == null ? 16 : time - lastTime);
    lastTime = time;
    const root = doc.scrollingElement;
    if (pointer && root && time >= wheelPauseUntil && pointer.x >= 0 && pointer.x <= view.innerWidth) {
      const pageVelocity = getDragScrollVelocity(pointer.y, 0, view.innerHeight, 128, 900);
      if (pageVelocity && canScroll(root, pageVelocity)) {
        // Viewport edges take priority so a tall class card cannot trap the page.
        scrollBy(root, pageVelocity * delta / 1000);
      } else {
        for (const parent of scrollParentsAt(pointer)) {
          const rect = parent.getBoundingClientRect();
          const speed = getDragScrollVelocity(pointer.y, Math.max(0, rect.top), Math.min(view.innerHeight, rect.bottom), 72, 480);
          if (speed && canScroll(parent, speed)) {
            scrollBy(parent, speed * delta / 1000);
            break;
          }
        }
      }
    }
    frame = view.requestAnimationFrame(tick);
  };

  const updatePointer = (event) => {
    if (active && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      pointer = { x: event.clientX, y: event.clientY };
    }
  };

  const clearPointer = () => { pointer = null; };
  const leaveDocument = (event) => {
    if (event.target === doc.documentElement && !event.relatedTarget) clearPointer();
  };

  const onWheel = (event) => {
    if (!active || !event.cancelable || event.ctrlKey || event.metaKey || !event.deltaY) return;
    const point = { x: event.clientX, y: event.clientY };
    const targets = [...scrollParentsAt(point), doc.scrollingElement].filter(Boolean);
    const target = targets.find((element) => canScroll(element, event.deltaY));
    if (!target) return;
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.innerHeight : 1;
    event.preventDefault();
    scrollBy(target, event.deltaY * multiplier);
    wheelPauseUntil = view.performance.now() + 600;
  };

  const stop = () => {
    if (!active) return;
    active = false;
    pointer = null;
    lastTime = null;
    wheelPauseUntil = 0;
    if (frame != null) view.cancelAnimationFrame(frame);
    frame = null;
    doc.removeEventListener('dragover', updatePointer, true);
    doc.removeEventListener('dragleave', leaveDocument, true);
    doc.removeEventListener('drop', stop, true);
    doc.removeEventListener('dragend', stop, true);
    doc.removeEventListener('wheel', onWheel, true);
    view.removeEventListener('blur', clearPointer);
    onDraggingChange(false);
  };

  const sync = () => {
    const shouldScroll = monitor.isDragging() && monitor.getItemType() === 'santri' && !monitor.didDrop() && !doc.hidden;
    if (!shouldScroll) { stop(); return; }
    if (active) return;
    active = true;
    pointer = monitor.getClientOffset();
    doc.addEventListener('dragover', updatePointer, true);
    doc.addEventListener('dragleave', leaveDocument, true);
    doc.addEventListener('drop', stop, true);
    doc.addEventListener('dragend', stop, true);
    doc.addEventListener('wheel', onWheel, { capture: true, passive: false });
    view.addEventListener('blur', clearPointer);
    onDraggingChange(true);
    frame = view.requestAnimationFrame(tick);
  };

  const unsubscribeState = monitor.subscribeToStateChange(sync);
  const unsubscribeOffset = monitor.subscribeToOffsetChange(() => {
    if (active) pointer = monitor.getClientOffset();
  });
  doc.addEventListener('visibilitychange', sync);
  sync();

  return () => {
    unsubscribeState();
    unsubscribeOffset();
    doc.removeEventListener('visibilitychange', sync);
    stop();
  };
};
