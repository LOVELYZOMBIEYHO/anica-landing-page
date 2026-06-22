# Third-Party Notices

## Mediabunny

- Package: `mediabunny`
- License: `MPL-2.0`
- Use: browser-only MotionLoom preview export in `anica-landing-page`

Mediabunny is intentionally isolated to the landing page's WebCodecs export path. The MotionLoom Rust crate and WASM renderer do not include Mediabunny source code.

Current integration consumes Mediabunny unmodified from npm. If this project modifies Mediabunny source files, those modifications must be made available under MPL-2.0 according to the MPL file-level copyleft terms.

The landing page project remains Apache-2.0. This notice documents the separate MPL-2.0 dependency used by the browser export feature.
