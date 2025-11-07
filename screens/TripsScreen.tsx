
import React, { useState, useMemo, FC, ReactNode, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { OrderStatus, WorkOrder, Trip, SuggestedTrip, Screen } from '../types';
import { GenerateRoutesModal } from '../components/GenerateRoutesModal';
import { TripDetailView } from '../components/TripDetailView';
import { PlannedTripEditor } from '../components/PlannedTripEditor';
import { ChevronUpIcon } from '../components/icons/ChevronUpIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { ListViewIcon } from '../components/icons/ListViewIcon';
import { MapViewIcon } from '../components/icons/MapViewIcon';
import WorkOrderMapView from '../components/WorkOrderMapView';
import WorkOrderEditorModal from '../components/WorkOrderEditorModal';
import { CircleDotIcon } from '../components/icons/CircleDotIcon';

type SortKey = 'dueDate' | 'startDate' | 'city';

interface TripsScreenProps {
    setActiveScreen: (screen: Screen) => void;
}

// --- Date Formatting Helpers ---
const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return 'No Date';
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
};


const TripsScreen: FC<TripsScreenProps> = ({ setActiveScreen }) => {
  const { state, updateTrip, updateWorkOrder } = useAppContext();
  const [isPlannerOpen, setIsPlannerOpen] = useState(true);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);

  const groupedPlannedTrips = useMemo(() => {
    const planned = state.trips.filter(t => t.status === 'Planned');
    
    const groups: { [key: string]: Trip[] } = {
      noDate: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);
    
    // Sunday = 0, Saturday = 6. We want Sunday to be the start of the week.
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    planned.forEach(trip => {
      if (!trip.startTime) {
        groups.noDate.push(trip);
        return;
      }
      const tripDate = new Date(trip.startTime);
      if (tripDate >= today && tripDate < tomorrow) groups.today.push(trip);
      else if (tripDate >= tomorrow && tripDate <= endOfTomorrow) groups.tomorrow.push(trip);
      else if (tripDate > endOfTomorrow && tripDate <= endOfWeek) groups.thisWeek.push(trip);
      else groups.later.push(trip);
    });

    return [
      { title: 'No Date Assigned', trips: groups.noDate },
      { title: 'Today', trips: groups.today },
      { title: 'Tomorrow', trips: groups.tomorrow },
      { title: 'This Week', trips: groups.thisWeek },
      { title: 'Later', trips: groups.later },
    ].filter(g => g.trips.length > 0);

  }, [state.trips]);

  const completedTrips = useMemo(() => state.trips.filter(t => t.status === 'Completed'), [state.trips]);

  const handleStartTrip = (tripId: string) => {
    const tripToStart = state.trips.find(t => t.id === tripId);
    if (!tripToStart) return;
    updateTrip({ ...tripToStart, status: 'Active', startTime: Date.now() });
    tripToStart.stops.forEach(stop => {
      const order = state.workOrders.find(wo => wo.id === stop.workOrderId);
      if (order) {
        updateWorkOrder({...order, status: OrderStatus.Active})
      }
    });
  };

  return (
    <div className="space-y-6">
      <CollapsibleSection title="Trip Planner" isOpen={isPlannerOpen} onToggle={() => setIsPlannerOpen(!isPlannerOpen)}>
        <TripPlanner />
      </CollapsibleSection>

      {editingTrip && (
          <PlannedTripEditor
            mode="edit"
            initialTrip={editingTrip}
            onClose={() => setEditingTrip(null)}
          />
      )}
      
      <div className="bg-gray-50 rounded-lg shadow-sm">
        <div className="p-4">
            <h2 className="text-xl font-semibold">Planned Trips ({state.trips.filter(t=>t.status==='Planned').length})</h2>
        </div>
        <div className="px-4 pb-4 border-t space-y-4">
          {groupedPlannedTrips.length > 0 ? (
            groupedPlannedTrips.map(group => (
              <DateGroupedSection key={group.title} title={`${group.title} (${group.trips.length})`}>
                {group.trips.map(trip => (
                  <PlannedTripItem 
                    key={trip.id} 
                    trip={trip} 
                    onEdit={() => setEditingTrip(trip)} 
                    onStart={() => handleStartTrip(trip.id)} 
                  />
                ))}
              </DateGroupedSection>
            ))
          ) : <p className="text-center text-gray-500 py-4">No trips have been planned.</p>}
        </div>
      </div>
    </div>
  );
};

