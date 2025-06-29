
import { NextResponse } from 'next/server';

// Using a powerful instruction-tuned model is a great choice for this task.
const API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";
const API_KEY = process.env.HUGGING_FACE_API_KEY;

export async function POST(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const { invalidValue, context } = await request.json();

  if (!invalidValue || !context) {
    return NextResponse.json({ error: 'Invalid value and context are required' }, { status: 400 });
  }

  // A prompt specifically designed for an instruction-tuned model like Mistral
  const prompt = `
[INST] You are a data correction expert. Your task is to fix the following data value based on the provided context.
Your response must ONLY be the corrected value itself, with no extra text, explanations, or quotation marks.

Context: The value must be a ${context}.
Invalid Value: \`${invalidValue}\`
[/INST]
`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
            max_new_tokens: 100,      // Limit output size
            return_full_text: false,  // Return only the AI's generation
            temperature: 0.1,         // Make the output more deterministic
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Hugging Face API Error:", errorText);
      return NextResponse.json({ error: 'Failed to query AI model', details: errorText }, { status: response.status });
    }

    const result = await response.json();
    let fixedValue = result[0].generated_text.trim();
    
    // Clean up potential markdown formatting from the AI
    if (fixedValue.startsWith("`") && fixedValue.endsWith("`")) {
        fixedValue = fixedValue.substring(1, fixedValue.length - 1);
    }

    return NextResponse.json({ fixedValue });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}