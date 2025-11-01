import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult } from '../types.ts';

// Fix: Use process.env.API_KEY instead of localStorage and remove UI-related error messages.
async function getAiClient() {
    // The API key must be obtained exclusively from the environment variable `process.env.API_KEY`.
    if (!process.env.API_KEY) {
      throw new Error("API Key not found. Please ensure the API_KEY environment variable is set.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: "The summary in a self-contained HTML string format."
        },
        quiz: {
            type: Type.OBJECT,
            properties: {
                quizTitle: {
                    type: Type.STRING,
                    description: "Title of the quiz related to the document."
                },
                settings: {
                    type: Type.OBJECT,
                    properties: {
                        positiveScore: { type: Type.NUMBER },
                        negativeScore: { type: Type.NUMBER }
                    },
                    required: ['positiveScore', 'negativeScore']
                },
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionText: { type: Type.STRING },
                            options: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            correctAnswerIndex: { type: Type.INTEGER },
                            explanation: { type: Type.STRING },
                            topic: { 
                                type: Type.STRING,
                                description: "The main topic or document section this question relates to (e.g., 'Diagnosis', 'Treatment Protocol')."
                            }
                        },
                        required: ['questionText', 'options', 'correctAnswerIndex', 'explanation', 'topic']
                    }
                }
            },
            required: ['quizTitle', 'settings', 'questions']
        },
        flashcards: {
            type: Type.ARRAY,
            description: "An array of key medical terms and their definitions from the document.",
            items: {
                type: Type.OBJECT,
                properties: {
                    term: {
                        type: Type.STRING,
                        description: "The medical term or concept."
                    },
                    definition: {
                        type: Type.STRING,
                        description: "A concise definition or explanation of the term."
                    },
                    topic: {
                        type: Type.STRING,
                        description: "The main topic or document section this flashcard relates to (e.g., 'Pharmacology', 'Diagnosis')."
                    }
                },
                required: ['term', 'definition', 'topic']
            }
        }
    },
    required: ['summary', 'quiz', 'flashcards']
};

