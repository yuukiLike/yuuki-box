import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function finish(color: THREE.ColorRepresentation, metalness = 0.1, roughness = 0.35): THREE.MeshStandardNodeMaterial {
  return new THREE.MeshStandardNodeMaterial({ color, metalness, roughness });
}

export function box(parent: THREE.Object3D, name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material): THREE.Mesh {
  const radius = Math.min(...size) * 0.16;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, Math.min(0.08, radius)), material);
  mesh.name = name; mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function rod(parent: THREE.Object3D, name: string, start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 12), material);
  mesh.name = name; mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
  mesh.castShadow = true; parent.add(mesh); return mesh;
}

export function label(parent: THREE.Object3D, text: string, position: [number, number, number], width = 2.4): THREE.Sprite {
  const canvas = document.createElement('canvas'); canvas.width = text.length <= 4 ? 160 : 640; canvas.height = 112;
  const context = canvas.getContext('2d'); if (!context) throw new Error('无法创建模型标注。');
  context.fillStyle = '#101b25e8'; context.beginPath(); context.roundRect(4, 4, canvas.width - 8, 104, 14); context.fill();
  context.strokeStyle = '#8596a74d'; context.lineWidth = 2; context.stroke();
  context.fillStyle = '#ede9df'; context.font = `500 ${text.length <= 4 ? 64 : 38}px -apple-system, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, canvas.width / 2, 58);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteNodeMaterial({ map, transparent: true, depthTest: false, depthWrite: false }));
  sprite.position.set(...position); sprite.scale.set(width, width * 112 / canvas.width, 1); sprite.renderOrder = 20; parent.add(sprite); return sprite;
}

export function disposeModel(group: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) geometries.add(object.geometry);
    if (object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.Line || object instanceof THREE.Points) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose();
}

export async function modelFile(source: THREE.Group, metadata: Record<string, unknown>): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const result = new THREE.Group(); result.name = source.name; result.userData = metadata;
  source.updateMatrixWorld(true);
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.helper || object instanceof THREE.InstancedMesh) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const original = Array.isArray(object.material) ? object.material[0] : object.material;
    const material = original instanceof THREE.MeshStandardNodeMaterial || original instanceof THREE.MeshBasicNodeMaterial
      ? new THREE.MeshStandardMaterial({ color: original.color, map: original.map, vertexColors: !!geometry.getAttribute('color'),
        metalness: original instanceof THREE.MeshStandardNodeMaterial ? original.metalness : 0, roughness: 0.4, side: THREE.DoubleSide,
        transparent: original.transparent, opacity: original.opacity, alphaTest: original.alphaTest }) : new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = object.name; result.add(mesh);
  });
  try {
    const data = await new GLTFExporter().parseAsync(result, { binary: true });
    if (!(data instanceof ArrayBuffer)) throw new Error('未生成标准 GLB 模型。'); return data;
  } finally { disposeModel(result); }
}
