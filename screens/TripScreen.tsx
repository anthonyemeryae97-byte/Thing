
import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTimer } from '../hooks/useTimer';
import { OrderStatus, WorkOrder, TripStop } from '../types';

const TripScreen: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const activeTrip = useMemo(() => state.trips.find(t => t.status === 'Active'), [state.trips]);

    const { 
        isActive: isTripActive, 
        formattedTime: tripFormattedTime, 
        start: startTripTimer, 
        pause: pauseTripTimer, 
        stop: stopTripTimer
    } = useTimer(activeTrip?.totalTimeSeconds || 0);

    const handleStopTrip = () => {
        if (!activeTrip) return;
        const finalTime = stopTripTimer();
        dispatch({ 
            type: 'UPDATE_TRIP', 
            payload: { ...activeTrip, status: 'Completed', endTime: Date.now(), totalTimeSeconds: finalTime }
        });
    };

    if (!activeTrip) {
        return (
            <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
                <p>No active trip.</p>
                <p className="text-sm mt-2">Go to the Trip Planner to start a new trip.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-lg shadow text-center">
                <h2 className="text-xl font-semibold mb-2">{activeTrip.name}</h2>
                <p className="text-5xl font-mono tracking-wider text-gray-800">{tripFormattedTime}</p>
                <div className="flex justify-center space-x-4 mt-4">
                    {!isTripActive ? (
                        <button onClick={startTripTimer} className="bg-green-500 text-white px-6 py-2 rounded-lg shadow hover:bg-green-600">Start</button>
                    ) : (
                        <button onClick={pauseTripTimer} className="bg-yellow-500 text-white px-6 py-2 rounded-lg shadow hover:bg-yellow-600">Pause</button>
                    )}
                    <button onClick={handleStopTrip} className="bg-red-500 text-white px-6 py-2 rounded-lg shadow hover:bg-red-600">Stop & Complete Trip</button>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-lg font-semibold">Stops</h3>
                {activeTrip.stops.map((stop, index) => (
                    <StopCard key={stop.workOrderId} stop={stop} stopIndex={index} tripId={activeTrip.id} />
                ))}
            </div>
        </div>
    );
};

interface StopCardProps {
    stop: TripStop;
    stopIndex: number;
    tripId: string;
}

const StopCard: React.FC<StopCardProps> = ({ stop, stopIndex, tripId }) => {
    const { state, dispatch } = useAppContext();
    const order = useMemo(() => state.workOrders.find(wo => wo.id === stop.workOrderId), [state.workOrders, stop.workOrderId]) as WorkOrder;
    const { isActive, formattedTime, start, pause } = useTimer(stop.timeSpentSeconds);
    
    const toggleTimer = () => {
        if (isActive) {
            pause();
        } else {
            start();
        }
    }
    
    const completeStop = () => {
        pause();
        const activeTrip = state.trips.find(t => t.id === tripId);
        if (!activeTrip) return;
        
        const newStops = activeTrip.stops.map(s => s.workOrderId === stop.workOrderId ? {...s, isCompleted: true} : s);
        dispatch({ type: 'UPDATE_TRIP', payload: {...activeTrip, stops: newStops}});
        dispatch({ type: 'UPDATE_WORK_ORDER', payload: {...order, status: OrderStatus.Completed, completedDate: new Date().toISOString()}});
    }

    return (
        <div className={`p-4 rounded-lg shadow transition-colors ${stop.isCompleted ? 'bg-green-100' : 'bg-white'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg"><span className="text-gray-500">{stopIndex + 1}.</span> {order.typeName}</p>
                    <p className="text-gray-600">{order.address}</p>
                </div>
                {!stop.isCompleted && (
                    <div className="text-right">
                        <p className="text-2xl font-mono">{formattedTime}</p>
                        <button onClick={toggleTimer} className={`text-sm px-3 py-1 rounded ${isActive ? 'bg-yellow-400' : 'bg-blue-400'} text-white`}>
                            {isActive ? 'Pause Timer' : 'Start Timer'}
                        </button>
                    </div>
                )}
                 {stop.isCompleted && (
                    <div className="text-right text-green-700 font-semibold">
                        Completed
                    </div>
                )}
            </div>
            {!stop.isCompleted && (
                 <button onClick={completeStop} className="w-full mt-3 bg-gray-200 text-gray-800 py-1.5 rounded-lg hover:bg-gray-300">
                    Mark as Completed
                </button>
            )}
        </div>
    );
}

export default TripScreen;
