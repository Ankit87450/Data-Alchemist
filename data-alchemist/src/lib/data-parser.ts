
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Client, Worker, Task } from './types';
import { v4 as uuidv4 } from 'uuid'; // Use `npm install uuid @types/uuid`

// AI-like feature: Map various possible header names to a canonical name.
const headerMappings: Record<string, Record<string, string>> = {
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

const normalizeHeaders = (headers: string[], entity: keyof typeof headerMappings): string[] => {
  const mapping = headerMappings[entity];
  return headers.map(h => mapping[h.toLowerCase().trim()] || h);
};

const normalizeRow = (row: any, entity: keyof typeof headerMappings): any => {
    // Add a unique id for React keys
    const newRow: Record<string, any> = { id: uuidv4(), errors: {} };

    for (const key in row) {
        const normalizedKey = headerMappings[entity][key.toLowerCase().trim()] || key;
        let value = row[key];

        // Type conversions and normalization
        switch (normalizedKey) {
            case 'PriorityLevel':
            case 'MaxLoadPerPhase':
            case 'Duration':
            case 'MaxConcurrent':
            case 'QualificationLevel':
                newRow[normalizedKey] = Number(value) || 0;
                break;
            case 'RequestedTaskIDs':
            case 'Skills':
            case 'RequiredSkills':
                newRow[normalizedKey] = typeof value === 'string' ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
                break;
            case 'AvailableSlots':
                // Handles "[1,3,5]" or "1,3,5"
                try {
                  if (typeof value === 'string' && value.startsWith('[')) {
                    newRow[normalizedKey] = JSON.parse(value);
                  } else if (typeof value === 'string') {
                    newRow[normalizedKey] = value.split(',').map(s => Number(s.trim()));
                  } else {
                     newRow[normalizedKey] = Array.isArray(value) ? value : [];
                  }
                } catch {
                  newRow[normalizedKey] = [];
                }
                break;
            case 'PreferredPhases':
                // Handles "1-3" or "[2,4,5]" or "2,4,5"
                try {
                  if (typeof value === 'string' && value.includes('-')) {
                    const [start, end] = value.split('-').map(Number);
                    newRow[normalizedKey] = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                  } else if (typeof value === 'string' && value.startsWith('[')) {
                    newRow[normalizedKey] = JSON.parse(value);
                  } else if (typeof value === 'string') {
                    newRow[normalizedKey] = value.split(',').map(s => Number(s.trim()));
                  } else {
                    newRow[normalizedKey] = Array.isArray(value) ? value : [];
                  }
                } catch {
                   newRow[normalizedKey] = [];
                }
                break;
            default:
                newRow[normalizedKey] = value;
        }
    }
    return newRow;
};


export const parseFile = (file: File, entity: keyof typeof headerMappings): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let jsonData: any[];

        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(data as string, { header: true, skipEmptyLines: true });
          const normalizedHeaders = normalizeHeaders(result.meta.fields!, entity);
          // Manually map data to normalized headers
          jsonData = result.data.map((row: any) => {
            const newRow: any = {};
            result.meta.fields!.forEach((field, index) => {
              newRow[normalizedHeaders[index]] = row[field];
            });
            return newRow;
          });

        } else if (file.name.endsWith('.xlsx')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          throw new Error('Unsupported file type');
        }

        const normalizedData = jsonData.map(row => normalizeRow(row, entity));
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