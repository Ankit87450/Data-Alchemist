
'use client';
import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { EntityType } from '@/lib/types';
import { parseFile } from '@/lib/data-parser';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface FileUploaderProps {
  entity: EntityType;
  title: string;
}

export function FileUploader({ entity, title }: FileUploaderProps) {
  const { dispatch } = useAppContext();
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        setError('Invalid file type. Please upload a CSV or XLSX file.');
        return;
    }

    setFileName(file.name);
    setError('');

    try {
      const data = await parseFile(file, entity);
      dispatch({ type: 'SET_DATA', payload: { entity, data } });
    } catch (err: any) {
      setError(`Error parsing file: ${err.message}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor={`file-upload-${entity}`}>Upload {entity}.csv or .xlsx</Label>
        <Input id={`file-upload-${entity}`} type="file" onChange={handleFileChange} accept=".csv, .xlsx" />
        {fileName && <p className="text-sm text-muted-foreground mt-2">Loaded: {fileName}</p>}
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}