
import React, { useState, FC, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { SuggestedTrip, SuggestedStop, Trip, WorkOrder, FinancialGoals, WorkOrderType } from '../types';
import WorkOrderMapView from './WorkOrderMapView';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { generateOptimalRoute } from '../services/geminiService';
import WorkOrderEditorModal from './WorkOrderEditorModal';
import { PrinterIcon } from './icons/PrinterIcon';
import { AddStopModal } from './AddStopModal';
import { AddressAutocomplete } from './AddressAutocomplete';
import { loadGoogleMapsScript } from '../utils/googleMapsLoader';
import { PrintOptionsModal } from './PrintOptionsModal';

type TripEditorMode = 'review' | 'edit';

interface TripEditorProps {
    mode: TripEditorMode;
    initialTrip: Trip | SuggestedTrip;
    onClose: () => void;
    // Callbacks for 'review' mode
    onApprove?: (finalTrip: SuggestedTrip) => void;
    onReject?: () => void;
}

export const PlannedTripEditor: FC<TripEditorProps> = (props) => {
    const { mode, initialTrip, onClose, onApprove, onReject } = props;
    const { state, updateTrip, deleteTrip, updateWorkOrder, setPrintRequest } = useAppContext();
    const [editableTrip, setEditableTrip] = useState<SuggestedTrip | null>(null);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [recalculationError, setRecalculationError] = useState<string | null>(null);
    const [isReoptimizing, setIsReoptimizing] = useState(false);
    const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
    const [highlightedStopId, setHighlightedStopId] = useState<string | null>(null);
    const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);

    const dragItemIndex = useRef<number | null>(null);
    const dragOverItemIndex = useRef<number | null>(null);
    const stopListRefs = useRef<Record<string, HTMLLIElement | null>>({});
    
    const getOrder = useCallback((id: string): WorkOrder | undefined => state.workOrders.find(wo => wo.id === id), [state.workOrders]);
    const getType = useCallback((typeName: string): WorkOrderType | undefined => state.workOrderTypes.find(t => t.typeName === typeName), [state.workOrderTypes]);
    
    const getServiceTime = useCallback((orderId: string): number => {
        const order = getOrder(orderId);
        const type = order ? getType(order.typeName) : undefined;
        return Math.round((type?.defaultServiceTimeSeconds || 0) / 60);
    }, [getOrder, getType]);

    // Scroll to highlighted stop
    useEffect(() => {
        if (highlightedStopId) {
            const el = stopListRefs.current[highlightedStopId];
            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [highlightedStopId]);

    const recalculateTrip = useCallback(async (tripToCalc: SuggestedTrip) => {
        setIsRecalculating(true);
        setRecalculationError(null);
        
        try {
            await loadGoogleMapsScript();
        } catch (error) {
            setRecalculationError("Could not load Google Maps API. Please check your connection.");
            setIsRecalculating(false);
            return;
        }

        if (!tripToCalc) return;

        const directionsService = new window.google.maps.DirectionsService();
        const allStops = tripToCalc.stops.map(s => s.address);
        const locations = [tripToCalc.startLocation, ...allStops, tripToCalc.endLocation];
        const MAX_WAYPOINTS_PER_REQUEST = 25;
        const requestPromises: Promise<{result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus}>[] = [];

        for (let i = 0; i < locations.length - 1; i += (MAX_WAYPOINTS_PER_REQUEST + 1)) {
            const origin = locations[i];
            const chunkEndIndex = Math.min(i + MAX_WAYPOINTS_PER_REQUEST + 1, locations.length - 1);
            const destination = locations[chunkEndIndex];
            const waypoints = locations.slice(i + 1, chunkEndIndex).map(location => ({ location, stopover: true }));
            
            if (!origin || !destination) {
                setRecalculationError("Start or End location is missing. Cannot calculate route.");
                setIsRecalculating(false);
                return;
            }

            requestPromises.push(new Promise((resolve) => {
                directionsService.route({ origin, destination, waypoints, travelMode: window.google.maps.TravelMode.DRIVING }, (result, status) => {
                    resolve({result, status});
                });
            }));
        }

        try {
            const responses = await Promise.all(requestPromises);
            let totalMiles = 0, travelSeconds = 0;
            let hasError = false;

            for (const response of responses) {
                if (response.status === 'OK' && response.result) {
                    response.result.routes[0].legs.forEach(leg => {
                        totalMiles += (leg.distance?.value || 0) * 0.000621371;
                        travelSeconds += leg.duration?.value || 0;
                    });
                } else {
                    hasError = true;
                    const errorMessage = response.status === 'NOT_FOUND' || response.status === 'ZERO_RESULTS'
                        ? "Could not find a route. Please check if all addresses are correct and accessible."
                        : `Route calculation failed. (Error: ${response.status})`;
                    setRecalculationError(errorMessage);
                    break; 
                }
            }
            
            if (!hasError) {
                const travelMinutes = Math.round(travelSeconds / 60);
                const serviceMinutes = tripToCalc.stops.reduce((acc, stop) => acc + stop.serviceTimeMinutes, 0);
                setEditableTrip(prev => prev ? { ...prev, totalMiles, travelMinutes, serviceMinutes, totalMinutes: travelMinutes + serviceMinutes } : null);
            }
        } catch (error) { 
            setRecalculationError("An unexpected error occurred during route calculation.");
        }
        finally { setIsRecalculating(false); }
    }, []);

    useEffect(() => {
        let tripToLoad: SuggestedTrip;
        
        if ('totalTimeSeconds' in initialTrip) {
            const trip = initialTrip as Trip;
            const detailedStops: SuggestedStop[] = trip.stops.map(stop => {
                const order = getOrder(stop.workOrderId);
                return { 
                    workOrderId: stop.workOrderId, 
                    address: order?.address || 'Address not found',
                    serviceTimeMinutes: getServiceTime(stop.workOrderId) // Default service time
                };
            }).filter(s => s.address !== 'Address not found');

            const serviceMinutes = detailedStops.reduce((sum, stop) => sum + stop.serviceTimeMinutes, 0);
            
            tripToLoad = {
                id: trip.id, name: trip.name, stops: detailedStops,
                tripNumber: trip.tripNumber,
                startLocation: trip.startLocation, endLocation: trip.endLocation,
                totalMinutes: trip.totalTimeSeconds / 60, 
                travelMinutes: (trip.totalTimeSeconds / 60) - serviceMinutes,
                serviceMinutes: serviceMinutes,
                totalMiles: 0, estimatedPayout: 0, reasoning: '', color: '#4F46E5'
            };
        } else {
            const suggested = initialTrip as SuggestedTrip;
            const stopsWithServiceTime = suggested.stops.map(s => ({
                ...s,
                serviceTimeMinutes: getServiceTime(s.workOrderId)
            }));
            const serviceMinutes = stopsWithServiceTime.reduce((sum, stop) => sum + stop.serviceTimeMinutes, 0);
            tripToLoad = {
                ...suggested,
                stops: stopsWithServiceTime,
                serviceMinutes,
                travelMinutes: suggested.totalMinutes - serviceMinutes,
            };
        }
        setEditableTrip(tripToLoad);
        recalculateTrip(tripToLoad);
    }, [initialTrip, getOrder, getType, recalculateTrip, getServiceTime]);

    const handleSaveChanges = () => {
        if (!editableTrip || !('startTime' in initialTrip)) return;
        const updatedTrip: Trip = {
            ...(initialTrip as Trip),
            name: editableTrip.name,
            startLocation: editableTrip.startLocation,
            endLocation: editableTrip.endLocation,
            stops: editableTrip.stops.map(s => ({ workOrderId: s.workOrderId, isCompleted: false, timeSpentSeconds: 0 })),
            totalTimeSeconds: editableTrip.totalMinutes * 60,
        };
        updateTrip(updatedTrip);
        onClose();
    };
    
    const handleDelete = () => {
        deleteTrip(initialTrip.id);
        onClose();
    };

    const handleStopsChange = (newStops: SuggestedStop[]) => {
        if (editableTrip) {
            const updatedTrip = { ...editableTrip, stops: newStops };
            setEditableTrip(updatedTrip);
            recalculateTrip(updatedTrip);
        }
    };
    
    const handleLocationCommit = (type: 'startLocation' | 'endLocation', value: string) => {
        if (editableTrip && editableTrip[type] !== value) {
            const updatedTrip = { ...editableTrip, [type]: value };
            setEditableTrip(updatedTrip);
            recalculateTrip(updatedTrip);
        }
    };

    const handleServiceTimeChange = (workOrderId: string, newTime: number) => {
        if (!editableTrip) return;
        const newStops = editableTrip.stops.map(s => 
            s.workOrderId === workOrderId ? { ...s, serviceTimeMinutes: newTime } : s
        );
        const serviceMinutes = newStops.reduce((acc, stop) => acc + stop.serviceTimeMinutes, 0);
        const newTotalMinutes = editableTrip.travelMinutes + serviceMinutes;
        setEditableTrip({ ...editableTrip, stops: newStops, serviceMinutes, totalMinutes: newTotalMinutes });
    };
    
    const handleRemoveStop = (workOrderId: string) => {
        handleStopsChange(editableTrip?.stops.filter(s => s.workOrderId !== workOrderId) || []);
    };
    
    const handleAddStops = (workOrderIds: string[]) => {
        const newStops = workOrderIds.map(id => { 
            const order = getOrder(id);
            const type = order ? getType(order.typeName) : undefined;
            const serviceTime = Math.round((type?.defaultServiceTimeSeconds || 0) / 60);
            return { workOrderId: id, address: order?.address || '', serviceTimeMinutes: serviceTime }; 
        }).filter(s => s.address);

        const currentStopIds = new Set(editableTrip?.stops.map(s => s.workOrderId));
        const uniqueNewStops = newStops.filter(s => !currentStopIds.has(s.workOrderId));
        handleStopsChange([...(editableTrip?.stops || []), ...uniqueNewStops]);
        setIsAddStopModalOpen(false);
    }
    
    const handleDragEnd = () => {
        if (dragItemIndex.current !== null && dragOverItemIndex.current !== null && dragItemIndex.current !== dragOverItemIndex.current && editableTrip) {
            const newStops = [...editableTrip.stops];
            const [draggedItem] = newStops.splice(dragItemIndex.current, 1);
            newStops.splice(dragOverItemIndex.current, 0, draggedItem);
            handleStopsChange(newStops);
        }
        dragItemIndex.current = dragOverItemIndex.current = null;
    };
    
    const handleReoptimize = async () => {
        if (!editableTrip || editableTrip.stops.length < 2) return alert("At least two stops are needed to re-optimize.");
        setIsReoptimizing(true);
        const ordersToOptimize = editableTrip.stops.map(s => getOrder(s.workOrderId)).filter((o): o is WorkOrder => !!o);
        try {
            const results = await generateOptimalRoute({
                orders: ordersToOptimize, workOrderTypes: state.workOrderTypes, startLocation: editableTrip.startLocation,
                endLocation: editableTrip.endLocation, settings: state.tripSettings, goals: state.financialGoals, maxTrips: 1
            });
            if (results.suggestions?.[0]) {
                 const newSuggested = results.suggestions[0];
                 const stopsWithServiceTime = newSuggested.stops.map(s => ({
                    ...s,
                    serviceTimeMinutes: getServiceTime(s.workOrderId)
                }));
                const serviceMinutes = stopsWithServiceTime.reduce((sum, stop) => sum + stop.serviceTimeMinutes, 0);
                 setEditableTrip(prev => prev ? { 
                     ...prev, 
                     ...newSuggested,
                     stops: stopsWithServiceTime,
                     serviceMinutes,
                     travelMinutes: newSuggested.totalMinutes - serviceMinutes,
                     reasoning: `Re-optimized: ${newSuggested.reasoning}` 
                 } : null);
            }
        } catch (err) { alert(err instanceof Error ? err.message : "Re-optimization failed."); }
        finally { setIsReoptimizing(false); }
    };
    
    const handleSaveEditedOrder = (updatedOrder: WorkOrder) => {
        const oldOrder = getOrder(updatedOrder.id);
        updateWorkOrder(updatedOrder).then(() => {
            if (oldOrder && oldOrder.address !== updatedOrder.address && editableTrip) {
                const updatedStops = editableTrip.stops.map(s => s.workOrderId === updatedOrder.id ? { ...s, address: updatedOrder.address } : s);
                handleStopsChange(updatedStops);
            } else {
                setEditableTrip(t => t ? {...t} : null); // Trigger re-render for payout update
            }
        });
        setEditingOrder(null);
    };
    
    const handleGenerateReport = (includeMap: boolean) => {
        if (!editableTrip) return;
        const tripObject = 'tripNumber' in initialTrip ? (initialTrip as Trip) : undefined;
        setPrintRequest({ trip: editableTrip, tripObject, includeMap });
        setIsPrintOptionsOpen(false);
    };

    if (!editableTrip) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[51] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
                <div className="p-4 border-b flex-shrink-0 flex justify-between items-center no-print">
                    <h3 className="text-xl font-semibold">{mode === 'edit' ? 'Edit Planned Trip' : 'Review Suggested Trip'}: {editableTrip.name}</h3>
                    <button onClick={() => setIsPrintOptionsOpen(true)} className="p-2 rounded-md hover:bg-gray-200"><PrinterIcon className="w-5 h-5 text-gray-600" /></button>
                </div>
                
                <div className="flex-grow flex flex-col md:flex-row min-h-0">
                    <div className="w-full md:w-2/3 h-64 md:h-full flex-shrink-0 relative">
                        {(isRecalculating || isReoptimizing) && <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center no-print"><div className="text-lg font-semibold animate-pulse">{isReoptimizing ? 'Re-optimizing...' : 'Recalculating...'}</div></div>}
                        <WorkOrderMapView workOrders={editableTrip.stops.map(s => getOrder(s.workOrderId)).filter((o): o is WorkOrder => !!o)} trips={[]} officeLocations={state.officeLocations} onPinClick={(order) => setHighlightedStopId(order.id)} suggestedTrips={[editableTrip]} mode="detail" highlightedWorkOrderId={highlightedStopId}/>
                    </div>
                    <div className="w-full md:w-1/3 flex flex-col border-t md:border-t-0 md:border-l">
                        <div className="flex-grow flex flex-col min-h-0">
                            <h4 className="font-semibold p-3 border-b flex-shrink-0">Stop Order & Metrics</h4>
                            {recalculationError && (
                                <div className="p-3 bg-red-100 text-red-800 text-sm font-medium no-print">
                                    {recalculationError}
                                </div>
                            )}
                            <div className="p-3 border-b bg-gray-50 flex-shrink-0"><MetricsDisplay trip={editableTrip} goals={state.financialGoals} getOrder={getOrder} /></div>
                            <ul className="flex-grow overflow-y-auto p-2 space-y-2" onDragEnd={handleDragEnd}>
                                <LocationItem type="Start" value={editableTrip.startLocation} onCommit={val => handleLocationCommit('startLocation', val)} />
                                {editableTrip.stops.map((stop, index) => {
                                    const order = getOrder(stop.workOrderId);
                                    if (!order) return null;
                                    return (
                                    <li key={stop.workOrderId} ref={el => { stopListRefs.current[stop.workOrderId] = el; }} draggable onDragStart={() => dragItemIndex.current = index} onDragEnter={() => dragOverItemIndex.current = index} onDragOver={(e) => e.preventDefault()} onClick={() => setHighlightedStopId(stop.workOrderId)} className={`p-2.5 border rounded-md flex items-start gap-3 cursor-pointer group ${highlightedStopId === stop.workOrderId ? 'bg-blue-100 border-blue-400' : 'bg-white hover:bg-gray-50'}`}>
                                        <span className="font-bold text-gray-500 pt-0.5">{index + 1}</span>
                                        <div className="flex-grow">
                                            <p className="font-medium text-sm">{order.typeName}</p>
                                            <p className="text-xs text-gray-500">{order.address}</p>
                                            <div className="mt-2 flex items-center no-print">
                                                <label htmlFor={`service-time-${order.id}`} className="text-xs text-gray-600 mr-2">Service Time:</label>
                                                <input
                                                  type="number"
                                                  id={`service-time-${order.id}`}
                                                  value={stop.serviceTimeMinutes}
                                                  onChange={(e) => handleServiceTimeChange(order.id, parseInt(e.target.value, 10) || 0)}
                                                  onClick={e => e.stopPropagation()}
                                                  className="w-16 p-1 text-xs border rounded-md text-center"
                                                />
                                                <span className="text-xs text-gray-500 ml-1">min</span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 flex items-start gap-2">
                                            <div>
                                                <p className="font-semibold text-sm">${(order.baseRate + order.miscFee).toFixed(2)}</p>
                                                <button onClick={(e) => { e.stopPropagation(); setEditingOrder(order); }} className="text-xs text-blue-600 hover:underline mt-1 no-print">Edit</button>
                                            </div>
                                            {mode === 'edit' && <button onClick={() => handleRemoveStop(order.id)} className="text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-700 no-print" title="Remove stop">&times;</button>}
                                        </div>
                                    </li>);
                                })}
                                <LocationItem type="End" value={editableTrip.endLocation} onCommit={val => handleLocationCommit('endLocation', val)} />
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center p-4 border-t flex-shrink-0 bg-gray-50 no-print">
                     <div>
                         {mode === 'edit' && <button onClick={() => setConfirmDelete(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Delete Trip</button>}
                         {mode === 'edit' && <button onClick={() => setIsAddStopModalOpen(true)} className="ml-3 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Add Stop</button>}
                         {mode === 'review' && <button onClick={onReject} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Reject Trip</button>}
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={handleReoptimize} disabled={isReoptimizing || isRecalculating} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:bg-purple-300"><SparklesIcon className="w-5 h-5" />{isReoptimizing ? 'Optimizing...' : 'Re-optimize'}</button>
                        <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                        {mode === 'review' && <button onClick={() => onApprove && onApprove(editableTrip)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Approve & Schedule Trip</button>}
                        {mode === 'edit' && <button onClick={handleSaveChanges} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save Changes</button>}
                    </div>
                </div>
            </div>
            {isAddStopModalOpen && <AddStopModal currentTrip={editableTrip} onClose={() => setIsAddStopModalOpen(false)} onAddStops={handleAddStops}/>}
            {editingOrder && <WorkOrderEditorModal workOrder={editingOrder} onSave={handleSaveEditedOrder} onClose={() => setEditingOrder(null)}/>}
            {confirmDelete && <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4"><div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm"><h3 className="text-lg font-bold mb-4">Confirm Deletion</h3><p className="text-gray-700 mb-6">Are you sure you want to permanently delete this trip?</p><div className="flex justify-end space-x-3"><button onClick={() => setConfirmDelete(false)} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={handleDelete} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Delete Permanently</button></div></div></div>}
            {isPrintOptionsOpen && editableTrip && (
                <PrintOptionsModal 
                    onClose={() => setIsPrintOptionsOpen(false)} 
                    onGenerate={handleGenerateReport}
                />
            )}
        </div>
    );
};

const LocationItem: FC<{type: 'Start' | 'End', value: string, onCommit: (newValue: string) => void}> = ({type, value, onCommit}) => {
    const [inputValue, setInputValue] = useState(value);
    useEffect(() => { setInputValue(value); }, [value]);

    return (
        <li className="p-2 border-dashed border-2 rounded-md bg-indigo-50 flex items-center gap-3">
             <BriefcaseIcon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            <div className="w-full">
                <p className="font-bold text-sm text-indigo-800">{type} Location</p>
                <AddressAutocomplete 
                    value={inputValue}
                    onChange={setInputValue}
                    onCommit={onCommit}
                    className="w-full bg-transparent text-xs text-gray-600 focus:outline-none border-b border-indigo-200 focus:border-indigo-500"
                    placeholder="Type an address..."
                />
            </div>
        </li>
    );
}

const formatMinutes = (mins: number) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;

const MetricsDisplay: FC<{ trip: SuggestedTrip; goals: FinancialGoals, getOrder: (id: string) => WorkOrder | undefined }> = ({ trip, goals, getOrder }) => {
    const { totalMinutes, travelMinutes, serviceMinutes, totalMiles, stops } = trip;
    const estimatedPayout = useMemo(() => stops.reduce((acc, stop) => acc + ((getOrder(stop.workOrderId)?.baseRate || 0) + (getOrder(stop.workOrderId)?.miscFee || 0)), 0), [stops, getOrder]);
    const hours = totalMinutes / 60, perHourRate = hours > 0 ? estimatedPayout / hours : 0, perMileRate = totalMiles > 0 ? estimatedPayout / totalMiles : 0;
    const getMetricClass = (v: number, t: number) => {
        if (t === 0) return 'bg-gray-100 text-gray-800';
        const ratio = v / t;
        if (ratio >= 1.2) return 'bg-green-200 text-green-900';
        if (ratio >= 1.0) return 'bg-green-100 text-green-800';
        if (ratio >= 0.8) return 'bg-yellow-100 text-yellow-800';
        return 'bg-red-100 text-red-800';
    };
    return (<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricCard label="Travel Time" value={formatMinutes(travelMinutes)} />
        <MetricCard label="Service Time" value={formatMinutes(serviceMinutes)} />
        <MetricCard label="Total Time" value={formatMinutes(totalMinutes)} />
        <MetricCard label="Stops" value={stops.length.toString()} />
        <MetricCard label="Mileage" value={`${totalMiles.toFixed(1)} mi`} />
        <MetricCard label="Payout" value={`$${estimatedPayout.toFixed(2)}`} />
        <MetricCard label="$/hour" value={`$${perHourRate.toFixed(2)}`} className={getMetricClass(perHourRate, goals.targetHourlyRate)} />
        <MetricCard label="$/mile" value={`$${perMileRate.toFixed(2)}`} className={getMetricClass(perMileRate, goals.targetPerMileRate)} />
    </div>);
};
const MetricCard: FC<{ label: string; value: string; className?: string }> = ({ label, value, className = 'bg-gray-100 text-gray-800' }) => (<div className={`p-2 rounded-md text-center ${className} transition-colors`}><p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p><p className="text-lg font-bold">{value}</p></div>);
