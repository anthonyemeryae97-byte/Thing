
import React, { useState, useEffect } from 'react';
import { WorkOrder, OrderStatus } from '../types';
import { AddressAutocomplete } from './AddressAutocomplete';

interface WorkOrderEditorModalProps {
    workOrder: WorkOrder;
    onSave: (workOrder: WorkOrder) => void;
    onClose: () => void;
}

const inputClasses = "w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClasses = "block text-sm font-medium text-gray-700";

const WorkOrderEditorModal: React.FC<WorkOrderEditorModalProps> = ({ workOrder, onSave, onClose }) => {
    const [formData, setFormData] = useState<WorkOrder>(workOrder);

    useEffect(() => {
        setFormData(workOrder);
    }, [workOrder]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'baseRate' || name === 'miscFee' ? parseFloat(value) || 0 : value,
        }));
    };
    
    const handleAddressChange = (address: string) => {
        setFormData(prev => ({ ...prev, address }));
    };
    
    const handleResourcesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, resources: e.target.value.split(',').map(s => s.trim()) }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-full overflow-y-auto">
                <h3 className="text-xl font-semibold mb-4">Edit Work Order</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="orderId" className={labelClasses}>Order ID</label>
                            <input id="orderId" name="orderId" value={formData.orderId} readOnly className={`${inputClasses} bg-gray-100`} />
                        </div>
                        <div>
                            <label htmlFor="status" className={labelClasses}>Status</label>
                            <select id="status" name="status" value={formData.status} onChange={handleChange} className={inputClasses}>
                                {Object.values(OrderStatus).map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="typeName" className={labelClasses}>Work Order Type</label>
                        <input id="typeName" name="typeName" value={formData.typeName} readOnly className={`${inputClasses} bg-gray-100`} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label htmlFor="clientName" className={labelClasses}>Client Name</label>
                           <input id="clientName" name="clientName" value={formData.clientName} onChange={handleChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label htmlFor="companyName" className={labelClasses}>Company</label>
                            <input id="companyName" name="companyName" value={formData.companyName} readOnly className={`${inputClasses} bg-gray-100`} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="address" className={labelClasses}>Address</label>
                        {/* FIX: Added onCommit prop to satisfy AddressAutocompleteProps type requirement. */}
<AddressAutocomplete 
                            id="address"
                            value={formData.address}
                            onChange={handleAddressChange}
                            onCommit={handleAddressChange}
                            className={inputClasses}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="dueDate" className={labelClasses}>Due Date</label>
                            <input id="dueDate" name="dueDate" type="date" value={formData.dueDate.split('T')[0]} onChange={handleChange} className={inputClasses} />
                        </div>
                         <div>
                            <label htmlFor="startDate" className={labelClasses}>Start Date</label>
                            <input id="startDate" name="startDate" type="date" value={formData.startDate?.split('T')[0] || ''} onChange={handleChange} className={inputClasses} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="description" className={labelClasses}>Description / Notes</label>
                        <textarea id="description" name="description" value={formData.description || ''} onChange={handleChange} rows={3} className={inputClasses}></textarea>
                    </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="baseRate" className={labelClasses}>Base Rate ($)</label>
                            <input id="baseRate" name="baseRate" type="number" step="0.01" value={formData.baseRate} onChange={handleChange} className={inputClasses} />
                        </div>
                         <div>
                            <label htmlFor="miscFee" className={labelClasses}>Misc. Fee ($)</label>
                            <input id="miscFee" name="miscFee" type="number" step="0.01" value={formData.miscFee} onChange={handleChange} className={inputClasses} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="resources" className={labelClasses}>Resources</label>
                        <input id="resources" name="resources" value={formData.resources.join(', ')} onChange={handleResourcesChange} placeholder="e.g., Notary Stamp, Scanner" className={inputClasses} />
                    </div>

                    {formData.isFollowUp && <p className="text-sm font-semibold text-yellow-700 bg-yellow-100 p-2 rounded">This is a follow-up order.</p>}
                    
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WorkOrderEditorModal;
