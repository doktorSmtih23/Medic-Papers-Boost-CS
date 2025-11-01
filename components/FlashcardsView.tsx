
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Flashcard } from '../types';

interface FlashcardsViewProps {
  flashcards: Flashcard[];
  fileName: string;
}

const ArrowLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
);

const ArrowRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
);

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({ flashcards, fileName }) => {
  const [deckStarted, setDeckStarted] = useState(false);
  const [numFlashcards, setNumFlashcards] = useState(10);
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[]>([]);

  const allTopics = useMemo(() => [...new Set(flashcards.map(f => f.topic))], [flashcards]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(allTopics);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  const filteredFlashcards = useMemo(() => {
    return flashcards.filter(f => selectedTopics.includes(f.topic));
  }, [flashcards, selectedTopics]);

  const maxFlashcardsAvailable = filteredFlashcards.length;
  const minFlashcards = Math.min(5, maxFlashcardsAvailable);
  const maxFlashcards = Math.max(minFlashcards, maxFlashcardsAvailable);

  useEffect(() => {
    if (maxFlashcardsAvailable === 0) {
      if (numFlashcards !== 0) setNumFlashcards(0);
      return;
    }
  
    let clampedNum = numFlashcards;
    if (clampedNum > maxFlashcards) {
      clampedNum = maxFlashcards;
    }
    if (clampedNum < minFlashcards) {
      clampedNum = minFlashcards;
    }
  
    if (clampedNum !== numFlashcards) {
      setNumFlashcards(clampedNum);
    }
  }, [maxFlashcards, minFlashcards, maxFlashcardsAvailable, numFlashcards]);

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic)
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleSelectAllTopics = () => setSelectedTopics(allTopics);
  const handleDeselectAllTopics = () => setSelectedTopics([]);

  const handleStartDeck = () => {
    const shuffled = [...filteredFlashcards].sort(() => 0.5 - Math.random());
    setActiveFlashcards(shuffled.slice(0, numFlashcards));
    setCurrentIndex(0);
    setIsFlipped(false);
    setDeckStarted(true);
  };
  
  const handleRestart = () => {
    setDeckStarted(false);
  };

  // Reset flip state when changing cards
  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < activeFlashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, activeFlashcards.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if(!deckStarted) return;
      if (event.key === 'ArrowLeft') handlePrev();
      else if (event.key === 'ArrowRight') handleNext();
      else if (event.key === ' ') {
        event.preventDefault(); // Prevent page scroll
        setIsFlipped(f => !f);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, deckStarted]);
  
  const handleExportCsv = () => {
    if (filteredFlashcards.length === 0) {
        alert("No hay tarjetas para exportar. Por favor, selecciona temas que contengan tarjetas.");
        return;
    }

    const escapeCsvField = (field: string) => {
        if (/[",\n]/.test(field)) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    };

    const headers = ['Termino', 'Definicion', 'Tema'];
    const rows = filteredFlashcards.map(card => [
        escapeCsvField(card.term),
        escapeCsvField(card.definition),
        escapeCsvField(card.topic)
    ]);
    
    let csvContent = headers.join(',') + '\n';
    rows.forEach(rowArray => {
        csvContent += rowArray.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const sanitizedFileName = fileName.replace(/\.pdf$/i, '').replace(/[^a-z0-9]/gi, '_');
    link.setAttribute("download", `${sanitizedFileName} - Tarjetas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!deckStarted) {
    return (
        <div className="max-w-4xl mx-auto text-center p-8 bg-gray-50 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Configuración de Tarjetas de Estudio</h2>
            <p className="text-gray-600 mb-8">Personaliza tu sesión de estudio.</p>

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
              <label htmlFor="numFlashcards" className="block text-lg font-medium text-gray-700">
                Número de Tarjetas ({maxFlashcardsAvailable} disponibles)
              </label>
              <div className="flex items-center justify-center space-x-4 my-4">
                <span className="text-sm font-medium text-gray-500">{minFlashcards > 0 ? minFlashcards : 0}</span>
                <input
                  id="numFlashcards"
                  type="range"
                  min={minFlashcards > 0 ? minFlashcards : 0}
                  max={maxFlashcards > 0 ? maxFlashcards : 0}
                  value={numFlashcards}
                  onChange={(e) => setNumFlashcards(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
                  disabled={maxFlashcardsAvailable < minFlashcards || maxFlashcardsAvailable === 0}
                />
                <span className="text-sm font-medium text-gray-500">{maxFlashcards > 0 ? maxFlashcards : 0}</span>
              </div>
              <div className="font-bold text-blue-600 text-4xl my-4">
                {numFlashcards}
              </div>
            </div>

            {maxFlashcardsAvailable < minFlashcards ? (
                <p className="text-red-600 mt-4">
                {selectedTopics.length > 0
                    ? `No se encontraron suficientes tarjetas para los temas seleccionados (se requiere un mínimo de ${minFlashcards}).`
                    : 'Por favor, selecciona al menos un tema para empezar.'
                }
                </p>
            ) : (
              <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                <button
                  onClick={handleStartDeck}
                  disabled={selectedTopics.length === 0 || numFlashcards === 0}
                  className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:scale-105 transition-transform disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Empezar a Estudiar
                </button>
                <button
                    onClick={handleExportCsv}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                    <DownloadIcon />
                    Exportar Filtro a CSV
                </button>
              </div>
            )}
        </div>
    );
  }

  const currentCard = activeFlashcards[currentIndex];

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center">
      <style>{`
        .perspective {
          perspective: 1500px;
        }
        .card {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease-out;
          cursor: pointer;
        }
        .card:hover {
            transform: translateY(-6px) scale(1.02);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .card.is-flipped:hover {
            transform: rotateY(180deg) translateY(-6px) scale(1.02);
        }
        .card.is-flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          text-align: center;
          border-radius: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
        }
        .card-face-front {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            border: 1px solid #e5e7eb;
        }
        .card-face-back {
          transform: rotateY(180deg);
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1px solid #bae6fd;
        }
      `}</style>
      
      {activeFlashcards.length > 0 ? (
      <>
        <div className="w-full h-72 md:h-80 perspective">
          <div
            className={`relative w-full h-full card ${isFlipped ? 'is-flipped' : ''}`}
            onClick={() => setIsFlipped(!isFlipped)}
            aria-live="polite"
          >
            <div className="card-face card-face-front">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-800">{currentCard.term}</h3>
            </div>
            <div className="card-face card-face-back">
              <p className="text-lg md:text-xl text-gray-700">{currentCard.definition}</p>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">Haz clic en la tarjeta para voltearla (o presiona la barra espaciadora)</p>

        <div className="flex items-center justify-between w-full mt-6">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Tarjeta anterior"
          >
            <ArrowLeftIcon />
          </button>
          <p className="font-medium text-gray-700">
            {currentIndex + 1} / {activeFlashcards.length}
          </p>
          <button
            onClick={handleNext}
            disabled={currentIndex === activeFlashcards.length - 1}
            className="p-3 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Siguiente tarjeta"
          >
            <ArrowRightIcon />
          </button>
        </div>

        <div className="mt-8 w-full border-t pt-6 flex justify-center items-center gap-4">
            <button
                onClick={handleRestart}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                Cambiar Configuración
            </button>
            <button
                onClick={handleExportCsv}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
                <DownloadIcon />
                Exportar Filtro a CSV
            </button>
        </div>
      </>
      ) : (
        <div className="text-center p-8">
            <p className="text-lg text-gray-600">No hay tarjetas disponibles para los temas seleccionados.</p>
            <button
                onClick={handleRestart}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                Cambiar Configuración
            </button>
        </div>
      )}
    </div>
  );
};
