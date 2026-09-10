# Model editing (MeshAsset only)

Open MotionLoom and choose **Model editing (MeshAsset only)** below Puppet Warp.
Choose a named Model referencing a MeshAsset, then click **Edit / Refresh**.
Only that asset's authored control vertices become selectable. HeadAsset,
HairAsset and other procedural assets are excluded, including explicit HeadCage.

- Click a vertex; Shift adds/removes vertices.
- Drag empty space to box-select. Selection is X-ray, including hidden vertices.
- Drag selected vertices in the view plane, or choose the X/Y/Z constraint.
- XYZ inputs set the selected vertices' average position in asset coordinates.
- Apply XYZ and dragging rewrite only the selected MeshAsset's Vertex positions.
- UV, pinned flags, Face indices, other assets and formatting are preserved.
- A drag is one Undo operation. Undo and Redo preserve the current paused frame.
- Editing always pauses and retains the frame even when Keep frame is unchecked.
- Shared asset instances all update. Exit mesh before choosing another Model.
- Scrubbing or external DSL changes invalidate the overlay; refresh before editing.

The first version edits existing control vertex positions, not topology. It does
not add/delete vertices or faces, extrude, sculpt, or make shared assets unique.
It supports rigid Model transforms and the runtime Camera3D projection inside
CompositeGroup. Nonidentity 2D Group transforms and presentation deformation
are explicitly rejected; unsupported scene nesting may report no active model.
Assets requiring unavailable browser filesystem resources may fail snapshot loading.

## Verification

Run `node --experimental-strip-types --test tests/mesh-edit.test.mjs` and
`npm run build`. Rust coverage is in motionloom/tests/geometry_export.rs.
Browser checks use a quad MeshAsset beside an explicit HeadAsset: only the quad
appears in the selector. Dragging preserves HeadAsset text and UVs. Select all,
set Z to 0.15, Apply, Undo and Redo all retain the paused frame with Keep frame off.
