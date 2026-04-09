import React from 'react';
import { LockEvent } from '../types/lockMode';

interface Props {
  logs: LockEvent[];
}

export function ActivityLogScreen({ logs }: Props): JSX.Element {
  return (
    <section>
      <h2>Activity Log</h2>
      <ul>
        {logs
          .slice()
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((event) => (
            <li key={event.id}>
              [{new Date(event.timestamp).toISOString()}] {event.type}: {event.message}
            </li>
          ))}
      </ul>
    </section>
  );
}
