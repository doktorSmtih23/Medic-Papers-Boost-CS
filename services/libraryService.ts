import type { SavedArticle, AnalysisResult } from '../types.ts';

const LIBRARY_KEY = 'medicPapersBoostLibrary';

export const getLibrary = (): SavedArticle[] => {
    try {
        const savedLibrary = localStorage.getItem(LIBRARY_KEY);
        if (savedLibrary) {
            // Sort by savedAt date, newest first
            const library: SavedArticle[] = JSON.parse(savedLibrary);
            return library.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        }
    } catch (error) {
        console.error("Failed to load library from localStorage:", error);
    }
    return [];
};

export const saveArticle = (fileName: string, specialty: string, analysisResult: AnalysisResult): SavedArticle[] => {
    const library = getLibrary();
    const newArticle: SavedArticle = {
        id: new Date().toISOString() + Math.random(), // Add random number for better uniqueness
        fileName,
        specialty,
        analysisResult,
        savedAt: new Date().toISOString(),
    };
    const updatedLibrary = [newArticle, ...library]; // Prepend new article to keep it at the top
    try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLibrary));
    } catch (error) {
        console.error("Failed to save article to localStorage:", error);
    }
    return updatedLibrary;
};

export const deleteArticle = (articleId: string): SavedArticle[] => {
    let library = getLibrary();
    const updatedLibrary = library.filter(article => article.id !== articleId);
    try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(updatedLibrary));
    } catch (error) {
        console.error("Failed to delete article from localStorage:", error);
    }
    return updatedLibrary;
}
