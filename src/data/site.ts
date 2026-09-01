export const site = {
  name: 'Anica',
  title: 'Anica - Agentic AI Video Editor',
  description:
    'Anica is an agentic-first video editor built with Rust for native, AI-assisted video workflows.',
  repoUrl: 'https://github.com/LOVELYZOMBIEYHO/anica',
  youtubeUrl: 'https://www.youtube.com/@AnicaEditor',
  installDocsUrl: 'https://github.com/LOVELYZOMBIEYHO/anica/blob/main/docs/INSTALL.md',
  macosBundleDocsUrl: 'https://github.com/LOVELYZOMBIEYHO/anica/blob/main/docs/MACOS_APP_BUNDLE.md',
  contributingUrl: 'https://github.com/LOVELYZOMBIEYHO/anica/blob/main/CONTRIBUTING.md',
  licenseUrl: 'https://github.com/LOVELYZOMBIEYHO/anica/blob/main/LICENSE',
  screenshotOne:
    'https://raw.githubusercontent.com/LOVELYZOMBIEYHO/anica/main/assets/README/readme_showcase1.png',
  screenshotTwo:
    'https://raw.githubusercontent.com/LOVELYZOMBIEYHO/anica/main/assets/README/readme_showcase2.png',
};

export const navItems = [
  { label: 'Intro', href: '/' },
  { label: 'Showcase', href: '/showcase' },
  { label: 'MotionLoom', href: '/motionloom' },
  { label: 'Download', href: '/download' },
  { label: 'Action Editor', href: '/action-editor' },
];

export const featureGroups = [
  {
    eyebrow: 'Agent workflow',
    title: 'Edit through conversation',
    text: 'Connect compatible ACP agents, inspect timeline state, and move from intent to concrete edits without leaving the editor.',
  },
  {
    eyebrow: 'Subtitle pipeline',
    title: 'Local speech and translation paths',
    text: 'Use local ONNX Whisper model packs for subtitle generation, then translate and re-import subtitle tracks with timing preserved.',
  },
  {
    eyebrow: 'Native media core',
    title: 'Built for GPU-assisted editing',
    text: 'Rust, GPUI, WGPU, GStreamer, and FFmpeg provide the foundation for native preview, export, analysis, and effect rendering.',
  },
];

export const workflowSteps = [
  'Import clips and build a timeline.',
  'Ask an agent to inspect, clean, or restructure the edit.',
  'Generate subtitles, translations, B-roll ideas, or export actions.',
  'Review the timeline and keep creative control over the result.',
];

export const showcaseItems = [
  {
    label: 'Silence cleanup',
    title: 'Cut dead air with timeline-aware prompts',
    text: 'Ask Anica to detect silent sections, remove repeated speech, and tighten pacing while keeping the edit visible for review.',
  },
  {
    label: 'B-roll planning',
    title: 'Turn a rough sequence into visual opportunities',
    text: 'Agents can analyze the project state and suggest relevant B-roll or generated inserts for semantic layers.',
  },
  {
    label: 'Subtitle localization',
    title: 'Translate tracks without losing timing',
    text: 'Generate, translate, clean, and re-import subtitles while keeping timeline alignment intact.',
  },
];

export const platformStatus = [
  {
    platform: 'macOS Apple Silicon',
    status: 'Primary development target',
  },
  {
    platform: 'Linux',
    status: 'Experimental and untested',
  },
  {
    platform: 'Windows',
    status: 'Experimental and untested',
  },
];
