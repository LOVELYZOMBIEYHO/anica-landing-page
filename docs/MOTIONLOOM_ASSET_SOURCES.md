# MotionLoom editor asset sources

The DSL keeps its original relative asset paths. The web editor supplies a source
location to resolve them, equivalent to opening the DSL from its directory locally.
The source location is editor state, not a new DSL attribute.

## Paste a showcase

1. Paste the DSL into the editor.
2. Open **Asset source**, choose its example asset category and number, and click
   **Use example source**. For S92, choose `showcase` and `92`.
3. The editor renders the existing DSL using that example's asset directory.

These asset controls never load or replace the DSL. The top **Load** controls
continue to load a complete example and automatically set its asset source.
Changing the source also changes the base used by audio preview and video export.
Blank scene and process templates clear the previous source.

For custom projects, enter a repository-relative DSL path or an absolute HTTP(S)
source URL and click **Apply source**. Examples:

- `showcase/s-000092/main.motionloom`
- `core/scene/cs-000001/main.motionloom`
- `https://cdn.example/project/main.motionloom`
- `https://cdn.example/project/` (directory URLs must end with `/`)

A relative path is resolved against the configured example repository. Local
filesystem paths are not network locations. Clearing the source explicitly uses
the page URL for relative assets. A pasted DSL has no reliable original directory;
the editor therefore does not guess a showcase from object names or silently try
multiple repositories. Remote files must be published and permit browser CORS.

## Move the repository or add categories

Edit `src/config/motionloom-assets.json`:

- `repository`: GitHub `owner/repository` containing the examples and their assets.
- `ref`: a branch ref, tag or pinned commit accepted by GitHub Raw.
- `processManifest`: manifest path relative to the repository root.
- `categories`: each category's label, folder, ID prefix and entry filename.

Both category pickers and generated example URLs use this configuration. Adding a
numbered category does not require another switch branch in the editor. A process
manifest entry's own path remains authoritative for irregular folder layouts.
Build and deploy the landing page after changing configuration. Changing host-side
asset sources does not require rebuilding MotionLoom WASM.

## Resolution and diagnostics

Images, GLB models, GLB inspection and scene dependencies share URL resolution.
Absolute asset URLs retain their destination. Relative paths and `../` segments
are interpreted against the source directory. Nested ActionLibrary and HeadSwap
scene assets resolve against the nested file's directory, not the outer scene.
External glTF buffers and textures resolve against the glTF file's URL. Renderer
asset keys retain the exact original DSL names; HeadSwap child keys remain scoped.

Fetch errors include the original path and resolved URL. Inspect **Asset source**
when that URL points to a different example. A 404 at the correct URL means the
file is missing or has not been published; source selection cannot publish assets.

Run the resolver and nested scene regression checks with:

```sh
node --test tests/asset-source.test.mjs tests/head-swap-preload.test.mjs
npm run build
```
