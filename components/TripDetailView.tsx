
import React, { useState, FC } from 'react';
import { SuggestedTrip, Trip } from '../types';
import { PlannedTripEditor } from './PlannedTripEditor';


// --- Main Component ---
interface TripDetailViewProps {
    trip: SuggestedTrip;
    onClose: () => void;
    onApprove: (finalTrip: SuggestedTrip, startTime: number | null) => void;
    onReject: () => void;
}

export const TripDetailView: FC<TripDetailViewProps> = ({ trip, onClose, onApprove, onReject }) => {
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [finalTripState, setFinalTripState] = useState<SuggestedTrip>(trip);

    const handleApproveClick = (currentTripState: SuggestedTrip) => {
        setFinalTripState(currentTripState);
        setIsScheduleModalOpen(true);
    };
    
    const handleConfirmSchedule = (date: string | null, time: string | null) => {
        let startTime: number | null = null;
        if (date && time) {
            const [year, month, day] = date.split('-').map(Number);
            const [hours, minutes] = time.split(':').map(Number);
            startTime = new Date(year, month - 1, day, hours, minutes).getTime();
        }

        onApprove(finalTripState, startTime);
        setIsScheduleModalOpen(false);
    };

    return (
        <>
            <PlannedTripEditor
                mode="review"
                initialTrip={trip}
                onClose={onClose}
                onReject={onReject}
                onApprove={handleApproveClick}
            />
            {isScheduleModalOpen && 
                <ScheduleTripModal 
                    onClose={() => setIsScheduleModalOpen(false)}
                    onConfirm={handleConfirmSchedule}
                />
            }
        </>
    );
};


// --- Sub-components for TripDetailView ---

const ScheduleTripModal: FC<{onClose: () => void, onConfirm: (date: string | null, time: string | null) => void}> = ({onClose, onConfirm}) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState('08:00');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold mb-4">Schedule Trip</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Trip Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Start Time</label>
                        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 w-full p-2 border rounded-md"/>
                    </div>
                </div>
                <div className="flex justify-between items-center mt-6">
                     <button onClick={() => onConfirm(null, null)} className="text-blue-600 hover:underline text-sm font-medium">Plan For Later</button>
                    <div className="space-x-3">
                        <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button onClick={() => onConfirm(date, time)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Confirm Schedule</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
