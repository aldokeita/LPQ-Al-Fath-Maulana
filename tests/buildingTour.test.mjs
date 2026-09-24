import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DoubleSide, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BUILDING_ASSET_REVISION, sampleCamera, scrollProgress, stageAt, validateTour, TOUR_STAGES } from '../src/components/public/home/buildingTourMath.js';

const tour = JSON.parse(readFileSync(new URL('../public/models/lpq-building-tour.json', import.meta.url)));

async function geometryForRayTests() {
  const source = readFileSync(new URL('../public/models/lpq-building.glb', import.meta.url));
  const jsonLength = source.readUInt32LE(12);
  const data = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
  // Geometry-only import avoids a DOM image decoder in Node; positions and indices are untouched.
  delete data.images; delete data.textures; delete data.materials;
  for (const mesh of data.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const raw = Buffer.from(JSON.stringify(data));
  const json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 0x20); raw.copy(json);
  const bin = source.subarray(28 + jsonLength);
  const glb = Buffer.alloc(28 + json.length + bin.length);
  glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  glb.writeUInt32LE(bin.length, 20 + json.length); glb.writeUInt32LE(0x004e4942, 24 + json.length); bin.copy(glb, 28 + json.length);
  const loaded = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  loaded.scene.traverse((object) => { if (object.isMesh) object.material.side = DoubleSide; });
  loaded.scene.updateMatrixWorld(true);
  return loaded.scene;
}

const exportedGeometry = geometryForRayTests();

test('exported route covers both floors and every presentation stop', () => {
  assert.equal(validateTour(tour), tour);
  assert.deepEqual(tour.roomCounts, { ground: 5, upper: 4 });
  assert.deepEqual(tour.stages, TOUR_STAGES);
  for (const stop of tour.stages) {
    const pose = sampleCamera(tour.keyframes, stop.progress);
    assert.ok(pose.position.every(Number.isFinite));
    assert.ok(pose.target.some((v, i) => v !== pose.position[i]));
  }
});

test('scroll clamps before/after hero and maps reverse scroll consistently', () => {
  assert.equal(scrollProgress(100, 3000, 1000), 0);
  assert.equal(scrollProgress(-1000, 3000, 1000), 0.5);
  assert.equal(scrollProgress(-4000, 3000, 1000), 1);
  assert.equal(scrollProgress(0, 500, 900), 0);
  for (const p of [...TOUR_STAGES, ...TOUR_STAGES.toReversed()].map((stage) => stage.progress)) {
    const actual = sampleCamera(tour.keyframes, p);
    const exact = tour.keyframes.find((frame) => frame.progress === p);
    assert.deepEqual(actual.position, exact.position);
    assert.deepEqual(actual.target, exact.target);
  }
});

test('camera interpolation stays on each collision-checked segment', () => {
  for (let i = 1; i < tour.keyframes.length; i += 1) {
    const a = tour.keyframes[i - 1]; const b = tour.keyframes[i];
    const pose = sampleCamera(tour.keyframes, (a.progress + b.progress) / 2);
    pose.position.forEach((value, axis) => assert.ok(Math.abs(value - (a.position[axis] + b.position[axis]) / 2) < 1e-8));
  }
  assert.equal(stageAt(1), 5);
  assert.equal(stageAt(0), 0);
});

test('invalid or incomplete path data falls back instead of moving a camera', () => {
  assert.throws(() => validateTour(null));
  assert.throws(() => validateTour({ ...tour, keyframes: [...tour.keyframes].reverse() }));
  assert.throws(() => validateTour({ ...tour, keyframes: [{ progress: 0, position: [NaN, 0, 0], target: [0, 0, 0], fov: 40 }, tour.keyframes.at(-1)] }));
});

test('GLB is self-contained, within budget, and has independently revealable shades', () => {
  const glb = readFileSync(new URL('../public/models/lpq-building.glb', import.meta.url));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);
  assert.ok(glb.length < 12 * 1024 * 1024);
  const document = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
  assert.ok(document.meshes.length < 60);
  assert.ok(document.nodes.some((node) => node.extras?.tourReveal));
  assert.ok(document.images.every((image) => !image.uri && Number.isInteger(image.bufferView)));
  assert.ok(document.buffers.every((buffer) => !buffer.uri));
});

test('revised layout records the corrected numbering, table, staircase and flora', () => {
  assert.equal(tour.revision, BUILDING_ASSET_REVISION);
  assert.deepEqual(tour.layout.groundRoomOrder, [5, 4, 3, 2, 1]);
  assert.deepEqual(tour.layout.gateOpeningX, [16, 17.5]);
  assert.equal(tour.layout.tableRoom, 1);
  assert.equal(tour.layout.tableRotationDegrees, 90);
  assert.equal(tour.layout.firstStairFlight, 'inner');
  assert.ok(tour.layout.frontWalkwayWidth >= 1.8);
  assert.equal(tour.layout.porchShadeCenterX, 8.8);
  assert.equal(tour.layout.treeCount, 7);
  assert.equal(tour.layout.hasClimbers, true);
  assert.equal(tour.layout.peopleModelled, false);
});

