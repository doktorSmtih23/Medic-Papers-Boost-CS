
import React, { useState, useMemo, useEffect } from 'react';
import type { Quiz, Question } from '../types.ts';

interface QuizViewProps {
  quizData: Quiz;
  fileName: string;
}

// Type for storing quiz state in localStorage
interface SavedQuizState {
  quizTitle: string;
  activeQuestions: Question[];
  currentQuestionIndex: number;
  score: number;
  userAnswers: (number | null)[];
  numQuestions: number;
}

const LOCAL_STORAGE_KEY = 'medicPapersBoostQuizProgress';

const CheckIcon = () => (
    <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const XIcon = () => (
    <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.607a1 1 0 010-1.314z" clipRule="evenodd" />
    </svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);


export const QuizView: React.FC<QuizViewProps> = ({ quizData, fileName }) => {
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

  const filteredQuestions = useMemo(() => {
    return quizData.questions.filter(q => selectedTopics.includes(q.topic));
  }, [quizData.questions, selectedTopics]);

  const maxQuestionsAvailable = filteredQuestions.length;
  const minQuestions = Math.min(5, maxQuestionsAvailable);
  const maxQuestions = Math.min(20, maxQuestionsAvailable);
  
  // Load saved progress from localStorage on component mount
  useEffect(() => {
    try {
      const savedStateJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateJSON) {
        const savedState: SavedQuizState = JSON.parse(savedStateJSON);
        // Check if the saved quiz matches the current one
        if (savedState.quizTitle === quizData.quizTitle) {
          setSavedProgress(savedState);
        } else {
          // Clear storage if it's for a different quiz
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load quiz progress:", error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [quizData.quizTitle]);

  useEffect(() => {
    // This effect adjusts the selected number of questions whenever the available pool of questions changes (e.g., due to topic filtering).
    if (maxQuestionsAvailable === 0) {
      if (numQuestions !== 0) setNumQuestions(0);
      return;
    }
  
    let clampedNum = numQuestions;
    if (clampedNum > maxQuestions) {
      clampedNum = maxQuestions;
    }
    if (clampedNum < minQuestions) {
      clampedNum = minQuestions;
    }
  
    if (clampedNum !== numQuestions) {
      setNumQuestions(clampedNum);
    }
  }, [maxQuestions, minQuestions, maxQuestionsAvailable, numQuestions]);

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleSelectAllTopics = () => {
    setSelectedTopics(allTopics);
  };

  const handleDeselectAllTopics = () => {
    setSelectedTopics([]);
  };

  const handleStartNewQuiz = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    // Fisher-Yates shuffle algorithm to randomize questions from the filtered pool
    const shuffled = [...filteredQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    setActiveQuestions(shuffled.slice(0, numQuestions));
    
    // Reset state for a new quiz attempt
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswerIndex(null);
    setIsAnswered(false);
    setShowExplanation(false);
    setQuizFinished(false);
    setUserAnswers(Array(numQuestions).fill(null));

    setQuizStarted(true);
    setSavedProgress(null);
  };

  const handleResumeQuiz = () => {
    if (!savedProgress) return;

    setActiveQuestions(savedProgress.activeQuestions);
    setCurrentQuestionIndex(savedProgress.currentQuestionIndex);
    setScore(savedProgress.score);
    setUserAnswers(savedProgress.userAnswers);
    setNumQuestions(savedProgress.numQuestions);

    const lastAnswer = savedProgress.userAnswers[savedProgress.currentQuestionIndex];
    if (lastAnswer !== null && typeof lastAnswer !== 'undefined') {
        setSelectedAnswerIndex(lastAnswer);
        setIsAnswered(true);
        setShowExplanation(true);
    }

    setQuizStarted(true);
    setSavedProgress(null);
  }

  const currentQuestion = activeQuestions[currentQuestionIndex];
  
  const handleAnswerSelect = (index: number) => {
    if (isAnswered) return;
    
    setIsAnswered(true);
    setSelectedAnswerIndex(index);
    
    let newScore = score;
    if (index === currentQuestion.correctAnswerIndex) {
      newScore += quizData.settings.positiveScore;
    } else {
      newScore += quizData.settings.negativeScore;
    }
    setScore(newScore);

    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = index;
    setUserAnswers(newAnswers);

    // Save progress to localStorage
    const stateToSave: SavedQuizState = {
        quizTitle: quizData.quizTitle,
        activeQuestions,
        currentQuestionIndex,
        score: newScore,
        userAnswers: newAnswers,
        numQuestions
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));

    // Reveal explanation after a delay to allow user to see feedback
    setTimeout(() => {
        setShowExplanation(true);
    }, 1200);
  };
  
  const handleNextQuestion = () => {
    if (currentQuestionIndex < activeQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedAnswerIndex(null);
      setShowExplanation(false);
    } else {
      setQuizFinished(true);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };
  
  const handleRestartQuiz = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setQuizStarted(false);
    setSavedProgress(null);
    setSelectedTopics(allTopics); // Reset topics on full restart
  };

  const handleExportToDoc = () => {
    if (!activeQuestions.length) return;

    let docContent = `Quiz: ${quizData.quizTitle}\n\n`;
    docContent += '----------------------------------------\n\n';

    activeQuestions.forEach((q, index) => {
        docContent += `${index + 1}. ${q.questionText}\n`;
        q.options.forEach((opt, i) => {
            docContent += `   ${String.fromCharCode(97 + i)}. ${opt}\n`;
        });
        docContent += `\nRespuesta Correcta: ${q.options[q.correctAnswerIndex]}\n`;
        docContent += `Explicación: ${q.explanation}\n`;
        docContent += '----------------------------------------\n\n';
    });

    const sanitizedFileName = fileName.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '_');
    const exportFileName = `${sanitizedFileName} - Quiz.doc`;
    
    // Prepend the UTF-8 Byte Order Mark (BOM) to ensure Word opens it with the correct encoding.
    const bom = '\uFEFF';
    const dataBlob = new Blob([bom + docContent], { type: 'application/msword;charset=utf-8' });
    
    const url = window.URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getOptionClass = (index: number) => {
    if (!isAnswered) {
      // Unanswered state with hover and active animations
      return "bg-white hover:bg-blue-50 border-gray-300 hover:border-blue-400 text-gray-900 transform hover:-translate-y-1 active:scale-[0.99]";
    }
    
    const isCorrect = index === currentQuestion.correctAnswerIndex;
    const isSelected = index === selectedAnswerIndex;

    // Correct answer, always green and scaled
    if (isCorrect) {
      return "bg-green-100 border-green-500 text-green-900 font-semibold transform scale-105 shadow-lg";
    }

    // Selected but incorrect answer, red and scaled
    if (isSelected && !isCorrect) {
       return "bg-red-100 border-red-500 text-red-900 font-semibold transform scale-105 shadow-lg";
    }

    // Other non-selected, incorrect answers are de-emphasized
    return "bg-gray-50 border-gray-200 text-gray-500 opacity-60";
  };

  const progressPercentage = useMemo(() => {
    if(activeQuestions.length === 0) return 0;
    return ((currentQuestionIndex + 1) / activeQuestions.length) * 100;
  }, [currentQuestionIndex, activeQuestions.length]);


  if (!quizStarted) {
    return (
      <div className="max-w-4xl mx-auto text-center p-8 bg-gray-50 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{quizData.quizTitle}</h2>
        
        {savedProgress ? (
            <div className="my-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-xl font-semibold text-blue-800">¡Bienvenido de nuevo!</h3>
                <p className="text-blue-700 mt-2">
                    Tienes un quiz en progreso con {savedProgress.numQuestions} preguntas. Estabas en la pregunta {savedProgress.currentQuestionIndex + 1}.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button
                        onClick={handleResumeQuiz}
                        className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-transform"
                    >
                        Reanudar Quiz
                    </button>
                    <button
                        onClick={handleStartNewQuiz}
                        className="w-full sm:w-auto px-8 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                        Empezar Nuevo Quiz
                    </button>
                </div>
            </div>
        ) : (
          <>
            <p className="text-gray-600 mb-8">¿Listo para poner a prueba tus conocimientos? Personaliza tu quiz a continuación.</p>

            <div className="max-w-xl mx-auto my-8 text-left">
              <h3 className="text-lg font-medium text-gray-700 mb-3">Filtrar por Tema</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {allTopics.map(topic => (
                  <button
                    key={topic}
                    onClick={() => handleTopicToggle(topic)}
                    className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                      selectedTopics.includes(topic)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                  <button onClick={handleSelectAllTopics} className="text-sm text-blue-600 hover:underline">Seleccionar Todos</button>
                  <button onClick={handleDeselectAllTopics} className="text-sm text-blue-600 hover:underline">Deseleccionar Todos</button>
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <label htmlFor="numQuestions" className="block text-lg font-medium text-gray-700">
                Número de Preguntas ({maxQuestionsAvailable} disponibles)
              </label>
              <div className="flex items-center justify-center space-x-4 my-4">
                <span className="text-sm font-medium text-gray-500">{minQuestions > 0 ? minQuestions : 0}</span>
                <input
                  id="numQuestions"
                  type="range"
                  min={minQuestions > 0 ? minQuestions : 0}
                  max={maxQuestions > 0 ? maxQuestions : 0}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
                  disabled={maxQuestionsAvailable < minQuestions || maxQuestionsAvailable === 0}
                />
                <span className="text-sm font-medium text-gray-500">{maxQuestions > 0 ? maxQuestions : 0}</span>
              </div>
              <div className="font-bold text-blue-600 text-4xl my-4">
                {numQuestions}
              </div>
            </div>

            {maxQuestionsAvailable < minQuestions ? (
                <p className="text-red-600 mt-4">
                {selectedTopics.length > 0
                    ? `No se encontraron suficientes preguntas para los temas seleccionados (se requiere un mínimo de ${minQuestions}).`
                    : 'Por favor, selecciona al menos un tema para empezar el quiz.'
                }
                </p>
            ) : (
              <div className="mt-8">
                <button
                  onClick={handleStartNewQuiz}
                  disabled={selectedTopics.length === 0 || numQuestions === 0}
                  className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-transform disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Empezar Quiz
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (quizFinished) {
    const correctAnswers = userAnswers.filter((answer, index) => answer === activeQuestions[index].correctAnswerIndex).length;
    const percentageScore = Math.round((correctAnswers / activeQuestions.length) * 100);
    const passed = percentageScore >= 90;

    const incorrectQuestions = activeQuestions.filter((q, index) => userAnswers[index] !== null && userAnswers[index] !== q.correctAnswerIndex);
    const topicsToReview = [...new Set(incorrectQuestions.map(q => q.topic))];

    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-gray-800">¡Quiz Completado!</h2>
        
        <div className={`mt-6 p-6 rounded-lg ${passed ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'} border`}>
          <p className="text-lg text-gray-700">Tu puntuación final</p>
          <p className={`mt-2 text-6xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>{percentageScore}%</p>
          <p className="text-md text-gray-600">({correctAnswers} de {activeQuestions.length} correctas)</p>
          
          {passed ? (
            <p className="mt-4 font-semibold text-green-700">¡Felicidades! Has alcanzado el objetivo de aprendizaje y dominado este material.</p>
          ) : (
            <p className="mt-4 font-semibold text-red-700">¡Ya casi lo tienes! Revisa los siguientes temas para reforzar tu comprensión.</p>
          )}
        </div>
        
        {!passed && topicsToReview.length > 0 && (
          <div className="mt-8 text-left p-6 bg-yellow-50 border-l-4 border-yellow-400">
            <h3 className="text-xl font-bold text-yellow-800">Áreas a Repasar</h3>
            <p className="text-yellow-700 mt-2">Basado en tus respuestas, recomendamos repasar los siguientes temas en el resumen o el documento original:</p>
            <ul className="list-disc list-inside mt-4 space-y-1 text-yellow-900">
              {topicsToReview.map((topic, index) => (
                <li key={index} className="font-semibold">{topic}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={handleRestartQuiz}
              className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Empezar Nuevo Quiz
            </button>
            <button
              onClick={handleExportToDoc}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              <DownloadIcon />
              Exportar para Formularios (.doc)
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .explanation-fade-in {
            animation: fadeIn 0.5s ease-out forwards;
          }
        `}
      </style>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">{quizData.quizTitle}</h2>
        <p className="text-lg font-semibold text-blue-600">Puntuación: {score}</p>
      </div>

       <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
      </div>
       <p className="text-sm text-gray-500 text-right mb-4">Pregunta {currentQuestionIndex + 1} de {activeQuestions.length}</p>

      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-lg font-semibold text-gray-900 mb-4">{currentQuestion.questionText}</p>
        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              disabled={isAnswered}
              className={`w-full text-left p-4 border rounded-lg flex items-center justify-between transition-all duration-300 ease-in-out ${getOptionClass(index)}`}
            >
              <span>{option}</span>
              {isAnswered && (
                  <span className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-all duration-300 ease-out transform ${
                      index === currentQuestion.correctAnswerIndex 
                        ? 'bg-green-500 scale-100' 
                        : (index === selectedAnswerIndex ? 'bg-red-500 scale-100' : 'scale-0 opacity-0')
                    }`}>
                      {index === currentQuestion.correctAnswerIndex ? <CheckIcon /> : <XIcon />}
                  </span>
              )}
            </button>
          ))}
        </div>

        {showExplanation && (
          <div className="explanation-fade-in">
            <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                <h4 className="font-bold text-yellow-800">Explicación</h4>
                <p className="text-yellow-700">{currentQuestion.explanation}</p>
            </div>
            <div className="mt-6 text-right">
                <button
                    onClick={handleNextQuestion}
                    className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    {currentQuestionIndex < activeQuestions.length - 1 ? 'Siguiente Pregunta' : 'Finalizar Quiz'}
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
