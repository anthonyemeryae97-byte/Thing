import React, { useState, FC, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { WorkOrder, OrderStatus, SuggestedTrip } from '../types';
import WorkOrderMapView from './WorkOrderMapView';
import WorkOrderEditorModal from './WorkOrderEditorModal';

interface AddStopModalProps {
    currentTrip: SuggestedTrip;
    onClose: () => void;
    onAddStops: (workOrderIds: string[]) => void;
}

export const AddStopModal: FC<AddStopModalProps> = ({ currentTrip, onClose, onAddStops }) => {
    const { state } = useAppContext();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);

    const availableOrders = useMemo(() => {
        const plannedOrderIds = new Set(state.trips.flatMap(t => t.stops.map(s => s.workOrderId)));
        const currentTripOrderIds = new Set(currentTrip.stops.map(s => s.workOrderId));
        
        return state.workOrders.filter(wo => 
            wo.status === OrderStatus.Pending && 
            !plannedOrderIds.has(wo.id) &&
            !currentTripOrderIds.has(wo.id)
        );
    }, [state.workOrders, state.trips, currentTrip.stops]);

    const handleToggleSelection = (orderId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) newSet.delete(orderId);
            else newSet.add(orderId);
            return newSet;
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
                <h3 className="text-xl font-semibold p-4 border-b">Add Stops to Trip</h3>
                <div className="flex-grow flex flex-col md:flex-row min-h-0">
                    <div className="w-full md:w-1/2 h-64 md:h-full border-b md:border-b-0 md:border-r">
                         <WorkOrderMapView 
                            workOrders={availableOrders}
                            trips={[]}
                            officeLocations={state.officeLocations}
                            onPinClick={(order) => handleToggleSelection(order.id)}
                            tripOverlay={currentTrip}
                         />
                    </div>
                    <div className="w-full md:w-1/2 flex flex-col">
                        <h4 className="font-semibold p-3 border-b">{availableOrders.length} Available Orders</h4>
                        <ul className="flex-grow overflow-y-auto p-2 space-y-2">
                            {availableOrders.map(order => (
                                <li 
                                    key={order.id} 
                                    onClick={() => handleToggleSelection(order.id)}
                                    className={`p-2 border rounded-md flex items-center gap-3 cursor-pointer ${selectedIds.has(order.id) ? 'bg-blue-100 border-blue-400' : 'hover:bg-gray-50'}`}
                                >
                                    <input type="checkbox" readOnly checked={selectedIds.has(order.id)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <div className="flex-grow">
                                        <p className="font-medium text-sm">{order.typeName}</p>
                                        <p className="text-xs text-gray-500">{order.address}</p>
                                    </div>
                                    <p className="font-semibold text-sm">${(order.baseRate + order.miscFee).toFixed(2)}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                    <p className="font-semibold">{selectedIds.size} stops selected</p>
                    <div className="space-x-3">
                        <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button onClick={() => onAddStops(Array.from(selectedIds))} disabled={selectedIds.size === 0} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">Add Selected Stops</button>
                    </div>
                </div>
            </div>
            {editingOrder && <WorkOrderEditorModal workOrder={editingOrder} onSave={() => {}} onClose={() => setEditingOrder(null)} />}
        </div>
    );
};
