import { AppState, Client, Worker, Task, DataRow, ValidationSummaryData, Rule } from './types';
import { isFieldMissing } from './utils';

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function findBestSuggestion(invalidValue: string, validOptions: string[]): string | undefined {
  let bestMatch: string | undefined = undefined;
  let minDistance = Math.floor(invalidValue.length / 2) + 1;

  for (const option of validOptions) {
    const distance = levenshteinDistance(invalidValue.toLowerCase(), option.toLowerCase());
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = option;
    }
  }
  return bestMatch;
}

function addError(row: DataRow, field: string, message: string, suggestion?: string) {
  if (!row.errors) row.errors = {};
  row.errors[field] = { message, suggestion };
}

export function runAllValidations(state: AppState): {
  clients: Client[];
  workers: Worker[];
  tasks: Task[];
  summary: ValidationSummaryData;
} {
  const { clients, workers, tasks, rules = []} = state;

  const newClients = clients.map(c => ({ ...c, errors: {} }));
  const newWorkers = workers.map(w => ({ ...w, errors: {} }));
  const newTasks = tasks.map(t => ({ ...t, errors: {} }));

  const taskMap = new Map(newTasks.map(t => [t.TaskID, t]));
  const taskIds = new Set(taskMap.keys());
  const validTaskIdsArray = Array.from(taskIds);
  const allWorkerSkills = Array.from(new Set(newWorkers.flatMap(w => w.Skills)));

  const summary: ValidationSummaryData = {
    totalErrors: 0,
    errorsByType: {},
    lastRun: new Date()
  };
  const incrementError = (type: string) => {
    summary.totalErrors++;
    summary.errorsByType[type] = (summary.errorsByType[type] || 0) + 1;
  };

  const requiredFields = {
    clients: ['ClientID', 'PriorityLevel', 'RequestedTaskIDs'] as const,
    workers: ['WorkerID', 'Skills', 'AvailableSlots'] as const,
    tasks: ['TaskID', 'Duration', 'RequiredSkills'] as const,
  };

  newClients.forEach(c =>
    requiredFields.clients.forEach(f => {
      if (isFieldMissing(c, f)) {
        addError(c, f, 'Required field is missing.');
        incrementError('Missing Field');
      }
    })
  );

  newWorkers.forEach(w =>
    requiredFields.workers.forEach(f => {
      if (isFieldMissing(w, f)) {
        addError(w, f, 'Required field is missing.');
        incrementError('Missing Field');
      }
    })
  );

  newTasks.forEach(t =>
    requiredFields.tasks.forEach(f => {
      if (isFieldMissing(t, f)) {
        addError(t, f, 'Required field is missing.');
        incrementError('Missing Field');
      }
    })
  );

  // Duplicate ID checks
  const findDuplicates = <T>(arr: T[], key: keyof T, entity: T[]) => {
    const counts: Record<string, number> = {};
    arr.forEach(item => {
      const k = item[key] as string;
      counts[k] = (counts[k] || 0) + 1;
    });
    arr.forEach((item, i) => {
      const k = item[key] as string;
      if (counts[k] > 1) {
        addError(entity[i] as DataRow, key as string, 'Duplicate ID found.');
        incrementError('Duplicate ID');
      }
    });
  };

  findDuplicates(newClients, 'ClientID', newClients);
  findDuplicates(newWorkers, 'WorkerID', newWorkers);
  findDuplicates(newTasks, 'TaskID', newTasks);

  // Client-specific validations
  newClients.forEach(client => {
    client.RequestedTaskIDs?.forEach((reqId, index) => {
      if (!taskIds.has(reqId)) {
        const suggestion = findBestSuggestion(reqId, validTaskIdsArray);
        addError(client, `RequestedTaskIDs.${index}`, `TaskID "${reqId}" not found.`, suggestion);
        incrementError('Broken Reference');
      }
    });
    if (client.PriorityLevel < 1 || client.PriorityLevel > 5) {
      addError(client, 'PriorityLevel', 'Must be between 1 and 5.');
      incrementError('Out of Range');
    }
    try {
      if (client.AttributesJSON) JSON.parse(client.AttributesJSON);
    } catch {
      addError(client, 'AttributesJSON', 'Invalid JSON format.');
      incrementError('Invalid JSON');
    }
  });

  // Worker-specific validations
  newWorkers.forEach(worker => {
    if (!Array.isArray(worker.AvailableSlots) || !worker.AvailableSlots?.every(s => typeof s === 'number' && !isNaN(s))) {
      addError(worker, 'AvailableSlots', 'Must be a list of numbers.');
      incrementError('Malformed List');
    }
    if (worker.AvailableSlots?.length < worker.MaxLoadPerPhase) {
      addError(worker, 'MaxLoadPerPhase', `MaxLoad (${worker.MaxLoadPerPhase}) exceeds available slots (${worker.AvailableSlots.length}).`);
      incrementError('Overloaded Worker');
    }
  });

  // Task-specific validations
  newTasks.forEach(task => {
    if (task.Duration < 1) {
      addError(task, 'Duration', 'Duration must be at least 1.');
      incrementError('Out of Range');
    }

    task.RequiredSkills?.forEach((skill, index) => {
      const hasSkill = newWorkers.some(w => w.Skills.includes(skill));
      if (!hasSkill) {
        const suggestion = findBestSuggestion(skill, allWorkerSkills);
        addError(task, `RequiredSkills.${index}`, `No worker has this skill: "${skill}".`, suggestion);
        incrementError('Skill Uncovered');
      }
    });

    const qualifiedWorkers = newWorkers.filter(w => {
      const hasSkills = task.RequiredSkills?.every(s => w.Skills.includes(s));
      const isAvailable = task.PreferredPhases?.some(p => w.AvailableSlots.includes(p));
      return hasSkills && isAvailable;
    });

    if (task.MaxConcurrent > qualifiedWorkers.length) {
      addError(task, 'MaxConcurrent', `Concurrency (${task.MaxConcurrent}) exceeds qualified, available workers (${qualifiedWorkers.length}).`);
      incrementError('Concurrency Infeasible');
    }
  });

  // Phase saturation
  const phaseSlots = new Map<number, number>();
  newWorkers.forEach(w => w.AvailableSlots?.forEach(s => {
    phaseSlots.set(s, (phaseSlots.get(s) || 0) + 1);
  }));

  const phaseDemand = new Map<number, number>();
  newTasks.forEach(t => t.PreferredPhases?.forEach(p => {
    phaseDemand.set(p, (phaseDemand.get(p) || 0) + t.Duration);
  }));

  phaseDemand.forEach((demand, phase) => {
    const supply = phaseSlots.get(phase) || 0;
    if (demand > supply) {
      newTasks.forEach(t => {
        if (t.PreferredPhases?.includes(phase)) {
          addError(t, 'PreferredPhases', `Phase ${phase} is oversaturated. Demand (${demand}) > Supply (${supply}).`);
        }
      });
      incrementError('Phase Saturation');
    }
  });

  // Circular co-run group detection
  const coRunRules = rules.filter(r => r.type === 'coRun') as Extract<Rule, { type: 'coRun' }>[];
  if (coRunRules.length > 0) {
    const adj = new Map<string, string[]>();
    coRunRules.forEach(rule => {
      rule.tasks.forEach(task => {
        if (!adj.has(task)) adj.set(task, []);
        adj.get(task)!.push(...rule.tasks.filter(t => t !== task));
      });
    });

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (task: string): boolean => {
      visited.add(task);
      recursionStack.add(task);

      for (const neighbor of adj.get(task) || []) {
        if (!visited.has(neighbor)) {
          if (detectCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(task);
      return false;
    };

    adj.forEach((_, task) => {
      if (!visited.has(task) && detectCycle(task)) {
        incrementError('Circular Dependency');
        recursionStack.forEach(taskId => {
          const taskToError = taskMap.get(taskId);
          if (taskToError) addError(taskToError, 'TaskID', 'This task is part of a circular co-run dependency.');
        });
      }
    });
  }

  return { clients: newClients, workers: newWorkers, tasks: newTasks, summary };
}
