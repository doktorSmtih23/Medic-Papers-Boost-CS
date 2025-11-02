import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

// --- Consolidated Code ---
// To solve deployment issues with incorrect MIME types, all source code
// has been moved into this single file. This avoids multiple browser
// requests for .ts/.tsx files that the server might misconfigure.

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// --- types.ts ---
interface Question {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  topic: string;
}

interface QuizSettings {
  positiveScore: number;
  negativeScore: number;
}

interface Quiz {
  quizTitle: string;
  settings: QuizSettings;
  questions: Question[];
}

interface Flashcard {
  term: string;
  definition: string;
  topic: string;
}

interface AnalysisResult {
    summary: string;
    quiz: Quiz;
    flashcards: Flashcard[];
}

interface SavedArticle {
  id: string;
  fileName: string;
  specialty: string;
  analysisResult: AnalysisResult;
  savedAt: string;
}

// --- services/libraryService.ts ---
const LIBRARY_KEY = 'medicPapersBoostLibrary';

const getLibrary = (): SavedArticle[] => {
    try {
        const savedLibrary = localStorage.getItem(LIBRARY_KEY);
        if (savedLibrary) {
            const library: SavedArticle[] = JSON.parse(savedLibrary);
            return library.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        }
    } catch (error) {
        console.error("Failed to load library from localStorage:", error);
    }
    return [];
};

const saveArticle = (fileName: string, specialty: string, analysisResult: AnalysisResult): SavedArticle[] => {
    const library = getLibrary();
    const newArticle: SavedArticle = {
        id: new Date().toISOString() + Math.random(),
        fileName,
        specialty,
        analysisResult,
        savedAt: new Date().toISOString(),
    };
    const updatedLibrary = [newArticle, ...library];
    try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLibrary));
    } catch (error) {
        console.error("Failed to save article to localStorage:", error);
    }
    return updatedLibrary;
};

const deleteArticle = (articleId: string): SavedArticle[] => {
    let library = getLibrary();
    const updatedLibrary = library.filter(article => article.id !== articleId);
    try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLibrary));
    } catch (error) {
        console.error("Failed to delete article from localStorage:", error);
    }
    return updatedLibrary;
}

// --- services/geminiService.ts ---
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: "The summary in a self-contained HTML string format." },
        quiz: {
            type: Type.OBJECT,
            properties: {
                quizTitle: { type: Type.STRING, description: "Title of the quiz related to the document." },
                settings: { type: Type.OBJECT, properties: { positiveScore: { type: Type.NUMBER }, negativeScore: { type: Type.NUMBER } }, required: ['positiveScore', 'negativeScore'] },
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionText: { type: Type.STRING },
                            options: { type: Type.ARRAY, items: { type: Type.STRING } },
                            correctAnswerIndex: { type: Type.INTEGER },
                            explanation: { type: Type.STRING },
                            topic: { type: Type.STRING, description: "The main topic or document section this question relates to (e.g., 'Diagnosis', 'Treatment Protocol')." }
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
                    term: { type: Type.STRING, description: "The medical term or concept." },
                    definition: { type: Type.STRING, description: "A concise definition or explanation of the term." },
                    topic: { type: Type.STRING, description: "The main topic or document section this flashcard relates to (e.g., 'Pharmacology', 'Diagnosis')." }
                },
                required: ['term', 'definition', 'topic']
            }
        }
    },
    required: ['summary', 'quiz', 'flashcards']
};

