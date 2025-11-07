import React, { useState } from 'react';
import { PrinterIcon } from './icons/PrinterIcon';

interface PrintOptionsModalProps {
    onClose: () => void;
    onGenerate: (includeMap: boolean) => void;
}

export const PrintOptionsModal: React.FC<PrintOptionsModalProps> = ({ onClose, onGenerate }) => {
    const [includeMap, setIncludeMap] = useState(true);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Print Options</h3>
                <div className="space-y-4">
                    <label className="flex items-center text-gray-700">
                        <input
                            type="checkbox"
                            checked={includeMap}
                            onChange={(e) => setIncludeMap(e.target.checked)}
                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                        />
                        <span>Include map on a separate page?</span>
                    </label>
                </div>
                <div className="flex justify-end items-center mt-6 space-x-3">
                    <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                    <button
                        onClick={() => onGenerate(includeMap)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <PrinterIcon className="w-5 h-5" />
                        Generate & Print
                    </button>
                </div>
            </div>
        </div>
    );
};
