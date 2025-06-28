
'use client';
import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Rule } from '@/lib/types';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { PlusCircle, Trash2 } from 'lucide-react';

export function RuleBuilder() {
  const { state, dispatch } = useAppContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ruleType, setRuleType] = useState<Rule['type'] | ''>('');
  const [taskIds, setTaskIds] = useState('');
  const [workerGroup, setWorkerGroup] = useState('');
  const [maxSlots, setMaxSlots] = useState(1);

  const handleAddRule = () => {
    let newRule: Rule | null = null;
    switch (ruleType) {
      case 'coRun':
        newRule = { type: 'coRun', tasks: taskIds.split(',').map(t => t.trim()) };
        break;
      case 'loadLimit':
        newRule = { type: 'loadLimit', workerGroup: workerGroup, maxSlotsPerPhase: maxSlots };
        break;
      // Add other rule types here...
    }

    if (newRule) {
      dispatch({ type: 'ADD_RULE', payload: newRule });
    }
    
    // Reset form and close dialog
    setRuleType('');
    setTaskIds('');
    setWorkerGroup('');
    setMaxSlots(1);
    setIsDialogOpen(false);
  };
  
  const getRuleDescription = (rule: Rule) => {
    switch(rule.type) {
      case 'coRun': return `Co-Run: Tasks [${rule.tasks.join(', ')}] must run together.`;
      case 'loadLimit': return `Load Limit: Workers in group "${rule.workerGroup}" cannot exceed ${rule.maxSlotsPerPhase} slots per phase.`;
      default: return 'Unknown Rule';
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Business Rules</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4" /> Add Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a New Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rule-type">Rule Type</Label>
                <Select onValueChange={(value) => setRuleType(value as Rule['type'])}>
                  <SelectTrigger id="rule-type">
                    <SelectValue placeholder="Select a rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coRun">Co-Run Tasks</SelectItem>
                    <SelectItem value="loadLimit">Worker Load Limit</SelectItem>
                    {/* Add other rule types as SelectItem here */}
                  </SelectContent>
                </Select>
              </div>

              {ruleType === 'coRun' && (
                <div className="space-y-2">
                  <Label htmlFor="task-ids">Task IDs (comma-separated)</Label>
                  <Input id="task-ids" value={taskIds} onChange={e => setTaskIds(e.target.value)} placeholder="T01, T02, T05" />
                </div>
              )}

              {ruleType === 'loadLimit' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="worker-group">Worker Group</Label>
                    <Input id="worker-group" value={workerGroup} onChange={e => setWorkerGroup(e.target.value)} placeholder="Sales" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-slots">Max Slots Per Phase</Label>
                    <Input id="max-slots" type="number" value={maxSlots} onChange={e => setMaxSlots(Number(e.target.value))} min={1} />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddRule} disabled={!ruleType}>Add Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {state.rules.length > 0 ? (
          <ul className="space-y-2">
            {state.rules.map((rule, index) => (
              <li key={index} className="flex justify-between items-center p-2 bg-muted rounded-md">
                <span className="text-sm">{getRuleDescription(rule)}</span>
                <Button variant="ghost" size="icon" onClick={() => dispatch({ type: 'REMOVE_RULE', payload: { index } })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-center">No rules defined yet. Click "Add Rule" to begin.</p>
        )}
      </CardContent>
    </Card>
  );
}