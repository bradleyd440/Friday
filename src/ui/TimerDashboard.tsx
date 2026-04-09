import React from 'react';
import { SessionTimer } from '../types/lockMode';

interface Props {
  timer: SessionTimer | null;
  onExtend: () => void;
  now: number;
}

export function TimerDashboard({ timer, onExtend, now }: Props): JSX.Element {
  const remainingMs = timer ? Math.max(0, timer.endAt - now) : 0;
  return (
    <section>
      <h2>Timer Dashboard</h2>
      <div>Countdown: {Math.ceil(remainingMs / 1000)}s</div>
      <button onClick={onExtend} disabled={!timer}>Spin Extension</button>
    </section>
  );
}
