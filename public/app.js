import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { solveArm, basis } from "./anatomy.js";
import {
  DEFAULT,
  RELEASE,
  DURATION,
  R,
  HOOP,
  simulate,
  ballAt,
  attachedPosition,
  validateShot,
} from "./physics.js";
const $ = (s) => document.querySelector(s),
  vec = (x, y, z) => new THREE.Vector3(x, y, z);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x273f50, 0.025);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$("#viewport").append(renderer.domElement);
const camera = new THREE.PerspectiveCamera(
  42,
  innerWidth / innerHeight,
  0.05,
  220,
);
camera.position.set(-5.3, 2.55, -6.2);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1.6, 1.4);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.minDistance = 1.1;
orbit.maxDistance = 24;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.enabled = false;
orbit.update();
const composer = new EffectComposer(renderer);
composer.renderTarget1.samples = 4;
composer.renderTarget2.samples = 4;
composer.addPass(new RenderPass(scene, camera));
const ao = new SSAOPass(scene, camera, innerWidth, innerHeight, 16);
ao.kernelRadius = 0.16;
ao.minDistance = 0.0001;
ao.maxDistance = 0.0015;
composer.addPass(ao);
const bloom = new UnrealBloomPass(
  vec(innerWidth, innerHeight, 0),
  0.25,
  0.5,
  1.2,
);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const hemi = new THREE.HemisphereLight(0x94bcde, 0x202d2b, 0.3);
scene.add(hemi);
const fill = new THREE.DirectionalLight(0x9fceff, 0.65);
fill.position.set(4, 7, -2);
scene.add(fill);
function spot(x, z, power, shadow) {
  const l = new THREE.SpotLight(0xffc28a, power, 30, Math.PI * 0.22, 0.8, 1.5);
  l.position.set(x, 7.1, z);
  l.target.position.set(x * 0.17, 0.5, z * 0.45);
  l.castShadow = shadow;
  if (shadow) {
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.03;
    l.shadow.camera.near = 0.5;
    l.shadow.camera.far = 22;
    l.shadow.focus = 1;
  }
  scene.add(l, l.target);
  return l;
}
spot(-6.4, 3.5, 70, true);
spot(6.4, -6, 65, true);
spot(6.4, 3.5, 54, false);
spot(-6.4, -6, 45, false);
const key = new THREE.SpotLight(0xffc896, 15, 14, 0.8, 0.75, 1.5);
key.position.set(-3, 4, 1);
key.target.position.set(0, 1.2, 0);
scene.add(key, key.target);
// Sky gradient preserves blue-hour exposure independently of environment reflections.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(150, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader:
      "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec3 p;void main(){float h=normalize(p).y;vec3 c=mix(vec3(.018,.041,.067),vec3(.003,.011,.027),smoothstep(-.05,.65,h));gl_FragColor=vec4(c,1.);}",
  }),
);
scene.add(sky);
const loader = new GLTFLoader();
let mixer,
  athlete,
  net = [],
  motion,
  sim,
  time = 0,
  playing = false,
  rate = 1,
  cameraMode = "cinematic",
  shot = { ...DEFAULT },
  trajectory,
  bones = {},
  animationOffset = 0;
