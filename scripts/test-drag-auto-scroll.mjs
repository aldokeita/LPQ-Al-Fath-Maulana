import assert from 'node:assert/strict';
import test from 'node:test';
import { createDragAutoScroller, getDragScrollVelocity } from '../src/lib/dragAutoScroll.js';

const makeElement = (height, contentHeight, rect, parentElement = null) => ({
  scrollTop: 0, clientHeight: height, scrollHeight: contentHeight, parentElement,
  getBoundingClientRect: () => rect,
  scrollTo({ top }) { this.scrollTop = Math.min(contentHeight - height, Math.max(0, top)); },
});

const makeHarness = (type = 'santri') => {
  const listeners = new Map();
  const frames = new Map();
  let nextFrame = 0;
  let stateListener;
  let offsetListener;
  let now = 0;
  const root = makeElement(800, 3000, { top: 0, bottom: 800 });
  const local = makeElement(250, 900, { top: 200, bottom: 450 });
  const monitor = {
    dragging: true, point: { x: 300, y: 400 }, dropped: false,
    isDragging() { return this.dragging; }, getItemType() { return type; },
    didDrop() { return this.dropped; }, getClientOffset() { return this.point; },
    subscribeToStateChange(fn) { stateListener = fn; return () => { stateListener = null; }; },
    subscribeToOffsetChange(fn) { offsetListener = fn; return () => { offsetListener = null; }; },
  };
  const events = {
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const doc = { ...events, hidden: false, body: {}, documentElement: {}, scrollingElement: root,
    elementFromPoint: () => local };
  const view = { ...events, innerWidth: 1200, innerHeight: 800,
    getComputedStyle: () => ({ overflowY: 'auto' }), performance: { now: () => now },
    requestAnimationFrame(fn) { const id = ++nextFrame; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const cleanup = createDragAutoScroller({ monitor, doc, view });
  return { root, local, monitor, doc, listeners, frames, cleanup,
    point(y) { monitor.point = { x: 300, y }; offsetListener?.(); },
    state() { stateListener?.(); },
    step(time) { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn(time)); },
  };
};

test('edge speed is gradual, bounded, and stops outside the viewport', () => {
  assert.equal(getDragScrollVelocity(400, 0, 800, 128, 900), 0);
  assert.equal(getDragScrollVelocity(-10, 0, 800, 128, 900), 0);
  assert.equal(getDragScrollVelocity(810, 0, 800, 128, 900), 0);
  assert.equal(getDragScrollVelocity(0, 0, 800, 128, 900), -900);
  assert.ok(getDragScrollVelocity(780, 0, 800, 128, 900) > getDragScrollVelocity(700, 0, 800, 128, 900));
});

test('page scroll continues without another dragover event', () => {
  const h = makeHarness(); h.point(760); h.step(0);
  const first = h.root.scrollTop; h.step(16); h.step(32);
  assert.ok(first > 0); assert.ok(h.root.scrollTop > first * 2);
  h.cleanup();
});

test('middle of viewport scrolls a class card near its own edge', () => {
  const h = makeHarness(); h.point(440); h.step(0);
  assert.ok(h.local.scrollTop > 0); assert.equal(h.root.scrollTop, 0);
  h.cleanup();
});

test('viewport edge escapes a nested scroll container', () => {
  const h = makeHarness(); h.local.getBoundingClientRect = () => ({ top: 550, bottom: 800 });
  h.point(760); h.step(0);
  assert.ok(h.root.scrollTop > 0); assert.equal(h.local.scrollTop, 0);
  h.cleanup();
});

test('wheel is consumed once and temporarily overrides edge scrolling', () => {
  const h = makeHarness(); h.point(760); let prevented = 0;
  h.listeners.get('wheel')({ cancelable: true, deltaY: 3, deltaMode: 1, clientX: 300, clientY: 440,
    preventDefault() { prevented++; } });
  assert.equal(h.local.scrollTop, 48); assert.equal(prevented, 1);
  h.step(16); assert.equal(h.root.scrollTop, 0);
  h.step(650); assert.ok(h.root.scrollTop > 0);
  h.cleanup();
});

test('wheel falls back to page when a class card reaches its limit', () => {
  const h = makeHarness(); h.local.scrollTop = 650;
  h.listeners.get('wheel')({ cancelable: true, deltaY: 80, deltaMode: 0, clientX: 300, clientY: 440,
    preventDefault() {} });
  assert.equal(h.root.scrollTop, 80); h.cleanup();
});

test('drop, cancellation, and disposal leave no scrolling behind', () => {
  const h = makeHarness(); h.point(760); h.step(0);
  h.listeners.get('dragend')(); const finalPosition = h.root.scrollTop;
  h.step(16); assert.equal(h.root.scrollTop, finalPosition); assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.has('wheel'), false);
  h.monitor.dropped = true; h.state(); assert.equal(h.frames.size, 0);
  h.cleanup(); assert.equal(h.listeners.size, 0);
});

test('other draggable item types never start student scrolling', () => {
  const h = makeHarness('class_order'); assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.has('wheel'), false); h.cleanup();
});
