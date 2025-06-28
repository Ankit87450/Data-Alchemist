'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { useAppContext } from '@/context/AppContext';
import { EntityType, DataRow } from '@/lib/types';
import { Input } from './ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { Button } from './ui/button';
import { Lightbulb, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Helper Component: EditableCell ---
const EditableCell: React.FC<any> = ({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const { dispatch } = useAppContext();
  const { entity } = table.options.meta;

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value !== initialValue) {
      dispatch({
        type: 'UPDATE_CELL',
        payload: {
          entity,
          rowIndex: row.index,
          columnId: column.id,
          value: e.target.value,
        },
      });
    }
  };

  const value = Array.isArray(initialValue)
    ? initialValue.join(', ')
    : initialValue;

  return (
    <Input
      defaultValue={value}
      onBlur={onBlur}
      className="w-full h-full text-sm border-none rounded-none bg-transparent focus:ring-1 focus:ring-blue-500 p-1"
    />
  );
};

// --- Helper Component: AIFixButton ---
type AIFixButtonProps = {
  entity: EntityType;
  rowIndex: number;
  columnId: string;
  cellValue: string;
  errorContext: string;
};

function AIFixButton({
  entity,
  rowIndex,
  columnId,
  cellValue,
  errorContext,
}: AIFixButtonProps) {
  const { dispatch } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleAIFix = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/fix-cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invalidValue: cellValue,
          context: errorContext,
        }),
      });
      const data = await res.json();

      if (res.ok && data.fixedValue) {
        dispatch({
          type: 'UPDATE_CELL',
          payload: { entity, rowIndex, columnId, value: data.fixedValue },
        });
      } else {
        throw new Error(data.error || 'Failed to get a fix from the AI.');
      }
    } catch (error) {
      console.error('AI fix failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-auto p-1 text-purple-400 border-purple-400/50 hover:bg-purple-900/50 hover:text-purple-300"
      onClick={handleAIFix}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-3 w-3" />
      )}
      Fix with AI
    </Button>
  );
}

// --- Main Component: DataGrid ---
interface DataGridProps {
  data: any[];
  columns: ColumnDef<any, any>[];
  entity: EntityType;
  highlightedRowIds?: Set<string>;
}

export function DataGrid({
  data,
  columns,
  entity,
  highlightedRowIds,
}: DataGridProps) {
  const { dispatch } = useAppContext();
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    defaultColumn: {
      cell: EditableCell,
    },
    meta: {
      entity,
      dispatch,
    },
  });

  return (
    <div className="rounded-md border overflow-auto">
      <TooltipProvider delayDuration={200}>
        <table className="w-full text-sm">
          <thead className="border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="h-10 px-2 text-left font-medium text-muted-foreground"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isHighlighted = highlightedRowIds?.has(row.original.id);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b transition-colors',
                    isHighlighted && 'bg-green-800/50',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const errorKey = Object.keys(
                      (row.original as DataRow).errors || {},
                    ).find((k) => k.startsWith(cell.column.id));

                    const specificError = errorKey
                      ? (row.original as DataRow).errors?.[errorKey]
                      : undefined;

                    const rawValue = cell.getValue();
                    const stringifiedValue =
                      typeof rawValue === 'string'
                        ? rawValue
                        : Array.isArray(rawValue)
                        ? rawValue.join(', ')
                        : JSON.stringify(rawValue);

                    return (
                      <td
                        key={cell.id}
                        className={`p-0 ${specificError ? 'bg-red-900/30' : ''}`}
                      >
                        {specificError ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full h-full relative">
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                                <div className="absolute top-0 right-1 text-red-500 font-bold">
                                  !
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-background border-red-500 space-y-2">
                              <p className="text-red-400 font-semibold">
                                {specificError.message}
                              </p>

                              {specificError.suggestion && (
                                <div className="pt-2 border-t border-border flex items-center gap-2">
                                  <Lightbulb className="h-4 w-4 text-yellow-400" />
                                  <span className="text-muted-foreground text-xs">
                                    Did you mean:
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 text-yellow-400 hover:bg-yellow-900/50 hover:text-yellow-300"
                                    onClick={() => {
                                      const [columnId, indexStr] =
                                        errorKey!.split('.');
                                      const index = parseInt(indexStr);
                                      const currentValue =
                                        cell.getValue<string[]>();
                                      const newValue = [...currentValue];
                                      newValue[index] =
                                        specificError.suggestion!;
                                      dispatch({
                                        type: 'UPDATE_CELL',
                                        payload: {
                                          entity,
                                          rowIndex: row.index,
                                          columnId,
                                          value: newValue.join(','),
                                        },
                                      });
                                    }}
                                  >
                                    {specificError.suggestion}
                                  </Button>
                                </div>
                              )}

                              {specificError.message.includes(
                                'Invalid JSON',
                              ) && (
                                <div className="pt-2 border-t border-border">
                                  <AIFixButton
                                    entity={entity}
                                    rowIndex={row.index}
                                    columnId={cell.column.id}
                                    cellValue={stringifiedValue}
                                    errorContext="valid JSON string that is properly escaped"
                                  />
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TooltipProvider>
    </div>
  );
}
