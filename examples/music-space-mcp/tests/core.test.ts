import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import midiPackage from '@tonejs/midi';
import sharp from 'sharp';
import { decodeOwnWav, midiData, wav } from '../src/media.js';
import { MusicStore } from '../src/store.js';
import { cueAt, frameAt } from '../src/timeline.js';
import { fixture } from './helpers.js';

test('MIDI 速度/拍号变化定位为真实秒数，默认速度覆盖首个事件之前的时间', () => {
  const midi = new midiPackage.Midi();
  midi.header.tempos = [{ ticks: 0, bpm: 120 }, { ticks: 960, bpm: 60 }];
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }, { ticks: 1920, timeSignature: [3, 4] }];
  midi.header.update();
  midi.addTrack().addNote({ midi: 60, ticks: 4800, durationTicks: 480, velocity: 0.6 });
  const music = midiData(Buffer.from(midi.toArray()), '11111111-1111-4111-8111-111111111111', '变速', 'test.mid');
  assert.equal(music.bars[1]?.time, 3); assert.equal(music.bars[1]?.numerator, 3);
  assert.equal(music.bars[2]?.time, 6); assert.equal(music.tracks[0]?.notes[0]?.time, 9);
  midi.header.tempos = [{ ticks: 960, bpm: 60 }]; midi.header.update();
  const delayed = midiData(Buffer.from(midi.toArray()), '11111111-1111-4111-8111-111111111111', '默认速度', 'test.mid');
  assert.equal(delayed.tracks[0]?.notes[0]?.time, 9);
  assert.equal(delayed.tempos[0]?.bpm, 120);
});

test('归一化 WAV 兼容附加元数据 chunk，损坏文件明确拒绝', () => {
  const samples = new Float32Array([0, 0.25, -0.5, 0.75]);
  const original = wav(samples);
  const extra = Buffer.alloc(10); extra.write('JUNK'); extra.writeUInt32LE(1, 4);
  const withMetadata = Buffer.concat([original.subarray(0, 36), extra, original.subarray(36)]);
  withMetadata.writeUInt32LE(withMetadata.length - 8, 4);
  const decoded = decodeOwnWav(withMetadata);
  for (let i = 0; i < samples.length; i++) assert.ok(Math.abs((samples[i] ?? 0) - (decoded[i] ?? 0)) < 0.00004);
  assert.throws(() => decodeOwnWav(withMetadata.subarray(0, 40)));
});

test('小节定位、独听与重复关系可保存恢复，音符结束边界不会继续发声', async t => {
  const f = await fixture(t);
  assert.equal(f.music.tracks.length, 3); assert.ok(f.music.repeats.length > 0);
  assert.deepEqual(f.music.markers.map(marker => marker.label), ['Opening', 'Answer', 'Interweave', 'Return', 'Afterglow']);
  const scene = await f.store.create(f.music.assetId, 'score', {});
  const changed = await f.store.transport({ sceneId: scene.sceneId, bar: 8, playing: false, soloTrackIds: ['track-2'] });
  assert.equal(changed.transport.position, f.music.bars[7]?.time);
  const restored = await new MusicStore(f.store.root).scene(scene.sceneId);
  assert.deepEqual(restored, changed);
  assert.deepEqual(frameAt(restored, f.music, changed.transport.position).audibleTrackIds, ['track-2']);
  const note = f.music.tracks[1]?.notes[0]; assert.ok(note);
  assert.equal(frameAt(restored, f.music, note.time).activeNotes, 1);
  assert.equal(frameAt(restored, f.music, note.time + note.duration).activeNotes, 0);
  assert.equal(frameAt(restored, f.music, 1).activeNotes, 0, '第二声部在第三小节才进入');
  const halfway = (scene.cues[0]!.time + scene.cues[1]!.time) / 2;
  assert.ok(Math.abs(cueAt(scene, halfway).light - 0.375) < 1e-6);
  await assert.rejects(() => f.store.transport({ sceneId: scene.sceneId, bar: 99999 }), /小节不存在/);
  await assert.rejects(() => f.store.transport({ sceneId: scene.sceneId, time: 99999 }), /超过/);
  await assert.rejects(() => f.store.transport({ sceneId: scene.sceneId, soloTrackIds: ['nonexistent'] }), /不存在/);
});

