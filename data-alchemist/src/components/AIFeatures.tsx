
'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Bot, Sparkles, Search, Wand2, Edit, Loader2, AlertCircle, ChevronsRight } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { AppState, EntityType, DataRow } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface AIFeaturesProps {
    onFilterResults: (entity: EntityType, rowIndices: number[]) => void;
    onClearFilter: () => void;
}

// The robust parser from our previous discussion (no changes needed here).
function getAffectedRows(sql: string, state: AppState) {
    const whereMatch = sql.match(/WHERE (.*)/i);
    if (!whereMatch) return { error: 'The AI did not specify a WHERE condition to select rows.' };
    const condition = whereMatch[1].trim();
    const conditionMatch = condition.match(/(\w+)\s*([<>=!]+)\s*(['"]?)(.*?)\3/);
    if (!conditionMatch) return { error: 'Could not parse the condition from the AI. Please try rephrasing.' };
    const [, whereField, operator, , whereValue] = conditionMatch;
    const numericValue = Number(whereValue);
    const entityMatch = sql.match(/FROM \`?(\w+)\`?/i);
    if (!entityMatch) return { error: 'Could not identify the entity table from the AI response.' };
    const entity = entityMatch[1] as EntityType;
    const data = state[entity];
    if (!data) return { error: `Invalid entity table specified by AI: ${entity}`};
    const affectedRows = data.filter(row => {
        const rowValue = row[whereField];
        if (rowValue === undefined) return false;
        switch (operator) {
            case '=': case '==': return String(rowValue).toLowerCase() === whereValue.toLowerCase();
            case '!=': case '<>': return String(rowValue).toLowerCase() !== whereValue.toLowerCase();
            case '>': return Number(rowValue) > numericValue;
            case '<': return Number(rowValue) < numericValue;
            case '>=': return Number(rowValue) >= numericValue;
            case '<=': return Number(rowValue) <= numericValue;
            default: return false;
        }
    });
    return { affectedRows, entity };
}


export function AIFeatures({ onFilterResults, onClearFilter }: AIFeaturesProps) {
    const { state, dispatch } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    // State variables for all tabs
    const [searchQuery, setSearchQuery] = useState('');
    const [searchEntity, setSearchEntity] = useState<EntityType | ''>('');
    const [validationSuggestion, setValidationSuggestion] = useState('');
    const [modQuery, setModQuery] = useState('');
    const [modEntity, setModEntity] = useState<EntityType | ''>('');
    const [modPlan, setModPlan] = useState<any>(null);
    const [fieldToSet, setFieldToSet] = useState('');
    const [valueToSet, setValueToSet] = useState('');

    // --- CORRECTED: handleSearch function with its API call ---
    const handleSearch = async () => {
        if (!searchQuery || !searchEntity) { setError('Please select an entity and enter a question.'); return; }
        setIsLoading(true); setError(''); onClearFilter();
        try {
            const res = await fetch('/api/table-qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, data: state[searchEntity] }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Search request failed.');
            onFilterResults(searchEntity, result.rowIndices);
            setIsOpen(false);
        } catch (err: any) { setError(err.message); }
        finally { setIsLoading(false); }
    };
    
    // --- CORRECTED: handleAnalyze function with its API call ---
    const handleAnalyze = async () => {
        setIsLoading(true); setError(''); setValidationSuggestion('');
        try {
            const res = await fetch('/api/suggest-validations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clients: state.clients, workers: state.workers, tasks: state.tasks }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Analysis request failed.');
            setValidationSuggestion(result.suggestion);
        } catch (err: any) { setError(err.message); }
        finally { setIsLoading(false); }
    };

    // --- This function is also complete and correct ---
    const handleGenerateModificationPlan = async () => {
        if (!modQuery || !modEntity) { setError("Please select data and describe which rows to modify."); return; }
        setIsLoading(true); setError(''); setModPlan(null);
        try {
            const schema = Object.keys(state[modEntity][0] || {});
            if (schema.length === 0) throw new Error(`No data available for entity: ${modEntity}`);
            const res = await fetch('/api/nl-to-modification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `for ${modEntity} ${modQuery}`, entity: modEntity, schema }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Could not generate modification plan');
            const plan = getAffectedRows(result.sqlCommand, state);
            if (plan.error) { setError(plan.error); } 
            else if (plan.affectedRows?.length === 0) { setError("No rows found matching your condition."); }
            else { setModPlan(plan); }
        } catch(err: any) { setError(err.message); }
        finally { setIsLoading(false); }
    };
    
    // ... all other handlers and the return statement are correct ...
    const handleConfirmModification = () => {
        if (!modPlan || !modPlan.affectedRows || !fieldToSet || !modPlan.entity) { setError("Cannot apply change. The modification plan is incomplete."); return; }
        const entityToUpdate = modPlan.entity as EntityType;
        modPlan.affectedRows.forEach((rowToUpdate: DataRow) => {
            const rowIndex = state[entityToUpdate].findIndex(r => r.id === rowToUpdate.id);
            if (rowIndex > -1) {
                dispatch({ type: 'UPDATE_CELL', payload: { entity: entityToUpdate, rowIndex, columnId: fieldToSet, value: valueToSet }, });
            }
        });
        resetAll();
        setIsOpen(false);
    };

    const resetAll = () => {
        setError(''); setIsLoading(false); setModPlan(null);
        setValidationSuggestion(''); setModQuery(''); setFieldToSet('');
        setValueToSet(''); setSearchQuery(''); setModEntity('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetAll(); }}>
            <DialogTrigger asChild>
                <Button variant="outline"><Bot className="mr-2 h-4 w-4" /> AI Assistant</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>AI Assistant</DialogTitle>
                    <DialogDescription>Use AI to search, modify, and analyze your data.</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="search" onValueChange={resetAll}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="search"><Search className="mr-2 h-4 w-4" />Search</TabsTrigger>
                        <TabsTrigger value="modify"><Edit className="mr-2 h-4 w-4" />Modify</TabsTrigger>
                        <TabsTrigger value="analyze"><Wand2 className="mr-2 h-4 w-4" />Analyze</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="search" className="space-y-4 pt-4">
                        <p className="text-sm text-muted-foreground">Ask a question to find and highlight rows.</p>
                        <div className="space-y-2">
                            <Label>1. Choose data to search</Label>
                            <Select onValueChange={(v) => setSearchEntity(v as EntityType)}><SelectTrigger><SelectValue placeholder="Select clients, workers, or tasks..." /></SelectTrigger><SelectContent><SelectItem value="clients">Clients</SelectItem><SelectItem value="workers">Workers</SelectItem><SelectItem value="tasks">Tasks</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-2">
                            <Label>2. Ask your question</Label>
                            <Input placeholder="e.g., 'which tasks require the dev skill?'" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        <Button onClick={handleSearch} disabled={isLoading || !searchEntity || !searchQuery}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                            Find & Highlight
                        </Button>
                    </TabsContent>

                    <TabsContent value="modify" className="space-y-4 pt-4">
                        {!modPlan ? (
                            <div className="space-y-4">
                                <Label className="font-semibold">Step 1: Tell the AI which rows to select</Label>
                                <Select onValueChange={(v) => setModEntity(v as EntityType)}><SelectTrigger><SelectValue placeholder="Select data to modify..." /></SelectTrigger><SelectContent><SelectItem value="clients">Clients</SelectItem><SelectItem value="workers">Workers</SelectItem><SelectItem value="tasks">Tasks</SelectItem></SelectContent></Select>
                                <Input placeholder="e.g., 'WHERE Category = Dev' or 'WHERE Duration > 5'" value={modQuery} onChange={(e) => setModQuery(e.target.value)} />
                                <Button onClick={handleGenerateModificationPlan} disabled={isLoading || !modEntity || !modQuery}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><ChevronsRight className="mr-2 h-4 w-4" />Select Rows</>}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Label className="font-semibold">Step 2: Specify the change for {modPlan.affectedRows.length} selected row(s)</Label>
                                <div className="p-2 bg-muted rounded-md text-sm">Selected: {modPlan.affectedRows.length} {modPlan.entity} rows.</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Field to Change</Label>
                                        <Select onValueChange={setFieldToSet}>
                                            <SelectTrigger><SelectValue placeholder="Select field..." /></SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(modPlan.affectedRows[0] || {}).filter(k => k !== 'id' && k !== 'errors').map(key => (
                                                    <SelectItem key={key} value={key}>{key}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>New Value</Label>
                                        <Input value={valueToSet} onChange={(e) => setValueToSet(e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={handleConfirmModification} disabled={!fieldToSet}>Apply Change</Button>
                                    <Button variant="ghost" onClick={() => setModPlan(null)}>Back</Button>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="analyze" className="space-y-4 pt-4">
                         <p className="text-sm text-muted-foreground">Have the AI analyze all your data to suggest a new validation rule you might have missed.</p>
                         <Button onClick={handleAnalyze} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}Analyze & Suggest</Button>
                         {validationSuggestion && (
                            <div className="p-4 bg-muted rounded-md">
                                <p className="font-semibold">AI Suggestion:</p>
                                <p className="text-sm italic">"{validationSuggestion}"</p>
                            </div>
                         )}
                    </TabsContent>
                </Tabs>
                
                {error && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-md text-sm text-red-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <div><span className="font-semibold">Error:</span> {error}</div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}