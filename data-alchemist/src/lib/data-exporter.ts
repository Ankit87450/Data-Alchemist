import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import { AppState, DataRow } from './types';

// Helper to clean data for export (remove UI-specific fields)
const cleanDataForExport = (data: DataRow[]) => {
  return data.map(({ id, errors, ...rest }) => {
    // Re-stringify arrays for CSV
    for (const key in rest) {
      if (Array.isArray(rest[key])) {
        rest[key] = (rest[key] as string[]).join(',');
      }
    }
    return rest;
  });
};

export const exportAllData = async (state: AppState) => {
  const zip = new JSZip();

  // 1. Clean and prepare data
  const cleanedClients = cleanDataForExport(state.clients);
  const cleanedWorkers = cleanDataForExport(state.workers);
  const cleanedTasks = cleanDataForExport(state.tasks);

  // 2. Convert to CSV
  const clientsCsv = Papa.unparse(cleanedClients);
  const workersCsv = Papa.unparse(cleanedWorkers);
  const tasksCsv = Papa.unparse(cleanedTasks);

  // 3. Create config JSON
  const config = {
    rules: state.rules,
    prioritization: state.priorities,
  };
  const configJson = JSON.stringify(config, null, 2);

  // 4. Add files to zip
  zip.file('clients_cleaned.csv', clientsCsv);
  zip.file('workers_cleaned.csv', workersCsv);
  zip.file('tasks_cleaned.csv', tasksCsv);
  zip.file('config.json', configJson);

  // 5. Generate and download zip
  try {
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'ResourceAllocator_Export.zip');
  } catch (error) {
    console.error("Error generating zip file:", error);
    alert("Failed to generate export file. Check the console for details.");
  }
};