const windClock = { value: 0 };
let previousAdapt = [];
const knit = new THREE.TextureLoader().load("/assets/knit-normal.png");
knit.wrapS = knit.wrapT = THREE.RepeatWrapping;
knit.repeat.set(8, 8);
const states = { errors: [], frames: [], renderMs: [], ready: false };
window.addEventListener("error", (e) => states.errors.push(e.message));
try {
  const stored = JSON.parse(
    localStorage.getItem("after-rain-shot-v1") || "null",
  );
  if (stored && validateShot(stored)) shot = stored;
} catch {}
const toast = (message) => {
  $("#toast").textContent = message;
  $("#toast").style.opacity = 1;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").style.opacity = 0), 2500);
};
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,212,154,.8)");
  g.addColorStop(0.12, "rgba(255,192,120,.35)");
  g.addColorStop(0.4, "rgba(255,183,107,.08)");
  g.addColorStop(1, "rgba(255,181,98,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const glow = glowTexture();
for (const [x, z] of [
  [-6.4, 3.5],
  [6.4, 3.5],
  [-6.4, -6],
  [6.4, -6],
]) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow,
      color: 0xffd5a0,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.5,
    }),
  );
  s.position.set(x, 7.12, z);
  s.scale.set(2.7, 2.7, 1);
  scene.add(s);
}
for (const x of [-3.7, 4.8]) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow,
      color: 0xffc183,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85,
    }),
  );
  s.position.set(x, 4.6, 10.5);
  s.scale.set(2.2, 2.2, 1);
  scene.add(s);
  const light = new THREE.PointLight(0xffb978, 10, 8, 2);
  light.position.copy(s.position);
  scene.add(light);
}
// One reflection pass for irregular, shallow puddles. No full mirror court.
const shader = {
  ...Reflector.ReflectorShader,
  uniforms: THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),
};
shader.vertexShader = shader.vertexShader
  .replace("varying vec4 vUv;", "varying vec4 vUv; varying vec3 vWorld;")
  .replace(
    "vUv = textureMatrix",
    "vWorld = (modelMatrix * vec4(position,1.)).xyz; vUv = textureMatrix",
  );
shader.fragmentShader = shader.fragmentShader
  .replace(
    "varying vec4 vUv;",
    "varying vec4 vUv; varying vec3 vWorld;\nfloat hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}",
  )
  .replace(
    "vec4 base = texture2DProj( tDiffuse, vUv );",
    "vec4 vv=vUv;float n=noise(vWorld.xz*1.15)*.7+noise(vWorld.xz*3.7)*.3;vv.x+=sin(vWorld.z*100.)*.00008*vv.w;vec4 base=texture2DProj(tDiffuse,vv);",
  )
  .replace(
    "gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );",
    "float pool=exp(-pow((vWorld.x+4.1)/.48,2.)-pow((vWorld.z-.5)/1.15,2.));float mask=max(smoothstep(.65,.76,n),pool*.75);float lane=1.-.75*(1.-smoothstep(2.35,2.6,abs(vWorld.x)))*(1.-smoothstep(0.,.3,-vWorld.z));gl_FragColor=vec4(base.rgb*.8,mask*.45*lane);",
  );
