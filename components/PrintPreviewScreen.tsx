import React from 'react';
import { useAppContext } from '../context/AppContext';
import { PrintRequest } from '../types';
import { PrintableReport } from './PrintableReport';
import { PrinterIcon } from './icons/PrinterIcon';

interface PrintPreviewScreenProps {
  printRequest: PrintRequest;
}

export const PrintPreviewScreen: React.FC<PrintPreviewScreenProps> = ({ printRequest }) => {
  const { dispatch } = useAppContext();

  const handleClose = () => {
    dispatch({ type: 'SET_PRINT_REQUEST', payload: null });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-preview-screen fixed inset-0 bg-gray-600 bg-opacity-75 z-[100] flex flex-col items-center p-4 animate-fade-in">
      {/* Toolbar */}
      <div className="no-print w-full max-w-5xl bg-white rounded-t-lg shadow-lg p-3 flex justify-between items-center border-b">
        <h2 className="text-lg font-bold">Print Preview</h2>
        <div className="space-x-3">
          <button onClick={handleClose} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">
            Close
          </button>
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <PrinterIcon className="w-5 h-5" />
            Print
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="print-content-wrapper w-full max-w-5xl bg-white shadow-lg flex-grow overflow-y-auto">
        <PrintableReport trip={printRequest.trip} includeMap={printRequest.includeMap} />
      </div>
    </div>
  );
};
