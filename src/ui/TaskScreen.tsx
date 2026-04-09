import React from 'react';
import { LockTask } from '../types/lockMode';

interface Props {
  tasks: LockTask[];
  onCreate: () => void;
  onComplete: (taskId: string) => void;
  onApprove: (taskId: string) => void;
  onDeny: (taskId: string) => void;
}

export function TaskScreen({ tasks, onCreate, onComplete, onApprove, onDeny }: Props): JSX.Element {
  return (
    <section>
      <h2>Tasks</h2>
      <button onClick={onCreate}>Create Task</button>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <strong>{task.title}</strong> - {task.status}
            <button onClick={() => onComplete(task.id)}>Complete</button>
            <button onClick={() => onApprove(task.id)}>Approve</button>
            <button onClick={() => onDeny(task.id)}>Deny</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
