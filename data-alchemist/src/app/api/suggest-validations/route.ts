
import { NextResponse } from 'next/server';

// STEP 1: Use a super-reliable, always-on model for our test.
// This eliminates "cold start" as a problem.
const API_URL = "https://api-inference.huggingface.co/models/distilbert-base-cased-distilled-squad";
const API_KEY = process.env.HUGGING_FACE_API_KEY;

export async function POST(request: Request) {
  // STEP 2: Add a console.log to VERIFY the API key is loaded on the server.
  // Check your terminal where `npm run dev` is running to see this log.
  console.log("API Key loaded on server:", API_KEY ? `...${API_KEY.slice(-4)}` : "NOT FOUND");

  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured on the server. Did you restart the server after creating .env.local?' }, { status: 500 });
  }

  const { clients, workers, tasks } = await request.json();

  // STEP 3: Create a payload specifically for this question-answering model.
  const context = `
    Here is data from our system. 
    Clients: ${JSON.stringify(clients.slice(0, 2))}
    Workers: ${JSON.stringify(workers.slice(0, 2))}
    Tasks: ${JSON.stringify(tasks.slice(0, 2))}
  `;

  const payload = {
    inputs: {
        question: "Based on the data, what is one potential validation rule that might be missing?",
        context: context
    }
  };

  try {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    // STEP 4: Add detailed error handling for the response.
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Hugging Face API Error: Status ${response.status}`, errorText);

        if (response.status === 401 || response.status === 403) {
            return NextResponse.json({ error: 'Authorization failed. Your API key may be invalid or you have not accepted the model license.' }, { status: response.status });
        }
        if (response.status === 503) {
            return NextResponse.json({ error: 'The AI model is currently loading (503 Service Unavailable). Please try again in 20 seconds.' }, { status: 503 });
        }
        return NextResponse.json({ error: `AI model request failed: ${response.statusText}`, details: errorText }, { status: response.status });
    }

    const result = await response.json();
    const suggestion = result.answer || "AI could not determine a specific suggestion from the data provided.";

    return NextResponse.json({ suggestion });

  } catch (error) {
    console.error("Internal error in /api/suggest-validations:", error);
    return NextResponse.json({ error: 'An internal server error occurred while making the request.' }, { status: 500 });
  }
}