const wet = new Reflector(new THREE.PlaneGeometry(15.22, 28.63), {
  textureWidth: 1024,
  textureHeight: 1024,
  color: 0x60777a,
  clipBias: 0.003,
  shader,
  multisample: 0,
});
wet.rotation.x = -Math.PI / 2;
wet.position.set(0, 0.012, -8.535);
wet.material.transparent = true;
wet.material.depthWrite = false;
wet.renderOrder = 2;
const reflectRender = wet.onBeforeRender;
wet.onBeforeRender = function (...args) {
  if (scene.overrideMaterial) return;
  reflectRender.apply(this, args);
};
scene.add(wet);
function makeBall() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#b9672d";
  ctx.fillRect(0, 0, 1024, 512);
  let seed = 71;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 53000; i++) {
    let x = rand() * 1024,
      y = rand() * 512;
    ctx.fillStyle = rand() > 0.5 ? "#ca7d3b" : "#8e4523";
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + rand() * 0.75, 0, 7);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const group = new THREE.Group(),
    ball = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 40),
      new THREE.MeshStandardMaterial({
        map: tex,
        bumpMap: tex,
        bumpScale: 0.00065,
        roughness: 0.83,
        color: 0xffffff,
      }),
    );
  ball.castShadow = true;
  group.add(ball);
  const seam = new THREE.MeshStandardMaterial({
    color: 0x1d1b17,
    roughness: 0.9,
  });
  for (let axis = 0; axis < 3; axis++) {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.997, 0.0017, 6, 128),
      seam,
    );
    if (axis === 1) t.rotation.x = Math.PI / 2;
    if (axis === 2) t.rotation.y = Math.PI / 2;
    group.add(t);
  }
  return group;
}
const ball = makeBall();
scene.add(ball);
function mergeStatic(root) {
  const buckets = new Map();
  root.updateMatrixWorld(true);
  const remove = [];
  root.traverse((o) => {
    if (
      !o.isMesh ||
      o.name.startsWith("Net") ||
      o.material.transparent ||
      o.material.transmission > 0.1
    )
      return;
    const key = o.material.uuid;
    if (!buckets.has(key))
      buckets.set(key, {
        material: o.material,
        geo: [],
        name: o.material.name,
      });
    let g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute("tangent");
    g.deleteAttribute("color");
    g.deleteAttribute("uv1");
    if (!g.getAttribute("uv"))
      g.setAttribute(
        "uv",
        new THREE.BufferAttribute(
          new Float32Array(g.getAttribute("position").count * 2),
          2,
        ),
      );
    buckets.get(key).geo.push(g);
    remove.push(o);
  });
  for (const b of buckets.values()) {
    try {
      const g = mergeGeometries(b.geo, false);
      if (g) {
        const m = new THREE.Mesh(g, b.material);
        m.name = "Static / " + b.name;
        m.castShadow =
          !/asphalt|paint|ground|foliage|petrol key|Perimeter concrete/i.test(
            b.name,
          );
        m.receiveShadow = true;
        scene.add(m);
      }
    } catch (e) {
      states.errors.push("Merge: " + e.message);
    }
  }
  for (const o of remove) o.removeFromParent();
}
async function boot() {
  const [a, c, m, hdr] = await Promise.all([
    loader.loadAsync("/assets/athlete.glb"),
    loader.loadAsync("/assets/court.glb"),
    fetch("/assets/motion.json").then((r) => r.json()),
    new RGBELoader().loadAsync("/assets/dusk.hdr"),
  ]);
  motion = m;
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr;
  scene.environmentIntensity = 0.2;
  athlete = a.scene;
  athlete.name = "Synthetic athlete";
  athlete.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (o.material) {
        o.material.envMapIntensity = 0.3;
        if (/skin/i.test(o.material.name)) {
          o.material.roughness = 0.58;
        }
        if (/knit|woven/i.test(o.material.name)) {
          o.material.normalMap = knit;
          o.material.normalScale.set(0.25, 0.25);
        }
        if (/canvas/i.test(o.material.name)) {
          o.material.color.set(0xf3efe0);
        }
      }
    }
  });
  scene.add(athlete);
  mixer = new THREE.AnimationMixer(athlete);
  for (const clip of a.animations) {
    const ac = mixer.clipAction(clip);
    ac.setLoop(THREE.LoopOnce, 1);
    ac.clampWhenFinished = true;
    ac.play();
  }
  c.scene.updateMatrixWorld(true);
  let asphaltSource;
  c.scene.traverse((o) => {
    if (o.isMesh && /asphalt/i.test(o.material.name))
      asphaltSource = o.material;
  });
  c.scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.name.startsWith("Net")) {
        const base = o.geometry.attributes.position.array.slice(),
          weights = [];
        for (let i = 0; i < o.geometry.attributes.position.count; i++) {
          const v = new THREE.Vector3()
            .fromBufferAttribute(o.geometry.attributes.position, i)
            .applyMatrix4(o.matrixWorld);
          weights.push(Math.min(1, Math.max(0, (3.0285 - v.y) / 0.43)) ** 2);
        }
        net.push({ o, base, weights, inverse: o.matrixWorld.clone().invert() });
      }
      if (/petrol key/i.test(o.material.name)) {
        const pos = o.geometry.attributes.position,
          uv = [];
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3()
            .fromBufferAttribute(pos, i)
            .applyMatrix4(o.matrixWorld);
          uv.push(v.x * 0.5, v.z * 0.5);
        }
        o.geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        o.material.map = asphaltSource.map;
        o.material.normalMap = asphaltSource.normalMap;
        o.material.normalScale.set(0.25, 0.25);
        o.material.color.set(0x7bada5);
        o.material.roughness = 0.74;
      }
      if (/glass/i.test(o.material.name)) {
        o.material.transmission = 0;
        o.material.transparent = true;
        o.material.opacity = 0.17;
        o.material.roughness = 0.08;
        o.material.depthWrite = false;
        o.material.color.set(0x94b7bd);
      }
      if (/Distant concrete/i.test(o.material.name)) {
        o.material.color.set(0x253c4a);
        o.castShadow = false;
      }
      if (/asphalt/i.test(o.material.name)) {
        o.material.color.set(0x344851);
        o.material.roughness = 0.67;
        o.material.normalScale.set(0.5, 0.5);
      }
      if (/foliage/i.test(o.material.name)) {
        o.material.side = THREE.DoubleSide;
        o.material.color.set(0x60756e);
        o.castShadow = false;
        o.material.onBeforeCompile = (s) => {
          s.uniforms.windClock = windClock;
          s.vertexShader = "uniform float windClock;\n" + s.vertexShader;
          s.vertexShader = s.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\ntransformed.x+=sin(position.z*.4+position.y*.9+windClock*.75)*.045;",
          );
        };
      }
      if (/court paint/i.test(o.material.name)) {
        o.material.color.set(0xb5c5c6);
        o.castShadow = false;
      }
      for (const map of [o.material.map, o.material.normalMap])
        if (map) map.anisotropy = 8;
    }
  });
  scene.add(c.scene);
  mergeStatic(c.scene);
  animationOffset = Math.min(
    ...a.animations.flatMap((c) => c.tracks.map((t) => t.times[0])),
  );
  rebuild();
  syncControls();
  setTime(0);
  states.ready = true;
  $("#loading").style.opacity = 0;
  setTimeout(() => $("#loading").remove(), 750);
  render();
}
function rebuild() {
  if (!motion) return;
  const p = motion.ballTrack[Math.round(motion.release * motion.fps)];
  sim = simulate({ x: p[0], y: p[1], z: p[2] }, shot);
  if (trajectory) {
    scene.remove(trajectory);
    trajectory.geometry.dispose();
    trajectory.material.dispose();
  }
  const points = sim.samples
    .filter((p, i) => i % 12 === 0 && p.t < 1.7)
    .map((p) => vec(p.x, p.y, p.z));
  trajectory = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color: 0xf2c18c,
      dashSize: 0.07,
      gapSize: 0.045,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
    }),
  );
  trajectory.computeLineDistances();
  trajectory.visible = $("#trajectory").checked;
  scene.add(trajectory);
  localStorage.setItem("after-rain-shot-v1", JSON.stringify(shot));
  updateOutcome();
}
function phase() {
  return time < 0.30
    ? "GATHER"
    : time < 0.95
      ? "LIFT"
      : time < 1.15
        ? "SET → EXTEND"
        : time < RELEASE
          ? "EXTEND"
          : time < RELEASE + 0.28
            ? "RELEASE"
            : "HOLD THE FINISH";
}
function updateOutcome() {
  if (!sim) return;
  const events = sim.events.filter((e) => e.t <= time - RELEASE);
  $("#outcome").textContent =
    time < RELEASE
      ? "Ready to release"
      : events.some((e) => e.kind === "through-rim")
        ? "Through the rim"
        : events.some((e) => e.kind === "rim")
          ? "Rim contact"
          : events.some((e) => e.kind === "backboard")
            ? "Backboard contact"
            : events.some((e) => e.kind === "floor")
              ? "Floor contact"
              : "Ball in flight";
}
function syncControls() {
  for (const k of ["speed", "angle", "direction"]) $("#" + k).value = shot[k];
  $("#speed-value").innerHTML = shot.speed.toFixed(2) + " <small>m/s</small>";
  $("#angle-value").innerHTML = shot.angle.toFixed(1) + "<small>°</small>";
  $("#direction-value").innerHTML =
    (shot.direction >= 0 ? "+" : "") +
    shot.direction.toFixed(2) +
    "<small>°</small>";
}
function cinematic(t) {
  const u = Math.min(1, t / 6),
    ease = u * u * (3 - 2 * u);
  camera.position.set(-4.3 + 0.5 * ease, 2.3 + 0.5 * ease, -4.6 + 1.5 * ease);
  const target = vec(0, 1.65 + 0.3 * ease, 1.6 + 0.35 * ease);
  camera.lookAt(target);
  camera.fov = 38;
  camera.updateProjectionMatrix();
}
function adaptHand(offset, side = "R") {
  if (offset.lengthSq() < 1e-12) return;
  athlete.updateMatrixWorld(true);
  const names = [
      "upperarm01",
      "upperarm02",
      "lowerarm01",
      "lowerarm02",
      "wrist",
    ].map((n) => n + side),
    old = names.map((n) => bones[n].matrixWorld.clone());
  for (const n of names) {
    const b = bones[n];
    previousAdapt.push({
      b,
      p: b.position.clone(),
      q: b.quaternion.clone(),
      s: b.scale.clone(),
    });
  }
  const a = new THREE.Vector3().setFromMatrixPosition(old[0]),
    e = new THREE.Vector3().setFromMatrixPosition(old[2]),
    w = new THREE.Vector3().setFromMatrixPosition(old[4]),
    target = w.clone().add(offset);
  const h=bones['finger3-1'+side].getWorldPosition(new THREE.Vector3()).sub(w).normalize();
  const across=bones['finger2-1'+side].getWorldPosition(new THREE.Vector3()).sub(bones['finger5-1'+side].getWorldPosition(new THREE.Vector3()));
  const normal=h.clone().cross(across).normalize().multiplyScalar(side==='R'?-1:1);
  // Same anatomical elbow-swivel objective as the Blender authoring script.
  const ee=solveArm(a,target,e.distanceTo(a),w.distanceTo(e),vec(side==='R'?.08:.45,-1,.45),h,normal,side);
  const u=e.clone().sub(a).normalize(),f=w.clone().sub(e).normalize(),uu=ee.clone().sub(a).normalize(),ff=target.clone().sub(ee).normalize();
  const q1=new THREE.Quaternion().setFromRotationMatrix(basis(uu,uu.clone().cross(ff)).multiply(basis(u,u.clone().cross(f)).invert()));
  const p0=normal.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(h,f));
  const p1=normal.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(h,ff));
  const q2=new THREE.Quaternion().setFromRotationMatrix(basis(ff,p1).multiply(basis(f,p0).invert()));
  const transform = (from, to, q) =>
    new THREE.Matrix4()
      .makeTranslation(...to.toArray())
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
      .multiply(
        new THREE.Matrix4().makeTranslation(...from.clone().negate().toArray()),
      );
  const upper = transform(a, a, q1),
    lower = transform(e, ee, q2);
  for (let i = 0; i < 5; i++) {
    const b = bones[names[i]],
      desired =
        i < 2
          ? upper.clone().multiply(old[i])
          : i < 4
            ? lower.clone().multiply(old[i])
            : old[i].clone().setPosition(target);
    b.parent.updateWorldMatrix(true, false);
    b.matrix.copy(b.parent.matrixWorld).invert().multiply(desired);
    b.matrix.decompose(b.position, b.quaternion, b.scale);
    b.updateMatrixWorld(true);
  }
}
function setTime(t) {
  time = Math.max(0, Math.min(DURATION, t));
  windClock.value = time;
  if (mixer) {
    for (const { b, p, q, s } of previousAdapt) {
      b.position.copy(p);
      b.quaternion.copy(q);
      b.scale.copy(s);
    }
    previousAdapt = [];
    mixer.setTime(time + animationOffset);
    if (
      motion.approachStart !== undefined &&
      time >= motion.approachStart &&
      time < RELEASE
    ) {
      const actual = attachedPosition(motion, time, shot),
        authored = attachedPosition(motion, time, DEFAULT),
        offset = vec(
          actual.x - authored.x,
          actual.y - authored.y,
          actual.z - authored.z,
        );
      adaptHand(offset);
      // Guide is already detached: launch edits must never add a left-hand push.
    }
    const p = ballAt(motion, sim, time);
    ball.position.set(p.x, p.y, p.z);
    ball.rotation.set(time < RELEASE ? 0 : -(time - RELEASE) * 9, 0.2, 0.08);
    const ev = sim.events.find((e) => e.kind === "through-rim");
    const d = ev ? time - RELEASE - ev.t : -1;
    for (const n of net) {
      const shift = new THREE.Vector3(
        d > 0 && d < 2 ? Math.sin(d * 17) * 0.026 * Math.exp(-d * 2.8) : 0,
        0,
        d > 0 && d < 2 ? Math.sin(d * 13) * 0.035 * Math.exp(-d * 2.6) : 0,
      );
      const zero = new THREE.Vector3().applyMatrix4(n.inverse);
      shift.applyMatrix4(n.inverse).sub(zero);
      const attr = n.o.geometry.attributes.position;
      for (let i = 0; i < attr.count; i++)
        attr.setXYZ(
          i,
          n.base[i * 3] + shift.x * n.weights[i],
          n.base[i * 3 + 1] + shift.y * n.weights[i],
          n.base[i * 3 + 2] + shift.z * n.weights[i],
        );
      attr.needsUpdate = true;
    }
  }
  if (cameraMode === "cinematic") cinematic(time);
  $("#timeline").value = time;
  $("#timeline").style.setProperty("--progress", (time / 6) * 100 + "%");
  $("#time").textContent = time.toFixed(2).padStart(5, "0");
  $("#phase").textContent = phase();
  updateOutcome();
}
function play(value = !playing) {
  playing = value;
  if (playing && time >= DURATION) setTime(0);
  $("#play-text").textContent = playing ? "Pause" : "Play shot";
  $("#play-icon").textContent = playing ? "Ⅱ" : "▶";
  $("#play").setAttribute("aria-label", playing ? "Pause shot" : "Play shot");
}
function mode(value) {
  cameraMode = value;
  orbit.enabled = value === "orbit";
  document
    .querySelectorAll("[data-camera]")
    .forEach((b) => b.classList.toggle("active", b.dataset.camera === value));
  if (value === "side") {
    camera.position.set(-4.8, 1.75, 0.7);
    camera.lookAt(0, 1.35, 0.55);
    camera.fov = 39;
  } else if (value === "front") {
    camera.position.set(0, 1.65, 4.0);
    camera.lookAt(0, 1.2, 0.1);
    camera.fov = 38;
  } else if (value === "orbit") {
    orbit.target.set(0, 1.6, 1.4);
    orbit.update();
  } else cinematic(time);
  camera.updateProjectionMatrix();
  $("#camera-hint").textContent =
    value === "orbit"
      ? "DRAG orbit · SCROLL zoom · RIGHT-DRAG pan"
      : "SPACE play · H hide interface";
}
function present(value) {
  document.body.classList.toggle(
    "presentation",
    value ?? !document.body.classList.contains("presentation"),
  );
}
$("#play").onclick = () => play();
$("#restart").onclick = () => {
  setTime(0);
  play(true);
};
$("#timeline").addEventListener("input", (e) => {
  play(false);
  setTime(Number(e.target.value));
});
$("#presentation").onclick = () => present();
for (const k of ["speed", "angle", "direction"])
  $("#" + k).addEventListener("input", (e) => {
    shot[k] = Number(e.target.value);
    syncControls();
    rebuild();
    setTime(time);
  });