test('独立透明图层保存深度；拒绝不透明素材和两种深度输入同时使用', async t => {
  const f = await fixture(t); const image = join(f.directory, 'stage.png'); const layer = join(f.directory, 'arch.png');
  await sharp({ create: { width: 160, height: 90, channels: 3, background: '#202a31' } }).png().toFile(image);
  await sharp({ create: { width: 160, height: 90, channels: 4, background: { r: 120, g: 80, b: 40, alpha: 0.2 } } }).png().toFile(layer);
  const scene = await f.store.create(f.music.assetId, 'photo', { imagePath: image, layers: [{ path: layer, depth: 3 }] });
  assert.equal(scene.depthSource, 'layers'); assert.deepEqual(scene.photoLayers, [{ file: 'layer-1.png', depth: 3 }]);
  assert.equal((await sharp(join(f.store.root, 'scenes', scene.sceneId, 'layer-1.png')).metadata()).hasAlpha, true);
  await assert.rejects(() => f.store.create(f.music.assetId, 'photo', { imagePath: image, layers: [{ path: image, depth: 3 }] }), /透明/);
  await sharp({ create: { width: 160, height: 90, channels: 4, background: { r: 120, g: 80, b: 40, alpha: 1 } } }).png().toFile(layer);
  await assert.rejects(() => f.store.create(f.music.assetId, 'photo', { imagePath: image, layers: [{ path: layer, depth: 3 }] }), /实际透明/);
  await assert.rejects(() => f.store.create(f.music.assetId, 'photo', { imagePath: image, depthPath: image, layers: [{ path: layer, depth: 3 }] }), /请选择/);
  assert.equal((await f.store.list()).length, 1);
});

test('同版本并发更新只接受一次，过期配置和非法关键帧不会覆盖结果', async t => {
  const f = await fixture(t); const scene = await f.store.create(f.music.assetId, 'score', {});
  const results = await Promise.allSettled([
    f.store.update({ sceneId: scene.sceneId, expectedRevision: 1, title: '我的场景' }),
    f.store.update({ sceneId: scene.sceneId, expectedRevision: 1, title: '旧窗口的场景' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await f.store.scene(scene.sceneId)).title, '我的场景');
  await assert.rejects(() => f.store.update({ sceneId: scene.sceneId, expectedRevision: 2, cues: [{ time: 100, label: '错误', zoom: 1, pan: 0 }] }), /时间/);
  assert.equal((await f.store.scene(scene.sceneId)).revision, 2);
});

test('机位与部件参数保存恢复；非法参数不会覆盖模型配置', async t => {
  const f = await fixture(t); const scene = await f.store.create(f.music.assetId, 'score', {});
  const updated = await f.store.update({ sceneId: scene.sceneId, expectedRevision: scene.revision,
    presentation: { view: 'detail' }, model: { lidAngle: 45, showGuide: false } });
  assert.equal(updated.camera.distance, 11); assert.equal(updated.model.lidAngle, 45); assert.equal(updated.presentation.view, 'detail');
  const restored = await new MusicStore(f.store.root).scene(scene.sceneId); assert.deepEqual(restored, updated);
  assert.ok((await f.store.inspect(scene.sceneId)).objects.some(object => object.id === 'piano.lid' && object.controls.includes('model.lidAngle')));
  await assert.rejects(() => f.store.update({ sceneId: scene.sceneId, expectedRevision: updated.revision, model: { lidAngle: 90 } }));
  assert.equal((await f.store.scene(scene.sceneId)).revision, updated.revision);
});

test('照片深度来源明确；支持提供深度图，宽高比错误不会留下半成品场景', async t => {
  const f = await fixture(t);
  const image = join(f.directory, 'image.png'); const depth = join(f.directory, 'depth.png');
  await sharp({ create: { width: 160, height: 90, channels: 3, background: '#345678' } }).png().toFile(image);
  await sharp({ create: { width: 160, height: 90, channels: 3, background: '#999999' } }).png().toFile(depth);
  const photo = await f.store.create(f.music.assetId, 'photo', { imagePath: image, depthPath: depth });
  assert.equal(photo.depthSource, 'provided');
  const plain = await f.store.create(f.music.assetId, 'photo', { imagePath: image });
  assert.equal(plain.depthSource, 'layered');
  await sharp({ create: { width: 30, height: 90, channels: 3, background: '#999999' } }).png().toFile(depth);
  await assert.rejects(() => f.store.create(f.music.assetId, 'photo', { imagePath: image, depthPath: depth }), /宽高比/);
  assert.equal((await f.store.list()).length, 2);
  const audio = await f.store.import(join(f.store.root, 'assets', f.music.assetId, 'track-1.wav'));
  assert.equal(audio.kind, 'audio'); assert.equal(audio.bars.length, 0); assert.equal(audio.tracks[0]?.notes.length, 0);
  assert.equal(audio.sampleRate, 48000);
  await assert.rejects(() => f.store.create(audio.assetId, 'score', {}), /需要多轨 MIDI/);
});

test('拒绝越界标识、符号链接和坏输入，保留原文件与已成功导入的音乐', async t => {
  const f = await fixture(t);
  await assert.rejects(() => f.store.scene('../outside'));
  const outside = join(f.directory, 'outside'); await mkdir(outside);
  const fakeId = '22222222-2222-4222-8222-222222222222';
  await symlink(outside, join(f.store.root, 'assets', fakeId));
  await assert.rejects(() => f.store.music(fakeId), /符号链接/);
  const bad = join(f.directory, 'bad.mid'); await writeFile(bad, 'not a MIDI');
  await assert.rejects(() => f.store.import(bad), /不是标准/);
  assert.equal(await readFile(bad, 'utf8'), 'not a MIDI');
  assert.equal((await readdir(join(f.store.root, 'assets'))).length, 2);
  assert.equal(existsSync(join(f.store.root, 'scenes')), false);
});