async function generateMedicalAnalysis(pdfText: string, detailLevel: 'simple' | 'concrete' | 'deep'): Promise<AnalysisResult> {
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
      throw new Error("API Key not found. Please select or enter an API Key to continue.");
    }
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    let detailInstruction = '';
    switch (detailLevel) {
        case 'simple':
            detailInstruction = 'The user has selected: "Simple, para tener idea del tema". The summary must be a brief, high-level overview, written in simple language. Focus only on the document\'s main purpose and final conclusions. The target audience is someone who just wants to get a general idea of the topic quickly.';
            break;
        case 'concrete':
            detailInstruction = 'The user has selected: "Concreto, tener conceptos fundamentales". The summary must be well-balanced and concise, focusing on the fundamental concepts, key methodologies, and principal findings. It should define the most important terms clearly. The target audience is someone who needs to understand the core pillars of the document without excessive detail.';
            break;
        case 'deep':
            detailInstruction = 'The user has selected: "Profundo, para examenes". The summary must be profound, comprehensive, and detailed, suitable for exam preparation or in-depth study. It must include specifics about methodologies, data points, results, limitations, and clinical implications. Complex concepts must be explained thoroughly. The target audience is a professional or student who needs to master the subject matter.';
            break;
    }

    const model = 'gemini-2.5-pro';
    const prompt = `
        You are "Medic Papers Boost CS", an expert medical document processing and educational gamification assistant. Your purpose is to transform dense medical documents into three distinct, high-quality outputs: a Summary, an Assessment Quiz, and a set of Flashcards.
        Based on the provided medical document content, generate a JSON object with three root keys: "summary", "quiz", and "flashcards".

        1.  **summary**: A single, self-contained HTML string. This is the most critical output.
            **CRITICAL INSTRUCTION FOR SUMMARY DETAIL:** Based on the user's choice, generate the summary with the following level of detail: ${detailInstruction}.
            The summary's HTML MUST be visually engaging, professional, and well-structured.
            *   **A Self-Contained \`<style>\` Block (MANDATORY):**
                *   The CSS must create a professional, modern, and fully responsive layout. The base font should be 'Inter', sans-serif.
                *   **CSS Variables for Theming (CRITICAL):** Define CSS variables for ALL colors in a \`:root\` selector for the light theme. Then, create a \`html.dark\` selector that re-defines these same variables for a dark theme. Style ALL elements using these variables (e.g., \`color: var(--text-color);\`). This ensures the summary's theme syncs with the main application.
                *   **Example CSS Variables:**
                    \`\`\`css
                    :root {
                        --bg-color: #ffffff; --text-color: #374151; --heading-color: #111827; --border-color: #e5e7eb;
                        --card-bg: #ffffff; --blockquote-bg: #EFF6FF; --blockquote-border: #3B82F6; --table-header-bg: #f3f4f6;
                    }
                    html.dark {
                        --bg-color: #111827; --text-color: #d1d5db; --heading-color: #f9fafb; --border-color: #374151;
                        --card-bg: #1f2937; --blockquote-bg: #1e3a8a; --blockquote-border: #60a5fa; --table-header-bg: #374151;
                    }
                    body { background-color: var(--bg-color); color: var(--text-color); }
                    \`\`\`
                *   **Styled Tables:** Tables must be styled for clarity, be responsive (scroll horizontally on small screens), and have distinct headers and alternating row colors, using the CSS variables. Every \`<table>\` must be wrapped in a scrollable container.
                *   **Clinical Pearls:** Style \`<blockquote>\` elements as prominent callouts with a background and border to highlight key clinical advice, using the CSS variables.
                *   **Key Takeaway Cards:** Style a \`.card-grid\` container as a responsive grid. Individual \`.card\` elements inside should be visually distinct with borders, shadows, and a hover effect, using the CSS variables.
                *   **Section Headers:** Style \`<h2>\` headers for clear hierarchy with a larger font, bold weight, and a bottom border, using the CSS variables.
                *   **Print Styles:** Include a \`@media print\` rule. CRITICALLY, this rule must include \`page-break-inside: avoid !important;\` for cards, sections, blockquotes, and table wrappers to prevent them from splitting across pages. Also, optimize for printing by removing backgrounds/shadows and using black text.
            *   **HTML Body Content (MANDATORY):**
                *   **Structure:** Start with \`<h1>\` for the title. Use \`<section>\` for major topics, each starting with a styled \`<h2>\` that includes an inline SVG icon.
                *   **Key Takeaways:** Generate 5-7 vital points inside the styled \`.card-grid\`.
                *   **Rich Content:** Use standard semantic HTML like \`<strong>\`, \`<ul>\`, and the styled \`<table>\`s and \`<blockquote>\`s.
                *   **Interactive Tooltips:** Find at least 5-10 complex medical terms and wrap them in \`<span class="tooltip">Term<span class="tooltiptext">Definition</span></span>\`. This is mandatory.

        2.  **quiz**: A JSON object for an "Interactive Quiz" with a title, settings, and an array of 20 multiple-choice questions if possible.

        3.  **flashcards**: A JSON array of at least 10 flashcard objects, each with "term", "definition", and "topic".

        Here is the medical document content:
        ---
        ${pdfText}
        ---
    `;
    try {
        const response = await ai.models.generateContent({ model: model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: responseSchema } });
        const jsonText = response.text.trim();
        const parsedResult = JSON.parse(jsonText);
        if (!parsedResult.summary || !parsedResult.quiz || !parsedResult.quiz.questions || !parsedResult.flashcards) {
            throw new Error("Invalid response structure from AI model.");
        }
        return parsedResult as AnalysisResult;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error && (error.message.includes("API key not valid") || error.message.includes("Requested entity was not found."))) {
             throw new Error("The provided API Key is not valid. Please check your key.");
        }
        throw new Error("Failed to generate analysis from the AI model.");
    }
}

// --- components/LoadingSpinner.tsx ---
const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-10 w-10 text-blue-600 dark:text-blue-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// --- components/Home.tsx ---
const FeatureIcon1 = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
const FeatureIcon2 = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>;
const FeatureIcon3 = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const Home: React.FC<{ onGetStarted: () => void; onViewLibrary: () => void; }> = ({ onGetStarted, onViewLibrary }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="relative"><div className="absolute inset-0 bg-gray-100 dark:bg-gray-900 mix-blend-multiply" /><div className="relative px-4 py-16 sm:px-6 sm:py-24 lg:py-32 lg:px-8"><h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl"><span className="block text-gray-900 dark:text-gray-100">Unlock Medical Insights</span><span className="block text-blue-600 dark:text-blue-400">Instantly.</span></h1><p className="mt-6 max-w-lg mx-auto text-center text-xl text-gray-600 dark:text-gray-300 sm:max-w-3xl">Medic Papers Boost CS transforms dense medical documents into clear summaries and interactive quizzes, helping you learn faster and retain more.</p><div className="mt-10 max-w-md mx-auto sm:max-w-lg sm:flex sm:justify-center gap-4"><button onClick={onGetStarted} className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 sm:w-auto">Analyze a Document</button><button onClick={onViewLibrary} className="w-full mt-4 sm:mt-0 flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 sm:w-auto">View My Library</button></div></div></div>
        <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-8"><div className="max-w-7xl mx-auto"><div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8"><div className="text-center"><div className="flex items-center justify-center h-16 w-16 rounded-md bg-blue-100 dark:bg-gray-700 text-white mx-auto"><FeatureIcon1 /></div><h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">AI-Powered Summaries</h3><p className="mt-2 text-base text-gray-500 dark:text-gray-400">Go from pages of text to scannable summaries with key takeaways, clinical pearls, and data tables in seconds.</p></div><div className="text-center"><div className="flex items-center justify-center h-16 w-16 rounded-md bg-blue-100 dark:bg-gray-700 text-white mx-auto"><FeatureIcon2 /></div><h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Interactive Learning</h3><p className="mt-2 text-base text-gray-500 dark:text-gray-400">Reinforce your knowledge with auto-generated quizzes based on the document's content, complete with scoring and explanations.</p></div><div className="text-center"><div className="flex items-center justify-center h-16 w-16 rounded-md bg-blue-100 dark:bg-gray-700 text-white mx-auto"><FeatureIcon3 /></div><h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-gray-100">Secure and Private</h3><p className="mt-2 text-base text-gray-500 dark:text-gray-400">Your documents are processed on the fly and never stored. Your privacy and data security are our top priority.</p></div></div></div></div>
    </div>
);

