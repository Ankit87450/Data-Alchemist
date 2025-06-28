// src/app/api/fix-cell/route.ts
import { NextResponse } from 'next/server';

const API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large";
const API_KEY = process.env.HUGGING_FACE_API_KEY;

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const { invalidValue, context } = await request.json();

  if (!invalidValue || !context) {
    return NextResponse.json({ error: 'Invalid value and context are required' }, { status: 400 });
  }

  const prompt = `
    Fix the following data value based on the context. Only return the corrected value itself, with no extra text.
    Context: The value should be a ${context}.
    Invalid Value: "${invalidValue}"
    Corrected Value:
  `;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hugging Face API Error:", errorText);
      return NextResponse.json({ error: 'Failed to query AI model', details: errorText }, { status: response.status });
    }

    const result = await response.json();
    const fixedValue = result[0].generated_text.trim();

    return NextResponse.json({ fixedValue });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}