import React, { useState } from 'react';
import { Company } from '../types';

const inputClasses = "w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

interface CompanyEditorModalProps {
  company: Company;
  onSave: (company: Company) => void;
  onClose: () => void;
}

export const CompanyEditorModal: React.FC<CompanyEditorModalProps> = ({ company, onSave, onClose }) => {
    const [formData, setFormData] = useState(company);
  
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      // FIX: Add type assertion to prevent type widening on the updated object.
      // This ensures the object passed to the onSave callback strictly matches the Company interface,
      // preventing downstream type errors.
      setFormData(prev => ({ ...prev, [name]: value } as Company));
    };
  
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFormData(prev => ({...prev, contractFileName: e.target.files![0].name}));
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave(formData);
    };
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 className="text-xl font-semibold mb-4">{company.id ? 'Edit' : 'Add'} Company</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input name="name" value={formData.name} onChange={handleChange} placeholder="Company Name" className={inputClasses} required />
            <input name="contactRep" value={formData.contactRep} onChange={handleChange} placeholder="Contact Rep Name" className={inputClasses} />
            <input name="contactEmail" value={formData.contactEmail} onChange={handleChange} type="email" placeholder="Contact Email" className={inputClasses} />
            <input name="contactPhone" value={formData.contactPhone} onChange={handleChange} type="tel" placeholder="Contact Phone" className={inputClasses} />
            <div>
                <label className="block text-sm font-medium text-gray-700">Contract</label>
                <div className="mt-1 flex items-center">
                    <input type="file" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>
                {formData.contractFileName && <p className="text-xs text-gray-500 mt-1">Current file: {formData.contractFileName}</p>}
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </form>
        </div>
      </div>
    );
};