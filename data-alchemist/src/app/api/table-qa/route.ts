
import { NextResponse } from 'next/server';

const API_URL = "https://api-inference.huggingface.co/models/google/tapas-base-finetuned-wtq";
const API_KEY = process.env.HUGGING_FACE_API_KEY;

// Helper to convert our row-based data to the column-based format TAPAS expects
function formatTableForTapas(data: any[]) {
    if (data.length === 0) return {};
    
    const table: Record<string, string[]> = {};

    const headers = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'errors');
    
    headers.forEach(header => {
        // TAPAS expects all values to be strings
        table[header] = data.map(row => String(row[header] || ''));
    });
    
    return table;
}

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const { query, data } = await request.json();

  if (!query || !data || data.length === 0) {
    return NextResponse.json({ error: 'Query and data table are required' }, { status: 400 });
  }

  const table = formatTableForTapas(data);

  const payload = {
    inputs: {
      query: query,
      table: table,
    }
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Hugging Face API Error:", errorText);
        // Sometimes the model is loading, give a user-friendly error
        if (response.status === 503) {
            return NextResponse.json({ error: 'The AI model is currently loading, please try again in a moment.' }, { status: 503 });
        }
        return NextResponse.json({ error: 'Failed to query AI model', details: errorText }, { status: response.status });
    }

    const result = await response.json();
    
    // TAPAS returns coordinates of the cells [[row, col], ...]. We only need the row indices.
    const rowIndices = new Set<number>(result.coordinates.map((coord: [number, number]) => coord[0]));

    return NextResponse.json({ rowIndices: Array.from(rowIndices) });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}