$("#reset").onclick = () => {
  shot = { ...DEFAULT };
  rate = 1;
  document
    .querySelectorAll("[data-rate]")
    .forEach((b) => b.classList.toggle("active", b.dataset.rate === "1"));
  $("#trajectory").checked = false;
  rebuild();
  syncControls();
  play(false);
  setTime(0);
  mode("cinematic");
  toast("Default shot restored");
};
$("#trajectory").onchange = () =>
  (trajectory.visible = $("#trajectory").checked);
document
  .querySelectorAll("[data-camera]")
  .forEach((b) => (b.onclick = () => mode(b.dataset.camera)));
document.querySelectorAll("[data-rate]").forEach(
  (b) =>
    (b.onclick = () => {
      rate = Number(b.dataset.rate);
      document
        .querySelectorAll("[data-rate]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }),
);
$("#collapse").onclick = () => {
  $("#settings").classList.toggle("collapsed");
  $("#collapse").textContent = $("#settings").classList.contains("collapsed")
    ? "+"
    : "−";
};
$("#about").onclick = () => $("#info").showModal();
$("#close-info").onclick = () => $("#info").close();
$("#save").onclick = () => {
  const data = {
    schema: "after-rain-shot",
    version: 1,
    launch: shot,
    description: "Hypothetical launch conditions; authored synthetic athlete.",
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = "after-rain-shot.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Shot settings saved");
};
$("#open").onclick = () => $("#file").click();
$("#file").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10000) throw Error("Shot file is too large");
    const j = JSON.parse(await f.text());
    if (
      j.schema !== "after-rain-shot" ||
      j.version !== 1 ||
      !validateShot(j.launch)
    )
      throw Error("Unsupported shot file");
    shot = {
      speed: j.launch.speed,
      angle: j.launch.angle,
      direction: j.launch.direction,
    };
    rebuild();
    syncControls();
    setTime(0);
    play(false);
    toast("Shot opened");
  } catch (err) {
    toast(err.message);
  } finally {
    e.target.value = "";
  }
};
addEventListener("keydown", (e) => {
  if ($("#info").open) return;
  if (e.target.matches("input,button") && e.code === "Space") return;
  if (e.code === "Space") {
    e.preventDefault();
    play();
  }
  if (e.key.toLowerCase() === "r") {
    setTime(0);
    play(true);
  }
  if (e.key.toLowerCase() === "h") present();
  if (e.key === "Escape") present(false);
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
let last = performance.now(),
  fpsStart = last,
  frames = 0;
function render(now = performance.now()) {
  requestAnimationFrame(render);
  if (!states.ready) return;
  const delta = (now - last) / 1000;
  last = now;
  if (playing) {
    setTime(time + delta * rate);
    if (time >= DURATION) play(false);
  }
  if (orbit.enabled) orbit.update();
  const begin = performance.now();
  composer.render();
  states.renderMs.push(performance.now() - begin);
  states.frames.push(delta * 1000);
  if (states.frames.length > 720) {
    states.frames.shift();
    states.renderMs.shift();
  }
  frames++;
  if (now - fpsStart > 1000) {
    $("#fps").textContent =
      Math.round((frames * 1000) / (now - fpsStart)) + " FPS / LOCAL";
    frames = 0;
    fpsStart = now;
  }
}
window.lab = {
  get ready() {
    return states.ready;
  },
  get time() {
    return time;
  },
  get playing() {
    return playing;
  },
  get rate() {
    return rate;
  },
  get shot() {
    return { ...shot };
  },
  get simulation() {
    return sim;
  },
  get motion() {
    return motion;
  },
  get cameraMode() {
    return cameraMode;
  },
  get stats() {
    return {
      frameMs: states.frames,
      renderMs: states.renderMs,
      errors: states.errors,
      renderer: renderer
        .getContext()
        .getParameter(
          renderer.getContext().getExtension("WEBGL_debug_renderer_info")
            ?.UNMASKED_RENDERER_WEBGL || renderer.getContext().RENDERER,
        ),
    };
  },
  seek: setTime,
  play,
  mode,
  present,
  setShot(s) {
    if (!validateShot(s)) throw Error("Invalid shot");
    shot = { ...s };
    syncControls();
    rebuild();
    setTime(time);
  },
  setCamera(p, t, fov = 42) {
    cameraMode = "custom";
    orbit.enabled = false;
    camera.position.fromArray(p);
    camera.lookAt(vec(...t));
    camera.fov = fov;
    camera.updateProjectionMatrix();
  },
  renderFrame(t, format = "image/png") {
    play(false);
    setTime(t);
    composer.render();
    return renderer.domElement.toDataURL(format, 0.96);
  },
  get joints() {
    athlete.updateMatrixWorld(true);
    let j = {};
    athlete.traverse((o) => {
      if (o.isBone)
        j[o.name] = o.getWorldPosition(new THREE.Vector3()).toArray();
    });
    return j;
  },
  get canvas() {
    return renderer.domElement;
  },
};
boot().catch((e) => {
  states.errors.push(e.stack);
  $("#load-message").textContent = "Could not load the scene. " + e.message;
  console.error(e);
});
Object.defineProperties(window.lab, {
  ballPosition: { get: () => ball.position.toArray() },
  meshes: {
    get: () => {
      const list = [];
      athlete.traverse((o) => {
        if (o.isMesh) list.push(o);
      });
      return list;
    },
  },
});
