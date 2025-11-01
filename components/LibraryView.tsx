import React from 'react';
import type { SavedArticle } from '../types';

interface LibraryViewProps {
  library: SavedArticle[];
  onViewArticle: (article: SavedArticle) => void;
  onGoHome: () => void;
  onDeleteArticle: (articleId: string) => void;
}

const BackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);

const EmptyStateIcon = () => (
    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);


export const LibraryView: React.FC<LibraryViewProps> = ({ library, onViewArticle, onGoHome, onDeleteArticle }) => {
    
    const groupedBySpecialty = library.reduce((acc, article) => {
        (acc[article.specialty] = acc[article.specialty] || []).push(article);
        return acc;
    }, {} as Record<string, SavedArticle[]>);

    return (
        <div className="bg-white p-4 sm:p-6 lg:p-8 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">My Article Library</h2>
                    <p className="text-sm text-gray-500">Review your saved analyses.</p>
                </div>
                <button
                    onClick={onGoHome}
                    className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <BackIcon />
                    Back to Home
                </button>
            </div>

            {library.length === 0 ? (
                <div className="text-center py-16">
                    <EmptyStateIcon />
                    <h3 className="mt-2 text-lg font-medium text-gray-900">Your library is empty</h3>
                    <p className="mt-1 text-sm text-gray-500">Analyze a new document to save it here.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedBySpecialty).map(([specialty, articles]) => (
                        <div key={specialty}>
                            <h3 className="text-xl font-semibold text-gray-700 border-b-2 border-blue-500 pb-2 mb-4">{specialty}</h3>
                            <ul className="space-y-3">
                                {articles.map(article => (
                                    <li key={article.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-blue-50 hover:shadow-md transition-all border border-gray-200">
                                        <button 
                                            onClick={() => onViewArticle(article)}
                                            className="flex-grow text-left"
                                        >
                                            <p className="font-semibold text-blue-700">{article.fileName}</p>
                                            <p className="text-xs text-gray-500">Saved on: {new Date(article.savedAt).toLocaleDateString()}</p>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent triggering the view article action
                                                onDeleteArticle(article.id);
                                            }}
                                            className="ml-4 flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                            aria-label={`Delete ${article.fileName}`}
                                        >
                                            <TrashIcon />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};