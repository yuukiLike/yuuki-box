import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import type { Music, MusicScene } from '../src/contracts.js';

function timeAxis(time: number, duration: number): THREE.Vector3 {
  const angle = time / duration * Math.PI * 2 - Math.PI / 2;
  return new THREE.Vector3(Math.cos(angle) * 7, Math.sin(angle) * 7, 0);
}
function strandPoint(time: number, pitch: number, voice: number, count: number, scene: MusicScene, duration: number): THREE.Vector3 {
  const angle = time / duration * Math.PI * 2 - Math.PI / 2;
  const twist = angle * 5 + voice * Math.PI * 2 / count;
  const spread = scene.score.layerSpacing * 0.8;
  const radius = 7 * scene.score.timeScale / 0.9 + Math.cos(twist) * spread + (pitch - 60) * scene.score.pitchScale * 0.17;
  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius,
    Math.sin(twist) * spread + (pitch - 60) * scene.score.pitchScale * 0.15);
}

interface Ribbon {
  mesh: THREE.Mesh; voice: number; colors: Float32Array;
  notes: { vertex: number; vertices: number }[];
}

export class ScoreWeave {
  readonly group = new THREE.Group();
  private readonly ribbons: Ribbon[] = [];
  private readonly heads: THREE.Mesh[] = [];
  private readonly gate = new THREE.Group();
  private readonly bridges: THREE.LineSegments;
  private readonly bridgePositions = new Float32Array(16 * 16 * 6);
  private readonly center = new THREE.Vector3();
  constructor(private readonly music: Music, private readonly scene: MusicScene) {
    for (const [voice, track] of music.tracks.entries()) {
      const color = new THREE.Color(scene.colors[voice % scene.colors.length]);
      const positions: number[] = []; const indices: number[] = [];
      const spans: Ribbon['notes'] = [];
      for (const [index, note] of track.notes.entries()) {
        const vertex = positions.length / 3;
        const previous = track.notes[index - 1]; const next = track.notes[index + 1];
        const gapBefore = previous ? note.time - previous.time - previous.duration : Infinity;
        const gapAfter = next ? next.time - note.time - note.duration : Infinity;
        const joinsPrevious = previous && gapBefore >= -0.00001 && gapBefore < 0.1;
        const joinsNext = next && gapAfter >= -0.00001 && gapAfter < 0.1;
        for (let step = 0; step <= 10; step++) {
          const u = step / 10; const time = note.time + note.duration * u;
          // Bend into the next pitch while keeping starts/ends at their real times.
          const pitch = u < 0.5 && joinsPrevious ? THREE.MathUtils.lerp((previous.midi + note.midi) / 2, note.midi, THREE.MathUtils.smoothstep(u * 2, 0, 1))
            : u >= 0.5 && joinsNext ? THREE.MathUtils.lerp(note.midi, (note.midi + next.midi) / 2, THREE.MathUtils.smoothstep((u - 0.5) * 2, 0, 1)) : note.midi;
          const point = strandPoint(time, pitch, voice, music.tracks.length, scene, music.duration);
          const phase = time / music.duration * Math.PI * 2 - Math.PI / 2;
          const side = new THREE.Vector3(Math.cos(phase), Math.sin(phase), Math.sin(time * 0.8) * 0.6).normalize();
          const taper = (!joinsPrevious ? Math.min(1, u * 5 + 0.12) : 1) * (!joinsNext ? Math.min(1, (1 - u) * 5 + 0.12) : 1);
          const width = (0.15 + note.velocity * 0.32) * taper;
          positions.push(...point.clone().addScaledVector(side, width).toArray(), ...point.clone().addScaledVector(side, -width).toArray());
          const offset = vertex + step * 2;
          if (step) indices.push(offset - 2, offset - 1, offset, offset - 1, offset + 1, offset);
        }
        if (joinsPrevious && vertex >= 2) indices.push(vertex - 2, vertex - 1, vertex, vertex - 1, vertex + 1, vertex);
        spans.push({ vertex, vertices: 22 });
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const colors = new Float32Array(positions.length); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.MeshPhysicalNodeMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, metalness: 0.45, roughness: 0.28, clearcoat: 1 });
      material.emissiveNode = attribute('color', 'vec3').mul(0.35);
      const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false;
      this.ribbons.push({ mesh, voice, colors, notes: spans }); this.group.add(mesh);
      const path = Array.from({ length: Math.ceil(music.duration * 16) + 1 }, (_, i) => strandPoint(Math.min(music.duration, i / 16), 60, voice, music.tracks.length, scene, music.duration));
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.06 })));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicNodeMaterial({ color: color.clone().multiplyScalar(5) }));
      this.heads.push(head); this.group.add(head);
    }
    const outer = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.012, 6, 160), new THREE.MeshBasicNodeMaterial({ color: 0x738b9c, transparent: true, opacity: 0.45 }));
    this.gate.add(outer);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.009, 4, 160, Math.PI * 1.45), new THREE.MeshBasicNodeMaterial({ color: 0xd2ab76, transparent: true, opacity: 0.6 }));
    this.gate.add(inner); this.group.add(this.gate);
    // Marker rings are cross-sections through the musical knot.
    for (const marker of music.markers) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.007, 4, 96), new THREE.MeshBasicNodeMaterial({ color: 0x557181, transparent: true, opacity: 0.19 }));
      const angle = marker.time / music.duration * Math.PI * 2 - Math.PI / 2;
      hoop.position.copy(timeAxis(marker.time, music.duration)).multiplyScalar(scene.score.timeScale / 0.9);
      hoop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0)); this.group.add(hoop);
    }
    if (scene.score.showRepeats) {
      const shown = new Set<string>();
      for (const repeat of music.repeats) {
        if (shown.has(repeat.trackId)) continue; shown.add(repeat.trackId);
        const voice = music.tracks.findIndex(track => track.id === repeat.trackId);
        const a = music.bars.find(bar => bar.number === repeat.bars[0]); const b = music.bars.find(bar => bar.number === repeat.bars[1]);
        if (!a || !b || voice < 0) continue;
        const start = strandPoint(a.time, 60, voice, music.tracks.length, scene, music.duration); const end = strandPoint(b.time, 60, voice, music.tracks.length, scene, music.duration);
        const mid = start.clone().add(end).multiplyScalar(0.5); mid.multiplyScalar(0.3); mid.z += 3;
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), new THREE.LineBasicMaterial({ color: scene.colors[voice % scene.colors.length] ?? '#ffffff', transparent: true, opacity: 0.23 })));
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.bridgePositions, 3));
    this.bridges = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xe1f3fc, transparent: true, opacity: 0.32 }));
    this.bridges.frustumCulled = false; this.group.add(this.bridges);
    const dust = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { const angle = i * 2.399963; const radius = 12 + ((i * 67) % 113) / 10; dust[i * 3] = Math.cos(angle) * radius; dust[i * 3 + 1] = Math.sin(angle) * radius; dust[i * 3 + 2] = -(i / 500) * 25 - 5; }
    const dustGeometry = new THREE.BufferGeometry(); dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    this.group.add(new THREE.Points(dustGeometry, new THREE.PointsNodeMaterial({ color: 0x78909c, size: 0.02, transparent: true, opacity: 0.3 })));
  }
  focus(): THREE.Vector3 { return this.center.set(0, 0, 0); }
  frame(time: number, audibleTrackIds: string[]): void {
    const angle = time / this.music.duration * Math.PI * 2 - Math.PI / 2;
    this.gate.position.copy(timeAxis(time, this.music.duration)).multiplyScalar(this.scene.score.timeScale / 0.9);
    this.gate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0));
    const active: { pitch: number; point: THREE.Vector3; voice: number }[] = [];
    for (const { mesh, voice, colors, notes } of this.ribbons) {
      const track = this.music.tracks[voice]; if (!track) continue;
      const audible = audibleTrackIds.includes(track.id); const color = new THREE.Color(this.scene.colors[voice % this.scene.colors.length]);
      let current: (typeof track.notes)[number] | undefined;
      for (const [index, note] of track.notes.entries()) {
        const span = notes[index]; if (!span) continue;
        const playing = audible && note.time <= time && time < note.time + note.duration;
        const light = !audible ? 0.035 : playing ? 3.6 : note.time < time ? 0.5 : 0.9;
        for (let i = span.vertex; i < span.vertex + span.vertices; i++) { colors[i * 3] = color.r * light; colors[i * 3 + 1] = color.g * light; colors[i * 3 + 2] = color.b * light; }
        if (playing) { current = note; if (active.length < 256) active.push({ pitch: note.midi, point: strandPoint(time, note.midi, voice, this.music.tracks.length, this.scene, this.music.duration), voice }); }
      }
      mesh.geometry.getAttribute('color').needsUpdate = true;
      const head = this.heads[voice]; if (head) { head.visible = !!current; if (current) head.position.copy(strandPoint(time, current.midi, voice, this.music.tracks.length, this.scene, this.music.duration)); }
    }
    let vertices = 0;
    for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
      const first = active[a]; const second = active[b]; if (!first || !second || first.voice === second.voice || vertices >= 16 * 16 * 2) continue;
      if (![0, 5, 7].includes(Math.abs(first.pitch - second.pitch) % 12)) continue;
      for (const point of [first.point, second.point]) { this.bridgePositions.set(point.toArray(), vertices * 3); vertices++; }
    }
    this.bridges.geometry.setDrawRange(0, vertices); this.bridges.geometry.getAttribute('position').needsUpdate = true;
  }
  dispose(): void {
    this.group.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); } });
  }
  async model(): Promise<ArrayBuffer> {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const sculpture = new THREE.Group(); sculpture.name = 'Phrase Knot';
    sculpture.userData = { assetId: this.music.assetId, title: this.music.title, duration: this.music.duration,
      mapping: 'time around ring; voice as strand; pitch bends strand; velocity sets width; rests leave gaps', units: 'artistic, not physical scale' };
    for (const ribbon of this.ribbons) {
      const geometry = ribbon.mesh.geometry.clone(); const colors = geometry.getAttribute('color');
      for (let i = 0; i < colors.count; i++) colors.setXYZ(i, Math.min(1, colors.getX(i)), Math.min(1, colors.getY(i)), Math.min(1, colors.getZ(i)));
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.45, roughness: 0.28, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = this.music.tracks[ribbon.voice]?.name ?? `Voice ${ribbon.voice + 1}`; sculpture.add(mesh);
    }
    try {
      const result = await new GLTFExporter().parseAsync(sculpture, { binary: true });
      if (!(result instanceof ArrayBuffer)) throw new Error('模型导出未生成 GLB。');
      return result;
    } finally { sculpture.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const material = object.material; if (!Array.isArray(material)) material.dispose(); } }); }
  }
}
