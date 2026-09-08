import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  G,
  R,
  DT,
  RELEASE,
  DEFAULT,
  velocity,
  ballistic,
  simulate,
  sampleFlight,
  attachedPosition,
  ballAt,
} from "../public/physics.js";
const origin = { x: -0.12, y: 2.22, z: 0.19 },
  motion = JSON.parse(
    readFileSync(new URL("../public/assets/motion.json", import.meta.url)),
  );
const near = (a, b, e = 1e-8) =>
  assert.ok(Math.abs(a - b) < e, `${a} != ${b} (tol ${e})`);
test("constant gravity matches an independent analytic value", () => {
  const p = ballistic({ x: 0, y: 2, z: 0 }, { x: 0, y: 5.95, z: 4 }, 1);
  near(p.y, 3.045);
  near(p.z, 4);
});
test("free flight uses analytic integration before contact", () => {
  const v = velocity(DEFAULT),
    sim = simulate(origin, DEFAULT);
  for (const t of [0.1, 0.3, 0.6]) {
    const p = sampleFlight(sim, t),
      truth = ballistic(origin, v, t);
    for (const k of ["x", "y", "z"]) near(p[k], truth[k], 1e-10);
  }
});
test("position and velocity remain continuous at release for changed shots", () => {
  for (const shot of [
    DEFAULT,
    { speed: 5.5, angle: 38, direction: -12 },
    { speed: 8.5, angle: 68, direction: 12 },
  ]) {
    const sim = simulate(origin, shot),
      a = attachedPosition(motion, RELEASE, shot),
      v = velocity(shot),
      epsilon = 1e-6,
      before = attachedPosition(motion, RELEASE - epsilon, shot),
      after = ballAt(motion, sim, RELEASE);
    for (const k of ["x", "y", "z"]) {
      near(a[k], origin[k]);
      near(after[k], a[k]);
      near((a[k] - before[k]) / epsilon, v[k], 0.0003);
    }
  }
});
test("default shot passes through clear rim without a contact assist", () => {
  const s = simulate(origin, DEFAULT);
  assert.equal(s.made, true);
  assert.equal(s.contacts.rim, 0);
  assert.equal(s.contacts.backboard, 0);
  assert.ok(s.contacts.support > 0);
  assert.ok(s.contacts.floor > 0);
  assert.ok(s.events.find((e) => e.kind === "through-rim").t > 0.8);
});
test("release acceleration also joins gravity without a step", () => {
  for (const shot of [DEFAULT, {speed:8.5,angle:68,direction:12}]) {
    const h=1e-5, a=attachedPosition(motion,RELEASE,shot),
      b=attachedPosition(motion,RELEASE-h,shot),c=attachedPosition(motion,RELEASE-2*h,shot),d=attachedPosition(motion,RELEASE-3*h,shot);
    // Second-order one-sided derivative avoids O(h) jerk contamination.
    for(const k of ['x','y','z']) near((2*a[k]-5*b[k]+4*c[k]-d[k])/(h*h),k==='y'?-G:0,.001);
  }
});
test("authored hands remain inside the measured arm reach", () => {
  for(const pose of motion.handChecks) assert.ok(pose.reach < .58374, `${pose.side} at ${pose.t}: ${pose.reach}`);
});
test("gather, set and launch segments have continuous velocity", () => {
  for(const t of motion.ballKeys.slice(1).map(k=>k[0])) {
    const h=1e-6,a=attachedPosition(motion,t-h),b=attachedPosition(motion,t),c=attachedPosition(motion,t+h);
    for(const k of ['x','y','z']) near((b[k]-a[k])/h,(c[k]-b[k])/h,.0001);
  }
});
test("one continuous lift has no set-point stall", () => {
  const h=1e-5;
  for(let t=.6;t<RELEASE-h;t+=1/240) {
    const a=attachedPosition(motion,t-h),b=attachedPosition(motion,t+h);
    assert.ok((b.y-a.y)/(2*h)>.75, `Lift stalled at ${t}`);
  }
  assert.equal(RELEASE,1.25);
});
test("left hand is a side guide with no forward release stroke", () => {
  assert.deepEqual(motion.guideImpulse,[0,0,0]);
  const guide=motion.handChecks.filter(x=>x.side==='L');
  for(const p of guide) {
    near(p.palmNormal[1],0,1e-6);near(p.palmNormal[2],0,1e-6);
  }
  const tail=guide.filter(x=>x.t>=motion.guideDetach);
  for(let i=1;i<tail.length;i++) assert.ok(tail[i].wrist[2] <= tail[i-1].wrist[2]+1e-6, `Guide pushed forward at ${tail[i].t}`);
});
test("rim and finite backboard respond to actual contact", () => {
  let rim = simulate(origin, { ...DEFAULT, speed: 6.8 });
  assert.ok(rim.contacts.rim > 0);
  let board = simulate(
    { x: 0, y: 3.3, z: 4.3 },
    { speed: 5.5, angle: 38, direction: 0 },
    0.2,
  );
  assert.ok(board.contacts.backboard > 0);
  let outside = simulate(
    { x: 2, y: 3.3, z: 4.3 },
    { speed: 5.5, angle: 38, direction: 0 },
    0.2,
  );
  assert.equal(outside.contacts.backboard, 0);
});
test("deterministic contact cache is stable under parameter sweep and reverse scrubbing", () => {
  for (let speed = 5.5; speed <= 8.5; speed += 0.5)
    for (let angle = 38; angle <= 68; angle += 5)
      for (const direction of [-12, 0, 12]) {
        const shot = { speed, angle, direction },
          s = simulate(origin, shot);
        for (const p of s.samples) {
          assert.ok(Number.isFinite(p.x + p.y + p.z));
          assert.ok(p.y >= R - 1e-9);
        }
        const times = [3, 0.2, 2, 0, 1];
        for (const t of times) {
          const a = sampleFlight(s, t),
            b = sampleFlight(simulate(origin, shot), t);
          assert.deepEqual(a, b);
        }
      }
});
test("court dimensions are internally consistent", () => {
  const d = JSON.parse(
    readFileSync(new URL("../public/assets/dimensions.json", import.meta.url)),
  );
  near(d.rimHeight, 10 * 0.3048);
  near(d.rimCenter[1] + d.rimTubeRadius, d.rimHeight);
  near(d.rimInsideDiameter, 18 * 0.0254);
  near(d.boardWidth, 6 * 0.3048);
  near(d.courtWidth, 50 * 0.3048);
  near(d.ballRadius, R);
  near(d.boardFrontZ - d.rimCenter[2], 0.381);
});
test("rejects malformed launch settings", () => {
  assert.throws(() =>
    simulate(origin, { speed: NaN, angle: 52, direction: 0 }),
  );
  assert.throws(() => simulate(origin, { speed: 20, angle: 52, direction: 0 }));
});
