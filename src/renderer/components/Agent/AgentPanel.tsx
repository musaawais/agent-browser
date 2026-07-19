import React, { useState } from 'react';
import type { AgentTask } from '../../store/types';
import { TaskForm } from './TaskForm';
import { TaskCard } from './TaskCard';

interface AgentPanelProps {
  tasks: AgentTask[];
  onTasksChange: (tasks: AgentTask[]) => void;
}

export function AgentPanel({ tasks, onTasksChange }: AgentPanelProps) {
  const [showForm, setShowForm] = useState(false);

  const handleTaskCreated = (task: AgentTask) => {
    onTasksChange([...tasks, task]);
    setShowForm(false);
  };

  const handleTaskUpdate = (updated: AgentTask) => {
    onTasksChange(tasks.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleTaskDelete = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header actions */}
      {!showForm && (
        <button className="btn-primary w-full" onClick={() => setShowForm(true)}>
          + New Agent Task
        </button>
      )}

      {/* Task creation form */}
      {showForm && (
        <TaskForm
          onCreated={handleTaskCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Task list */}
      {tasks.length === 0 && !showForm && (
        <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No agent tasks</div>
          <div style={{ fontSize: 12 }}>Create a task to start automated browsing</div>
        </div>
      )}

      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      ))}
    </div>
  );
}
