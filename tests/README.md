# Browser audio regression

This harness uses the real WASM audio mixer, browser decoding/playback and
Mediabunny export. It generates its own diagnostic WAV and inspects encoded
MP4/AAC and WebM/Opus tracks, duration and decoded non-silence.

1. Run `npm run build:motionloom-wasm`.
2. Copy `tests/audio-browser.html` to `public/audio-browser-test.html`.
3. Run `npm run dev` and open `/audio-browser-test.html`.
4. Click **Run browser audio checks**, then **Start playback and export**.
   The second gesture satisfies browser autoplay restrictions after asset loading.
5. Expect **ALL PASS**. Unsupported codecs are reported as failures.
6. Delete the temporary `public/audio-browser-test.html` before production builds.

The TypeScript harness is served by Vite during development and is not a
production route. Encoded buffers stay in memory; no files are downloaded.
