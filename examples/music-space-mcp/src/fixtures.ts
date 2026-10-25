import midiPackage from '@tonejs/midi';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeDemoMidi(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const midi = new midiPackage.Midi();
  midi.name = 'Three lines, one passage'; midi.header.setTempo(108);
  midi.header.timeSignatures = [{ ticks: 0, timeSignature: [4, 4] }]; midi.header.update();
  midi.header.meta = [
    { ticks: 0, type: 'marker', text: 'Opening' }, { ticks: 3840, type: 'marker', text: 'Answer' },
    { ticks: 11520, type: 'marker', text: 'Interweave' }, { ticks: 15360, type: 'marker', text: 'Return' },
    { ticks: 26880, type: 'marker', text: 'Afterglow' },
  ];
  const melody = midi.addTrack(); melody.name = 'Melody'; melody.instrument.number = 40;
  const counter = midi.addTrack(); counter.name = 'Counterline'; counter.instrument.number = 0;
  const bass = midi.addTrack(); bass.name = 'Bass'; bass.instrument.number = 42;
  const patterns = [[72, 74, 76, 79, 76, 74, 72, 71], [69, 72, 74, 76, 74, 72, 71, 69], [67, 71, 74, 76, 74, 71, 69, 67], [65, 69, 72, 74, 72, 69, 67, 65]];
  for (let bar = 0; bar < 16; bar++) {
    const pattern = patterns[bar % 4] ?? patterns[0] ?? [];
    if (![4, 5, 12, 13].includes(bar)) pattern.forEach((pitch, index) => melody.addNote({ midi: pitch, ticks: bar * 1920 + index * 240, durationTicks: 210, velocity: 0.66 + (index % 4 === 0 ? 0.08 : 0) }));
    if (bar >= 2 && ![8, 9].includes(bar)) {
      const response = patterns[(bar - 2) % 4] ?? [];
      response.forEach((pitch, index) => counter.addNote({ midi: pitch - 12, ticks: bar * 1920 + index * 240 + 100, durationTicks: 210, velocity: 0.5 }));
    }
    [0, 2].forEach(beat => bass.addNote({ midi: [48, 45, 43, 41][bar % 4] ?? 48,
      ticks: bar * 1920 + beat * 480, durationTicks: 880, velocity: 0.58 }));
  }
  const path = join(directory, 'three-lines.mid'); await writeFile(path, midi.toArray()); return path;
}
