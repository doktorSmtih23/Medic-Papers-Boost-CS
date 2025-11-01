
import React from 'react';

interface SummaryViewProps {
  htmlContent: string;
  fileName: string;
}

const PrintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

export const SummaryView: React.FC<SummaryViewProps> = ({ htmlContent, fileName }) => {
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
        <div className="flex justify-end mb-4 no-print">
            <button
                onClick={handlePrint}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                <PrintIcon />
                Imprimir / Guardar PDF
            </button>
        </div>
        <div id="print-section" className="prose max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
    </div>
  );
};
