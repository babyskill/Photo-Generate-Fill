import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // Create a dummy 1x1 transparent PNG
  const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/png',
            },
          },
          {
            text: "Fill the transparent areas with a beautiful landscape",
          },
        ],
      },
      config: {
        imageConfig: {
          imageSize: "2K",
          aspectRatio: "1:1",
        }
      }
    });

    console.log("Response candidates:", JSON.stringify(response.candidates, null, 2));
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
