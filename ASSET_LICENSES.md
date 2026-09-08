# Asset provenance

No personal footage, paid assets, stock music, paid image-generation services, or explicit model API calls were used. Existing Codex/agent usage may be billed by the product; this environment does not expose that total. No exact credit-spend claim is made.

## MakeHuman core assets — CC0

The synthetic athlete derives from the [MakeHuman core assets](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html), released under [CC0](https://static.makehumancommunity.org/about/license.html). MakeHuman's application code license is separate; the application itself is not bundled or required here.

Source repository: [makehumancommunity/makehuman](https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data). Files fetched into `assets/source/`:

- `3dobjs/base.obj`: continuous anatomical mesh and UVs.
- `rigs/default.mhskel` and `rigs/default_weights.mhw`: skeleton and skin weights.
- `targets/macrodetails/african-male-young.target`: stored as `male.target`.
- `targets/macrodetails/universal-male-young-maxmuscle-averageweight.target`: stored as `athletic.target`.

System pack: [makehuman_system_assets_cc0.zip](https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip). Used subsets:

- `skins/young_african_male/young_darkskinned_male_diffuse.png`.
- `clothes/shoes02/`: fitted mesh and diffuse texture, recolored; the original included socks are removed and replaced with local modeled socks.
- `eyes/materials/brown_eye.png` remains in the editable material data; visible eyes use local geometric sclera/iris/pupil inserts.

Original asset headers identify Data Collection AB, Joel Palmius and Jonas Hauquier among the CC0 release holders. Those headers are retained in supplied source files. The full 268 MB download is retained locally but excluded from delivery archives; required extracted sources are included.

Derived work: body morph blending, rest-scale conversion, jersey/shorts construction, seams, socks, fitted footwear and materials, synthetic eyes/hair treatment, and the authored animation. No real person's likeness or shooting technique was reconstructed.

## Poly Haven — CC0

- [Asphalt 02](https://polyhaven.com/a/asphalt_02): 1K diffuse, OpenGL normal, and roughness maps. Diffuse and normal are used in the viewer; roughness is supplied for editing.
- [Qwantani Dusk 2 Pure Sky](https://polyhaven.com/a/qwantani_dusk_2_puresky): 1K HDR environment.

Downloaded using the official asset API; see `scripts/fetch-environment.mjs`. Poly Haven's [asset license is CC0](https://polyhaven.com/license). Runtime and Blender grading differ, while sharing these sources.

## Locally authored assets

Court geometry, markings, basket/support, rim/net, fence, lamps, trees/building silhouettes, bench, ball/seams, procedural knit texture, wet-ground shader, lighting, camera paths, animation logic, UI and synthesized sound were created for this project. No photographic background plates or external sound samples are used.

## Software notices

- [Three.js](https://github.com/mrdoob/three), version 0.185.0, MIT. Its copyright/license notice is included as `licenses/THREE-LICENSE.txt` and in the bundled package.
- [Playwright](https://github.com/microsoft/playwright), version 1.58.2, Apache-2.0; used for testing and film capture, installed by `npm ci` rather than bundled in the share viewer.
- Python build tools: NumPy, Pillow, imageio-ffmpeg; versions in `requirements.txt`, upstream notices remain in their installed packages. No Python environment or FFmpeg binary is redistributed in delivery archives.
- Blender 5.2.1 LTS and Chrome are existing local applications, not redistributed.

## Visual references, not embedded assets

Composition and atmosphere were guided by [a night-court photograph on Unsplash](https://unsplash.com/photos/a-basketball-court-at-night-with-a-basketball-hoop-HUBZCckgVBA) and [Atelier Let's basketball pavilion on Designboom](https://www.designboom.com/architecture/atelier-lets-basketball-pavilion-taiwan-12-28-2018/). These photographs were viewed as references and are not included in the scene or archives.

The [dream-loop workflow](https://github.com/achimala/dream-loop) inspired target → build → render → independent review → correction. One independent reviewer was used across review iterations; no dream-loop code or image-generation service was needed.
