# Verification

Hand-animation revisions tested locally on 8 September 2026. This is an authored demonstration, not a claim of photorealism or biomechanical validation.

## Latest anatomy revision — focused checks only

This revision changes the authored motion and arm solver, not the rendering or post-release collision model. The six targeted release/lift/guide/arm-reach tests were rerun. Actual exported joint landmarks are sampled over 361 clip frames plus 104 samples spanning the release-adaptation window for eight extreme launch combinations. The configured angular bounds, arm lengths, planted feet, and guide withdrawal pass; see [the current anatomy report](validation/anatomy/report.json) and [definitions/limitations](ANATOMY.md). Both hands are also checked against actual skinned vertices at 17 times, including dense release samples. Front/side screenshots are inspected at gather, lift, set, release and finish.

The rendering benchmark, full UI suite, collision sweep and archive extraction tests below are **historical checks from the earlier delivery**, not rerun for this focused revision. Existing local ZIP archives also predate it until regenerated. Do not interpret the older performance numbers as a new measurement of this revision.

## Machine and rendering

MacBook Air, Apple M4 (10 CPU / 10 GPU cores), 16 GB unified memory, Metal 4. Blender 5.2.1 LTS uses Cycles with Metal, denoising, and 32 samples for the inspected native still. The interactive viewer uses Three.js 0.185.0 with Chrome 152.0.7977.77 / ANGLE Metal. No cloud rendering service was used.

The standalone benchmark runs 12 seconds of repeated shot playback after a three-second warmup, with no concurrent project rendering or screenshot capture. It measures requestAnimationFrame wall-clock intervals, not GPU timestamp queries. The detailed, timestamped result is in `validation/performance.json`.

| Render resolution | Average FPS | Mean frame time | 95th-percentile frame time |
| --- | ---: | ---: | ---: |
| 1920 × 1080 | 15.0 | 66.85 ms | 83.5 ms |
| 2160 × 1350 (1440 × 900 viewport, DPR 1.5) | 13.2 | 75.83 ms | 84.2 ms |

These are measured results, not a 60 FPS guarantee. Window size, thermal state, battery mode, and other apps affect performance. The MP4 is deterministically rendered at 30 fps independently of live frame rate. Mobile layout was checked; mobile GPU performance and Safari were not tested.

This September 8 run was substantially slower than the September 7 baseline (47.9 FPS at 1080p / 36.8 FPS at 2160 × 1350). A separate same-session, foreground 1080p A/B test measured 15.4 FPS with the original athlete export and 15.7 FPS with the hand revision; render submission averaged 7.0 and 6.6 ms respectively. The slowdown therefore also occurs with the old animation. AC power and low-power mode off were confirmed; macOS reported no thermal warning. Its cause is not established, and system settings were not changed. See `validation/motion-performance-comparison.json`. Smooth authored motion does not guarantee smooth real-time display at these current frame rates.

## Earlier delivery checks

- Thirteen physics/motion-contract tests: gravity, C1/C2 release continuity, continuous lift without a set-point stall, guide palm restricted to lateral alignment and no forward wrist movement after detach, arm reach, contacts, dimensions, malformed inputs and deterministic scrubbing. The stability sweep covers 147 launch settings.
- Fifteen headed browser checks: play/pause; scrub; quarter speed; launch controls; same-time edits without rig drift; launch changes leave the detached guide hand unchanged; orbit/zoom; JSON save; refresh recovery; reset/open; invalid import rejection; presentation/Esc; camera presets/restart; six-second playback/stop; 390 × 844 layout. See `validation/browser-results.json`.
- 361 sampled poses across the entire clip: finite ball/joint positions, fixed foot joints, and constant tested limb segment lengths within 1 mm tolerance. Final numerical variations are much smaller than that tolerance. See `validation/motion-audit.json`.
- Seventeen detailed times for BOTH hands (34 records): skinned vertex distance, palmar-facing direction, sole height, and toe clearance. Both palms face the ball during contact. Gather/lift surface gaps are near zero; dense release samples show up to 4.4 mm overlap and 2.3 mm separation at the right fingers. Tolerances are 5 mm overlap / 6 mm gap, with guide separation allowed after withdrawal. These are nearest-vertex checks, not exhaustive triangle contacts or anatomical validation. See `validation/contact-audit.json`.
- The Blender file is reopened in a fresh background process. Rig/action, 60 fps timeline, 361 frames, three cameras, six packed image assets, actual evaluated court/board/rim/ball dimensions, and sampled default ball flight are checked. See `validation/blender-reopen.json`.
- Film verification decodes all 600 frames, confirms 20 seconds at 1920 × 1080 / 30 fps, and checks all three stills at 1920 × 1080. Actual-video contact sheets cover the complete film and a denser release interval. See `validation/media-results.json`.
- The project ZIP is extracted into a fresh temporary directory and launched on a separate local port using only its bundled browser assets. It boots, produces the default through-rim result, and makes zero external network requests. Scene, video, all stills, source script and Three.js license are present. See `validation/package-results.json`.

## Visual review and corrections

Actual Cycles renders and browser screenshots were inspected from courtside, front and side at settle, load, gather, extension, release and follow-through. One independent reviewer compared successive screenshots against `VISUAL_TARGET.md`.

Corrections included skeleton export/dependency updates, glTF timing alignment, foot anchoring, leg overextension, stance clearance behind the line, late hand/ball alignment, guide-hand separation, shoulder deformation, clothing edge cleanup, continuous socks and lighter footwear, glass visibility, wet asphalt normals/reflections, motivated warm lamps, and softer background transitions. The native renderer and browser use different reflection/shading implementations.

The September 8 revision corrects the dorsal-versus-palmar basis on both hands, adds a palm-over gather, lifts into a shoulder-side set, and removes instantaneous wrist orientation changes. Authored curves carry nonzero velocities through intermediate poses. The held arms now settle with the torso without exceeding their measured reach. Front/side close-up sheets cover nine phases, plus denser finger-contact measurements around release. The same independent reviewer flagged the flat-upward guide-hand finish and residual elbow bend; the final pass relaxed the guide-hand pose and extended the held shooting arm. `validation/hand-fix/` contains the working views.

The subsequent one-motion revision shortens gather-to-release from 2.30 to 1.25 s and replaces the long set-point transition with one uninterrupted lift. The left palm no longer supports from below or follows the forward launch stroke. Actual exported wrist positions are checked across all 361 frames for no forward guide-hand movement after detachment. The film now contains labeled 1× replays, not changing-speed cinematics. This does not resolve the separately documented real-time frame-rate limitation.

## Remaining limitations

The character and setting remain game-like. Armholes, fingers, facial appearance, and clothing folds are simplified; extreme launch edits are not a full-body biomechanical re-solve. The animated net is cosmetic and can overlap the passing ball. Collision restitution and damping are chosen demonstration values, not measured basketball material properties. Contact is discrete at 600 Hz rather than an exact time-of-impact solver. Only the shooting half is fully staged, and the decorative skyline is deliberately sparse. See `MODEL_NOTES.md` for the complete assumptions.

## Reproduce

Start the local server, then run:

```sh
npm test
npm run verify -- --headed
node scripts/motion-audit.mjs
node scripts/contact-audit.mjs
node scripts/benchmark.mjs
/Applications/Blender.app/Contents/MacOS/Blender -b 'deliverables/After Rain.blend' --python scripts/verify_blend.py
.venv/bin/python scripts/verify_media.py
```

Run the benchmark alone. JSON reports are machine-generated; screenshots in `validation/` are working audit material, not the three presentation stills in `deliverables/stills/`.
