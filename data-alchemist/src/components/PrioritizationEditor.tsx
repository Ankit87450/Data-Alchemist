
'use client';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { PrioritizationWeights } from '@/lib/types';

export function PrioritizationEditor() {
  const { state, dispatch } = useAppContext();
  const { priorities } = state;

  const handlePriorityChange = (key: keyof PrioritizationWeights, value: number[]) => {
    dispatch({ type: 'UPDATE_PRIORITY', payload: { key, value: value[0] } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prioritization & Weights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label htmlFor="prio-level">Client Priority Level</Label>
            <span className="text-sm font-medium">{priorities.priorityLevel}</span>
          </div>
          <Slider
            id="prio-level"
            defaultValue={[priorities.priorityLevel]}
            max={100}
            step={1}
            onValueChange={(value) => handlePriorityChange('priorityLevel', value)}
          />
          <p className="text-xs text-muted-foreground">How much to weigh the `PriorityLevel` field from clients.</p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label htmlFor="prio-fulfillment">Requested Tasks Fulfillment</Label>
            <span className="text-sm font-medium">{priorities.requestedTasksFulfillment}</span>
          </div>
          <Slider
            id="prio-fulfillment"
            defaultValue={[priorities.requestedTasksFulfillment]}
            max={100}
            step={1}
            onValueChange={(value) => handlePriorityChange('requestedTasksFulfillment', value)}
          />
           <p className="text-xs text-muted-foreground">Importance of satisfying as many `RequestedTaskIDs` as possible.</p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <Label htmlFor="prio-fairness">Worker Fairness</Label>
            <span className="text-sm font-medium">{priorities.fairness}</span>
          </div>
          <Slider
            id="prio-fairness"
            defaultValue={[priorities.fairness]}
            max={100}
            step={1}
            onValueChange={(value) => handlePriorityChange('fairness', value)}
          />
           <p className="text-xs text-muted-foreground">How much to prioritize even distribution of work across available workers.</p>
        </div>
      </CardContent>
    </Card>
  );
}