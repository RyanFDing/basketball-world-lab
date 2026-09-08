# Authored joint envelope

This revision concerns the synthetic athlete, not any real person's technique. It uses a kinematic rig, not a muscle, ligament, force, fatigue, or injury model. Population ROM measurements inform conservative authoring bounds; they are not universal mechanical stops.

## What changed

The previous clip could fold the right elbow to approximately 168°, reverse the right wrist during the gather, and over-fold the finishing wrist. The left guide wrist also compensated for an unsuitable fixed hand orientation. The correction is limited to the shot motion and arm-solving code; the court, rendering, controls, ball dimensions and post-release collision model are unchanged.

The ball clears the chest during the lift. Its right-hand attachment remains continuous; the guide stays lateral and has no simulated launch impulse or forward release stroke. The set point remains a passing pose, with release at 1.25 s. A shallower root dip reduces ankle dorsiflexion while keeping the feet planted. Finger flexion supplies the relaxed finish instead of bending the wrist beyond its range.

## Model bounds and coordinates

| Measurement | Authored envelope |
| --- | --- |
| Elbow flexion | 0–145°; no authored hyperextension |
| Forearm axial rotation | −75° to +80° in the mirrored model frame |
| Wrist extension / flexion | 60° / 75° |
| Wrist side deviation | ±20°, reduced when flexion/extension is large |
| Shoulder elevation | At most 165° relative to the downward torso axis |
| Knee flexion | 0–135°; no authored hyperextension |
| Ankle sagittal dorsiflexion | At most 15° in this planted-foot clip |

The elbow is solved on a fixed-length two-segment IK circle. Its swivel is chosen jointly with wrist and forearm orientation; there is no lateral elbow hinge degree of freedom or bone stretching. Forearm rotation is assigned to the forearm deformation bones, with half the twist at the proximal segment and full twist distally. It is not assigned as arbitrary wrist yaw.

The hand frame uses wrist, middle-finger base, index base and little-finger base landmarks, with mirrored palmar normals. Wrist bending is measured relative to the forearm. Removing that bend defines the forearm's axial rotation relative to the elbow flexion plane. This is a rig-specific anatomical approximation, not a clinical goniometer or a full ISB joint-coordinate implementation. Shoulder elevation is whole-arm elevation, not isolated glenohumeral flexion. Scapular motion remains an authored shoulder lift.

The solver penalizes an elliptical wrist envelope: `(bend / directional_limit)² + (side_deviation / 20°)² ≤ 1`, with a one-degree interior target for bend/forearm rotation. This discourages using both wrist extrema together. The ellipse is a soft engineering preference, not a fitted physiological boundary or a hard constraint: some poses exceed the preferred ellipse while remaining inside the individual angular bounds. Exported poses are checked separately against those documented bounds. Finger curls are small authored segment rotations (maximum about 23° added per segment); thumb opposition, tendon coupling, skin collisions and soft-tissue compression are not solved anatomically.

## Research used

- [Zwerus et al., elbow ROM measurements](https://pmc.ncbi.nlm.nih.gov/articles/PMC6555111/): population measurements distinguish flexion/extension from pronation/supination and show variation with participant characteristics. This supports using an adult-character envelope without optional hyperextension.
- [CDC/Soucie et al., normal joint ROM study](https://archive.cdc.gov/www_cdc_gov/ncbddd/jointrom/index_1715172647.html): age/sex-specific shoulder, elbow, hip, knee and ankle reference measurements. These informed the broader limb check and shallower planted-foot dip; no individual participant data was imported.
- [Li et al., coupled wrist movement](https://pubmed.ncbi.nlm.nih.gov/15621323/): wrist flexion/extension and side deviation are coupled, and available movement depends on position in the other direction. This motivated the coupled envelope rather than independent maximum-angle clamps.
- [Wrist ROM and forearm rotation study](https://pubmed.ncbi.nlm.nih.gov/31413492/): wrist measurements vary with forearm position. The project therefore separates forearm rotation from wrist bending rather than treating the wrist as a free three-axis ball joint.
- [Influence of wrist position on finger MCP motion](https://pubmed.ncbi.nlm.nih.gov/29072491/): wrist position affects available finger movement. Here, finishing curl is distributed over finger segments while wrist bend stays restrained; this remains authored rather than a tendon simulation.

The human subjects in these studies were not used to reconstruct or validate this basketball motion. Joint-angle bounds alone do not establish balance, feasible muscle forces, realistic joint loading, absence of all body intersections, or coaching quality.

## Focused verification

`scripts/verify-anatomy.mjs` measures actual exported bone landmarks over the six-second clip, then checks only the 0.10-second adaptation window for eight launch-slider corner combinations. It checks joint bounds, fixed limb lengths, foot position, guide withdrawal and elbow position steps. The result is saved in [the anatomy report](validation/anatomy/report.json). Separate targeted checks cover continuous lift/release and skinned hand-to-ball contact. This revision intentionally does not repeat unrelated benchmarks or the entire UI test suite.

Measured across those samples: right elbow 19.3–132.3°, left elbow 64.7–115.4°; wrist extension at most 59.0° and flexion at most 63.3°; shoulder elevation at most 154.4°; knee flexion at most 39.3°; ankle dorsiflexion at most 14.8°. Bone-length variation and foot drift are below 0.002 mm. The 20-microsecond probes across motion joins show at most 0.086 mm joint movement, rather than a position jump. This is a continuity check, not a maximum human joint-speed or acceleration validation. Sampled right-hand contact has up to 3.5 mm overlap and 2.3 mm gap; the guide is near contact before withdrawal.
