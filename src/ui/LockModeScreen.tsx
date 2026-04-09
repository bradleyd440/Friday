import React, { useState } from 'react';
import { LockModeType } from '../types/lockMode';

interface Props {
  onStart: (mode: LockModeType, intensity: number, randomness: number, durationMs: number) => void;
  onStop: () => void;
}

export function LockModeScreen({ onStart, onStop }: Props): JSX.Element {
  const [mode, setMode] = useState<LockModeType>('tease');
  const [intensity, setIntensity] = useState(30);
  const [randomness, setRandomness] = useState(20);
  const [durationMs, setDurationMs] = useState(60_000);

  return (
    <section>
      <h2>Lock Mode</h2>
      <label>Mode Selector</label>
      <select value={mode} onChange={(e) => setMode(e.target.value as LockModeType)}>
        {['tease', 'punishment', 'timed', 'random', 'edging'].map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <label>Intensity: {intensity}</label>
      <input type="range" min={0} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />

      <label>Randomness: {randomness}</label>
      <input type="range" min={0} max={100} value={randomness} onChange={(e) => setRandomness(Number(e.target.value))} />

      <label>Duration (ms): {durationMs}</label>
      <input type="range" min={1000} max={300000} step={1000} value={durationMs} onChange={(e) => setDurationMs(Number(e.target.value))} />

      <button onClick={() => onStart(mode, intensity, randomness, durationMs)}>Start</button>
      <button onClick={onStop}>Stop</button>
    </section>
  );
}