const PlannedTripItem: FC<{trip: Trip, onEdit: () => void, onStart: () => void}> = ({trip, onEdit, onStart}) => (
    <div className="bg-white p-3 rounded-lg shadow-sm border flex flex-col sm:flex-row justify-between sm:items-center">
        <div className="flex-grow mb-3 sm:mb-0">
          <p className="font-semibold text-lg">{trip.name}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
            <span className="font-bold">{formatDate(trip.startTime)}</span>
            <span>{trip.stops.length} stops</span>
            <span>Est. {formatTime(trip.totalTimeSeconds)}</span>
            {trip.totalMiles != null && <span>{trip.totalMiles.toFixed(1)} mi</span>}
            {trip.estimatedPayout != null && <span className="font-semibold text-green-700">${trip.estimatedPayout.toFixed(2)}</span>}
          </div>
        </div>
        <div className="space-x-2 flex-shrink-0 flex">
            <button onClick={onEdit} className="flex-1 sm:flex-none bg-gray-200 text-gray-800 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm hover:bg-gray-300 transition">
                View & Edit
            </button>
            <button onClick={onStart} className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 text-sm font-semibold rounded-lg shadow hover:bg-green-700 transition">
              Start Trip
            </button>
        </div>
    </div>
);

const DateGroupedSection: FC<{ title: string, children: ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div>
        <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left py-2">
          <h3 className="font-bold text-gray-700">{title}</h3>
          {isOpen ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
        </button>
        {isOpen && <div className="space-y-3 mt-2">{children}</div>}
    </div>
  )
}


