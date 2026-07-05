# Agent Instructions for Anica Landing Page

This repository is the public Anica landing page. Treat it as a production GitHub Pages site, not as a sandbox.

## Critical Rules

- Do not push unless the user explicitly asks for push.
- Do not change `.github/workflows/deploy.yml` unless the user explicitly asks for workflow changes.
- Do not upgrade or downgrade GitHub Actions versions speculatively.
- Do not change `actions/deploy-pages` only because GitHub Pages reports `Deployment failed, try again later`.
- Do not replace the MotionLoom WASM renderer with JavaScript effect fallbacks. Canvas fallback is only for WASM load failure.
- Do not silently no-op unsupported MotionLoom process effects. Show a clear unsupported-effect error instead.
- Do not make UI examples that only control one hard-coded showcase. Scene controls must read the current DSL and target real `Group id` values.

## GitHub Pages Deploy Notes

The deploy workflow currently uses:

- `actions/checkout@v4`
- `actions/configure-pages@v5`
- `actions/setup-node@v4` with Node `22`
- `actions/upload-pages-artifact@v3`
- `actions/deploy-pages@v5`

If Pages deployment fails after artifact upload with:

```text
Error: Deployment failed, try again later.
```

do not assume the site code is broken. First verify:

- GitHub Pages is configured to deploy from GitHub Actions.
- The repository has the `github-pages` environment enabled.
- The workflow permissions include `pages: write` and `id-token: write`.
- The uploaded artifact path is `dist`.
- The build job completed successfully before deploy.
- The failure is not a transient GitHub Pages service issue.

Only edit workflow code when there is concrete evidence in the logs that the workflow file is wrong.

## Required Local Checks

Before committing code changes, run:

```sh
npm run build
```

If the change only touches docs or `AGENTS.md`, a build is optional. If build cannot be run, state that clearly in the final response.

## Project Commands

- `npm run dev`: local Astro dev server.
- `npm run check`: Astro type/content check.
- `npm run build`: `astro check && astro build`.
- `npm run build:motionloom-wasm`: rebuild local MotionLoom WASM package from `../anica/crates/motionloom`.

## MotionLoom Page Rules

- Process mode must prioritize MotionLoom WASM rendering.
- Canvas fallback must be visible as fallback behavior, not used as the main renderer.
- Process examples should load from `motionloom-example/core/process/*/main.motionloom`.
- Scene examples should load from the showcase/scene example source intended by the UI.
- If adding process-with-time examples in the future, keep them separate from static core process examples.
- Keep the DSL textarea as the source of truth for editor controls.
- When preview is paused, editing x/y/rotation/scale/opacity or other variables must update the current frame without restarting playback.

## UI Rules

- Use `Scene`, not `Designer`.
- Preserve the existing dark neon visual language.
- Variable selectors should be dropdowns because the editable variable list will grow.
- Avoid adding duplicate buttons in unrelated areas. If process and scene need similar selectors, keep the layout consistent but use separate state when the data source differs.

## Commit Hygiene

- Keep commits focused.
- Do not include generated noise unless it is required for the repo to run or deploy.
- Do not revert user changes unless the user explicitly asks for it.
- When fixing deployment, prefer diagnosis over speculative rewrites.
