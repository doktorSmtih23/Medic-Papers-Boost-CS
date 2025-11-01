
import React, { useState, useCallback, useEffect } from 'react';
import { Home } from './components/Home.tsx';
import { FileUpload } from './components/FileUpload.tsx';
import { SummaryView } from './components/SummaryView.tsx';
import { QuizView } from './components/QuizView.tsx';
import { FlashcardsView } from './components/FlashcardsView.tsx';
import { LoadingSpinner } from './components/LoadingSpinner.tsx';
import { LibraryView } from './components/LibraryView.tsx';
import { generateMedicalAnalysis } from './services/geminiService.ts';
import { getLibrary, saveArticle, deleteArticle } from './services/libraryService.ts';
import type { AnalysisResult, SavedArticle } from './types.ts';

// PDF.js worker setup
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type View = 'summary' | 'quiz' | 'flashcards';
type AppState = 'home' | 'analysis' | 'library';

const Header: React.FC<{ onViewLibrary: () => void }> = ({ onViewLibrary }) => (
  <header className="bg-white shadow-sm">
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">MedicoBoost AI</h1>
        </div>
        <div className="flex items-center gap-4">
            <button
                onClick={onViewLibrary}
                className="px-4 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                Mi Biblioteca
            </button>
        </div>
    </div>
  </header>
);

const PRESET_SPECIALTIES = [
    "Medicina Interna", "Cardiología", "Pediatría", "Ginecología", "Cirugía General"
];

