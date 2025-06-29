
'use client';

import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { AppState, AppAction, EntityType, Client, Worker, Task } from '@/lib/types';
import { runAllValidations } from '@/lib/validators';

const initialState: AppState = {
  clients: [],
  workers: [],
  tasks: [],
  rules: [],
  priorities: {
    priorityLevel: 50,
    requestedTasksFulfillment: 80,
    fairness: 30,
  },
  validationSummary: {
    totalErrors: 0,
    errorsByType: {},
    lastRun: null,
  },
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

type Row = Client | Worker | Task;

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        [action.payload.entity]: action.payload.data,
      };

    case 'UPDATE_CELL': {
      const { entity, rowIndex, columnId, value } = action.payload;

      // Get a copy of the existing rows (Client[] | Worker[] | Task[])
      const currentRows = state[entity] as Row[];
      const updatedRows = [...currentRows];

      // Copy and update a single row
      const updatedRow = { ...updatedRows[rowIndex] };

      if (
        ['PriorityLevel', 'MaxLoadPerPhase', 'Duration', 'MaxConcurrent', 'QualificationLevel'].includes(columnId)
      ) {
        updatedRow[columnId] = typeof value === 'string' ? Number(value) : value;
      } else if (['RequestedTaskIDs', 'Skills', 'RequiredSkills'].includes(columnId)) {
        if (typeof value === 'string') {
          updatedRow[columnId] = value.split(',').map((s) => s.trim());
        } else {
          updatedRow[columnId] = Array.isArray(value) ? value : [];
        }
      } else {
        updatedRow[columnId] = value;
      }

      updatedRows[rowIndex] = updatedRow;

      return {
        ...state,
        [entity]: updatedRows as typeof state[typeof entity],
      };
    }

    case 'RUN_VALIDATIONS': {
      const validationResult = runAllValidations({
        ...state,
        clients: action.payload.clients,
        workers: action.payload.workers,
        tasks: action.payload.tasks,
      });

      return {
        ...state,
        clients: validationResult.clients,
        workers: validationResult.workers,
        tasks: validationResult.tasks,
        validationSummary: {
          ...validationResult.summary,
          lastRun: new Date(),
        },
      };
    }

    case 'ADD_RULE':
      return {
        ...state,
        rules: [...state.rules, action.payload],
      };

    case 'REMOVE_RULE':
      return {
        ...state,
        rules: state.rules.filter((_, index) => index !== action.payload.index),
      };

    case 'UPDATE_PRIORITY':
      return {
        ...state,
        priorities: {
          ...state.priorities,
          [action.payload.key]: action.payload.value,
        },
      };

    default:
      return state;
  }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
