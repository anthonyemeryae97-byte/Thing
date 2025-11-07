
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { OrderStatus, WorkOrder, Trip } from '../types';
import CsvImportModal from '../components/CsvImportModal';
import ManualOrderModal from '../components/ManualOrderModal';
import WorkOrderEditorModal from '../components/WorkOrderEditorModal';
import { ChevronUpIcon } from '../components/icons/ChevronUpIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';

const DailyReviewScreen: React.FC = () => {
  const { state, updateWorkOrder } = useAppContext();
  const [modal, setModal] = useState<'none' | 'import' | 'manual'>('none');
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isOverdueOpen, setIsOverdueOpen] = useState(true);
  const [isPendingReviewOpen, setIsPendingReviewOpen] = useState(true);

  // --- Data Processing ---
  const { overdueGroups, pendingReviewOrders } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completableStatuses = [OrderStatus.Completed, OrderStatus.Invoiced, OrderStatus.Paid];
    
    // 1. Process Overdue Orders
    const overdueOrders = state.workOrders.filter(wo => 
      new Date(wo.dueDate.split('T')[0]) < today && !completableStatuses.includes(wo.status)
    );
    
    const workOrderToTripMap = new Map<string, Trip>();
    state.trips.forEach(trip => {
      trip.stops.forEach(stop => {
        workOrderToTripMap.set(stop.workOrderId, trip);
      });
    });

    const unassignedOverdue = overdueOrders.filter(wo => !workOrderToTripMap.has(wo.id));
    const assignedOverdue: Record<string, { tripName: string; orders: WorkOrder[] }> = {};
    
    overdueOrders.forEach(wo => {
      const trip = workOrderToTripMap.get(wo.id);
      if (trip) {
        if (!assignedOverdue[trip.id]) {
          assignedOverdue[trip.id] = { tripName: trip.name, orders: [] };
        }
        assignedOverdue[trip.id].orders.push(wo);
      }
    });

    const overdueGroups = {
      unassigned: unassignedOverdue.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
      assigned: Object.values(assignedOverdue).sort((a, b) => a.tripName.localeCompare(b.tripName)),
    };
    
    // 2. Process Orders Pending Review
    const pendingReviewOrders = state.workOrders.filter(wo => wo.status === OrderStatus.PendingReview)
        .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return { overdueGroups, pendingReviewOrders };
  }, [state.workOrders, state.trips]);
  
  // --- Actions ---
  const handleSaveOrder = (updatedOrder: WorkOrder) => {
    updateWorkOrder(updatedOrder);
    setEditingOrder(null);
  };
  
  const handleSelectionChange = (orderId: string, isSelected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(orderId);
      } else {
        newSet.delete(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          setSelectedIds(new Set(pendingReviewOrders.map(o => o.id)));
      } else {
          setSelectedIds(new Set());
      }
  };

  const markOrdersAsReady = (orderIds: string[]) => {
    if (orderIds.length === 0) return;
    const ordersToUpdate = orderIds
        .map(id => state.workOrders.find(wo => wo.id === id))
        .filter((o): o is WorkOrder => !!o);

    Promise.all(
        ordersToUpdate.map(order => updateWorkOrder({ ...order, status: OrderStatus.Pending }))
    ).then(() => {
        setSelectedIds(new Set()); // Clear selection after action
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Intake Section */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Work Order Intake</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => setModal('import')} className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg shadow hover:bg-blue-700 transition">Import Orders (CSV)</button>
          <button onClick={() => setModal('manual')} className="w-full bg-green-600 text-white px-4 py-3 rounded-lg shadow hover:bg-green-700 transition">New Manual Order</button>
        </div>
      </div>

      {modal === 'import' && <CsvImportModal onClose={() => setModal('none')} />}
      {modal === 'manual' && <ManualOrderModal onClose={() => setModal('none')} />}
      {editingOrder && <WorkOrderEditorModal workOrder={editingOrder} onSave={handleSaveOrder} onClose={() => setEditingOrder(null)} />}
      
      {/* Overdue Section */}
      {(overdueGroups.unassigned.length > 0 || overdueGroups.assigned.length > 0) && (
        <CollapsibleSection 
            title={`Overdue Work Orders (${overdueGroups.unassigned.length + overdueGroups.assigned.reduce((sum, g) => sum + g.orders.length, 0)})`} 
            isOpen={isOverdueOpen} 
            onToggle={() => setIsOverdueOpen(!isOverdueOpen)}
            titleClassName="text-red-600"
        >
          <div className="space-y-4">
            {overdueGroups.unassigned.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 border-b pb-1">Unassigned</h4>
                <div className="space-y-3 pt-2">
                  {overdueGroups.unassigned.map(wo => <WorkOrderItem key={wo.id} workOrder={wo} onEdit={() => setEditingOrder(wo)} />)}
                </div>
              </div>
            )}
            {overdueGroups.assigned.map(group => (
              <div key={group.tripName}>
                <h4 className="font-semibold text-gray-700 mb-2 border-b pb-1">Trip: {group.tripName}</h4>
                <div className="space-y-3 pt-2">
                  {group.orders.map(wo => <WorkOrderItem key={wo.id} workOrder={wo} onEdit={() => setEditingOrder(wo)} />)}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Pending Review Section */}
      <CollapsibleSection title={`Orders Pending Review (${pendingReviewOrders.length})`} isOpen={isPendingReviewOpen} onToggle={() => setIsPendingReviewOpen(!isPendingReviewOpen)}>
        {pendingReviewOrders.length > 0 ? (
          <div>
            <div className="bg-gray-100 p-2 rounded-md mb-4 flex items-center justify-between">
                <div className="flex items-center">
                    <input 
                        type="checkbox"
                        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                        onChange={handleSelectAll}
                        checked={selectedIds.size > 0 && selectedIds.size === pendingReviewOrders.length}
                        // @ts-ignore - 'indeterminate' is a valid property on checkboxes
                        ref={el => el && (el.indeterminate = selectedIds.size > 0 && selectedIds.size < pendingReviewOrders.length)}
                    />
                    <label className="text-sm font-medium">{selectedIds.size} selected</label>
                </div>
                <div className="space-x-2">
                    <button onClick={() => markOrdersAsReady(Array.from(selectedIds))} disabled={selectedIds.size === 0} className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-md shadow-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed">Mark Selected as Ready</button>
                    <button onClick={() => markOrdersAsReady(pendingReviewOrders.map(o => o.id))} className="bg-green-200 text-green-800 text-sm px-3 py-1.5 rounded-md hover:bg-green-300">Mark All as Ready</button>
                </div>
            </div>
            <div className="space-y-3">
              {pendingReviewOrders.map(wo => (
                <ReviewableWorkOrderItem 
                  key={wo.id} 
                  workOrder={wo} 
                  onEdit={() => setEditingOrder(wo)}
                  isSelected={selectedIds.has(wo.id)}
                  onSelectionChange={handleSelectionChange}
                  onMarkReady={() => markOrdersAsReady([wo.id])}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-4">All orders have been reviewed.</div>
        )}
      </CollapsibleSection>
    </div>
  );
};

// --- Sub-components ---

const CollapsibleSection: React.FC<{ title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode, titleClassName?: string }> = ({ title, isOpen, onToggle, children, titleClassName }) => (
  <div className="bg-white rounded-lg shadow-sm">
    <button onClick={onToggle} className="w-full flex justify-between items-center p-4 text-left">
      <h3 className={`text-xl font-semibold text-gray-800 ${titleClassName || ''}`}>{title}</h3>
      {isOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
    </button>
    {isOpen && <div className="p-4 border-t">{children}</div>}
  </div>
);

interface WorkOrderItemProps {
  workOrder: WorkOrder;
  onEdit: () => void;
}

const WorkOrderItem: React.FC<WorkOrderItemProps> = ({ workOrder: wo, onEdit }) => {
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };
  
  const isOverdue = new Date(wo.dueDate.split('T')[0]) < new Date(new Date().toDateString());

  return (
    <div 
      className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${isOverdue ? 'border-red-500' : (wo.isFollowUp ? 'border-yellow-500' : 'border-transparent')}`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-grow min-w-0">
          <p className="font-bold text-lg text-gray-800 truncate" title={wo.orderId}>{wo.orderId}</p>
          <p className="text-gray-600 mt-1 truncate" title={wo.address}>{wo.address}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-2">
            <span className="font-medium bg-gray-100 px-2 py-0.5 rounded-md">{wo.typeName}</span>
             {wo.startDate && (
              <span className="flex items-center">
                  <span className="font-semibold text-gray-600 mr-1.5">Start:</span> {formatDate(wo.startDate)}
              </span>
             )}
             <span className="flex items-center">
               <span className={`font-semibold mr-1.5 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>Due:</span> {formatDate(wo.dueDate)}
             </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-4 space-y-1">
          <p className="font-semibold text-lg">${(wo.baseRate + wo.miscFee).toFixed(2)}</p>
          <button onClick={onEdit} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
          {wo.isFollowUp && <span className="text-xs bg-yellow-200 text-yellow-800 font-semibold px-2 py-1 rounded-full mt-1 inline-block">Follow Up</span>}
        </div>
      </div>
    </div>
  );
};


interface ReviewableWorkOrderItemProps extends WorkOrderItemProps {
    isSelected: boolean;
    onSelectionChange: (id: string, isSelected: boolean) => void;
    onMarkReady: () => void;
}

const ReviewableWorkOrderItem: React.FC<ReviewableWorkOrderItemProps> = ({ workOrder, onEdit, isSelected, onSelectionChange, onMarkReady }) => {
    const wo = workOrder;
    const formatDate = (dateString: string | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };
    
    return (
        <div className={`p-3 border rounded-lg flex items-start gap-3 transition-colors ${isSelected ? 'bg-blue-50 border-blue-400' : 'bg-white hover:bg-gray-50'}`}>
            <input 
                type="checkbox" 
                checked={isSelected} 
                onChange={(e) => onSelectionChange(wo.id, e.target.checked)} 
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                aria-label={`Select order ${wo.orderId}`}
            />
            <div className="flex-grow min-w-0 cursor-pointer" onClick={onEdit}>
                <p className="font-bold text-gray-800 truncate" title={wo.orderId}>{wo.orderId} - {wo.clientName}</p>
                <p className="text-sm text-gray-600 mt-1 truncate" title={wo.address}>{wo.address}</p>
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                    <span className="font-medium bg-gray-100 px-2 py-0.5 rounded-md">{wo.typeName}</span>
                     {wo.startDate && (
                      <span className="flex items-center">
                          <span className="font-semibold text-gray-600 mr-1.5">Start:</span> {formatDate(wo.startDate)}
                      </span>
                     )}
                     <span className="flex items-center">
                       <span className="font-semibold text-gray-600 mr-1.5">Due:</span> {formatDate(wo.dueDate)}
                     </span>
                </div>
            </div>
            <div className="text-right flex-shrink-0 ml-4 space-y-1.5 flex flex-col items-end">
                <p className="font-semibold">${(wo.baseRate + wo.miscFee).toFixed(2)}</p>
                <button onClick={(e) => { e.stopPropagation(); onMarkReady(); }} className="text-green-600 hover:underline text-sm font-medium">Mark Ready</button>
            </div>
        </div>
    );
}

export default DailyReviewScreen;
