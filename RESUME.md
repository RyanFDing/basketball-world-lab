# Project checkpoint

Latest: anatomy-limited motion revision. Start with README.md and ANATOMY.md, not older hand-pose conclusions below. The source of truth is scripts/build_scene.py plus public/anatomy.js (runtime release adaptation). Do not restore earlier free wrist orientation or 168° elbow poses. validation/anatomy/report.json is the focused exported-joint report. No new benchmark was requested. Local ZIPs and their checksum manifest predate the anatomy revision until scripts/package.mjs is run again.

Project: `/Users/ryanding/basketball-world-lab`. The earlier `/Users/ryanding/basketball-shot-lab` project was read for context and was not modified.

First delivery complete on 7 September 2026: playable viewer, editable scene, 20-second 1080p film, three stills, documentation and tested share archives. Final measured playback: 47.9 FPS at 1080p and 36.8 FPS at 2160 × 1350 on this M4. Eight physics tests and fourteen browser checks passed. Film decoding and a fresh ZIP extraction/launch were verified. The local app was opened in Chrome at handoff.

## Current experience

Latest September 8 revision: right-hand carry and launch, left palm restricted to lateral alignment, no forward guide-hand stroke. Gather-to-release is now 1.25 s with one continuous lift and no set-point hold. The film has three labeled 1× takes instead of speed ramps. Ball release remains C2 continuous; feet and limb lengths remain fixed. Thirteen physics/motion tests and fifteen browser checks pass. Earlier versions are backed up in `revisions/2026-09-08-before-hand-fix/` and `revisions/2026-09-08-before-one-motion/`. Updated scene, stills, film and archives use the one-motion revision.

Current performance caveat: September 8 measurements are 15.0 FPS at 1080p and 13.2 FPS at 2160 × 1350, slower than the original baseline above. Same-session A/B measured 15.4 FPS on the OLD athlete and 15.7 FPS on the revision; the cause is not established. Do not attribute it to the new hand motion or repeat the old 48 FPS as current. See VALIDATION.md. A separate performance investigation is optional future work, not completed here.

After Rain: one synthetic six-second stationary free throw, an editable Blender scene and 163-bone athlete rig, and a local Three.js viewer with play/pause/restart, ¼×/½×, scrubbing, cinematic/orbit/side/front cameras, launch editing, trajectory overlay, presentation mode, and JSON save/open.

Start with `./launch.command`, or `npm start` and open `http://127.0.0.1:4173`. Node and Three.js are sufficient for playback. Do not re-fetch the large source asset pack: required sources and exported GLBs already exist.

## Authoritative files

- `scripts/build_scene.py`: generates the rig, scene, animation, packed `.blend`, GLBs, motion track, and dimensions. It overwrites generated assets; preserve manual Blender edits under another name before rebuilding.
- `public/physics.js`: deterministic gravity and rim/board/support/floor contact model.
- `public/app.js`: viewer and coordinated hand/ball release.
- `deliverables/After Rain.blend`: editable scene; release frame 76, timeline frames 1–361 at 60 fps.
- `README.md`, `MODEL_NOTES.md`, `ASSET_LICENSES.md`, `VALIDATION.md`: launch, assumptions, provenance, and actual test evidence.
- `validation/*.json`: machine-generated acceptance, motion, contact, dimension, performance and media reports.

Final default: 6.94 m/s, 52° elevation, +1.72° direction, release at 1.25 s from [−0.12, 2.22, 0.19] m. Guide detaches at 1.05 s. The athlete stands behind the line. Never restore the older 2.30 s timing or 6.74 m/s / Z = 0.49 defaults from earlier revisions.

## Regenerate deliverables

With the viewer server running:

```sh
node scripts/render_demo.mjs
.venv/bin/python scripts/verify_media.py
node scripts/package.mjs
```

Film: `deliverables/After-Rain.mp4`. Stills: `deliverables/stills/`. Archives: `After-Rain-Project.zip` for local use/editing, `After-Rain-Site.zip` for static web hosting at a domain root. The local server is not public hosting.

## Future visual work, if requested

Prioritize a purpose-built garment mesh/weights and facial detail if further visual work is requested. Finger contact is now checked on both hands, with approximately 4 mm maximum sampled release overlap; it remains authored skinning rather than a physical contact solve. Keep release continuity, fixed feet, dimensions, and deterministic contacts covered by tests. The net remains cosmetic; body animation is authored, not a reconstruction or validated biomechanics.

No paid assets, cloud services, or explicit model API calls were purchased. Product-level GPT billing is not exposed. One independent visual-review agent was used; no additional agent work is necessary to reopen or play.
