# Dimensions, animation, and simulation

All distances are metres, time is seconds. Browser axes: X across the court, Y up, +Z toward the basket. Blender axes: X across, Z up, −Y toward the basket. The free-throw line is at browser Z = 0. Dimensions are exported to `public/assets/dimensions.json` and checked by tests.

## Virtual dimensions

| Item | Implemented value |
| --- | --- |
| Court footprint | 15.24 × 28.6512 m (50 × 94 ft) |
| Rim upper steel surface | 3.048 m (10 ft) above the playing plane |
| Rim centerline | [0, 3.038475, 4.191] m |
| Rim clear inside diameter | 0.4572 m (18 in) |
| Rim tube radius | 0.009525 m |
| Backboard | 1.8288 × 1.0668 × 0.026 m |
| Backboard front plane | Z = 4.572 m (15 ft from the free-throw line) |
| Nearest rim inside edge to board | 0.1524 m (6 in) |
| Net modeled drop | 0.43 m; slightly shorter than a regulation 0.4572 m net |
| Ball radius / diameter | 0.119 / 0.238 m; nominal adult size, not a measured physical ball |
| Ball circumference | Approximately 0.748 m |
| Base body normalization | 1.90 m before the 0.025 m placement offset and footwear |
| Release | 1.25 s; center at [−0.12, 2.22, 0.19] m |
| Default launch | 6.94 m/s, 52° elevation, +1.72° direction |

The athlete is set back from the line: the foremost shoe vertices are approximately 0.055 m behind its centerline, clear of the painted near edge.

Rim, board and free-throw offsets reference [NBA Rule 1](https://official.nba.com/rule-no-1-court-dimensions-equipment/). Only the shooting end is fully staged: some lines, net length, support construction, and distant court features are approximate. Line placements use geometric centerlines with approximately 50 mm painted widths. These choices do not certify a regulation court. The steel top, not the torus centerline, is at ten feet.

## Motion and release continuity

The motion is authored from a CC0 human mesh and rig, with fixed-foot two-segment limb solves, a knee/root dip, arm extension, guide-hand withdrawal, and wrist follow-through. It is sampled at 60 Hz. There is no personal footage, inferred shooting technique, force model, center-of-mass balance solver, or measured biomechanics.

The anatomy revision coordinates elbow swivel, wrist bend and forearm rotation, adds chest clearance during the lift, and reduces the planted-foot dip. Forearm rotation is distributed along the forearm bones rather than concentrated at the wrist. [ANATOMY.md](ANATOMY.md) defines the researched authoring limits, coordinate approximations and focused verification; passing angle bounds is not equivalent to physiological validation.

The latest September 8 revision uses a brief right-hand palm-over pickup followed by right-palm support underneath/behind the ball. The left palm faces sideways throughout: it supplies alignment, not an under-ball shelf or a forward shooting gesture. Its forward motion is braked before it detaches at 1.05 s; it then moves sideways, down and back, with no wrist flick. Only the right-hand release receives launch edits. The ball's hypothetical launch velocity is prescribed directly; the left hand has no simulated impulse. This is not a force-resolved human grip model.

The right elbow rises through a passing set position without stopping; extension and finger roll flow into a held wrist finish. Palmar orientation is derived from wrist/index/little-finger landmarks, with opposite handedness on each side. The visual cues draw on [Hal Wissel's shooting mechanics](https://www.coachesclipboard.net/WisselShootingMechanics.html), with the user's requested right-hand-dominant animation direction. It is not validated coaching or biomechanics.

The brief gather reaches its low point at 0.30 s, followed by one continuous lift to release at 1.25 s. There is no held set-point key. Quintic curves preserve position, velocity and acceleration. The final 1.15–1.25 s curve ends at the release position with the selected launch velocity and gravity acceleration. The browser adjusts only the late right arm when launch settings change; the guide is already detached. Torso and legs remain authored; slider edits are hypothetical experiments, not predictions of how a human changes technique.

The glTF clip starts at 1/60 s. The viewer compensates for that offset when scrubbing. Previous procedural bone offsets are restored before each sample, preventing accumulated drift. Small surface overlaps can remain because mesh skinning and ball attachment are approximate, not collision-resolved finger contacts.

## Ball flight and contacts

Free flight uses `p(t) = p₀ + v₀t + ½at²`, with `a = [0, −9.81, 0] m/s²`. Between contacts, constant gravity is integrated analytically in 1/600 s steps. Results are cached deterministically and interpolated when scrubbing; reverse scrubbing does not run the physics backward.

| Collider | Approximation | Restitution |
| --- | --- | --- |
| Rim | Sphere distance to a circular steel centerline plus tube radius | 0.64 |
| Board | Sphere against finite axis-aligned box, including edges | 0.72 |
| Floor | Infinite horizontal plane at Y = 0 | 0.72 |
| Support | Box enclosing the front safety pad and lower post | 0.35 |

Penetration is projected out; incoming normal velocity is reflected. X/Z velocity is multiplied by 0.99 after contact as a simple damping approximation. Very small vertical floor rebounds are clamped to rest. There is no calibrated material response, continuous time-of-impact solver, compliant rim, rolling resistance, air drag, Magnus force, player collision, or fence/building collision. High-speed/contact-edge cases can differ from real basketball; the supported UI range is 5.5–8.5 m/s, 38–68°, and ±12° direction.

The support collider is a conservative box, not an exact representation of every pole and brace. The floor is mathematically infinite even beyond the visible court. Post-release spin is cosmetic and does not affect flight.

A through-rim event is registered only when the ball center crosses the rim centerline plane downward with enough radial clearance for the sphere. The default launch was chosen to yield a clean simulated shot. There is no random outcome, hidden aim correction, snap-to-hoop or scripted post-release path. The same default simulation is sampled into the Blender ball animation. The cinematic film changes playback timing and camera framing, not the trajectory.

## Net, environment, and film

The net's top anchors remain fixed. Its lower vertices sway in a damped, authored response after an actual through-rim event. This is visual-only: the net neither slows nor redirects the ball. Foliage has a small procedural sway. Rain is represented by damp materials and restrained reflection patches; there is no fluid simulation.

The 20-second film shows three complete six-second takes of the same simulation: courtside, then labeled side and front replays. Every take uses constant 1× playback, with no speed ramps; the remaining two seconds are opening/closing holds. Ball, rim and floor events are those of the default simulation. Sound is synthesized for presentation and is not recorded on-court audio.
