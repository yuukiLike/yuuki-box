import midiPackage from '@tonejs/midi';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { musicSchema, type Music, type Track } from './contracts.js';

const execute = promisify(execFile);
const { Midi } = midiPackage;
export const sampleRate = 22050;

export async function ffmpeg(args: string[], signal?: AbortSignal): Promise<void> {
  await execute(process.env.FFMPEG_BIN ?? 'ffmpeg', ['-nostdin', '-v', 'error', ...args], {
    signal, timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 262_144,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C', },
  });
}

export async function localFile(path: string, extensions: string[]): Promise<Buffer> {
  if (!isAbsolute(path) || !extensions.includes(extname(path).toLowerCase())) throw new Error('请选择支持格式的本地绝对路径。');
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 67_108_864) throw new Error('素材必须是普通文件，且不超过 64 MiB。');
  return await readFile(path);
}

export function wav(samples: Float32Array): Buffer {
  const result = Buffer.alloc(44 + samples.length * 2);
  result.write('RIFF'); result.writeUInt32LE(result.length - 8, 4); result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(sampleRate, 24); result.writeUInt32LE(sampleRate * 2, 28);
  result.writeUInt16LE(2, 32); result.writeUInt16LE(16, 34); result.write('data', 36);
  result.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) result.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] ?? 0)) * 32767), 44 + i * 2);
  return result;
}

export function decodeOwnWav(data: Buffer): Float32Array {
  if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new Error('WAV 文件头不合法。');
  let pcm: Buffer | undefined;
  let validFormat = false;
  for (let offset = 12; offset + 8 <= data.length;) {
    const tag = data.toString('ascii', offset, offset + 4); const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > data.length) throw new Error('WAV 数据不完整。');
    if (tag === 'fmt ' && size >= 16) validFormat = data.readUInt16LE(start) === 1 && data.readUInt16LE(start + 2) === 1 && data.readUInt32LE(start + 4) === sampleRate && data.readUInt16LE(start + 14) === 16;
    if (tag === 'data') pcm = data.subarray(start, start + size);
    offset = start + size + size % 2;
  }
  if (!validFormat || !pcm || pcm.length % 2) throw new Error('需要 22050 Hz、单声道、16 位 PCM WAV。');
  const samples = new Float32Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  return samples;
}

function envelope(samples: Float32Array): number[] {
  const hop = sampleRate * 0.05;
  const values: number[] = [];
  for (let start = 0; start < samples.length; start += hop) {
    let sum = 0;
    const end = Math.min(Math.floor(start + hop), samples.length);
    for (let index = Math.floor(start); index < end; index++) sum += (samples[index] ?? 0) ** 2;
    values.push(Math.sqrt(sum / Math.max(1, end - Math.floor(start))));
  }
  const maximum = Math.max(0.001, ...values);
  return values.map(value => value / maximum);
}

function synthesize(track: Track, duration: number): Float32Array {
  const samples = new Float32Array(Math.ceil(duration * sampleRate));
  for (const note of track.notes) {
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    const start = Math.round(note.time * sampleRate);
    const count = Math.round(note.duration * sampleRate);
    for (let index = 0; index < count && start + index < samples.length; index++) {
      const t = index / sampleRate;
      const gate = Math.min(1, t / 0.02, (note.duration - t) / 0.06);
      const angle = 2 * Math.PI * frequency * t;
      const tone = Math.sin(angle) + 0.22 * Math.sin(2 * angle) + 0.08 * Math.sin(3 * angle);
      samples[start + index] = (samples[start + index] ?? 0) + tone * Math.max(0, gate) * note.velocity * 0.14;
    }
  }
  return samples;
}

