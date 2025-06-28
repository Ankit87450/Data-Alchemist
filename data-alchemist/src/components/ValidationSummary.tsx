
'use client';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';

export function ValidationSummary() {
  const { state } = useAppContext();
  const { totalErrors, errorsByType, lastRun } = state.validationSummary;

  if (!lastRun) {
    return null; // Don't show anything until first validation
  }

  return (
    <Card className={totalErrors > 0 ? 'border-destructive' : 'border-green-500'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {totalErrors > 0 ? <AlertCircle className="text-destructive" /> : <CheckCircle className="text-green-500" />}
          Validation Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalErrors > 0 ? (
          <div>
            <p className="text-lg font-semibold text-destructive">Found {totalErrors} error(s).</p>
            <ul className="list-disc pl-5 mt-2 text-muted-foreground">
              {Object.entries(errorsByType).map(([type, count]) => (
                <li key={type}>{`${type}: ${count} error(s)`}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-lg font-semibold text-green-500">All validations passed successfully!</p>
        )}
        <p className="text-xs text-muted-foreground mt-4">Last run: {lastRun.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}