
import { NextResponse } from 'next/server';

const API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3";
const API_KEY = process.env.HUGGING_FACE_API_KEY;

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
  }

  const { query, entity, schema } = await request.json();
  if (!query || !entity || !schema) {
    return NextResponse.json({ error: 'Query, entity, and schema are required.' }, { status: 400 });
  }

  // The prompt is well-designed for Mistral.
  const prompt = `
[INST] You are an expert in generating SQL queries. Your task is to generate a SQL query to select rows from a table based on a user's request.

Database Schema:
The database has a table named \`${entity}\`.
The table has the following columns: ${schema.join(', ')}.

User Request: "${query}"

Generate a SQL SELECT statement to find the rows described in the user request. Only generate the SQL query and nothing else. [/INST]
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

    // ADD MORE DETAILED ERROR HANDLING for consistency and easier debugging.
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Hugging Face API Error: Status ${response.status}`, errorText);
        if (response.status === 401 || response.status === 403) {
            return NextResponse.json({ error: 'Authorization failed. Your API key may be invalid or you have not accepted the model license.' }, { status: response.status });
        }
        if (response.status === 503) {
            return NextResponse.json({ error: 'The AI model is currently loading. Please try again in 20 seconds.' }, { status: 503 });
        }
        return NextResponse.json({ error: `AI model request failed: ${response.statusText}`, details: errorText }, { status: response.status });
    }

    const result = await response.json();
    const generatedText = result[0].generated_text;

    // --- THIS LOGIC IS NOW MORE ROBUST ---
    // It intelligently assembles the final SQL command.
    let sqlCommand;
    // Check if the AI generated a full query or just the WHERE clause.
    if (generatedText.trim().toLowerCase().startsWith('select')) {
      sqlCommand = generatedText;
    } else {
      // If it only generated the WHERE part, prepend the SELECT part.
      sqlCommand = `SELECT * FROM \`${entity}\` ${generatedText}`;
    }

    // Clean up the final result.
    sqlCommand = sqlCommand.replace(/;/g, '').replace(/\n/g, ' ').trim();

    return NextResponse.json({ sqlCommand });

  } catch (error) {
    console.error("Internal error in /api/nl-to-modification:", error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}