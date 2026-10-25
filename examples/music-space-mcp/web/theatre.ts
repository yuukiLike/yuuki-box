import * as THREE from 'three/webgpu';
import { texture, uniform, uv } from 'three/tsl';
import { depthSchema, type MusicScene } from '../src/contracts.js';
import { cueAt } from '../src/timeline.js';

export class PhotoTheatre {
  readonly group = new THREE.Group();
  private readonly exposure = uniform(0.9);
  private readonly tint = uniform(new THREE.Color(1, 1, 1));
  private readonly beamOpacity = uniform(0.03);
  private readonly planes: { mesh: THREE.Mesh; depth: number; foreground: boolean }[] = [];
  private readonly beams: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicNodeMaterial>[] = [];
  private readonly orbits = new THREE.Group();
  private readonly dust: THREE.Points;
  private depthValues: number[] = [];
  private pictureAspect = 16 / 9;
  private constructor(private settings: MusicScene) {
    for (let i = 0; i < 5; i++) {
      const material = new THREE.MeshBasicNodeMaterial({ color: 0xa9dcff, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      material.opacityNode = uv().x.mul(Math.PI).sin().pow(3).mul(uv().y.mul(Math.PI).sin()).mul(this.beamOpacity);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 13), material);
      beam.position.set((i - 2) * 2, 3.2, -0.5 - Math.abs(i - 2) * 0.5); beam.rotation.z = (i - 2) * -0.16;
      beam.renderOrder = 2; this.beams.push(beam); this.group.add(beam);
    }
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1 + i * 0.32, 0.008, 6, 128), new THREE.MeshBasicNodeMaterial({ color: i === 1 ? 0x8bdded : 0xffb66a, transparent: true, opacity: 0.45 }));
      ring.rotation.set(Math.PI / 2.5 + i * 0.4, i * 0.8, 0.2); this.orbits.add(ring);
    }
    this.orbits.position.set(0, -0.35, 0); this.orbits.renderOrder = 2; this.group.add(this.orbits);
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { positions[i * 3] = Math.sin(i * 2.399963) * (2 + (i % 13) * 0.38); positions[i * 3 + 1] = ((i * 47) % 100) / 10 - 4.5; positions[i * 3 + 2] = ((i * 17) % 100) / 25 - 1; }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(geometry, new THREE.PointsNodeMaterial({ color: 0xe6c79a, size: 0.016, transparent: true, opacity: 0.5, depthWrite: false }));
    this.dust.renderOrder = 3; this.group.add(this.dust);
  }
  static async create(settings: MusicScene): Promise<PhotoTheatre> {
    const result = new PhotoTheatre(settings);
    const loader = new THREE.TextureLoader();
    const picture = await loader.loadAsync(`/media/scenes/${settings.sceneId}/photo.png`);
    const size = picture.image as { width: number; height: number }; result.pictureAspect = size.width / size.height;
    const response = await fetch(`/media/scenes/${settings.sceneId}/depth.json`);
    const raw: unknown = await response.json(); const depth = depthSchema.parse(raw); result.depthValues = depth.values;
    result.addPlane(picture, -4, false, depth.width - 1, depth.height - 1);
    for (const layer of settings.photoLayers) {
      const image = await loader.loadAsync(`/media/scenes/${settings.sceneId}/${layer.file}`);
      result.addPlane(image, layer.depth, true, 1, 1);
    }
    return result;
  }
  private addPlane(picture: THREE.Texture, depth: number, foreground: boolean, widthSegments: number, heightSegments: number): void {
    picture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: foreground, depthWrite: !foreground, alphaTest: foreground ? 0.01 : 0 });
    const sample = texture(picture);
    material.colorNode = sample.rgb.mul(this.exposure).mul(this.tint);
    if (foreground) material.opacityNode = sample.a;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 16 / this.pictureAspect, widthSegments, heightSegments), material);
    mesh.renderOrder = foreground ? 4 + depth : 0;
    this.planes.push({ mesh, depth, foreground }); this.group.add(mesh);
  }
  update(settings: MusicScene): void { this.settings = settings; }
  frame(time: number, energy: number, camera: THREE.PerspectiveCamera): void {
    const cue = cueAt(this.settings, time); const settings = this.settings.photo;
    const travel = settings.cameraTravel;
    camera.position.set((Math.sin(time * 0.24) * 0.7 + cue.pan) * travel * 3.5, Math.sin(time * 0.17) * travel * 0.55, 16);
    camera.lookAt(cue.pan * travel * 0.2, 0, -2);
    for (const { mesh, depth, foreground } of this.planes) {
      mesh.position.z = foreground ? depth * settings.depthStrength : -4;
      const distance = 16 - mesh.position.z;
      const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const cover = Math.max(visibleHeight * camera.aspect / 16, visibleHeight / (16 / this.pictureAspect));
      mesh.scale.setScalar(cover * settings.zoom * cue.zoom * (foreground ? 1.02 : 1.08));
      if (!foreground && this.settings.depthSource !== 'layers') {
        const positions = mesh.geometry.getAttribute('position');
        this.depthValues.forEach((value, i) => positions.setZ(i, (value - 0.5) * settings.depthStrength * 2)); positions.needsUpdate = true;
      }
    }
    this.exposure.value = 0.72 + cue.light * 0.22 + energy * settings.pulse;
    this.tint.value.setRGB(0.9 + cue.light * 0.1, 0.93 + cue.light * 0.02, 1 - cue.light * 0.07);
    this.beamOpacity.value = 0.012 + cue.light * 0.026 + energy * settings.pulse * 0.5;
    for (const [i, beam] of this.beams.entries()) {
      beam.rotation.z = (i - 2) * -0.16 + Math.sin(time * 0.19 + i) * (0.1 + cue.light * 0.2);
      beam.rotation.x = Math.sin(time * 0.23 + i) * 0.15;
      beam.material.color.setHSL(0.56 - cue.light * 0.46, 0.5, 0.7);
    }
    this.orbits.rotation.set(Math.sin(time * 0.23) * 0.3, time * 0.16, time * 0.07);
    this.orbits.scale.setScalar(0.8 + cue.light * 0.55 + energy * settings.pulse * 0.6);
    this.dust.rotation.y = time * 0.014; this.dust.position.y = Math.sin(time * 0.14) * 0.25;
  }
}
