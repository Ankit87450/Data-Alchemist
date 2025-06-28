'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AppProvider, useAppContext } from '@/context/AppContext';
import { FileUploader } from '@/components/FileUploader';
import { DataGrid } from '@/components/DataGrid';
import { ColumnDef } from '@tanstack/react-table';
import { Client, Worker, Task, EntityType } from '@/lib/types';
import { Header } from '@/components/Header';
import { ValidationSummary } from '@/components/ValidationSummary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RuleBuilder } from '@/components/RuleBuilder';
import { PrioritizationEditor } from '@/components/PrioritizationEditor';
import { AIFeatures } from '@/components/AIFeatures';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

// --- Column Definitions ---
const clientColumns: ColumnDef<Client>[] = [
  { accessorKey: 'ClientID', header: 'Client ID' },
  { accessorKey: 'ClientName', header: 'Name' },
  { accessorKey: 'PriorityLevel', header: 'Priority' },
  { accessorKey: 'RequestedTaskIDs', header: 'Requested Tasks' },
  { accessorKey: 'GroupTag', header: 'Group' },
  { accessorKey: 'AttributesJSON', header: 'Attributes (JSON)' },
];

const workerColumns: ColumnDef<Worker>[] = [
  { accessorKey: 'WorkerID', header: 'Worker ID' },
  { accessorKey: 'WorkerName', header: 'Name' },
  { accessorKey: 'Skills', header: 'Skills' },
  { accessorKey: 'AvailableSlots', header: 'Available Slots' },
  { accessorKey: 'MaxLoadPerPhase', header: 'Max Load' },
  { accessorKey: 'WorkerGroup', header: 'Group' },
];

const taskColumns: ColumnDef<Task>[] = [
  { accessorKey: 'TaskID', header: 'Task ID' },
  { accessorKey: 'TaskName', header: 'Name' },
  { accessorKey: 'Duration', header: 'Duration' },
  { accessorKey: 'RequiredSkills', header: 'Required Skills' },
  { accessorKey: 'PreferredPhases', header: 'Preferred Phases' },
  { accessorKey: 'MaxConcurrent', header: 'Max Concurrent' },
];

function MainApp() {
  const { state, dispatch } = useAppContext();
  const { clients, workers, tasks, rules } = state;

  const [highlightedIds, setHighlightedIds] = useState<Record<EntityType, Set<string>>>({
    clients: new Set(),
    workers: new Set(),
    tasks: new Set(),
  });

  const hasHighlights = Array.from(Object.values(highlightedIds)).some(s => s.size > 0);

  const hasValidatedOnce = useRef(false);

  useEffect(() => {
    if (!hasValidatedOnce.current && (clients.length > 0 || workers.length > 0 || tasks.length > 0)) {
      hasValidatedOnce.current = true;

      dispatch({
        type: 'RUN_VALIDATIONS',
        payload: { clients, workers, tasks },
      });
    }
  }, [clients, workers, tasks]);

  const handleFilterResults = (entity: EntityType, rowIndices: number[]) => {
    const data = state[entity];
    if (!data) return;

    const idsToHighlight = new Set(
      rowIndices.map(index => data[index]?.id).filter(Boolean)
    );

    setHighlightedIds({
      clients: new Set(),
      workers: new Set(),
      tasks: new Set(),
      [entity]: idsToHighlight,
    });
  };

  const clearHighlights = () => {
    setHighlightedIds({ clients: new Set(), workers: new Set(), tasks: new Set() });
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Header />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FileUploader entity="clients" title="1. Upload Clients" />
        <FileUploader entity="workers" title="2. Upload Workers" />
        <FileUploader entity="tasks" title="3. Upload Tasks" />
      </div>

      <ValidationSummary />

      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">Data Editor</TabsTrigger>
          <TabsTrigger value="rules">Rule Builder</TabsTrigger>
          <TabsTrigger value="priorities">Prioritization</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="space-y-4">
          <div className="flex items-center gap-4 py-4">
            <AIFeatures onFilterResults={handleFilterResults} onClearFilter={clearHighlights} />
            
            {hasHighlights && (() => {
              const activeEntry = Object.entries(highlightedIds).find(([, set]) => set.size > 0);
              const activeKey = activeEntry?.[0] as EntityType | undefined;
              const activeCount = activeKey ? highlightedIds[activeKey].size : 0;

              return (
                <Button variant="ghost" onClick={clearHighlights} className="text-muted-foreground">
                  <XCircle className="mr-2 h-4 w-4" /> Clear Highlights ({activeCount})
                </Button>
              );
            })()}
          </div>

          <h2 className="text-2xl font-bold">Clients</h2>
          <DataGrid data={clients} columns={clientColumns} entity="clients" highlightedRowIds={highlightedIds.clients} />

          <h2 className="text-2xl font-bold">Workers</h2>
          <DataGrid data={workers} columns={workerColumns} entity="workers" highlightedRowIds={highlightedIds.workers} />

          <h2 className="text-2xl font-bold">Tasks</h2>
          <DataGrid data={tasks} columns={taskColumns} entity="tasks" highlightedRowIds={highlightedIds.tasks} />
        </TabsContent>

        <TabsContent value="rules">
          <RuleBuilder />
        </TabsContent>

        <TabsContent value="priorities">
          <PrioritizationEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
