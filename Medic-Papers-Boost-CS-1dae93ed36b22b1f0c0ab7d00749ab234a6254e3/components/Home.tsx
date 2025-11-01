import React from 'react';

interface HomeProps {
  onGetStarted: () => void;
  onViewLibrary: () => void;
}

const FeatureIcon1 = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);
const FeatureIcon2 = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
    </svg>
);
const FeatureIcon3 = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);

export const Home: React.FC<HomeProps> = ({ onGetStarted, onViewLibrary }) => {
  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden">
      <div className="relative">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gray-100 mix-blend-multiply" />
        </div>
        <div className="relative px-4 py-16 sm:px-6 sm:py-24 lg:py-32 lg:px-8">
          <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block text-gray-900">Unlock Medical Insights</span>
            <span className="block text-blue-600">Instantly.</span>
          </h1>
          <p className="mt-6 max-w-lg mx-auto text-center text-xl text-gray-600 sm:max-w-3xl">
            Medic Papers Boost CS transforms dense medical documents into clear summaries and interactive quizzes, helping you learn faster and retain more.
          </p>
          <div className="mt-10 max-w-md mx-auto sm:max-w-lg sm:flex sm:justify-center gap-4">
              <button
                onClick={onGetStarted}
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 sm:w-auto"
              >
                Analyze a Document
              </button>
              <button
                onClick={onViewLibrary}
                className="w-full mt-4 sm:mt-0 flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-blue-700 bg-blue-100 hover:bg-blue-200 sm:w-auto"
              >
                View My Library
              </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 border-t border-gray-200 p-8">
          <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
                  <div className="text-center">
                      <div className="flex items-center justify-center h-16 w-16 rounded-md bg-blue-100 text-white mx-auto">
                          <FeatureIcon1 />
                      </div>
                      <h3 className="mt-5 text-lg font-medium text-gray-900">AI-Powered Summaries</h3>
                      <p className="mt-2 text-base text-gray-500">
                          Go from pages of text to scannable summaries with key takeaways, clinical pearls, and data tables in seconds.
                      </p>
                  </div>
                  <div className="text-center">
                      <div className="flex items-center justify-center h-16 w-16 rounded-md bg-blue-100 text-white mx-auto">
                           <FeatureIcon2 />
                      </div>
                      <h3 className="mt-5 text-lg font-medium text-gray-900">Interactive Learning</h3>
                      <p className="mt-2 text-base text-gray-500">
                          Reinforce your knowledge with auto-generated quizzes based on the document's content, complete with scoring and explanations.
                      </p>
                  </div>
                  <div className="text-center">
                      <div className="flex items-center justify-center h-16 w-16 rounded-md bg-blue-100 text-white mx-auto">
                          <FeatureIcon3 />
                      </div>
                      <h3 className="mt-5 text-lg font-medium text-gray-900">Secure and Private</h3>
                      <p className="mt-2 text-base text-gray-500">
                          Your documents are processed on the fly and never stored. Your privacy and data security are our top priority.
                      </p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
