import type { MusicScene } from './contracts.js';

export function noteName(midi: number): string {
  return `${['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function viewCamera(mode: MusicScene['mode'], view: MusicScene['presentation']['view']): MusicScene['camera'] {
  if (view === 'plan') return { azimuth: 0, elevation: 85, distance: 22 };
  if (view === 'detail') return { azimuth: mode === 'score' ? 0 : 18, elevation: mode === 'score' ? 55 : 18, distance: mode === 'score' ? 11 : 15 };
  return { azimuth: 24, elevation: mode === 'score' ? 30 : 24, distance: mode === 'score' ? 24 : 23 };
}

export function sceneObjects(scene: MusicScene) {
  return scene.mode === 'score' ? [
    { id: 'piano.keyboard', name: '88 键键盘', controls: ['set_transport.bar', 'set_transport.soloTrackIds', 'presentation.view'] },
    { id: 'piano.lid', name: '琴盖', controls: ['model.lidAngle'] },
    { id: 'piano.guide', name: '声部练习提示', controls: ['model.showGuide', 'score.timeScale', 'score.pitchScale', 'score.layerSpacing'] },
  ] : [
    { id: 'stage.deck', name: '舞台与阶梯', controls: ['presentation.view', 'presentation.labels'] },
    { id: 'stage.screen', name: '演出主屏', controls: ['model.screenHeight', 'photo.depthStrength'] },
    { id: 'stage.speakers', name: '左右音箱', controls: ['model.speakerSpread'] },
    { id: 'stage.lights', name: '灯架与灯具', controls: ['cues.light', 'photo.pulse'] },
  ];
}
