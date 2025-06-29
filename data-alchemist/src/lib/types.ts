// --- Validation Error ---

export interface ValidationError {
  message: string;
  suggestion?: string;
}

// --- Base Data Entities ---

// Represents a row in the data grid, with potential errors
export interface DataRow {
  id: string; // Unique identifier for the row within the UI
  errors?: Record<string, ValidationError>; // { columnName: { message, suggestion } }
  [key: string]: string | number | string[] | number[] | ValidationError | Record<string, ValidationError> | undefined;
}

export interface Client extends DataRow {
  ClientID: string;
  ClientName: string;
  PriorityLevel: number;
  RequestedTaskIDs: string[];
  GroupTag: string;
  AttributesJSON: string; // Keep as string for editing, parse for validation
}

export interface Worker extends DataRow {
  WorkerID: string;
  WorkerName: string;
  Skills: string[];
  AvailableSlots: number[];
  MaxLoadPerPhase: number;
  WorkerGroup: string;
  QualificationLevel: number;
}

export interface Task extends DataRow {
  TaskID: string;
  TaskName: string;
  Category: string;
  Duration: number;
  RequiredSkills: string[];
  PreferredPhases: number[]; // Normalized from string
  MaxConcurrent: number;
}

// --- Rule Definitions ---

export type Rule =
  | { type: "coRun"; tasks: string[] }
  | { type: "slotRestriction"; group: string; minCommonSlots: number }
  | { type: "loadLimit"; workerGroup: string; maxSlotsPerPhase: number }
  | { type: "phaseWindow"; task: string; allowedPhases: number[] }
  | { type: "patternMatch"; regex: string; rule: Record<string, unknown> } // safer than any
  | { type: "precedence"; order: ('global' | 'specific')[] };

// --- Prioritization ---

export interface PrioritizationWeights {
  priorityLevel: number;
  requestedTasksFulfillment: number;
  fairness: number;
}

// --- App State ---

export type EntityType = 'clients' | 'workers' | 'tasks';

export interface AppState {
  clients: Client[];
  workers: Worker[];
  tasks: Task[];
  rules: Rule[];
  priorities: PrioritizationWeights;
  validationSummary: ValidationSummaryData;
}

export interface ValidationSummaryData {
  totalErrors: number;
  errorsByType: Record<string, number>;
  lastRun: Date | null;
}

// --- Action for State Reducer ---

export type AppAction =
  | { type: 'SET_DATA'; payload: { entity: EntityType; data: DataRow[] } }
  | { type: 'UPDATE_CELL'; payload: { entity: EntityType; rowIndex: number; columnId: string; value: string | number | string[] | number[] } }
  | { type: 'RUN_VALIDATIONS'; payload: { clients: Client[]; workers: Worker[]; tasks: Task[] } }
  | { type: 'SET_VALIDATION_RESULT'; payload: { clients: Client[]; workers: Worker[]; tasks: Task[]; summary: ValidationSummaryData } }
  | { type: 'ADD_RULE'; payload: Rule }
  | { type: 'REMOVE_RULE'; payload: { index: number } }
  | { type: 'UPDATE_PRIORITY'; payload: { key: keyof PrioritizationWeights; value: number } };
