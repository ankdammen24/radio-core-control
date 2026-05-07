// Browser audio processor: decode -> trim silence -> normalize -> MP3 encode
import { Mp3Encoder } from "@breezystack/lamejs";

const SILENCE_THRESHOLD = 0.01; // ~ -40 dBFS
const TARGET_RMS_DBFS = -16; // approximation of -16 LUFS
const MAX_GAIN_DB = 20;

function findSilenceBounds(channel: Float32Array, sampleRate: number) {
  const win = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms windows
  let start = 0;
  let end = channel.length;
  for (let i = 0; i < channel.length; i += win) {
    let peak = 0;
    for (let j = i; j < Math.min(i + win, channel.length); j++) {
      const a = Math.abs(channel[j]);
      if (a > peak) peak = a;
    }
    if (peak > SILENCE_THRESHOLD) { start = i; break; }
  }
  for (let i = channel.length - win; i >= 0; i -= win) {
    let peak = 0;
    for (let j = i; j < Math.min(i + win, channel.length); j++) {
      const a = Math.abs(channel[j]);
      if (a > peak) peak = a;
    }
    if (peak > SILENCE_THRESHOLD) { end = Math.min(channel.length, i + win); break; }
  }
  return { start, end };
}

function rmsDbfs(samples: Float32Array) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return 20 * Math.log10(rms || 1e-9);
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export interface ProcessResult {
  mp3Blob: Blob;
  durationSeconds: number;
  rmsDbBefore: number;
  rmsDbAfter: number;
}

export async function processRecording(blob: Blob): Promise<ProcessResult> {
  const arrayBuf = await blob.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  const audioBuf: AudioBuffer = await new Promise((resolve, reject) => {
    ctx.decodeAudioData(arrayBuf.slice(0), resolve, reject);
  });

  // Mix to mono
  const numCh = audioBuf.numberOfChannels;
  const length = audioBuf.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < numCh; c++) {
    const data = audioBuf.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numCh;
  }

  // Trim silence
  const { start, end } = findSilenceBounds(mono, audioBuf.sampleRate);
  const trimmed = mono.slice(start, end);

  // Normalize toward target RMS (clamped)
  const rmsBefore = rmsDbfs(trimmed);
  let gainDb = TARGET_RMS_DBFS - rmsBefore;
  if (gainDb > MAX_GAIN_DB) gainDb = MAX_GAIN_DB;
  if (gainDb < -MAX_GAIN_DB) gainDb = -MAX_GAIN_DB;
  const gain = Math.pow(10, gainDb / 20);
  // Avoid clipping
  let peak = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const v = Math.abs(trimmed[i] * gain);
    if (v > peak) peak = v;
  }
  const safeGain = peak > 0.99 ? gain * (0.99 / peak) : gain;
  const out = new Float32Array(trimmed.length);
  for (let i = 0; i < trimmed.length; i++) out[i] = trimmed[i] * safeGain;
  const rmsAfter = rmsDbfs(out);

  // Encode MP3 (mono, 128 kbps)
  const sampleRate = audioBuf.sampleRate;
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const samples = floatToInt16(out);
  const blockSize = 1152;
  const chunks: BlobPart[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) chunks.push(new Uint8Array(buf).buffer as ArrayBuffer);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail).buffer as ArrayBuffer);

  const mp3Blob = new Blob(chunks, { type: "audio/mpeg" });
  ctx.close?.();

  return {
    mp3Blob,
    durationSeconds: out.length / sampleRate,
    rmsDbBefore: rmsBefore,
    rmsDbAfter: rmsAfter,
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const base64 = r.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