const SaveToLibraryForm: React.FC<{ onSave: (specialty: string) => void }> = ({ onSave }) => {
    const [selectedSpecialty, setSelectedSpecialty] = useState(PRESET_SPECIALTIES[0]);
    const [customSpecialty, setCustomSpecialty] = useState('');

    const handleSave = () => {
        const specialtyToSave = selectedSpecialty === 'Other' ? customSpecialty.trim() : selectedSpecialty;
        if (specialtyToSave) {
            onSave(specialtyToSave);
        } else {
            alert('Por favor, introduce un nombre para la especialidad personalizada.');
        }
    };

    return (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-gray-800">Guardar en la Biblioteca</h3>
            <p className="text-sm text-gray-600 mb-3">Organiza este análisis asignándolo a una especialidad.</p>
            <div className="flex flex-col sm:flex-row gap-2 items-center">
                <select 
                    value={selectedSpecialty} 
                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                    className="w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    {PRESET_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="Other">Crear Nueva...</option>
                </select>
                {selectedSpecialty === 'Other' && (
                    <input
                        type="text"
                        value={customSpecialty}
                        onChange={(e) => setCustomSpecialty(e.target.value)}
                        placeholder="Nombre de la nueva especialidad"
                        className="w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                )}
                <button
                    onClick={handleSave}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                >
                    Guardar
                </button>
            </div>
        </div>
    );
};

export default function App() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentView, setCurrentView] = useState<View>('summary');
  const [fileName, setFileName] = useState<string>('');
  const [appState, setAppState] = useState<AppState>('home');
  const [library, setLibrary] = useState<SavedArticle[]>([]);
  const [isCurrentArticleSaved, setIsCurrentArticleSaved] = useState<boolean>(false);

  useEffect(() => {
    setLibrary(getLibrary());
  }, []);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => 'str' in item ? item.str : '').join(' ');
      fullText += pageText + '\n\n';
    }
    
    let processedText = fullText.replace(/-\s*\n\n\s*/g, '');
    processedText = processedText.replace(/[ \t]+/g, ' ').trim();
    return processedText;
  };

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setIsCurrentArticleSaved(false);
    setFileName(file.name);
    setAppState('analysis');

    try {
      const pdfText = await extractTextFromPdf(file);
      if (pdfText.trim().length === 0) {
        throw new Error("No se pudo extraer texto del PDF. El documento podría estar basado en imágenes o estar vacío.");
      }
      
      const result = await generateMedicalAnalysis(pdfText);
      setAnalysisResult(result);
      setCurrentView('summary');

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido.';
      setError(`Fallo al procesar el documento. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const handleResetToHome = () => {
    localStorage.removeItem('medicPapersBoostQuizProgress');
    setAnalysisResult(null);
    setError(null);
    setFileName('');
    setAppState('home');
  }
  
  const handleStartNewAnalysis = () => {
    localStorage.removeItem('medicPapersBoostQuizProgress');
    setAnalysisResult(null);
    setError(null);
    setFileName('');
    setAppState('analysis');
  }

  const handleViewLibrary = () => {
    setAppState('library');
  }

  const handleViewSavedArticle = (article: SavedArticle) => {
    setAnalysisResult(article.analysisResult);
    setFileName(article.fileName);
    setIsCurrentArticleSaved(true);
    setCurrentView('summary');
    setAppState('analysis');
  };

  const handleSaveToLibrary = (specialty: string) => {
    if (analysisResult && fileName) {
      const updatedLibrary = saveArticle(fileName, specialty, analysisResult);
      setLibrary(updatedLibrary);
      setIsCurrentArticleSaved(true);
    }
  };
  
  const handleDeleteArticle = (articleId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este análisis de tu biblioteca?')) {
      const updatedLibrary = deleteArticle(articleId);
      setLibrary(updatedLibrary);
    }
  };


  const renderAnalysisView = () => {
     if (isLoading) {
      return (
        <div className="text-center p-10">
          <LoadingSpinner />
          <p className="mt-4 text-lg font-medium text-gray-600">Analizando tu documento...</p>
          <p className="text-sm text-gray-500">Esto puede tardar un momento.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-10 bg-red-50 border-l-4 border-red-400">
          <p className="text-red-700 font-semibold">Ocurrió un Error</p>
          <p className="mt-2 text-red-600">{error}</p>
          <button
            onClick={handleStartNewAnalysis}
            className="mt-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Intentar de Nuevo
          </button>
        </div>
      );
    }
    
    if (analysisResult) {
      return (
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg print-reset-layout">
          <div className="flex justify-between items-center mb-6 border-b pb-4 no-print">
              <h2 className="text-2xl font-bold text-gray-800 truncate pr-4" title={fileName}>{fileName}</h2>
              <button
                  onClick={handleStartNewAnalysis}
                  className="flex-shrink-0 px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                  Analizar Nuevo Documento
              </button>
          </div>

          <div className="no-print">
            {!isCurrentArticleSaved ? (
                <div className="mb-6">
                  <SaveToLibraryForm onSave={handleSaveToLibrary} />
                </div>
            ) : (
               <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-green-800 font-medium">Este análisis está guardado en tu biblioteca.</p>
              </div>
            )}
          </div>
          
          <div className="border-b border-gray-200 no-print">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setCurrentView('summary')}
                className={`${currentView === 'summary' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Resumen
              </button>
              <button
                onClick={() => setCurrentView('quiz')}
                className={`${currentView === 'quiz' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Quiz Interactivo
              </button>
              <button
                onClick={() => setCurrentView('flashcards')}
                className={`${currentView === 'flashcards' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Tarjetas de Estudio
              </button>
            </nav>
          </div>

          <div className="mt-6">
            {currentView === 'summary' && <SummaryView htmlContent={analysisResult.summary} fileName={fileName} />}
            {currentView === 'quiz' && <QuizView quizData={analysisResult.quiz} fileName={fileName} />}
            {currentView === 'flashcards' && <FlashcardsView flashcards={analysisResult.flashcards} fileName={fileName} />}
          </div>
        </div>
      );
    }
    
    return <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />;
  }

  const renderContent = () => {
    switch (appState) {
        case 'home':
            return <Home onGetStarted={handleStartNewAnalysis} onViewLibrary={handleViewLibrary} />;
        case 'library':
            return <LibraryView library={library} onViewArticle={handleViewSavedArticle} onGoHome={handleResetToHome} onDeleteArticle={handleDeleteArticle} />;
        case 'analysis':
             if (!analysisResult && !isLoading && !error) {
                return <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />;
            }
            return renderAnalysisView();
        default:
            return <Home onGetStarted={handleStartNewAnalysis} onViewLibrary={handleViewLibrary} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="no-print">
        <Header onViewLibrary={handleViewLibrary} />
      </div>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 print-reset-layout">
          <div className="px-4 py-6 sm:px-0 print-reset-layout">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