const TripPlanner: FC = () => {
    const { state, updateWorkOrder, addTrip } = useAppContext();
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generationTarget, setGenerationTarget] = useState<'all' | 'selected'>('all');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestedTrips, setSuggestedTrips] = useState<SuggestedTrip[]>([]);
    const [viewingTrip, setViewingTrip] = useState<SuggestedTrip | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [aiExplanation, setAiExplanation] = useState<string | null>(null);
    
    const [sortKey, setSortKey] = useState<SortKey>('dueDate');
    const [showUnavailable, setShowUnavailable] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
    const [isCircleToolActive, setIsCircleToolActive] = useState(false);

    useEffect(() => {
        if (aiExplanation) {
            alert(`AI Planner Update:\n\n${aiExplanation}`);
            setAiExplanation(null);
        }
    }, [aiExplanation]);

    const availableOrders = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const plannedOrderIds = new Set(state.trips.filter(t => t.status !== 'Completed').flatMap(t => t.stops.map(s => s.workOrderId)));
        
        const allReady = state.workOrders.filter(wo => wo.status === OrderStatus.Pending && !plannedOrderIds.has(wo.id));
        
        const filtered = showUnavailable ? allReady : allReady.filter(wo => !wo.startDate || new Date(wo.startDate) <= today);
        
        return filtered.sort((a, b) => {
            if (sortKey === 'city') return a.address.localeCompare(b.address);
            return new Date(a[sortKey] || 0).getTime() - new Date(b[sortKey] || 0).getTime();
        });
    }, [state.workOrders, state.trips, showUnavailable, sortKey]);

    const handleGenerateClick = (target: 'all' | 'selected') => {
        if (target === 'selected' && selectedOrderIds.size === 0) {
            alert("Please select at least one order to generate a route for.");
            return;
        }
        setGenerationTarget(target);
        setIsGenerateModalOpen(true);
    };

    const handleToggleOrder = (orderId: string) => {
        setSelectedOrderIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(orderId)) newSet.delete(orderId);
            else newSet.add(orderId);
            return newSet;
        });
    };
    
    const handleApprove = (finalTrip: SuggestedTrip, startTime: number | null) => {
        addTrip({
          id: '', // Will be generated by dataService
          name: finalTrip.name,
          tripNumber: '', // Will be generated by dataService
          stops: finalTrip.stops.map(s => ({ workOrderId: s.workOrderId, isCompleted: false, timeSpentSeconds: 0 })),
          status: 'Planned',
          totalTimeSeconds: finalTrip.totalMinutes * 60,
          startTime: startTime,
          startLocation: finalTrip.startLocation,
          endLocation: finalTrip.endLocation,
          totalMiles: finalTrip.totalMiles,
          estimatedPayout: finalTrip.estimatedPayout,
        });
        setSuggestedTrips(prev => prev.filter(t => t.id !== finalTrip.id));
        setViewingTrip(null);
        setSelectedOrderIds(new Set());
    };

    const handleReject = () => {
        if (viewingTrip) {
            setSuggestedTrips(prev => prev.filter(t => t.id !== viewingTrip.id));
        }
        setViewingTrip(null);
    };

    const handleSaveOrder = (updatedOrder: WorkOrder) => {
        updateWorkOrder(updatedOrder);
        setEditingOrder(null);
    };

    const handleMapSelection = useCallback((ids: string[]) => {
        const newSelectedIds = new Set(ids);
        setSelectedOrderIds(newSelectedIds);
        if (newSelectedIds.size > 0) {
            setGenerationTarget('selected');
            setIsGenerateModalOpen(true);
        }
    }, []);

    return (
        <div className="bg-white p-4 rounded-lg shadow">
            {isGenerateModalOpen && 
                <GenerateRoutesModal 
                    onClose={() => setIsGenerateModalOpen(false)}
                    ordersToPlan={generationTarget === 'selected' ? availableOrders.filter(wo => selectedOrderIds.has(wo.id)) : availableOrders}
                    setIsLoading={setIsLoading}
                    setSuggestedTrips={setSuggestedTrips}
                    setAiExplanation={setAiExplanation}
                    setError={setError}
                />
            }
            {viewingTrip && 
                <TripDetailView 
                    trip={viewingTrip}
                    onClose={() => setViewingTrip(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                />
            }
            {editingOrder && 
                <WorkOrderEditorModal 
                    workOrder={editingOrder} 
                    onSave={handleSaveOrder} 
                    onClose={() => setEditingOrder(null)} 
                />
            }

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <button onClick={() => handleGenerateClick('all')} className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg shadow hover:bg-blue-700 transition">Generate Route(s) for All</button>
                <button onClick={() => handleGenerateClick('selected')} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg shadow hover:bg-indigo-700 transition">Generate Route(s) for Selected ({selectedOrderIds.size})</button>
            </div>
            
             {isLoading && <div className="text-center p-4 text-gray-600 animate-pulse">The AI is planning your route(s)... This may take a moment.</div>}
             {error && <div className="text-center p-4 text-red-600 font-semibold">{error}</div>}

            {suggestedTrips.length > 0 && (
                <div className="my-4 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-2">AI Suggested Routes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suggestedTrips.map(trip => <SuggestedTripCard key={trip.id} trip={trip} onView={() => setViewingTrip(trip)} />)}
                    </div>
                </div>
            )}
            
            <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold">Available Work Orders ({availableOrders.length})</h3>
                        <div className="flex items-center space-x-2 mt-1">
                            <label className="flex items-center text-sm"><input type="checkbox" checked={showUnavailable} onChange={() => setShowUnavailable(!showUnavailable)} className="mr-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/> Show Unavailable</label>
                            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} className="text-sm p-1 border rounded-md bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="dueDate">Sort by Due Date</option>
                                <option value="startDate">Sort by Start Date</option>
                                <option value="city">Sort by City</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center p-1 bg-gray-200 rounded-lg space-x-1">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-600'}`}><ListViewIcon className="w-5 h-5" /></button>
                        <button onClick={() => setViewMode('map')} className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'map' ? 'bg-white shadow' : 'text-gray-600'}`}><MapViewIcon className="w-5 h-5" /></button>
                        {viewMode === 'map' && (
                            <div className="text-center">
                                <button 
                                    onClick={() => setIsCircleToolActive(prev => !prev)} 
                                    className={`p-2 rounded-lg transition-colors ${isCircleToolActive ? 'bg-blue-500 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-300'}`}
                                    title="Select on Map"
                                >
                                    <CircleDotIcon className="w-5 h-5" />
                                </button>
                                <p className="text-[10px] font-semibold text-gray-600 mt-0.5">Select on Map</p>
                            </div>
                        )}
                    </div>
                </div>
                
                {viewMode === 'list' ? (
                     <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                        {availableOrders.map(wo => <PlannerWorkOrderItem key={wo.id} order={wo} isSelected={selectedOrderIds.has(wo.id)} onToggle={handleToggleOrder} />)}
                    </div>
                ) : (
                    <WorkOrderMapView 
                        workOrders={availableOrders}
                        trips={[]}
                        officeLocations={state.officeLocations}
                        onPinClick={(order) => setEditingOrder(order)}
                        suggestedTrips={suggestedTrips}
                        isCircleToolActive={isCircleToolActive}
                        onMapSelection={handleMapSelection}
                    />
                )}
            </div>
        </div>
    )
}

const PlannerWorkOrderItem: FC<{order: WorkOrder, isSelected: boolean, onToggle: (id: string) => void}> = ({order, isSelected, onToggle}) => {
    const formatDate = (dateString: string | undefined) => dateString ? new Date(dateString).toLocaleDateString() : 'N/A';
    return (
        <div className={`p-3 border rounded-lg flex items-start gap-3 transition-colors ${isSelected ? 'bg-blue-50 border-blue-400' : 'bg-white hover:bg-gray-50'}`}>
            <input type="checkbox" checked={isSelected} onChange={() => onToggle(order.id)} className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
            <div className="flex-grow">
                <p className="font-semibold">{order.orderId} - {order.clientName}</p>
                <p className="text-sm text-gray-600">{order.address}</p>
                <div className="text-xs text-gray-500 mt-1 flex gap-x-3">
                    <span>Type: {order.typeName}</span>
                    <span>Due: {formatDate(order.dueDate)}</span>
                    {order.startDate && <span>Starts: {formatDate(order.startDate)}</span>}
                </div>
            </div>
        </div>
    )
}

const SuggestedTripCard: FC<{trip: SuggestedTrip, onView: () => void}> = ({ trip, onView }) => (
    <div className="p-3 bg-white rounded-lg border-l-4 shadow-sm" style={{borderColor: trip.color}}>
        <p className="font-bold text-gray-800">{trip.name}</p>
        <p className="text-sm text-gray-600 italic line-clamp-2 my-2">"{trip.reasoning}"</p>
        <div className="grid grid-cols-3 text-center text-xs my-2">
            <div><p className="font-bold text-lg">{trip.stops.length}</p><p className="text-gray-500">stops</p></div>
            <div><p className="font-bold text-lg">{trip.totalMiles.toFixed(1)}</p><p className="text-gray-500">miles</p></div>
            <div><p className="font-bold text-lg">${trip.estimatedPayout.toFixed(2)}</p><p className="text-gray-500">payout</p></div>
        </div>
        <button onClick={onView} className="w-full mt-2 text-center bg-gray-200 text-gray-800 py-1.5 rounded-md hover:bg-gray-300 text-sm font-semibold">View Details & Approve</button>
    </div>
)

const CollapsibleSection: FC<{ title: string, isOpen: boolean, onToggle: () => void, children: ReactNode }> = ({ title, isOpen, onToggle, children }) => (
  <div className="bg-gray-50 rounded-lg shadow-sm">
    <button onClick={onToggle} className="w-full flex justify-between items-center p-4 text-left">
      <h2 className="text-xl font-semibold">{title}</h2>
      {isOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
    </button>
    {isOpen && <div className="p-4 border-t">{children}</div>}
  </div>
);

export default TripsScreen;
