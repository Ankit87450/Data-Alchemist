
'use client';
import { Button } from './ui/button';
import { useAppContext } from '@/context/AppContext';
import { exportAllData } from '@/lib/data-exporter';
import { Bot, Download, FileCheck } from 'lucide-react';

export function Header() {
  const { state, dispatch } = useAppContext();

  const handleExport = () => {
    exportAllData(state);
  };

  const handleValidate = () => {
    dispatch({ type: 'RUN_VALIDATIONS', payload: state });
  };

  const hasData = state.clients.length > 0 || state.workers.length > 0 || state.tasks.length > 0;

  return (
    <header className="flex justify-between items-center pb-4 border-b">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot size={32} /> Resource Allocator
        </h1>
        <p className="text-muted-foreground">Ingest, Validate, and Configure Allocation Data</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleValidate} disabled={!hasData}>
          <FileCheck className="mr-2 h-4 w-4" /> Run Validations
        </Button>
        <Button onClick={handleExport} disabled={!hasData}>
          <Download className="mr-2 h-4 w-4" /> Export All
        </Button>
      </div>
    </header>
  );
}