// --- components/FileUpload.tsx ---
const UploadIcon = () => <svg className="w-12 h-12 mx-auto text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const FileUpload: React.FC<{ onFileUpload: (file: File) => void; isLoading: boolean; }> = ({ onFileUpload, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) { if (files[0].type === 'application/pdf') { onFileUpload(files[0]); } else { alert('Please upload a PDF file.'); } }
  }, [onFileUpload]);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (files && files.length > 0) { onFileUpload(files[0]); }
  };
  return (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Upload Your Medical Document</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">Drag and drop a PDF file or click to select one.</p>
      <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`relative block w-full border-2 ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'} border-dashed rounded-lg p-12 text-center hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}>
        <UploadIcon /><span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-200">Drag and drop your PDF here</span><span className="text-xs text-gray-500 dark:text-gray-400">or</span>
        <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
          <span> browse files</span><input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} disabled={isLoading} />
        </label>
      </div><p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Your documents are processed securely and are not stored.</p>
    </div>
  );
};

// --- components/SummaryDetailSelector.tsx ---
type DetailLevel = 'simple' | 'concrete' | 'deep';
const DetailOptionIconSimple = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.553L16.5 21.75l-.398-1.197a3.375 3.375 0 00-2.456-2.456L12.75 18l1.197-.398a3.375 3.375 0 002.456-2.456L16.5 14.25l.398 1.197a3.375 3.375 0 002.456 2.456L20.25 18l-1.197.398a3.375 3.375 0 00-2.456 2.456z" /></svg>;
const DetailOptionIconConcrete = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.75h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5M21 4.5H3a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 003 19.5h18a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0021 4.5z" /></svg>;
const DetailOptionIconDeep = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5M20.25 21.75l-2.25-2.25m0 0l-2.25 2.25m2.25-2.25V15m-4.5-5.25l-2.25-2.25m0 0l-2.25 2.25m2.25-2.25V3" /></svg>;

const SummaryDetailSelector: React.FC<{
    fileName: string;
    detail: DetailLevel;
    setDetail: (detail: DetailLevel) => void;
    onStartAnalysis: () => void;
}> = ({ fileName, detail, setDetail, onStartAnalysis }) => {
    const options = [
        { id: 'simple', icon: <DetailOptionIconSimple />, title: 'Simple', description: 'Para tener idea del tema' },
        { id: 'concrete', icon: <DetailOptionIconConcrete />, title: 'Concreto', description: 'Tener conceptos fundamentales' },
        { id: 'deep', icon: <DetailOptionIconDeep />, title: 'Profundo', description: 'Para examenes' },
    ];
    return (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Configurar Análisis</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-1">Archivo: <span className="font-medium text-gray-800 dark:text-gray-100">{fileName}</span></p>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Elige qué tan detallado quieres que sea el resumen.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {options.map(opt => (
                    <button key={opt.id} onClick={() => setDetail(opt.id as DetailLevel)} className={`p-6 border-2 rounded-lg text-center transition-all duration-200 ${detail === opt.id ? 'border-blue-500 bg-blue-50 dark:bg-gray-700 shadow-lg scale-105' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700/50'}`}>
                        <div className="mx-auto w-fit mb-3">{opt.icon}</div>
                        <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{opt.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{opt.description}</p>
                    </button>
                ))}
            </div>

            <button onClick={onStartAnalysis} className="w-full sm:w-auto px-10 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-transform">
                Generar Análisis
            </button>
        </div>
    );
};


// --- components/SummaryView.tsx ---
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const SummaryView: React.FC<{ htmlContent: string; fileName: string; }> = ({ htmlContent }) => (
    <div>
        <div className="flex justify-end mb-4 no-print">
            <button onClick={() => window.print()} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"><PrintIcon />Print / Save PDF</button>
        </div>
        <div id="print-section" className="prose max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
    </div>
);