export async function generateMedicalAnalysis(pdfText: string): Promise<AnalysisResult> {
    const ai = await getAiClient();
    const model = 'gemini-2.5-pro';

    const prompt = `
        You are "Medic Papers Boost CS", an expert medical document processing and educational gamification assistant. Your purpose is to transform dense medical documents into three distinct, high-quality outputs: a Summary, an Assessment Quiz, and a set of Flashcards.

        Based on the provided medical document content, generate a JSON object with three root keys: "summary", "quiz", and "flashcards".

        1.  **summary**: The value for this key must be a single, self-contained HTML string. This is the most critical output. It MUST be visually engaging and highly structured, not just flat text. Adhere strictly to the following structure and requirements:
            *   **A Self-Contained \`<style>\` Block:** This is MANDATORY. Provide comprehensive CSS for a professional, modern, and **fully responsive** layout. Use professional color palettes (e.g., blues, grays). The base font should match the application: \`font-family: 'Inter', sans-serif;\`.
                *   **General Readability:** Set a comfortable base \`font-size\` and \`line-height\` for body text.
                *   **Section Headers (\`<h2>\`):** Style these for clear visual hierarchy. They must have a larger \`font-size\`, heavier \`font-weight (e.g., 600)\`, a distinct \`color\` (e.g., a professional blue like #1E40AF), a subtle bottom border (e.g., \`border-bottom: 2px solid #BFDBFE;\`), and adequate padding and margins. Ensure the inline SVG icon is perfectly aligned using flexbox.
                *   **Key Takeaway Cards:**
                    *   The container (\`.card-grid\`) MUST be a responsive grid (\`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));\`).
                    *   Individual cards (\`.card\`) must have a clean look with a white background, soft border (\`border: 1px solid #e5e7eb;\`), rounded corners (\`border-radius: 0.75rem;\`), ample padding, and a refined box-shadow (\`box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);\`).
                    *   Add a subtle hover effect (\`transform: translateY(-4px);\`) for interactivity.
                *   **Styled Tables (CRITICAL):**
                    *   Every \`<table>\` element MUST be wrapped in a container div, for example \`<div class="table-wrapper">\`.
                    *   The wrapper class (\`.table-wrapper\`) MUST have \`overflow-x: auto;\` to ensure tables scroll horizontally on small screens and do not break the page layout.
                    *   The table itself should have \`width: 100%;\` and \`border-collapse: collapse;\`.
                    *   Table headers (\`<th>\`) must be distinct: use a light gray background (\`background-color: #f3f4f6;\`), bold font, and sufficient padding (\`padding: 0.75rem;\`).
                    *   Table rows (\`<td>\`) should have clear borders (\`border: 1px solid #e5e7eb;\`) and padding. Use alternating row colors (\`tr:nth-child(even) { background-color: #f9fafb; }\`) for scannability.
                *   **Clinical Pearls (\`<blockquote>\`) (CRITICAL):** These must be styled as prominent callouts. Style the \`<blockquote>\` tag directly with a light blue background (\`background-color: #EFF6FF;\`), a thick, darker blue left border (\`border-left: 5px solid #3B82F6;\`), generous padding (\`padding: 1rem;\`), and rounded corners (\`border-radius: 0.5rem;\`). The text color should be a dark blue-gray for readability (\`color: #1E3A8A;\`).
                *   **Interactive Tooltips:** Provide clean styling for \`.tooltip\` and \`.tooltiptext\`. The tooltip itself should be dark with white text for high contrast.
                *   **CRITICAL PRINT STYLES:** This \`<style>\` block MUST include a \`@media print\` rule that accomplishes the following:
                    1.  Hides non-essential UI elements.
                    2.  **MANDATORY & NON-NEGOTIABLE:** You MUST include the rule \`.card, section, blockquote, table { page-break-inside: avoid !important; }\` to prevent these crucial elements from splitting across printed pages. This is a critical requirement for professional output.
                    3.  Removes all box shadows, unnecessary backgrounds, and ensures text is black for optimal printing. Tooltips must be hidden.
            *   **HTML Body Content:**
                *   **Main Title:** Start with an \`<h1>\` containing the document's main topic.
                *   **Key Takeaways (Puntos Clave):** This section is MANDATORY. Generate the 5-7 most vital points. Display them in a responsive grid of visually distinct "cards" using the \`.card-grid\` and \`.card\` classes. Each card must have a border, a subtle shadow, and an icon.
                *   **Thematic Sections:** For each major topic (e.g., Diagnosis, Treatment), create a \`<section>\`. Each section MUST begin with a styled \`<h2>\` containing a relevant inline SVG icon and the section title. The containing \`<section>\` tag MUST have NO background or border.
                *   **Rich Content Formatting:** Inside each section, you MUST use appropriate HTML to structure the content. Use:
                    *   \`<strong>\` for important terms.
                    *   \`<ul>\` with \`<li>\` for bulleted lists.
                    *   \`<table>\` for presenting structured data (e.g., drug dosages, diagnostic criteria). Tables are essential for clarity and must be wrapped in a div for horizontal scrolling.
                    *   \`<blockquote>\` styled as a "Clinical Pearl" or "Pro-Tip" for highlighting crucial advice.
                *   **Interactive Tooltips (MANDATORY):** Scan the text for at least 5-10 complex medical terms. For each, wrap it in the tooltip structure: \`<span class="tooltip">Term<span class="tooltiptext">A brief definition.</span></span>\`. This is not optional.

        2.  **quiz**: The value for this key must be a JSON object for an "Interactive Quiz". This JSON must:
            *   Contain a 'quizTitle'.
            *   Contain a 'settings' object with 'positiveScore: 10' and 'negativeScore: -5'.
            *   Contain a 'questions' array of exactly 20 multiple-choice questions if the source material allows.
            *   Each question object must have 'questionText', 'options' (array of 4 strings), 'correctAnswerIndex' (number 0-3), 'explanation', and 'topic'. The 'topic' should be a short string identifying the part of the document the question is about (e.g., "Pathophysiology", "Treatment Guidelines").
            
        3.  **flashcards**: The value for this key must be a JSON array of at least 10 flashcard objects. Each object must contain three keys: "term", "definition", and "topic".
            *   "term": A key medical term, concept, or abbreviation from the document.
            *   "definition": A concise and accurate definition of the term, strictly based on the provided document.
            *   "topic": A short string identifying the part of the document the flashcard is about (e.g., "Pharmacology", "Diagnostic Criteria").

        Here is the medical document content:
        ---
        ${pdfText}
        ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });
        
        const jsonText = response.text.trim();
        const parsedResult = JSON.parse(jsonText);

        // Basic validation
        if (!parsedResult.summary || !parsedResult.quiz || !parsedResult.quiz.questions || !parsedResult.flashcards) {
            throw new Error("Invalid response structure from AI model.");
        }

        return parsedResult as AnalysisResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Fix: Remove localStorage logic and update error message.
        if (error instanceof Error && (error.message.includes("API key not valid") || error.message.includes("400 Bad Request"))) {
            throw new Error("The provided API Key is not valid or has expired. Please check your API_KEY environment variable.");
        }
        throw new Error("Failed to generate analysis from the AI model.");
    }
}