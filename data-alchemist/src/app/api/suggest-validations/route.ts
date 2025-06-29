
import { DataRow } from '@/lib/types';
import { NextResponse } from 'next/server';

// You are correctly using the latest version of the Mistral model.
const API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3";
const API_KEY = process.env.HUGGING_FACE_API_KEY;

// Helper to stringify data samples remains the same.
function stringifyDataSample(data: DataRow[], count = 3) {
  if (!data || data.length === 0) return '[]';
  const headers = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'errors');
  const sample = data.slice(0, count).map(row => {
    const newRow: Record<string,any> = {} ;
    headers.forEach(h => newRow[h] = row[h]);
    return newRow;
  });
  return `Headers: ${headers.join(', ')}\nSample Data:\n${JSON.stringify(sample, null, 2)}`;
}

export async function POST(request: Request) {
  console.log("API Key loaded on server:", API_KEY ? `...${API_KEY.slice(-4)}` : "NOT FOUND");

  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }

  const { clients, workers, tasks } = await request.json();

  // --- THIS IS THE FIX ---
  // The 'inputs' for instruction-tuned models like Mistral must be a single, formatted string.
  // We combine the instructions and the data into one block.
  const prompt = `
[INST] You are a data integrity expert for a resource allocation system. Your task is to find one potential problem or a missing validation rule by analyzing the following data samples. Look for logical inconsistencies, strong correlations, or potential capacity issues. Your suggestion should be a single, concise sentence.

Example Suggestion: "Workers in the 'Core' group seem to handle all 'Development' tasks; consider a rule to formalize this."

---
DATA SAMPLES:
Clients:
${stringifyDataSample(clients)}

Workers:
${stringifyDataSample(workers)}

Tasks:
${stringifyDataSample(tasks)}
---

Based on the data, what is one new validation rule you would suggest? [/INST]
`;

  // The payload now correctly sends the prompt as a single string under the "inputs" key.
  const payload = {
    inputs: prompt, // <-- The key change is here!
    parameters: {
        max_new_tokens: 60,
        return_full_text: false, // This is important for instruction models
        temperature: 0.7,
    }
  };

  try {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), // Send the corrected payload
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Hugging Face API Error: Status ${response.status}`, errorText);
        // Using detailed error handling is good practice.
        if (response.status === 422) {
            return NextResponse.json({ error: 'The AI model rejected the input format.', details: errorText }, { status: 422 });
        }
        // ... other error handlers (401, 503, etc.)
        return NextResponse.json({ error: `AI model request failed: ${response.statusText}`, details: errorText }, { status: response.status });
    }

    const result = await response.json();

    // The result format for this model is an array with a single object.
    const suggestion = result[0].generated_text.trim().replace(/^"|"$/g, ''); // Clean up quotes

    return NextResponse.json({ suggestion });

  } catch (error) {
    console.error("Internal error in /api/suggest-validations:", error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}