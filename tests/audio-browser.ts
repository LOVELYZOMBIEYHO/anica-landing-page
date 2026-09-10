// =========================================
// =========================================
// tests/audio-browser.ts

import { MotionLoomAudio } from '../src/scripts/motionloom-audio';
import { installMotionLoomWebExport } from '../src/scripts/motionloom-web-export';
import { Input, BufferSource, ALL_FORMATS, AudioBufferSink } from 'mediabunny';
installMotionLoomWebExport();
const button = document.querySelector<HTMLButtonElement>('#run')!;
const result = document.querySelector<HTMLPreElement>('#result')!;
button.onclick = async () => {
  button.disabled = true;
  let audio: MotionLoomAudio | undefined;
  let url = '';
  const log = (s: string) => { result.textContent += '\n' + s; };
  const assert = (value: boolean, why: string) => { if (!value) throw new Error(why); };
  try {
    result.textContent = 'Loading WASM';
    const moduleUrl = '/motionloom-wasm/pkg/motionloom.js';
    const mod = await new Function('url', 'return import(url)')(moduleUrl);
    await mod.default();
    // A local mathematical WAV exercises browser decoding without external assets.
    const sampleRate = 16000, n = sampleRate * 2;
    const bytes = new ArrayBuffer(44 + n * 2), view = new DataView(bytes);
    const text = (s: string, offset: number) => { for(let i=0;i<s.length;i++) view.setUint8(offset+i,s.charCodeAt(i)); };
    text('RIFF',0); view.setUint32(4,36+n*2,true); text('WAVEfmt ',8);
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
    view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true);
    view.setUint16(32,2,true); view.setUint16(34,16,true);text('data',36);view.setUint32(40,n*2,true);
    for(let i=0;i<n;i++) view.setInt16(44+i*2, Math.round(6000*Math.sin(i/sampleRate*440*Math.PI*2)),true);
    url=URL.createObjectURL(new Blob([bytes], {type:'audio/wav'}));
    const script = `<Graph fps="30" duration="2s" size={[64,64]}>
<Assets>
<AudioAsset id="tone" src="${url}" />
</Assets>
<AudioClip id="a" asset="tone" from="0.5s" duration="1s" sourceIn="0.2s" />
<AudioTarget node="a" property="gainDb">
<Key time="0.5s" value="-20" />
<Key time="1s" value="0" />
</AudioTarget>
<Scene id="main">
<Timeline>
<Track id="t">
<Sequence from="0s" duration="2s">
<Rect id="card" width="64" height="64" color="#ff0000" />
</Sequence>
</Track>
</Timeline>
</Scene>
<Present from="main" />
</Graph>`;
    audio = await MotionLoomAudio.create(mod, script);
    assert(audio.buffer(0,4000).getChannelData(0).every(x=>x===0),'leading silence');
    const samples=audio.buffer(30000,4000).getChannelData(0);
    assert(samples.some(x=>Math.abs(x)>0.01),'audible region');
    const whole=audio.buffer(0,96000).getChannelData(0);
    assert(samples.every((x,i)=>x===whole[30000+i]),'seek differs from sequential mix');
    const monoPeak = Math.max(...audio.buffer(48000, 1000).getChannelData(0).map(Math.abs));
    assert(Math.abs(monoPeak - 6000 / 32768 * Math.SQRT1_2) < 0.0005, 'mono upmix differs from FFmpeg');
    log('PASS: browser decode/resample, silence, audible region, seek parity, mono gain parity');
    // Browser autoplay requires an explicit gesture after asynchronous asset loading.
    await new Promise<void>(resolve => {
      button.disabled = false;
      button.textContent = 'Start playback and export';
      button.onclick = () => {
        button.disabled = true;
        audio!.play(0.5,2, error=>log('Playback error: '+error));
        resolve();
      };
    });
    await new Promise(resolve=>setTimeout(resolve,800));
    assert(audio.time(2)>0.6,'audio clock did not advance');
    audio.pause();
    log('PASS: Web Audio scheduled playback and pause');
    const canvas=document.querySelector<HTMLCanvasElement>('#frame')!;
    for(const format of ['mp4-h264','webm-vp9'] as const) {
      log('Encoding '+format);
      await window.motionloomExportVideoFromCanvas!(canvas, {
        format, duration:2, fps:30, audioScript:script, audioWasm:mod,
        beforeFrame(frame) {const ctx=canvas.getContext('2d')!;ctx.fillStyle=frame%2?'red':'blue';ctx.fillRect(0,0,64,64);},
        async onOutput(buffer) {
          const input=new Input({source:new BufferSource(buffer),formats:ALL_FORMATS});
          try {
            const track=await input.getPrimaryAudioTrack();
            assert(!!track && !!await input.getPrimaryVideoTrack(),'missing AV tracks');
            const duration=await input.computeDuration();
            assert(Math.abs(duration-2)<0.1,'wrong muxed duration '+duration);
            const sink = new AudioBufferSink(track!);
            let peak=0;
            for await(const packet of sink.buffers(0.65,1.0)) {
              for(const x of packet.buffer.getChannelData(0)) peak=Math.max(peak,Math.abs(x));
            }
            assert(peak>0.01,'encoded soundtrack is silent');
            log('PASS: '+format+' AV tracks, duration '+duration.toFixed(3)+'s, decoded peak '+peak.toFixed(4));
          } finally {input.dispose();}
        }
      });
    }
    log('ALL PASS');
  } catch(error) {log('FAIL: '+String(error));}
  finally {audio?.dispose();if(url)URL.revokeObjectURL(url);button.disabled=false;}
};