test('actual GLB keeps the fence closed and provides the right turn at the landing', async () => {
  const geometry = await exportedGeometry;
  const hits = (origin, direction, distance) => new Raycaster(new Vector3(...origin), new Vector3(...direction), .001, distance).intersectObject(geometry, true);
  assert.ok(hits([6, .4, 6], [0, 0, -1], 1.2).length, 'Fence at classroom 4');
  assert.ok(hits([18, .4, 6], [0, 0, -1], 1.2).length, 'Rightmost door frontage stays closed');
  assert.equal(hits([16.75, .4, 6], [0, 0, -1], 1.2).length, 0, 'Single entrance beside rightmost door');
  assert.ok(hits([-2.95, 5.25, -.8], [0, 0, -1], 1.2).length, 'Classroom wall ahead of landing');
  assert.equal(hits([-2.95, 5.25, -.9], [1, 0, 0], 15.85).length, 0, 'Clear rightward walkway to hall');
});

test('camera travels through the revised exported geometry without crossing a surface', async () => {
  const geometry = await exportedGeometry;
  for (let i = 1; i < tour.keyframes.length; i += 1) {
    const start = new Vector3(...tour.keyframes[i - 1].position);
    const delta = new Vector3(...tour.keyframes[i].position).sub(start);
    const distance = delta.length();
    if (distance < .001) continue;
    const hits = new Raycaster(start, delta.normalize(), .001, distance - .001).intersectObject(geometry, true);
    assert.equal(hits.length, 0, `Camera segment ${i - 1}: ${hits[0]?.object.name}`);
  }
});

test('all four upstairs doors form real openings on the two sides of the aisle', async () => {
  const geometry = await exportedGeometry;
  for (const depth of [3.45, 6.75]) {
    for (const direction of [-1, 1]) {
      const doorway = new Raycaster(new Vector3(4.2, 5.2, -depth), new Vector3(direction, 0, 0), .001, 1);
      assert.equal(doorway.intersectObject(geometry, true).length, 0, `Door at depth ${depth}, side ${direction}`);
      const adjacentWall = new Raycaster(new Vector3(4.2, 5.2, -(depth - 1)), new Vector3(direction, 0, 0), .001, 1);
      assert.ok(adjacentWall.intersectObject(geometry, true).length, `Wall beside door at depth ${depth}, side ${direction}`);
    }
  }
});

test('revision 3 retains office identity, slender storage, and textured road', async () => {
  assert.equal(tour.roomUses.ground['1'], 'admin');
  assert.equal(tour.layout.brandingPanels, 9);
  assert.equal(tour.layout.doorRacks, 5);
  assert.ok(tour.layout.shelfDepth <= .3);
  assert.ok(tour.layout.upperRoomWidth > 2.8);
  assert.ok(tour.layout.upperRoomLengths.every((length) => length < 7));
  const source = readFileSync(new URL('../public/models/lpq-building.glb', import.meta.url));
  const data = JSON.parse(source.toString('utf8', 20, 20 + source.readUInt32LE(12)));
  for (const title of ['Logo LPQ resmi', 'Logo Qiroati resmi']) {
    assert.ok(data.materials.find((material) => material.name.startsWith(title))?.pbrMetallicRoughness.baseColorTexture);
  }
  assert.ok(data.materials.some((material) => /Aspal/.test(material.name) && material.normalTexture));
  const geometry = await exportedGeometry;
  const hits = (origin, direction, distance) => new Raycaster(new Vector3(...origin), new Vector3(...direction), .001, distance).intersectObject(geometry, true);
  assert.ok(hits([21, .4, 2.4], [-1, 0, 0], 1).length, 'Right side fence closed');
  assert.ok(hits([-1.15, .4, 2], [1, 0, 0], 1).length, 'Inner stair solid underside');
  assert.ok(hits([-2.95, .8, 2], [1, 0, 0], 1).length, 'Outer stair solid underside');
  assert.ok(hits([-4.2, 2, 2], [1, 0, 0], .6).length, 'Blue stair enclosure');
});

test('side roads and semi-outdoor return wall are present in the actual export', async () => {
  const geometry = await exportedGeometry;
  for (const x of [-6, 23]) {
    const hits = new Raycaster(new Vector3(x, 1, 0), new Vector3(0, -1, 0), .001, 1.1).intersectObject(geometry, true);
    assert.ok(hits.some((hit) => hit.object.name.includes('Aspal')), `Asphalt beside building at ${x}`);
  }
  for (const x of [10.5, 11.25, 12]) {
    const hits = new Raycaster(new Vector3(x, 5.2, -6.9), new Vector3(0, 0, -1), .001, .6).intersectObject(geometry, true);
    assert.ok(hits.length, `Rear wall joins across ${x}`);
  }
});

test('floor-one pacing removes the short high-speed corridor segment', () => {
  const officeExit = tour.keyframes.find((frame) => frame.position[0] === 18 && frame.position[2] === 1.2);
  const corridorEnd = tour.keyframes.find((frame) => frame.position[0] === 7 && frame.position[2] === 1.2);
  assert.ok(corridorEnd.progress - officeExit.progress > .07);
  assert.ok(tour.pacing.scrollViewportHeights >= 8);
  assert.ok(TOUR_STAGES.find((stage) => stage.id === 'ground').progress > .38);
});
