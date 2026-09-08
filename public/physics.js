// Metres and seconds. Exact constant-gravity integration between small contact steps.
export const G = 9.81,
  R = 0.119,
  RELEASE = 1.25,
  DURATION = 6,
  DT = 1 / 600;
export const HOOP = {
  x: 0,
  y: 3.038475,
  z: 4.191,
  r: 0.238125,
  tube: 0.009525,
};
export const DEFAULT = { speed: 6.94, angle: 52, direction: 1.72 };
export function velocity(s) {
  const a = (s.angle * Math.PI) / 180,
    d = (s.direction * Math.PI) / 180;
  return {
    x: s.speed * Math.cos(a) * Math.sin(d),
    y: s.speed * Math.sin(a),
    z: s.speed * Math.cos(a) * Math.cos(d),
  };
}
export function ballistic(p, v, t) {
  return {
    x: p.x + v.x * t,
    y: p.y + v.y * t - 0.5 * G * t * t,
    z: p.z + v.z * t,
  };
}
export function validateShot(s) {
  return (
    ["speed", "angle", "direction"].every((k) => Number.isFinite(s[k])) &&
    s.speed >= 5.5 &&
    s.speed <= 8.5 &&
    s.angle >= 38 &&
    s.angle <= 68 &&
    Math.abs(s.direction) <= 12
  );
}
export function simulate(origin, shot, duration = DURATION - RELEASE) {
  if (!validateShot(shot))
    throw Error("Launch conditions outside supported limits");
  let p = { ...origin },
    v = velocity(shot),
    events = [],
    made = false,
    resting = false;
  const samples = [{ t: 0, ...p }],
    contacts = { rim: 0, backboard: 0, floor: 0, support: 0 };
  function hit(n, penetration, e, kind, t) {
    p.x += n.x * penetration;
    p.y += n.y * penetration;
    p.z += n.z * penetration;
    const vn = v.x * n.x + v.y * n.y + v.z * n.z;
    if (vn < 0) {
      v.x -= n.x * (1 + e) * vn;
      v.y -= n.y * (1 + e) * vn;
      v.z -= n.z * (1 + e) * vn;
      v.x *= 0.99;
      v.z *= 0.99;
      if (!events.some((ev) => ev.kind === kind && t - ev.t < 0.045)) {
        events.push({ t, kind, position: { ...p } });
        contacts[kind]++;
      }
    }
  }
  for (let i = 1; i <= Math.ceil(duration / DT); i++) {
    let t = i * DT,
      prev = { ...p };
    if (!resting) {
      p.x += v.x * DT;
      p.y += v.y * DT - 0.5 * G * DT * DT;
      p.z += v.z * DT;
      v.y -= G * DT;
    }
    // Sphere vs torus represented by distance to the circular steel centerline.
    let dx = p.x - HOOP.x,
      dz = p.z - HOOP.z,
      rad = Math.hypot(dx, dz);
    if (rad > 1e-8) {
      const q = {
        x: HOOP.x + (HOOP.r * dx) / rad,
        y: HOOP.y,
        z: HOOP.z + (HOOP.r * dz) / rad,
      };
      let nx = p.x - q.x,
        ny = p.y - q.y,
        nz = p.z - q.z,
        dist = Math.hypot(nx, ny, nz);
      if (dist < R + HOOP.tube && dist > 1e-8)
        hit(
          { x: nx / dist, y: ny / dist, z: nz / dist },
          R + HOOP.tube - dist,
          0.64,
          "rim",
          t,
        );
    }
    // Sphere vs finite 26 mm glass board AABB, including edges.
    const q = {
      x: Math.max(-0.9144, Math.min(0.9144, p.x)),
      y: Math.max(3.048, Math.min(4.1148, p.y)),
      z: Math.max(4.572, Math.min(4.598, p.z)),
    };
    dx = p.x - q.x;
    let dy = p.y - q.y;
    dz = p.z - q.z;
    let dist = Math.hypot(dx, dy, dz);
    if (dist < R && dist > 1e-8)
      hit(
        { x: dx / dist, y: dy / dist, z: dz / dist },
        R - dist,
        0.72,
        "backboard",
        t,
      );
    // Rubber safety pad on the basket support, so a swish cannot pass through it.
    const pad = {
      x: Math.max(-0.2, Math.min(0.2, p.x)),
      y: Math.max(0.12, Math.min(1.92, p.y)),
      z: Math.max(6.185, Math.min(6.64, p.z)),
    };
    dx = p.x - pad.x;
    dy = p.y - pad.y;
    dz = p.z - pad.z;
    dist = Math.hypot(dx, dy, dz);
    if (dist < R && dist > 1e-8)
      hit(
        { x: dx / dist, y: dy / dist, z: dz / dist },
        R - dist,
        0.35,
        "support",
        t,
      );
    if (p.y < R) {
      hit({ x: 0, y: 1, z: 0 }, R - p.y, 0.72, "floor", t);
      if (Math.abs(v.y) < 0.13) {
        resting = true;
        v = { x: 0, y: 0, z: 0 };
      }
    }
    if (
      !made &&
      prev.y > HOOP.y &&
      p.y <= HOOP.y &&
      v.y < 0 &&
      Math.hypot(p.x, p.z - HOOP.z) < 0.2286 - R
    ) {
      made = true;
      events.push({ t, kind: "through-rim", position: { ...p } });
    }
    samples.push({ t, ...p });
  }
  return { samples, events, contacts, made, shot: { ...shot } };
}
export function sampleFlight(sim, t) {
  let f = Math.max(0, Math.min(sim.samples.length - 1, t / DT)),
    i = Math.floor(f),
    u = f - i,
    a = sim.samples[i],
    b = sim.samples[Math.min(i + 1, sim.samples.length - 1)];
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    z: a.z + (b.z - a.z) * u,
  };
}
export function quintic(p0,v0,a0,p1,v1,a1,span,u) {
  u=Math.max(0,Math.min(1,u));
  const c0=p0,c1=v0*span,c2=a0*span*span/2,
    d=p1-c0-c1-c2,dv=v1*span-c1-2*c2,da=a1*span*span-2*c2;
  return c0+c1*u+c2*u*u+(10*d-4*dv+da/2)*u**3
    +(-15*d+7*dv-da)*u**4+(6*d-3*dv+da/2)*u**5;
}
export function attachedPosition(motion, t, shot = DEFAULT) {
  if (motion.approachStart !== undefined && t >= motion.approachStart) {
    const span = RELEASE - motion.approachStart,
      u = Math.min(1, (t - motion.approachStart) / span),
      a = motion.approachPosition,
      b = motion.ballTrack[Math.round(motion.release * motion.fps)],
      v = velocity(shot);
    const axis = (i, endVelocity, endAcceleration) => quintic(a[i],motion.approachVelocity[i],motion.approachAcceleration[i],b[i],endVelocity,endAcceleration,span,u);
    return {
      x: axis(0, v.x, 0),
      y: axis(1, v.y, -G),
      z: axis(2, v.z, 0),
    };
  }
  if(motion.ballKeys) {
    const keys=motion.ballKeys;
    for(let i=1;i<keys.length;i++) if(t<=keys[i][0]) {
      const [a,p,v,acc]=keys[i-1],[b,q,w,dd]=keys[i],span=b-a,u=(t-a)/span;
      return Object.fromEntries(['x','y','z'].map((k,j)=>[k,quintic(p[j],v[j],acc[j],q[j],w[j],dd[j],span,u)]));
    }
  }
  let f = Math.max(0, Math.min(RELEASE * 60, t * 60)),
    i = Math.floor(f),
    u = f - i,
    a = motion.ballTrack[i],
    b = motion.ballTrack[Math.min(i + 1, Math.round(RELEASE * 60))];
  return {
    x: a[0] + (b[0] - a[0]) * u,
    y: a[1] + (b[1] - a[1]) * u,
    z: a[2] + (b[2] - a[2]) * u,
  };
}
export function ballAt(motion, sim, t) {
  return t < RELEASE
    ? attachedPosition(motion, t, sim.shot)
    : sampleFlight(sim, t - RELEASE);
}
