import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

// --- Define safe types ---
import type { Client, Worker, Task } from '@/lib/types';

type EntityType = 'clients' | 'workers' | 'tasks';
type EntityRow = Client | Worker | Task;

// --- Header Mappings ---

const headerMappings: Record<EntityType, Record<string, string>> = {
  clients: {
    clientid: 'ClientID', client_id: 'ClientID', 'Client ID': 'ClientID',
    clientname: 'ClientName', 'Client Name': 'ClientName',
    prioritylevel: 'PriorityLevel', 'Priority Level': 'PriorityLevel',
    requestedtaskids: 'RequestedTaskIDs', 'Requested Task IDs': 'RequestedTaskIDs',
    grouptag: 'GroupTag', 'Group Tag': 'GroupTag',
    attributesjson: 'AttributesJSON', 'Attributes JSON': 'AttributesJSON',
  },
  workers: {
    workerid: 'WorkerID', 'Worker ID': 'WorkerID',
    workername: 'WorkerName', 'Worker Name': 'WorkerName',
    skills: 'Skills',
    availableslots: 'AvailableSlots', 'Available Slots': 'AvailableSlots',
    maxloadperphase: 'MaxLoadPerPhase', 'Max Load Per Phase': 'MaxLoadPerPhase',
    workergroup: 'WorkerGroup', 'Worker Group': 'WorkerGroup',
    qualificationlevel: 'QualificationLevel', 'Qualification Level': 'QualificationLevel',
  },
  tasks: {
    taskid: 'TaskID', 'Task ID': 'TaskID',
    taskname: 'TaskName', 'Task Name': 'TaskName',
    category: 'Category',
    duration: 'Duration',
    requiredskills: 'RequiredSkills', 'Required Skills': 'RequiredSkills',
    preferredphases: 'PreferredPhases', 'Preferred Phases': 'PreferredPhases',
    maxconcurrent: 'MaxConcurrent', 'Max Concurrent': 'MaxConcurrent',
  },
};

// --- Normalize Headers ---

const normalizeHeaders = (
  headers: string[],
  entity: EntityType
): string[] => {
  const mapping = headerMappings[entity];
  return headers.map(h => mapping[h.toLowerCase().trim()] || h);
};

// --- Normalize Row ---

const normalizeRow = (
  row: Record<string, unknown>,
  entity: EntityType
): EntityRow => {
  const newRow: Record<string, unknown> = {
    id: uuidv4(),
    errors: {},
  };

  for (const key in row) {
    const normalizedKey = headerMappings[entity][key.toLowerCase().trim()] || key;
    const rawValue = row[key];

    switch (normalizedKey) {
      case 'PriorityLevel':
      case 'MaxLoadPerPhase':
      case 'Duration':
      case 'MaxConcurrent':
      case 'QualificationLevel':
        newRow[normalizedKey] = Number(rawValue) || 0;
        break;

      case 'RequestedTaskIDs':
      case 'Skills':
      case 'RequiredSkills':
        if (typeof rawValue === 'string') {
          newRow[normalizedKey] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          newRow[normalizedKey] = Array.isArray(rawValue) ? rawValue : [];
        }
        break;

      case 'AvailableSlots':
        try {
          if (typeof rawValue === 'string' && rawValue.startsWith('[')) {
            newRow[normalizedKey] = JSON.parse(rawValue);
          } else if (typeof rawValue === 'string') {
            newRow[normalizedKey] = rawValue.split(',').map(s => Number(s.trim()));
          } else {
            newRow[normalizedKey] = Array.isArray(rawValue) ? rawValue : [];
          }
        } catch {
          newRow[normalizedKey] = [];
        }
        break;

      case 'PreferredPhases':
        try {
          if (typeof rawValue === 'string' && rawValue.includes('-')) {
            const [start, end] = rawValue.split('-').map(Number);
            newRow[normalizedKey] = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          } else if (typeof rawValue === 'string' && rawValue.startsWith('[')) {
            newRow[normalizedKey] = JSON.parse(rawValue);
          } else if (typeof rawValue === 'string') {
            newRow[normalizedKey] = rawValue.split(',').map(s => Number(s.trim()));
          } else {
            newRow[normalizedKey] = Array.isArray(rawValue) ? rawValue : [];
          }
        } catch {
          newRow[normalizedKey] = [];
        }
        break;

      default:
        newRow[normalizedKey] = rawValue;
    }
  }

  return newRow as EntityRow;
};

// --- File Parser ---

export const parseFile = (
  file: File,
  entity: EntityType
): Promise<EntityRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        let jsonData: Record<string, unknown>[];

        if (file.name.endsWith('.csv')) {
          const result = Papa.parse<Record<string, string>>(data as string, {
            header: true,
            skipEmptyLines: true,
          });

          const normalizedHeaders = normalizeHeaders(result.meta.fields ?? [], entity);
          jsonData = result.data.map((row: Record<string, string>) => {
            const newRow: Record<string, unknown> = {};
            (result.meta.fields ?? []).forEach((field, index) => {
              newRow[normalizedHeaders[index]] = row[field];
            });
            return newRow;
          });

        } else if (file.name.endsWith('.xlsx')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
        } else {
          throw new Error('Unsupported file type');
        }

        const normalizedData: EntityRow[] = jsonData.map(row => normalizeRow(row, entity));
        resolve(normalizedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
};
