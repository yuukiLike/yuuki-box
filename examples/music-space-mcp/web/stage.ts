import * as THREE from 'three/webgpu';
import { texture, uniform, uv } from 'three/tsl';
import { depthSchema, type MusicScene } from '../src/contracts.js';
import { cueAt } from '../src/timeline.js';
import { box, disposeModel, finish, label, modelFile, rod } from './model.js';

export class StagePreview {
  readonly group = new THREE.Group();
  private readonly labels = new THREE.Group();
  private readonly screen = new THREE.Group();
  private readonly speakers: THREE.Group[] = [];
  private readonly speakerRoot = new THREE.Group();
  private readonly lights: { lamp: THREE.SpotLight; face: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicNodeMaterial>; target: THREE.Object3D }[] = [];
  private readonly pictures: { mesh: THREE.Mesh; depth: number; foreground: boolean }[] = [];
  private readonly exposure = uniform(0.8);
  private readonly beamOpacity = uniform(0.03);
  private readonly dimensions = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xd4c6a8, transparent: true, opacity: 0.8 }));
  private depthValues: number[] = [];
  private constructor(private settings: MusicScene) {
    this.group.name = 'Concert Stage Previsualization';
    const black = finish('#161c24', 0.24, 0.4); const steel = finish('#71808c', 0.85, 0.3); const brass = finish('#bd9e6c', 0.65, 0.3);
    const floor = box(this.group, 'stage.deck', [16, 0.55, 8], [0, 0.25, 0], finish('#343335', 0.12, 0.65)); floor.receiveShadow = true;
    for (let i = 0; i < 19; i++) box(this.group, `Deck Board ${i + 1}`, [15.9, 0.015, 0.012], [0, 0.535, -3.8 + i * 0.4], finish('#25282d', 0, 0.85));
    box(this.group, 'Deck Front Light', [15.5, 0.04, 0.04], [0, 0.45, 4.02], new THREE.MeshBasicNodeMaterial({ color: 0xdfaf73 }));
    for (let i = 0; i < 3; i++) box(this.group, `Access Step ${i + 1}`, [4.5 + i * 1.1, 0.5 - i * 0.15, 0.6], [0, 0.25 - i * 0.075, 4.3 + i * 0.6], black);
    box(this.screen, 'Screen Frame', [9.65, 5.5, 0.22], [0, 0, -0.12], black);
    for (const x of [-4.65, 4.65]) box(this.screen, 'Screen Side Trim', [0.025, 5.26, 0.05], [x, 0, 0.025], brass);
    this.screen.name = 'stage.screen'; this.screen.position.z = -3.6; this.group.add(this.screen);
    this.speakerRoot.name = 'stage.speakers'; this.group.add(this.speakerRoot);
    for (const side of [-1, 1]) {
      const stack = new THREE.Group(); stack.name = side < 0 ? 'Speaker Left' : 'Speaker Right'; stack.position.z = 0.55;
      for (let tier = 0; tier < 2; tier++) {
        const y = 1.55 + tier * 2.05;
        box(stack, `${side < 0 ? 'Left' : 'Right'} Speaker Cabinet ${tier + 1}`, [1.15, 1.98, 0.85], [0, y, 0], black);
        box(stack, 'Speaker Grille', [0.98, 1.75, 0.035], [0, y, 0.45], finish('#252d37', 0.5, 0.6));
        for (const dy of [-0.43, 0.43]) {
          const cone = new THREE.Mesh(new THREE.CircleGeometry(0.31, 32), finish('#0a0f16', 0.1, 0.8)); cone.position.set(0, y + dy, 0.478); cone.name = 'Speaker Driver'; stack.add(cone);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.018, 6, 32), steel); rim.position.copy(cone.position); rim.name = 'Speaker Driver Rim'; stack.add(rim);
        }
        for (let i = 0; i < 11; i++) box(stack, 'Speaker Grille Bar', [0.008, 1.72, 0.01], [-0.43 + i * 0.086, y, 0.49], steel);
      }
      box(stack, 'Speaker Base', [1.5, 0.2, 1.15], [0, 0.65, 0], black); this.speakers.push(stack); this.speakerRoot.add(stack);
      const wedge = box(this.group, side < 0 ? 'Monitor Left' : 'Monitor Right', [1.3, 0.55, 0.9], [side * 2.4, 0.8, 2.8], black); wedge.rotation.x = -0.3;
    }
    for (const x of [-7.4, 7.4]) {
      for (const z of [-3.4, -2.8]) rod(this.group, 'Truss Upright', new THREE.Vector3(x, 0.6, z), new THREE.Vector3(x, 8.1, z), 0.07, steel);
      box(this.group, 'Truss Foot', [1.15, 0.16, 1.35], [x, 0.64, -3.1], black);
      for (let y = 1; y < 8; y += 0.8) rod(this.group, 'Truss Brace', new THREE.Vector3(x, y, -3.4), new THREE.Vector3(x, y + 0.8, -2.8), 0.027, steel);
    }
    for (const y of [7.7, 8.2]) for (const z of [-3.4, -2.8]) rod(this.group, 'Lighting Truss', new THREE.Vector3(-7.4, y, z), new THREE.Vector3(7.4, y, z), 0.065, steel);
    for (let x = -7.4; x < 7.2; x += 0.7) {
      rod(this.group, 'Truss Diagonal', new THREE.Vector3(x, 7.7, -2.8), new THREE.Vector3(x + 0.7, 8.2, -2.8), 0.022, steel);
      rod(this.group, 'Truss Cross Brace', new THREE.Vector3(x, 7.7, -3.4), new THREE.Vector3(x + 0.7, 8.2, -3.4), 0.022, steel);
    }
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 2.6;
      const fixture = new THREE.Group(); fixture.position.set(x, 7.65, -2.7); fixture.rotation.x = -0.4;
      box(fixture, 'Light Yoke', [0.65, 0.15, 0.35], [0, 0.15, 0], steel);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.27, 0.55, 20), black); body.name = `Light Fixture ${i + 1}`; body.rotation.x = Math.PI / 2; fixture.add(body);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicNodeMaterial({ color: 0xd4c49d })); face.position.z = 0.29; face.name = `Light Lens ${i + 1}`; fixture.add(face); this.group.add(fixture);
      const target = new THREE.Object3D(); target.position.set(x * 0.6, 0.55, 2); this.group.add(target);
      const lamp = new THREE.SpotLight(0x9bc7ed, 35, 18, 0.28, 0.75, 1.5); lamp.position.set(x, 7.55, -2.4); lamp.target = target; this.group.add(lamp);
      this.lights.push({ lamp, face, target });
      const material = new THREE.MeshBasicNodeMaterial({ color: 0xa5c4de, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      material.opacityNode = uv().x.mul(Math.PI).sin().pow(4).mul(uv().y.mul(Math.PI).sin()).mul(this.beamOpacity);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 7.8), material); beam.position.set(x, 4, -0.5); beam.rotation.x = 0.48; beam.userData.helper = true; this.group.add(beam);
    }
    rod(this.group, 'Microphone Stand', new THREE.Vector3(0, 0.6, 1.1), new THREE.Vector3(0, 2.4, 1.1), 0.025, black);
    const mic = box(this.group, 'Microphone', [0.12, 0.1, 0.42], [0, 2.45, 1.1], black); mic.rotation.x = 0.25;
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; rod(this.group, 'Mic Tripod', new THREE.Vector3(0, 0.7, 1.1), new THREE.Vector3(Math.cos(a) * 0.4, 0.57, 1.1 + Math.sin(a) * 0.4), 0.025, black); }
    label(this.labels, '01 / 演出主屏', [0, 7.05, -3.2], 3); label(this.labels, '02 / 灯架与灯具', [0, 8.8, -3], 3.5);
    label(this.labels, '03 / 左右音箱', [0, 0.85, 1.75], 3); this.labels.add(this.dimensions); this.group.add(this.labels);
  }
  static async create(settings: MusicScene): Promise<StagePreview> {
    const result = new StagePreview(settings); const loader = new THREE.TextureLoader();
    const picture = await loader.loadAsync(`/media/scenes/${settings.sceneId}/photo.png`);
    const response = await fetch(`/media/scenes/${settings.sceneId}/depth.json`); const raw: unknown = await response.json();
    const depth = depthSchema.parse(raw); result.depthValues = depth.values;
    result.addPicture(picture, 0, false, depth.width - 1, depth.height - 1);
    for (const layer of settings.photoLayers) result.addPicture(await loader.loadAsync(`/media/scenes/${settings.sceneId}/${layer.file}`), layer.depth, true, 1, 1);
    result.update(settings); return result;
  }
  private addPicture(picture: THREE.Texture, depth: number, foreground: boolean, x: number, y: number): void {
    picture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicNodeMaterial({ transparent: foreground, depthWrite: !foreground, side: THREE.DoubleSide, alphaTest: foreground ? 0.01 : 0 });
    material.map = picture;
    const sample = texture(picture); material.colorNode = sample.rgb.mul(this.exposure); if (foreground) material.opacityNode = sample.a;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9.3, 5.23, x, y), material); mesh.name = foreground ? 'Screen Alpha Layer' : 'Screen Artwork';
    mesh.renderOrder = foreground ? 3 + depth : 0; this.screen.add(mesh); this.pictures.push({ mesh, depth, foreground });
  }
  update(settings: MusicScene): void {
    this.settings = settings; this.screen.position.y = settings.model.screenHeight; this.labels.visible = settings.presentation.labels;
    this.speakers.forEach((speaker, i) => { speaker.position.x = (i ? 1 : -1) * settings.model.speakerSpread / 2; });
    const half = settings.model.speakerSpread / 2;
    this.dimensions.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-half, 0.57, 1.4, half, 0.57, 1.4, -half, 0.57, 1.1, -half, 0.57, 1.7, half, 0.57, 1.1, half, 0.57, 1.7], 3));
    const screenLabel = this.labels.children[0]; const lightLabel = this.labels.children[1];
    if (settings.presentation.view === 'plan') {
      screenLabel?.position.set(0, 1, -5.3); lightLabel?.position.set(-6.1, 1, -5.3);
    } else {
      screenLabel?.position.set(0, settings.model.screenHeight + 3, -3.2); lightLabel?.position.set(0, 8.8, -3);
    }
    for (const { mesh, depth, foreground } of this.pictures) {
      mesh.position.z = 0.04 + (foreground ? depth * 0.055 * settings.photo.depthStrength : 0);
      if (!foreground && settings.depthSource !== 'layers') {
        const positions = mesh.geometry.getAttribute('position'); this.depthValues.forEach((value, i) => positions.setZ(i, (value - 0.5) * settings.photo.depthStrength * 0.3)); positions.needsUpdate = true;
      }
    }
  }
  focus(): THREE.Vector3 { return new THREE.Vector3(0, this.settings.presentation.view === 'detail' ? this.settings.model.screenHeight : 3.3, this.settings.presentation.view === 'detail' ? -1.5 : 0); }
  frame(time: number, energy: number): void {
    const cue = cueAt(this.settings, time);
    this.exposure.value = 0.68 + cue.light * 0.12 + energy * this.settings.photo.pulse;
    this.beamOpacity.value = 0.018 + cue.light * 0.018 + energy * this.settings.photo.pulse * 0.2;
    for (const [i, { lamp, face, target }] of this.lights.entries()) {
      lamp.color.setHSL(0.58 - cue.light * 0.48, 0.65, 0.65); lamp.intensity = 24 + cue.light * 38 + energy * 25;
      face.material.color.copy(lamp.color).multiplyScalar(2.2);
      target.position.x = (i - 2) * 1.5 + cue.pan * this.settings.photo.cameraTravel * 2;
    }
  }
  async model(): Promise<ArrayBuffer> { return await modelFile(this.group, { sceneId: this.settings.sceneId, units: 'presentation scale', purpose: 'stage layout and camera previsualization' }); }
  dispose(): void { disposeModel(this.group); }
}
