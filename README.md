# anica-landing-page

Static landing page for [Anica](https://github.com/LOVELYZOMBIEYHO/anica), built with Astro and Tailwind CSS for GitHub Pages.

## Pages

- `/` - Intro page
- `/showcase` - Workflow showcase
- `/motionloom` - WASM/WebGPU DSL playground with Scene, Drawing and Puppet Warp tools
- `/download` - Source-only alpha download and build guidance
- `/action-editor` - full-screen Character1 Action Editor with a WebGPU 3D
  viewport, selectable humanoid/finger bones, transforms, Dope Sheet and Graph
  Editor

The dedicated MotionLoom Action Editor edits existing `Action`, `Pose`, `Bone`,
`Contact`, and `ApplyAction` syntax through typed Rust/WASM commands. The DSL
textarea remains the source of truth; UI changes are validated by the
MotionLoom parser before the browser accepts them.

Opening `/action-editor` creates an independent Character1 authoring scene
rather than loading a showcase. The template contains only a floor and the standing
Character1 GLB fetched from Raw GitHub. Its humanoid and finger retarget maps
are preconfigured and hidden from the basic UI, and no walk clip is selected.

Default Action DSL is deliberately kept outside the Astro/TypeScript UI code:

- `public/motionloom-actions/manifest.json` defines Action Library order and labels.
- `public/motionloom-actions/character1-scene.motionloom` contains only the shared
  Character1 stage, retarget profile, lighting, floor, and camera.
- `public/motionloom-actions/actions/*.motionloom` contains one editable `<Action>`
  per file. Adding a file and one manifest entry makes it available to the editor.

`Stand To Roll (Test)` loads `actions/stand_to_roll.motionloom`, the 485-pose
Character1-targeted conversion sampled from the 60 FPS source FBX. It does not
load the original FBX or launch Blender. Target-rig alignment and floor contact are not yet
visually accepted; this preset is not a production-quality reference motion.
The startup selection remains Neutral Stand.

The full-screen workspace uses the real WASM/WebGPU 3D preview. It provides
screen-space joint picking, per-frame Auto Key, individual finger segments,
move/rotate gizmos, numeric transforms, hand presets, front/side/top camera
views, orbit/zoom navigation, Dope Sheet and Graph views, undo/redo, playback,
MotionLoom import, and Action-only DSL export. Typed Action edits are validated
by Rust before the browser adopts the new DSL.

## Development

```sh
nvm use
npm install
npm run dev
```

This project expects Node `>=22.12.0`. The included `.nvmrc` points to Node `22.19.0`.

The dev server runs at `http://localhost:4321/` by overriding Astro base to `/` in the `dev` script.

The production config uses `base: /anica-landing-page` for GitHub Pages. If you want to inspect the deployed path locally, use `npm run preview` after building.

## Build

```sh
npm run build
npm run preview
```

## Deploy

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`. In the repository settings, set Pages source to GitHub Actions.
