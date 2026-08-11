import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  type Quality,
  WebMOutputFormat,
  canEncodeVideo,
} from 'mediabunny';

export type MotionLoomWebExportFormat =
  | 'webm-vp8'
  | 'webm-vp9'
  | 'webm-av1'
  | 'mp4-h264'
  | 'mp4-hevc'
  | 'mp4-hevc-main';

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
  codec: 'av1' | 'avc' | 'hevc' | 'vp8' | 'vp9';
  extension: string;
  mimeType: string;
}> = {
  'webm-vp8': { codec: 'vp8', extension: 'webm', mimeType: 'video/webm' },
  'webm-vp9': { codec: 'vp9', extension: 'webm', mimeType: 'video/webm' },
  'webm-av1': { codec: 'av1', extension: 'webm', mimeType: 'video/webm' },
  'mp4-h264': { codec: 'avc', extension: 'mp4', mimeType: 'video/mp4' },
  'mp4-hevc': { codec: 'hevc', extension: 'mp4', mimeType: 'video/mp4' },
  'mp4-hevc-main': { codec: 'hevc', extension: 'mp4', mimeType: 'video/mp4' },
};

const REFERENCE_WIDTH = 3840;
const REFERENCE_HEIGHT = 2160;
const REFERENCE_FPS = 30;
const H264_REFERENCE_BITRATE = 50_000_000;
const MIN_EXPORT_BITRATE = 4_000_000;
const MAX_EXPORT_BITRATE = 100_000_000;

/**
 * Motion graphics need more bitrate than camera footage to retain small text,
 * line art and flat-color edges. Scale a 4K30 H.264 quality target by the
 * actual pixel rate, then account for the relative efficiency of each codec.
 */
export function resolveMotionGraphicsBitrate(
  codec: 'av1' | 'avc' | 'hevc' | 'vp8' | 'vp9',
  width: number,
  height: number,
  fps: number,
) {
  const codecFactor = {
    avc: 1,
    hevc: 0.65,
    vp8: 1.1,
    vp9: 0.65,
    av1: 0.5,
  }[codec];
  const resolutionScale = (width * height) / (REFERENCE_WIDTH * REFERENCE_HEIGHT);
  const fpsScale = fps / REFERENCE_FPS;
  const bitrate = H264_REFERENCE_BITRATE * resolutionScale * fpsScale * codecFactor;

  return Math.round(Math.max(MIN_EXPORT_BITRATE, Math.min(MAX_EXPORT_BITRATE, bitrate)));
}

const nextAnimationFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => resolve());
});

function buildOutputFormat(format: MotionLoomWebExportFormat) {
  if (format.startsWith('mp4-')) {
    return new Mp4OutputFormat();
  }
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
  bitrate: number | Quality,
) {
  if (!('VideoEncoder' in window)) {
    throw new Error('WebCodecs VideoEncoder is not available in this browser.');
  }
  const meta = FORMAT_META[format];
  const supported = await canEncodeVideo(meta.codec, {
    width: canvas.width,
    height: canvas.height,
    bitrate,
    bitrateMode: 'constant',
    latencyMode: 'quality',
    contentHint: 'text',
  });
  if (!supported) {
    const codecLabel = format === 'mp4-h264'
      ? 'H.264 MP4'
      : meta.codec === 'hevc'
        ? 'HEVC Main MP4'
        : meta.codec;
    throw new Error(`This browser cannot encode ${codecLabel} at ${canvas.width}x${canvas.height}.`);
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

    const usesAutomaticH264Quality = meta.codec === 'avc';
    const bitrate = usesAutomaticH264Quality
      ? QUALITY_HIGH
      : resolveMotionGraphicsBitrate(meta.codec, canvas.width, canvas.height, fps);
    options.onStatus?.(
      usesAutomaticH264Quality
        ? 'Checking avc encoder with automatic high quality...'
        : `Checking ${meta.codec} encoder at ${((bitrate as number) / 1_000_000).toFixed(1)} Mbps...`,
    );
    await assertVideoEncoderSupport(canvas, format, bitrate);

    const target = new BufferTarget();
    const output = new Output({
      format: buildOutputFormat(format),
      target,
    });
    const videoSource = new CanvasSource(canvas, {
      codec: meta.codec,
      bitrate,
      bitrateMode: 'constant',
      latencyMode: 'quality',
      contentHint: 'text',
      // YouTube recommends a closed GOP of half the frame rate. Mediabunny
      // expresses this interval in seconds, so H.264 uses one keyframe every 0.5s.
      keyFrameInterval: meta.codec === 'avc' ? 0.5 : 2,
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
