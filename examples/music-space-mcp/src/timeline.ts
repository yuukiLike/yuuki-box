import type { Music, MusicScene } from './contracts.js';

export function positionAt(scene: MusicScene, duration: number, now = Date.now()): number {
  return Math.max(0, Math.min(duration, scene.transport.position + (scene.transport.playing ? Math.max(0, now - scene.transport.updatedAt) / 1000 : 0)));
}

export function audibleTracks(scene: MusicScene, music: Music): string[] {
  return music.tracks.filter(track => !scene.transport.soloTrackIds.length || scene.transport.soloTrackIds.includes(track.id)).map(track => track.id);
}

export function frameAt(scene: MusicScene, music: Music, time: number) {
  const audible = audibleTracks(scene, music);
  const index = Math.min(Math.floor(time / music.envelopeStep), Math.ceil(music.duration / music.envelopeStep) - 1);
  let activeNotes = 0;
  let energy = 0;
  for (const track of music.tracks) {
    if (!audible.includes(track.id)) continue;
    energy = Math.max(energy, track.envelope[Math.max(0, index)] ?? 0);
    activeNotes += track.notes.filter(note => note.time <= time && time < note.time + note.duration).length;
  }
  return { time, activeNotes, audibleTrackIds: audible, energy };
}

export function cueAt(scene: MusicScene, time: number): { zoom: number; pan: number; label: string; light: number } {
  let previous = scene.cues[0];
  if (!previous) return { zoom: 1, pan: 0, label: '', light: 0.5 };
  for (const next of scene.cues.slice(1)) {
    if (time < next.time) {
      const progress = Math.max(0, Math.min(1, (time - previous.time) / (next.time - previous.time)));
      const smooth = progress * progress * (3 - 2 * progress);
      return { zoom: previous.zoom + (next.zoom - previous.zoom) * smooth,
        pan: previous.pan + (next.pan - previous.pan) * smooth,
        light: previous.light + (next.light - previous.light) * smooth, label: previous.label };
    }
    previous = next;
  }
  return previous;
}
