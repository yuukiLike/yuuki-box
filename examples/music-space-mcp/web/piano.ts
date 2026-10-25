import * as THREE from 'three/webgpu';
import type { Music, MusicScene } from '../src/contracts.js';
import { noteName } from '../src/presentation.js';
import { box, disposeModel, finish, label, modelFile, rod } from './model.js';

const blackPitchClasses = new Set([1, 3, 6, 8, 10]);

export class RehearsalPiano {
  readonly group = new THREE.Group();
  private readonly lid = new THREE.Group();
  private readonly labels = new THREE.Group();
  private readonly keyboard = new THREE.Group();
  private readonly keys = new Map<number, { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardNodeMaterial>; rest: number; dark: boolean }>();
  private readonly guide: THREE.InstancedMesh;
  private readonly notePositions = new Map<number, number>();
  constructor(private readonly music: Music, private settings: MusicScene) {
    this.group.name = 'MIDI Rehearsal Piano';
    const ebony = finish('#141b22', 0.45, 0.23); const wood = finish('#5a3624', 0.15, 0.45); const brass = finish('#c4a573', 0.75, 0.28);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.3, 0.25, 96), finish('#202934', 0.3, 0.55));
    platform.name = 'Display Platform'; platform.position.y = -0.16; platform.receiveShadow = true; this.group.add(platform);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9.08, 0.025, 6, 128), brass); rim.rotation.x = Math.PI / 2; rim.position.y = -0.02; rim.name = 'Platform Rim'; this.group.add(rim);
    const outline = new THREE.Shape(); outline.moveTo(-6, -2.2); outline.lineTo(6, -2.2); outline.lineTo(6, 0.1);
    outline.bezierCurveTo(6, 2, 3, 2.1, 2.5, 3.6); outline.bezierCurveTo(2, 5, -1, 5.2, -6, 4.8); outline.closePath();
    const bodyGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.45, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.07, bevelThickness: 0.07, steps: 1 }); bodyGeometry.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(bodyGeometry, ebony); body.name = 'Piano Case'; body.position.y = 2.2; body.castShadow = true; this.group.add(body);
    const plate = new THREE.Mesh(new THREE.ShapeGeometry(outline, 32).rotateX(-Math.PI / 2), brass); plate.name = 'Harp Plate'; plate.position.y = 2.68; plate.scale.set(0.96, 1, 0.96); this.group.add(plate);
    for (let i = 0; i < 48; i++) {
      const x = -5.7 + i * 0.22; const length = 3.6 + Math.sin(i / 48 * Math.PI) * 1.6;
      rod(this.group, `String ${i + 1}`, new THREE.Vector3(x, 2.73, 1.7), new THREE.Vector3(x, 2.73, 1.7 - length), 0.006, finish('#e9d2a4', 0.65, 0.3));
    }
    for (const [i, position] of [[-5, 1.05, 1.45], [4.8, 1.05, 1.25], [-4.5, 1.05, -3.1]].entries()) {
      rod(this.group, `Leg ${i + 1}`, new THREE.Vector3(position[0], 0.15, position[2]), new THREE.Vector3(position[0], 2.28, position[2]), 0.18, ebony);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), brass); foot.name = `Caster ${i + 1}`; foot.position.set(position[0] ?? 0, 0.16, position[2] ?? 0); this.group.add(foot);
    }
    const lidGeometry = new THREE.ExtrudeGeometry(outline, { depth: 0.12, bevelEnabled: false }).rotateX(-Math.PI / 2);
    const lid = new THREE.Mesh(lidGeometry, ebony); lid.position.x = 6; lid.name = 'piano.lid'; lid.castShadow = true; this.lid.add(lid);
    this.lid.position.set(-6, 2.9, 0); this.group.add(this.lid);
    box(this.group, 'Keyboard Bed', [12.3, 0.3, 2.15], [0, 2.55, 2.8], wood);
    box(this.group, 'Fallboard', [12.2, 0.9, 0.24], [0, 3.0, 1.85], ebony);
    box(this.group, 'Keyboard Left Cheek', [0.25, 0.48, 2.2], [-6.08, 2.75, 2.83], ebony);
    box(this.group, 'Keyboard Right Cheek', [0.25, 0.48, 2.2], [6.08, 2.75, 2.83], ebony);
    this.keyboard.name = 'piano.keyboard'; this.group.add(this.keyboard);
    let white = 0;
    for (let midi = 21; midi <= 108; midi++) {
      const dark = blackPitchClasses.has(midi % 12);
      const x = dark ? (white - 0.5) * 0.226 - 5.763 : white++ * 0.226 - 5.763;
      const geometry = new THREE.BoxGeometry(dark ? 0.126 : 0.218, dark ? 0.25 : 0.19, dark ? 1.03 : 1.86);
      const material = finish(dark ? '#10141a' : '#eee9d8', dark ? 0.18 : 0.02, dark ? 0.28 : 0.36);
      const mesh = new THREE.Mesh(geometry, material); const rest = dark ? 2.99 : 2.82;
      mesh.position.set(x, rest, dark ? 2.44 : 2.84); mesh.name = `Key_${noteName(midi)}_${midi}`; mesh.castShadow = true; mesh.receiveShadow = true;
      this.keys.set(midi, { mesh, rest, dark }); this.notePositions.set(midi, x); this.keyboard.add(mesh);
      if (midi === 60 || midi === 48 || midi === 72) label(this.labels, noteName(midi), [x, 3.08, 4.15], 0.75);
    }
    for (let i = 0; i < 3; i++) box(this.group, `Pedal ${i + 1}`, [0.28, 0.09, 0.68], [(i - 1) * 0.42, 0.4, 2.72], brass);
    box(this.group, 'Pedal Lyre', [1.2, 1.8, 0.16], [0, 1.3, 2.28], ebony);
    box(this.group, 'Bench Seat', [4.3, 0.42, 1.55], [0, 1.35, 6.1], finish('#302a28', 0.04, 0.8));
    for (const x of [-1.8, 1.8]) for (const z of [5.6, 6.6]) box(this.group, 'Bench Leg', [0.16, 1.2, 0.16], [x, 0.6, z], wood);
    label(this.labels, '88 键 · MIDI 音高', [0, 1.7, 4.35], 3);
    this.group.add(this.labels);
    const count = music.tracks.reduce((sum, track) => sum + track.notes.length, 0);
    this.guide = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), count);
    this.guide.name = 'piano.guide'; this.guide.userData.helper = true; this.guide.frustumCulled = false; this.group.add(this.guide);
    this.update(settings);
  }
  update(settings: MusicScene): void {
    this.settings = settings; this.lid.rotation.z = THREE.MathUtils.degToRad(settings.model.lidAngle); this.labels.visible = settings.presentation.labels;
    this.guide.visible = settings.model.showGuide;
  }
  focus(): THREE.Vector3 { return this.settings.presentation.view === 'detail' ? new THREE.Vector3(0, 2.8, 2.9) : new THREE.Vector3(0, 3.0, 0.4); }
  pressedKeys(): number[] { return [...this.keys].filter(([, key]) => key.mesh.position.y < key.rest - 0.01).map(([midi]) => midi); }
  frame(time: number, audible: string[]): void {
    const active = new Map<number, { color: THREE.Color; velocity: number }>(); const transform = new THREE.Object3D(); let index = 0;
    for (const [voice, track] of this.music.tracks.entries()) {
      const color = new THREE.Color(this.settings.colors[voice % this.settings.colors.length]); const sounding = audible.includes(track.id);
      for (const note of track.notes) {
        if (sounding && note.time <= time && time < note.time + note.duration) active.set(note.midi, { color, velocity: note.velocity });
        const x = this.notePositions.get(note.midi); const ahead = note.time - time;
        if (!sounding || x === undefined || ahead < 0 || ahead > 4) transform.scale.setScalar(0);
        else {
          transform.position.set(x, 3.22 + ahead * this.settings.score.timeScale * 0.75 + voice * this.settings.score.layerSpacing * 0.055, 2.6 - ahead * 0.3);
          transform.scale.set(0.15, Math.max(0.04, note.duration * this.settings.score.pitchScale * 1.8), 0.12);
        }
        transform.updateMatrix(); this.guide.setMatrixAt(index, transform.matrix); this.guide.setColorAt(index++, color.clone().multiplyScalar(1.5));
      }
    }
    this.guide.instanceMatrix.needsUpdate = true; if (this.guide.instanceColor) this.guide.instanceColor.needsUpdate = true;
    for (const [midi, key] of this.keys) {
      const note = active.get(midi); key.mesh.position.y = key.rest - (note ? 0.09 + note.velocity * 0.035 : 0);
      key.mesh.material.color.set(key.dark ? '#10141a' : '#eee9d8'); key.mesh.material.emissive.setScalar(0);
      if (note) { key.mesh.material.color.copy(note.color).multiplyScalar(0.3); key.mesh.material.emissive.copy(note.color).multiplyScalar(0.08); }
    }
  }
  async model(): Promise<ArrayBuffer> { return await modelFile(this.group, { assetId: this.music.assetId, mapping: 'MIDI 21-108 maps to the 88 keyboard keys', units: 'display scale', title: this.music.title }); }
  dispose(): void { disposeModel(this.group); }
}
