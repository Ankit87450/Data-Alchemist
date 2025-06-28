// src/app/api/nl-to-modification/route.ts
import { NextResponse } from 'next/server';

// NEW: Also using Mistral-7B Instruct for this task.
const API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";
const API_KEY = process.env.HUGGING_FACE_API_KEY;

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }

  const { query, entity, schema } = await request.json();
  if (!query || !entity || !schema) {
    return NextResponse.json({ error: 'Query, entity, and schema are required.' }, { status: 400 });
  }

  // NEW: A safer and more robust prompt. We ask the AI to generate a SELECT query.
  // This prevents the AI from generating destructive queries (like UPDATE or DELETE).
  // Our frontend will parse the WHERE clause from this safe query.
  const prompt = `
[INST] You are an expert in generating SQL queries. Your task is to generate a SQL query to select rows from a table based on a user's request.

Database Schema:
The database has a table named \`${entity}\`.
The table has the following columns: ${schema.join(', ')}.

User Request: "${query}"

Generate a SQL SELECT statement to find the rows described in the user request. Only generate the SQL query and nothing else. [/INST]
SELECT * FROM \`${entity}\`
`;
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
          inputs: prompt,
          parameters: {
              max_new_tokens: 100,
              return_full_text: false,
          }
      }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `AI model request failed: ${response.statusText}`, details: errorText }, { status: response.status });
    }

    const result = await response.json();
    // Prepend the part of the query we provided to get the full statement
    let sqlCommand = `SELECT * FROM \`${entity}\` ${result[0].generated_text}`;
    sqlCommand = sqlCommand.replace(/;/g, '').trim(); // Clean up the result

    return NextResponse.json({ sqlCommand });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}