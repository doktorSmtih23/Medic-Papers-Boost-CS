export interface Question {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  topic: string;
}

export interface QuizSettings {
  positiveScore: number;
  negativeScore: number;
}

export interface Quiz {
  quizTitle: string;
  settings: QuizSettings;
  questions: Question[];
}

export interface Flashcard {
  term: string;
  definition: string;
  topic: string;
}

export interface AnalysisResult {
    summary: string;
    quiz: Quiz;
    flashcards: Flashcard[];
}

export interface SavedArticle {
  id: string;
  fileName: string;
  specialty: string;
  analysisResult: AnalysisResult;
  savedAt: string;
}