// --- components/QuizView.tsx ---
interface SavedQuizState { quizTitle: string; activeQuestions: Question[]; currentQuestionIndex: number; score: number; userAnswers: (number | null)[]; numQuestions: number; }
const LOCAL_STORAGE_KEY = 'medicPapersBoostQuizProgress';
const CheckIcon = () => <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
const XIcon = () => <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.607a1 1 0 010-1.314z" clipRule="evenodd" /></svg>;
const DownloadIconQV = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const QuizView: React.FC<{ quizData: Quiz; fileName: string; }> = ({ quizData, fileName }) => {
  const [quizStarted, setQuizStarted] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [savedProgress, setSavedProgress] = useState<SavedQuizState | null>(null);
  const allTopics = useMemo(() => [...new Set(quizData.questions.map(q => q.topic))], [quizData.questions]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(allTopics);
  const filteredQuestions = useMemo(() => quizData.questions.filter(q => selectedTopics.includes(q.topic)), [quizData.questions, selectedTopics]);
  const maxQuestionsAvailable = filteredQuestions.length;
  const minQuestions = Math.min(5, maxQuestionsAvailable);
  const maxQuestions = Math.min(20, maxQuestionsAvailable);
  useEffect(() => { try { const s = localStorage.getItem(LOCAL_STORAGE_KEY); if (s) { const saved: SavedQuizState = JSON.parse(s); if (saved.quizTitle === quizData.quizTitle) setSavedProgress(saved); else localStorage.removeItem(LOCAL_STORAGE_KEY); } } catch (e) { console.error("Failed to load quiz progress:", e); localStorage.removeItem(LOCAL_STORAGE_KEY); } }, [quizData.quizTitle]);
  useEffect(() => { if (maxQuestionsAvailable === 0) { if (numQuestions !== 0) setNumQuestions(0); return; } let clampedNum = numQuestions; if (clampedNum > maxQuestions) clampedNum = maxQuestions; if (clampedNum < minQuestions) clampedNum = minQuestions; if (clampedNum !== numQuestions) setNumQuestions(clampedNum); }, [maxQuestions, minQuestions, maxQuestionsAvailable, numQuestions]);
  
  const handleTopicToggle = (topic: string) => { setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic] ); };
  const handleSelectAllTopics = () => { setSelectedTopics(allTopics); };
  const handleDeselectAllTopics = () => { setSelectedTopics([]); };

  const handleStartNewQuiz = () => { localStorage.removeItem(LOCAL_STORAGE_KEY); const shuffled = [...filteredQuestions]; for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; } setActiveQuestions(shuffled.slice(0, numQuestions)); setCurrentQuestionIndex(0); setScore(0); setSelectedAnswerIndex(null); setIsAnswered(false); setShowExplanation(false); setQuizFinished(false); setUserAnswers(Array(numQuestions).fill(null)); setQuizStarted(true); setSavedProgress(null); };
  const handleResumeQuiz = () => { if (!savedProgress) return; setActiveQuestions(savedProgress.activeQuestions); setCurrentQuestionIndex(savedProgress.currentQuestionIndex); setScore(savedProgress.score); setUserAnswers(savedProgress.userAnswers); setNumQuestions(savedProgress.numQuestions); const lastAnswer = savedProgress.userAnswers[savedProgress.currentQuestionIndex]; if (lastAnswer !== null && typeof lastAnswer !== 'undefined') { setSelectedAnswerIndex(lastAnswer); setIsAnswered(true); setShowExplanation(true); } setQuizStarted(true); setSavedProgress(null); };
  const currentQuestion = activeQuestions[currentQuestionIndex];
  const handleAnswerSelect = (index: number) => { if (isAnswered) return; setIsAnswered(true); setSelectedAnswerIndex(index); let newScore = score; if (index === currentQuestion.correctAnswerIndex) newScore += quizData.settings.positiveScore; else newScore += quizData.settings.negativeScore; setScore(newScore); const newAnswers = [...userAnswers]; newAnswers[currentQuestionIndex] = index; setUserAnswers(newAnswers); const stateToSave: SavedQuizState = { quizTitle: quizData.quizTitle, activeQuestions, currentQuestionIndex, score: newScore, userAnswers: newAnswers, numQuestions }; localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave)); setTimeout(() => { setShowExplanation(true); }, 1200); };
  const handleNextQuestion = () => { if (currentQuestionIndex < activeQuestions.length - 1) { setCurrentQuestionIndex(prev => prev + 1); setIsAnswered(false); setSelectedAnswerIndex(null); setShowExplanation(false); } else { setQuizFinished(true); localStorage.removeItem(LOCAL_STORAGE_KEY); } };
  const handleRestartQuiz = () => { localStorage.removeItem(LOCAL_STORAGE_KEY); setQuizStarted(false); setSavedProgress(null); setSelectedTopics(allTopics); };
  const handleExportToDoc = () => { if (!activeQuestions.length) return; let docContent = `Quiz: ${quizData.quizTitle}\n\n----------------------------------------\n\n`; activeQuestions.forEach((q, index) => { docContent += `${index + 1}. ${q.questionText}\n`; q.options.forEach((opt, i) => { docContent += `   ${String.fromCharCode(97 + i)}. ${opt}\n`; }); docContent += `\nCorrect Answer: ${q.options[q.correctAnswerIndex]}\nExplanation: ${q.explanation}\n----------------------------------------\n\n`; }); const sanitizedFileName = fileName.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '_'); const exportFileName = `${sanitizedFileName} - Quiz.doc`; const bom = '\uFEFF'; const dataBlob = new Blob([bom + docContent], { type: 'application/msword;charset=utf-8' }); const url = window.URL.createObjectURL(dataBlob); const link = document.createElement('a'); link.href = url; link.download = exportFileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url); };
  const getOptionClass = (index: number) => { if (!isAnswered) return "bg-white dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 hover:border-blue-400 text-gray-900 dark:text-gray-100 transform hover:-translate-y-1 active:scale-[0.99]"; const isCorrect = index === currentQuestion.correctAnswerIndex; const isSelected = index === selectedAnswerIndex; if (isCorrect) return "bg-green-100 dark:bg-green-900/50 border-green-500 text-green-900 dark:text-green-200 font-semibold transform scale-105 shadow-lg"; if (isSelected && !isCorrect) return "bg-red-100 dark:bg-red-900/50 border-red-500 text-red-900 dark:text-red-200 font-semibold transform scale-105 shadow-lg"; return "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 opacity-60"; };
  const progressPercentage = useMemo(() => (activeQuestions.length === 0 ? 0 : ((currentQuestionIndex + 1) / activeQuestions.length) * 100), [currentQuestionIndex, activeQuestions.length]);
  
  if (!quizStarted) {
    return (
      <div className="max-w-4xl mx-auto text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">{quizData.quizTitle}</h2>
        
        {savedProgress ? (
            <div className="my-8 p-6 bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="text-xl font-semibold text-blue-800 dark:text-blue-200">Welcome Back!</h3>
                <p className="text-blue-700 dark:text-blue-300 mt-2">
                    You have a quiz in progress with {savedProgress.numQuestions} questions. You were on question {savedProgress.currentQuestionIndex + 1}.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button onClick={handleResumeQuiz} className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-transform">Resume Quiz</button>
                    <button onClick={handleStartNewQuiz} className="w-full sm:w-auto px-8 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">Start New Quiz</button>
                </div>
            </div>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Ready to test your knowledge? Customize your quiz below.</p>

            <div className="max-w-xl mx-auto my-8 text-left">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-3">Filter by Topic</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {allTopics.map(topic => (
                  <button key={topic} onClick={() => handleTopicToggle(topic)} className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${selectedTopics.includes(topic) ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>
                    {topic}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                  <button onClick={handleSelectAllTopics} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                  <button onClick={handleDeselectAllTopics} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Deselect All</button>
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <label htmlFor="numQuestions" className="block text-lg font-medium text-gray-700 dark:text-gray-200">Number of Questions ({maxQuestionsAvailable} available)</label>
              <div className="flex items-center justify-center space-x-4 my-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{minQuestions > 0 ? minQuestions : 0}</span>
                <input id="numQuestions" type="range" min={minQuestions > 0 ? minQuestions : 0} max={maxQuestions > 0 ? maxQuestions : 0} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed" disabled={maxQuestionsAvailable < minQuestions || maxQuestionsAvailable === 0}/>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{maxQuestions > 0 ? maxQuestions : 0}</span>
              </div>
              <div className="font-bold text-blue-600 dark:text-blue-400 text-4xl my-4">{numQuestions}</div>
            </div>

            {maxQuestionsAvailable < minQuestions ? (
                <p className="text-red-600 dark:text-red-400 mt-4">{selectedTopics.length > 0 ? `Not enough questions found for the selected topics (minimum ${minQuestions} required).` : 'Please select at least one topic to start the quiz.'}</p>
            ) : (
              <div className="mt-8">
                <button onClick={handleStartNewQuiz} disabled={selectedTopics.length === 0 || numQuestions === 0} className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-transform disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none">Start Quiz</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
  
  if (quizFinished) { const correctAnswers = userAnswers.filter((answer, index) => answer === activeQuestions[index].correctAnswerIndex).length; const percentageScore = Math.round((correctAnswers / activeQuestions.length) * 100); const passed = percentageScore >= 90; const incorrectQuestions = activeQuestions.filter((q, index) => userAnswers[index] !== null && userAnswers[index] !== q.correctAnswerIndex); const topicsToReview = [...new Set(incorrectQuestions.map(q => q.topic))]; return ( <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md"><h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Quiz Completed!</h2><div className={`mt-6 p-6 rounded-lg ${passed ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}><p className="text-lg">Your final score</p><p className={`mt-2 text-6xl font-bold ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{percentageScore}%</p><p>({correctAnswers} out of {activeQuestions.length} correct)</p>{passed ? <p className="mt-4 font-semibold text-green-700 dark:text-green-300">Congratulations!</p> : <p className="mt-4 font-semibold text-red-700 dark:text-red-300">Review the topics below.</p>}</div>{!passed && topicsToReview.length > 0 && (<div className="mt-8 text-left p-6 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500"><h3 className="text-xl font-bold dark:text-gray-100">Areas for Review</h3><ul className="list-disc list-inside mt-4 dark:text-gray-300">{topicsToReview.map((topic, index) => <li key={index}>{topic}</li>)}</ul></div>)}<div className="mt-10 flex gap-4 justify-center"><button onClick={handleRestartQuiz} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg">Start New Quiz</button><button onClick={handleExportToDoc} className="inline-flex items-center px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg"><DownloadIconQV />Export for Forms (.doc)</button></div></div>); }
  return ( <div className="max-w-4xl mx-auto"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold dark:text-gray-100">{quizData.quizTitle}</h2><p className="text-lg font-semibold text-blue-600 dark:text-blue-400">Score: {score}</p></div><div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div></div><p className="text-sm text-gray-500 dark:text-gray-400 text-right mb-4">Question {currentQuestionIndex + 1} of {activeQuestions.length}</p><div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow"><p className="text-lg font-semibold mb-4 dark:text-gray-100">{currentQuestion.questionText}</p><div className="space-y-3">{currentQuestion.options.map((option, index) => (<button key={index} onClick={() => handleAnswerSelect(index)} disabled={isAnswered} className={`w-full text-left p-4 border rounded-lg flex items-center justify-between transition-all duration-300 ${getOptionClass(index)}`}><span>{option}</span>{isAnswered && (<span className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center ${index === currentQuestion.correctAnswerIndex ? 'bg-green-500' : 'bg-red-500'}`}>{index === currentQuestion.correctAnswerIndex ? <CheckIcon /> : <XIcon />}</span>)}</button>))}</div>{showExplanation && (<div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500"><h4 className="font-bold dark:text-yellow-200">Explanation</h4><p className="dark:text-yellow-300">{currentQuestion.explanation}</p><div className="mt-6 text-right"><button onClick={handleNextQuestion} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg">{currentQuestionIndex < activeQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}</button></div></div>)}</div></div>);
};

// --- components/FlashcardsView.tsx ---
const ArrowLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const ArrowRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const DownloadIconFV = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const FlashcardsView: React.FC<{ flashcards: Flashcard[]; fileName: string; }> = ({ flashcards, fileName }) => {
  const [deckStarted, setDeckStarted] = useState(false);
  const [numFlashcards, setNumFlashcards] = useState(10);
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[]>([]);
  const allTopics = useMemo(() => [...new Set(flashcards.map(f => f.topic))], [flashcards]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(allTopics);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const filteredFlashcards = useMemo(() => flashcards.filter(f => selectedTopics.includes(f.topic)), [flashcards, selectedTopics]);
  const maxFlashcardsAvailable = filteredFlashcards.length;
  const minFlashcards = Math.min(5, maxFlashcardsAvailable);
  const maxFlashcards = Math.max(minFlashcards, maxFlashcardsAvailable);
  
  useEffect(() => { if (maxFlashcardsAvailable === 0) { if (numFlashcards !== 0) setNumFlashcards(0); return; } let clampedNum = numFlashcards; if (clampedNum > maxFlashcards) clampedNum = maxFlashcards; if (clampedNum < minFlashcards) clampedNum = minFlashcards; if (clampedNum !== numFlashcards) setNumFlashcards(clampedNum); }, [maxFlashcards, minFlashcards, maxFlashcardsAvailable, numFlashcards]);
  
  const handleTopicToggle = (topic: string) => { setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]); };
  const handleSelectAllTopics = () => setSelectedTopics(allTopics);
  const handleDeselectAllTopics = () => setSelectedTopics([]);

  const handleStartDeck = () => { const shuffled = [...filteredFlashcards].sort(() => 0.5 - Math.random()); setActiveFlashcards(shuffled.slice(0, numFlashcards)); setCurrentIndex(0); setIsFlipped(false); setDeckStarted(true); };
  useEffect(() => { setIsFlipped(false); }, [currentIndex]);
  const handleNext = useCallback(() => { if (currentIndex < activeFlashcards.length - 1) setCurrentIndex(currentIndex + 1); }, [currentIndex, activeFlashcards.length]);
  const handlePrev = useCallback(() => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); }, [currentIndex]);
  useEffect(() => { const handleKeyDown = (event: KeyboardEvent) => { if (!deckStarted) return; if (event.key === 'ArrowLeft') handlePrev(); else if (event.key === 'ArrowRight') handleNext(); else if (event.key === ' ') { event.preventDefault(); setIsFlipped(f => !f); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [handlePrev, handleNext, deckStarted]);
  const handleExportCsv = () => { if (filteredFlashcards.length === 0) { alert("No flashcards to export."); return; } const escape = (f: string) => (/[",\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f); const h = ['Term', 'Definition', 'Topic']; const r = filteredFlashcards.map(c => [escape(c.term), escape(c.definition), escape(c.topic)]); let csv = h.join(',') + '\n'; r.forEach(row => { csv += row.join(',') + '\n'; }); const b = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.setAttribute("href", u); const s = fileName.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '_'); l.setAttribute("download", `${s} - Flashcards.csv`); document.body.appendChild(l); l.click(); document.body.removeChild(l); };
  
  const handleRestart = () => setDeckStarted(false);

  if (!deckStarted) {
    return (
        <div className="max-w-4xl mx-auto text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Flashcard Deck Setup</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8">Customize your study session.</p>

            <div className="max-w-xl mx-auto my-8 text-left">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-3">Filter by Topic</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {allTopics.map(topic => (
                  <button key={topic} onClick={() => handleTopicToggle(topic)} className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${selectedTopics.includes(topic) ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'}`}>
                    {topic}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                  <button onClick={handleSelectAllTopics} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                  <button onClick={handleDeselectAllTopics} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Deselect All</button>
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <label htmlFor="numFlashcards" className="block text-lg font-medium text-gray-700 dark:text-gray-200">Number of Flashcards ({maxFlashcardsAvailable} available)</label>
              <div className="flex items-center justify-center space-x-4 my-4">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{minFlashcards > 0 ? minFlashcards : 0}</span>
                <input id="numFlashcards" type="range" min={minFlashcards > 0 ? minFlashcards : 0} max={maxFlashcards > 0 ? maxFlashcards : 0} value={numFlashcards} onChange={(e) => setNumFlashcards(Number(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed" disabled={maxFlashcardsAvailable < minFlashcards || maxFlashcardsAvailable === 0} />
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{maxFlashcards > 0 ? maxFlashcards : 0}</span>
              </div>
              <div className="font-bold text-blue-600 dark:text-blue-400 text-4xl my-4">{numFlashcards}</div>
            </div>

            {maxFlashcardsAvailable < minFlashcards ? (
                <p className="text-red-600 dark:text-red-400 mt-4">{selectedTopics.length > 0 ? `Not enough flashcards found for the selected topics (minimum ${minFlashcards} required).` : 'Please select at least one topic to start.'}</p>
            ) : (
              <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                <button onClick={handleStartDeck} disabled={selectedTopics.length === 0 || numFlashcards === 0} className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-transform disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none">Start Studying</button>
                <button onClick={handleExportCsv} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"><DownloadIconFV />Export Filtered to CSV</button>
              </div>
            )}
        </div>
    );
  }

  const currentCard = activeFlashcards[currentIndex];
  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center">
      <style>{`.perspective{perspective:1500px}.card{transform-style:preserve-3d;transition:transform .6s;cursor:pointer}.card.is-flipped{transform:rotateY(180deg)}.card-face{position:absolute;width:100%;height:100%;-webkit-backface-visibility:hidden;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;padding:1.5rem;text-align:center;border-radius:.75rem}.card-face-front{background:#fff;border:1px solid #e5e7eb}.dark .card-face-front{background:#1f2937;border:1px solid #374151;color:#f9fafb}.card-face-back{transform:rotateY(180deg);background:#f0f9ff;border:1px solid #bae6fd}.dark .card-face-back{transform:rotateY(180deg);background:#374151;border:1px solid #4b5563;color:#e5e7eb}`}</style>
      {activeFlashcards.length > 0 ? (<><div className="w-full h-72 md:h-80 perspective"><div className={`relative w-full h-full card ${isFlipped ? 'is-flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}><div className="card-face card-face-front"><h3 className="text-2xl font-bold">{currentCard.term}</h3></div><div className="card-face card-face-back"><p className="text-lg">{currentCard.definition}</p></div></div></div><p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Click card to flip (or press spacebar)</p><div className="flex items-center justify-between w-full mt-6 text-gray-800 dark:text-gray-200"><button onClick={handlePrev} disabled={currentIndex === 0} className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50"><ArrowLeftIcon /></button><p>{currentIndex + 1} / {activeFlashcards.length}</p><button onClick={handleNext} disabled={currentIndex === activeFlashcards.length - 1} className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50"><ArrowRightIcon /></button></div>
      <div className="mt-8 pt-6 border-t w-full flex justify-center items-center gap-4 border-gray-200 dark:border-gray-700">
        <button onClick={handleRestart} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md">Change Settings</button>
        <button onClick={handleExportCsv} className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md"><DownloadIconFV />Export Filtered to CSV</button>
      </div>
      </>) : (<div className="text-center p-8"><p>No flashcards available for the selected topics.</p><button onClick={() => setDeckStarted(false)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md">Change Settings</button></div>)}
    </div>
  );
};

// --- components/LibraryView.tsx ---
const BackIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;
const EmptyStateIcon = () => <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const LibraryView: React.FC<{ library: SavedArticle[]; onViewArticle: (article: SavedArticle) => void; onGoHome: () => void; onDeleteArticle: (articleId: string) => void; }> = ({ library, onViewArticle, onGoHome, onDeleteArticle }) => {
    const groupedBySpecialty = library.reduce((acc, article) => { (acc[article.specialty] = acc[article.specialty] || []).push(article); return acc; }, {} as Record<string, SavedArticle[]>);
    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4">
                <div><h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">My Article Library</h2><p className="text-sm text-gray-500 dark:text-gray-400">Review your saved analyses.</p></div>
                <button onClick={onGoHome} className="inline-flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"><BackIcon />Back to Home</button>
            </div>
            {library.length === 0 ? (<div className="text-center py-16"><EmptyStateIcon /><h3 className="mt-2 text-lg font-medium dark:text-gray-200">Your library is empty</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Analyze a new document to save it here.</p></div>) : (<div className="space-y-8">{Object.entries(groupedBySpecialty).map(([specialty, articles]) => (<div key={specialty}><h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-blue-500 dark:border-blue-400 pb-2 mb-4">{specialty}</h3><ul className="space-y-3">{articles.map(article => (<li key={article.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-600"><button onClick={() => onViewArticle(article)} className="flex-grow text-left"><p className="font-semibold text-blue-700 dark:text-blue-400">{article.fileName}</p><p className="text-xs text-gray-500 dark:text-gray-400">Saved on: {new Date(article.savedAt).toLocaleDateString()}</p></button><button onClick={(e) => { e.stopPropagation(); onDeleteArticle(article.id); }} className="ml-4 p-2 text-gray-400 hover:text-red-600 rounded-full"><TrashIcon /></button></li>))}</ul></div>))}</div>)}
        </div>
    );
};

// --- App.tsx ---
type View = 'summary' | 'quiz' | 'flashcards';
type AppState = 'home' | 'analysis' | 'library';
type Theme = 'light' | 'dark';

const Header: React.FC<{ onViewLibrary: () => void; theme: Theme; toggleTheme: () => void; }> = ({ onViewLibrary, theme, toggleTheme }) => (
  <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-300"><div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between"><div className="flex items-center space-x-3"><div className="bg-blue-600 p-2 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div><h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Medic Papers Boost CS</h1></div><div className="flex items-center gap-4"><button onClick={onViewLibrary} className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-gray-700 dark:text-gray-100 font-semibold rounded-lg hover:bg-blue-200 dark:hover:bg-gray-600 text-sm">My Library</button>
  <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
    {theme === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
    )}
    </button>
  </div></div></header>
);
const PRESET_SPECIALTIES = ["Medicina Interna", "Cardiologia", "Pediatria", "Ginecologia", "Cirugia General"];
const SaveToLibraryForm: React.FC<{ onSave: (specialty: string) => void }> = ({ onSave }) => {
    const [selectedSpecialty, setSelectedSpecialty] = useState(PRESET_SPECIALTIES[0]); const [customSpecialty, setCustomSpecialty] = useState('');
    const handleSave = () => { const s = selectedSpecialty === 'Other' ? customSpecialty.trim() : selectedSpecialty; if (s) onSave(s); else alert('Please enter a custom specialty name.'); };
    return (<div className="p-4 bg-blue-50 dark:bg-gray-700/50 border border-blue-200 dark:border-gray-700 rounded-lg"><h3 className="font-semibold dark:text-gray-100">Save to Library</h3><p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Organize this analysis by assigning it to a specialty.</p><div className="flex flex-col sm:flex-row gap-2 items-center"><select value={selectedSpecialty} onChange={(e) => setSelectedSpecialty(e.target.value)} className="w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200">{PRESET_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}<option value="Other">Create New...</option></select>{selectedSpecialty === 'Other' && (<input type="text" value={customSpecialty} onChange={(e) => setCustomSpecialty(e.target.value)} placeholder="New specialty name" className="w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200" />)}<button onClick={handleSave} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Save</button></div></div>);
};
function App() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentView, setCurrentView] = useState<View>('summary');
  const [fileName, setFileName] = useState<string>('');
  const [appState, setAppState] = useState<AppState>('home');
  const [library, setLibrary] = useState<SavedArticle[]>([]);
  const [isCurrentArticleSaved, setIsCurrentArticleSaved] = useState<boolean>(false);
  
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [isAiStudio, setIsAiStudio] = useState(false);
  const [manualApiKey, setManualApiKey] = useState('');
  
  const [summaryDetail, setSummaryDetail] = useState<DetailLevel>('concrete');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme') as Theme;
      if (storedTheme) return storedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const toggleTheme = () => {
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newTheme;
    });
  };

  useEffect(() => { setLibrary(getLibrary()); }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      setIsCheckingApiKey(true);
      const isStudio = typeof window.aistudio?.hasSelectedApiKey === 'function';
      setIsAiStudio(isStudio);

      if (isStudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      } else {
        // Non-AI Studio environment. Check sessionStorage.
        const storedKey = sessionStorage.getItem('gemini_api_key');
        if (storedKey) {
          if (window.process?.env) {
            window.process.env.API_KEY = storedKey;
          }
          setApiKeySelected(true);
        } else {
          setApiKeySelected(false);
        }
      }
      setIsCheckingApiKey(false);
    };
    checkApiKey();
  }, []);

  const handleSelectApiKey = async () => {
    if (isAiStudio && typeof window.aistudio?.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true); // Assume success after dialog
    }
  };

  const handleSaveManualKey = () => {
    const key = manualApiKey.trim();
    if (key) {
        sessionStorage.setItem('gemini_api_key', key);
        if (window.process?.env) {
            window.process.env.API_KEY = key;
        }
        setApiKeySelected(true);
    } else {
        alert('Please enter a valid API Key.');
    }
  };

  const extractTextFromPdf = async (file: File): Promise<string> => { const ab = await file.arrayBuffer(); const pdf = await pdfjsLib.getDocument(ab).promise; let ft = ''; for (let i = 1; i <= pdf.numPages; i++) { const p = await pdf.getPage(i); const tc = await p.getTextContent(); ft += tc.items.map(it => 'str' in it ? it.str : '').join(' ') + '\n\n'; } return ft.replace(/-\s*\n\n\s*/g, '').replace(/[ \t]+/g, ' ').trim(); };
  
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    setError(null);
    setAnalysisResult(null);
    setIsCurrentArticleSaved(false);
    setFileName(file.name);
    setPendingFile(file); // Set the file for the configuration step
    setAppState('analysis');
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    if (!pendingFile) return;

    setIsLoading(true);
    setError(null);
    const fileToProcess = pendingFile;
    setPendingFile(null); // Clear pending file, analysis is starting

    try {
      const pdfText = await extractTextFromPdf(fileToProcess);
      if (pdfText.trim().length === 0) throw new Error("Could not extract text from PDF.");
      const result = await generateMedicalAnalysis(pdfText, summaryDetail);
      setAnalysisResult(result);
      setCurrentView('summary');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error(err);
      if (errorMessage.includes("API Key not found") || errorMessage.includes("API key not valid")) {
          sessionStorage.removeItem('gemini_api_key');
          if (window.process?.env) {
              delete window.process.env.API_KEY;
          }
          setError(`There was an issue with the API Key: "${errorMessage}". Please enter or select a valid key and try again.`);
          setApiKeySelected(false);
          setAppState('home');
      } else {
          setError(`Failed to process document. ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [pendingFile, summaryDetail]);
  
  const handleResetToHome = () => { localStorage.removeItem(LOCAL_STORAGE_KEY); setAnalysisResult(null); setError(null); setFileName(''); setPendingFile(null); setAppState('home'); }
  const handleStartNewAnalysis = () => { localStorage.removeItem(LOCAL_STORAGE_KEY); setAnalysisResult(null); setError(null); setFileName(''); setPendingFile(null); setAppState('analysis'); }
  const handleViewLibrary = () => setAppState('library');
  const handleViewSavedArticle = (article: SavedArticle) => { setAnalysisResult(article.analysisResult); setFileName(article.fileName); setIsCurrentArticleSaved(true); setCurrentView('summary'); setPendingFile(null); setAppState('analysis'); };
  const handleSaveToLibrary = (specialty: string) => { if (analysisResult && fileName) { const updatedLibrary = saveArticle(fileName, specialty, analysisResult); setLibrary(updatedLibrary); setIsCurrentArticleSaved(true); } };
  const handleDeleteArticle = (articleId: string) => { if (window.confirm('Are you sure?')) { setLibrary(deleteArticle(articleId)); } };
  
  const renderAnalysisView = () => { 
    if (isLoading) { return <div className="text-center p-10"><LoadingSpinner /><p className="mt-4 dark:text-gray-300">Analyzing...</p></div>; } 
    if (error) { return <div className="text-center p-10 bg-red-50 dark:bg-red-900/20"><p className="text-red-700 dark:text-red-300 font-semibold">An Error Occurred</p><p className="mt-2 text-red-600 dark:text-red-400">{error}</p><button onClick={handleStartNewAnalysis} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">Try Again</button></div>; } 
    if (analysisResult) { return (<div className="bg-white dark:bg-gray-800 p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg print-reset-layout"><div className="flex justify-between items-center mb-6 border-b dark:border-gray-700 pb-4 no-print"><h2 className="text-2xl font-bold truncate pr-4 dark:text-gray-100" title={fileName}>{fileName}</h2><button onClick={handleStartNewAnalysis} className="flex-shrink-0 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm">Analyze New</button></div><div className="no-print">{!isCurrentArticleSaved ? (<div className="mb-6"><SaveToLibraryForm onSave={handleSaveToLibrary} /></div>) : (<div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><p className="text-green-800 dark:text-green-300">This analysis is saved in your library.</p></div>)}</div><div className="border-b border-gray-200 dark:border-gray-700 no-print"><nav className="-mb-px flex space-x-8"><button onClick={() => setCurrentView('summary')} className={`${currentView === 'summary' ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'} py-4 px-1 border-b-2 font-medium text-sm`}>Summary</button><button onClick={() => setCurrentView('quiz')} className={`${currentView === 'quiz' ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'} py-4 px-1 border-b-2 font-medium text-sm`}>Interactive Quiz</button><button onClick={() => setCurrentView('flashcards')} className={`${currentView === 'flashcards' ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400'} py-4 px-1 border-b-2 font-medium text-sm`}>Flashcards</button></nav></div><div className="mt-6">{currentView === 'summary' && <SummaryView htmlContent={analysisResult.summary} fileName={fileName} />}{currentView === 'quiz' && <QuizView quizData={analysisResult.quiz} fileName={fileName} />}{currentView === 'flashcards' && <FlashcardsView flashcards={analysisResult.flashcards} fileName={fileName} />}</div></div>); } 
    if (pendingFile) { return <SummaryDetailSelector fileName={fileName} detail={summaryDetail} setDetail={setSummaryDetail} onStartAnalysis={handleStartAnalysis} />; }
    return <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />; 
  };
  
  const renderContent = () => {
    if (isCheckingApiKey) {
        return <div className="text-center p-10"><LoadingSpinner /><p className="mt-4 dark:text-gray-300">Checking API Key...</p></div>;
    }

    if (!apiKeySelected) {
        if (isAiStudio) {
            return (
                <div className="max-w-xl mx-auto text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md mt-10">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">API Key Required</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">To use this application, you need to select a Google AI Studio API key. Your key is used only for this session and is not stored.</p>
                    <button onClick={handleSelectApiKey} className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                        Select API Key
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                        For information on billing, please visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">ai.google.dev/gemini-api/docs/billing</a>.
                    </p>
                </div>
            );
        } else {
             return (
                <div className="max-w-xl mx-auto text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md mt-10">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">API Key Required</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Please enter your Google AI Studio API key to continue. Your key is stored in your browser's session and is not sent anywhere else.</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                            type="password" 
                            value={manualApiKey} 
                            onChange={(e) => setManualApiKey(e.target.value)} 
                            placeholder="Enter your API Key"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        <button 
                            onClick={handleSaveManualKey} 
                            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                        >
                            Save Key
                        </button>
                    </div>
                     <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                        You can get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Google AI Studio</a>.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        For information on billing, please visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">ai.google.dev/gemini-api/docs/billing</a>.
                    </p>
                </div>
            );
        }
    }
      
    switch (appState) { case 'home': return <Home onGetStarted={handleStartNewAnalysis} onViewLibrary={handleViewLibrary} />; case 'library': return <LibraryView library={library} onViewArticle={handleViewSavedArticle} onGoHome={handleResetToHome} onDeleteArticle={handleDeleteArticle} />; case 'analysis': return renderAnalysisView(); default: return <Home onGetStarted={handleStartNewAnalysis} onViewLibrary={handleViewLibrary} />; } };
  return (<div className="min-h-screen bg-gray-100 dark:bg-gray-900"><div className="no-print"><Header onViewLibrary={handleViewLibrary} theme={theme} toggleTheme={toggleTheme} /></div><main><div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 print-reset-layout"><div className="px-4 py-6 sm:px-0 print-reset-layout">{renderContent()}</div></div></main></div>);
}

// --- Final Render Call ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);