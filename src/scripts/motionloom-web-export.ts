import {
  BufferTarget,
  CanvasSource,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeVideo,
} from 'mediabunny';

export type MotionLoomWebExportFormat = 'webm-vp8' | 'webm-vp9' | 'webm-av1';

type MotionLoomWebExportOptions = {
  format?: MotionLoomWebExportFormat;
  duration?: number;
  fps?: number;
  filename?: string;
  onStatus?: (message: string) => void;
  beforeFrame?: (frame: number, time: number) => Promise<void> | void;
};

declare global {
  interface Window {
    motionloomExportVideoFromCanvas?: (
      canvas: HTMLCanvasElement,
      options?: MotionLoomWebExportOptions,
    ) => Promise<void>;
  }
}

const FORMAT_META: Record<MotionLoomWebExportFormat, {
  codec: 'av1' | 'vp8' | 'vp9';
  extension: string;
  mimeType: string;
}> = {
  'webm-vp8': { codec: 'vp8', extension: 'webm', mimeType: 'video/webm' },
  'webm-vp9': { codec: 'vp9', extension: 'webm', mimeType: 'video/webm' },
  'webm-av1': { codec: 'av1', extension: 'webm', mimeType: 'video/webm' },
};

const nextAnimationFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => resolve());
});

function buildOutputFormat() {
  return new WebMOutputFormat();
}

function downloadBuffer(buffer: ArrayBuffer, mimeType: string, filename: string) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function assertVideoEncoderSupport(
  canvas: HTMLCanvasElement,
  format: MotionLoomWebExportFormat,
) {
  if (!('VideoEncoder' in window)) {
    throw new Error('WebCodecs VideoEncoder is not available in this browser.');
  }
  const meta = FORMAT_META[format];
  const supported = await canEncodeVideo(meta.codec, {
    width: canvas.width,
    height: canvas.height,
  });
  if (!supported) {
    throw new Error(`This browser cannot encode ${meta.codec} at ${canvas.width}x${canvas.height}.`);
  }
}

export function installMotionLoomWebExport() {
  window.motionloomExportVideoFromCanvas = async (canvas, options = {}) => {
    const format = options.format ?? 'webm-vp9';
    const meta = FORMAT_META[format];
    const fps = Math.max(1, Math.min(120, Math.round(options.fps ?? 30)));
    const duration = Math.max(1 / fps, Math.min(60, options.duration ?? 3));
    const frameCount = Math.max(1, Math.round(duration * fps));
    const filename = options.filename ?? `motionloom-preview.${meta.extension}`;

    if (!canvas.width || !canvas.height) {
      throw new Error('Preview canvas has no render size.');
    }

    options.onStatus?.(`Checking ${meta.codec} encoder...`);
    await assertVideoEncoderSupport(canvas, format);

    const target = new BufferTarget();
    const output = new Output({
      format: buildOutputFormat(),
      target,
    });
    const videoSource = new CanvasSource(canvas, {
      codec: meta.codec,
      bitrate: QUALITY_HIGH,
      keyFrameInterval: 1,
      sizeChangeBehavior: 'deny',
    });

    output.addVideoTrack(videoSource);
    await output.start();

    const frameDuration = 1 / fps;
    for (let frame = 0; frame < frameCount; frame += 1) {
      options.onStatus?.(`Encoding ${frame + 1}/${frameCount} ${meta.extension.toUpperCase()} frames...`);
      if (options.beforeFrame) {
        await options.beforeFrame(frame, frame * frameDuration);
      } else {
        await nextAnimationFrame();
      }
      await videoSource.add(frame * frameDuration, frameDuration);
    }

    await output.finalize();
    if (!target.buffer) {
      throw new Error('Mediabunny finished without an output buffer.');
    }

    downloadBuffer(target.buffer, meta.mimeType, filename);
    options.onStatus?.(`Saved ${filename}`);
  };
}