export function midiData(data: Buffer, assetId: string, title: string, sourceName: string): Music {
  if (data.toString('ascii', 0, 4) !== 'MThd') throw new Error('文件不是标准 MIDI。');
  const midi = new Midi(data);
  if (!(midi.header.ppq > 0 && midi.header.ppq <= 32767)) throw new Error('目前只支持 PPQ 时间基准的 MIDI。');
  const firstTempo = midi.header.tempos[0];
  if (firstTempo && firstTempo.ticks > 0) {
    midi.header.tempos.unshift({ ticks: 0, bpm: 120 }); midi.header.update();
  }
  const duration = midi.duration;
  if (!(duration > 0 && duration <= 180) || midi.tracks.filter(track => track.notes.length).length > 16 || midi.tracks.reduce((sum, track) => sum + track.notes.length, 0) > 25_000) {
    throw new Error('MIDI 须为 0–180 秒、最多 16 个有音符的轨道及 25,000 个音符。');
  }
  const tracks: Track[] = midi.tracks.filter(track => track.notes.length).map((track, index) => ({
    id: `track-${index + 1}`, name: track.name || `声部 ${index + 1}`, instrument: track.instrument.name,
    percussion: track.instrument.percussion, stem: `track-${index + 1}.wav`, envelope: [],
    notes: track.notes.map(note => ({ midi: note.midi, time: note.time, duration: note.duration,
      velocity: note.velocity, ticks: note.ticks, durationTicks: note.durationTicks })),
  }));
  const durationTicks = midi.durationTicks;
  const signatures = [{ ticks: 0, timeSignature: [4, 4] }, ...midi.header.timeSignatures].sort((a, b) => a.ticks - b.ticks);
  const bars: Music['bars'] = [];
  let ticks = 0;
  while (ticks < durationTicks) {
    const signature = signatures.findLast(value => value.ticks <= ticks);
    const numerator = signature?.timeSignature[0] ?? 4;
    const denominator = signature?.timeSignature[1] ?? 4;
    if (!(numerator > 0 && numerator <= 32 && denominator > 0 && denominator <= 64)) throw new Error('MIDI 拍号超出支持范围。');
    const nextChange = signatures.find(value => value.ticks > ticks);
    const next = Math.min(ticks + midi.header.ppq * numerator * 4 / denominator, nextChange?.ticks ?? Infinity);
    if (next <= ticks || bars.length >= 2000) throw new Error('MIDI 小节边界不合法。');
    const time = midi.header.ticksToSeconds(ticks);
    bars.push({ number: bars.length + 1, ticks, time, duration: midi.header.ticksToSeconds(next) - time, numerator, denominator });
    ticks = next;
  }
  const repeats: Music['repeats'] = [];
  for (const track of tracks) {
    const patterns = new Map<string, number[]>();
    for (const bar of bars) {
      const notes = track.notes.filter(note => note.time >= bar.time - 0.00001 && note.time < bar.time + bar.duration - 0.00001);
      if (!notes.length) continue;
      // 只标记同轨内精确的音高/节奏重复，不据此推断副歌或音乐语义。
      const pattern = JSON.stringify(notes.map(note => [note.midi, note.ticks - bar.ticks, note.durationTicks]));
      patterns.set(pattern, [...(patterns.get(pattern) ?? []), bar.number]);
    }
    for (const [pattern, repeatedBars] of patterns) if (repeatedBars.length > 1) repeats.push({ trackId: track.id, bars: repeatedBars,
      fingerprint: createHash('sha256').update(pattern).digest('hex').slice(0, 12) });
  }
  return musicSchema.parse({ assetId, title, sourceName, sourceSha256: createHash('sha256').update(data).digest('hex'),
    kind: 'midi', duration, sampleRate, envelopeStep: 0.05, tracks, bars, repeats,
    markers: midi.header.meta.filter(event => event.type === 'marker' || event.type === 'cuePoint')
      .map(event => ({ time: midi.header.ticksToSeconds(event.ticks), label: event.text.slice(0, 80) }))
      .filter(event => event.time >= 0 && event.time <= duration).slice(0, 32),
    tempos: midi.header.tempos.length ? midi.header.tempos.map(tempo => ({ time: tempo.time ?? 0, bpm: tempo.bpm })) : [{ time: 0, bpm: 120 }],
  });
}

export async function importMusic(root: string, path: string, title?: string, signal?: AbortSignal): Promise<Music> {
  const data = await localFile(path, ['.mid', '.midi', '.wav', '.mp3', '.flac', '.ogg', '.m4a']);
  signal?.throwIfAborted();
  const assetId = randomUUID();
  const directory = join(root, 'assets', assetId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    let music: Music;
    if (['.mid', '.midi'].includes(extname(path).toLowerCase())) {
      music = midiData(data, assetId, title ?? basename(path), basename(path));
      await writeFile(join(directory, 'source.mid'), data);
      for (const track of music.tracks) {
        signal?.throwIfAborted();
        const samples = synthesize(track, music.duration);
        track.envelope = envelope(samples);
        await writeFile(join(directory, track.stem), wav(samples));
      }
    } else {
      const source = join(directory, `source${extname(path).toLowerCase()}`);
      const raw = join(directory, 'decoded.wav');
      await writeFile(source, data);
      await ffmpeg(['-protocol_whitelist', 'file,pipe', '-i', source, '-t', '180.01', '-ac', '1', '-ar', String(sampleRate), '-c:a', 'pcm_s16le', '-f', 'wav', raw], signal);
      const samples = decodeOwnWav(await readFile(raw));
      if (!samples.length || samples.length / sampleRate > 180) throw new Error('音频须为 0–180 秒。');
      if (samples.some(value => !Number.isFinite(value))) throw new Error('音频含有无效采样。');
      // 音量分析可下混/降采样，供播放和导出的素材保留立体声信息。
      await ffmpeg(['-protocol_whitelist', 'file,pipe', '-i', source, '-t', '180.01', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', '-f', 'wav', join(directory, 'track-1.wav')], signal);
      await rm(raw);
      music = musicSchema.parse({ assetId, title: title ?? basename(path), kind: 'audio', sourceName: basename(path),
        sourceSha256: createHash('sha256').update(data).digest('hex'), duration: samples.length / sampleRate,
        sampleRate: 48000, envelopeStep: 0.05, bars: [], tempos: [], repeats: [],
        tracks: [{ id: 'track-1', name: '原曲', instrument: 'audio', percussion: false, notes: [], stem: 'track-1.wav', envelope: envelope(samples) }],
      });
    }
    await writeFile(join(directory, 'music.json'), JSON.stringify(music));
    return music;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
