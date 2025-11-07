
import React, { useMemo, FC } from 'react';
import { SuggestedTrip, WorkOrder, OrderStatus, Trip, SuggestedStop } from '../types';
import { useAppContext } from '../context/AppContext';
import WorkOrderMapView from './WorkOrderMapView';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { MapPinIcon } from './icons/MapPinIcon';

interface PrintableReportProps {
    trip: SuggestedTrip;
    tripObject?: Trip;
    includeMap: boolean;
}

const Checkbox: FC<{checked: boolean}> = ({ checked }) => (
    <div className="w-4 h-4 border border-black flex items-center justify-center">
        {checked && <div className="w-3 h-3 bg-black"></div>}
    </div>
);

const FormattedDateTime: FC<{timestamp: number | null | undefined}> = ({ timestamp }) => {
    if (!timestamp) return <>_______________</>;

    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\//g, '.');
    const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

    return (
        <div>
            <span>{time} | {dateStr}</span>
            <div className="mt-1">
                <span className="bg-gray-800 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm tracking-wider">{day}</span>
            </div>
        </div>
    )
};

const getKpiClass = (value: number, target: number) => {
    if (target === 0 || isNaN(value) || !isFinite(value)) return 'bg-gray-100 text-gray-800';
    const ratio = value / target;
    if (ratio >= 1.2) return 'bg-green-100 text-green-800';
    if (ratio >= 1.0) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
};

export const PrintableReport: React.FC<PrintableReportProps> = ({ trip, tripObject, includeMap }) => {
    const { state } = useAppContext();
    const getOrder = (id: string): WorkOrder | undefined => state.workOrders.find(wo => wo.id === id);

    const detailedStops = useMemo(() => 
        trip.stops
            .map(stop => ({
                suggestedStop: stop,
                workOrder: getOrder(stop.workOrderId)
            }))
            .filter((item): item is { suggestedStop: SuggestedStop, workOrder: WorkOrder } => !!item.workOrder),
    [trip.stops, state.workOrders]);

    const tripWorkOrders = useMemo(() => detailedStops.map(ds => ds.workOrder), [detailedStops]);

    const isTripPaid = useMemo(() => 
        tripWorkOrders.length > 0 && tripWorkOrders.every(wo => wo.status === OrderStatus.Paid),
    [tripWorkOrders]);

    const isTripInvoiced = useMemo(() =>
        tripWorkOrders.length > 0 && tripWorkOrders.every(wo => wo.status === OrderStatus.Invoiced || wo.status === OrderStatus.Paid),
    [tripWorkOrders]);
    
    const actualTotalPayout = useMemo(() =>
        tripWorkOrders.reduce((acc, order) => acc + order.baseRate + order.miscFee, 0),
    [tripWorkOrders]);

    const estimatedTotalTime = trip.totalMinutes > 0 ? trip.totalMinutes / 60 : 0;
    const actualTotalTime = tripObject?.totalTimeSeconds ? tripObject.totalTimeSeconds / 3600 : 0;
    
    const estimatedPerHour = estimatedTotalTime > 0 ? trip.estimatedPayout / estimatedTotalTime : 0;
    const actualPerHour = actualTotalTime > 0 ? actualTotalPayout / actualTotalTime : 0;

    const estimatedPerMile = trip.totalMiles > 0 ? trip.estimatedPayout / trip.totalMiles : 0;
    const actualPerMile = tripObject?.totalMiles && tripObject.totalMiles > 0 ? actualTotalPayout / tripObject.totalMiles : 0;
    
    const formatTime = (totalMinutes: number) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return `${hours}h ${minutes}m`;
    };
    
    const isOfficeLocation = (address: string) => state.officeLocations.some(loc => loc.address === address);

    return (
        <div className="bg-white text-black font-sans">
            {includeMap && (
                <div className="print-map-page">
                    <WorkOrderMapView
                        workOrders={tripWorkOrders}
                        trips={[]}
                        officeLocations={state.officeLocations}
                        onPinClick={() => {}}
                        suggestedTrips={[trip]}
                        mode="detail"
                    />
                </div>
            )}
            <div className="print-report-page p-8">
                <h1 className="text-3xl font-bold mb-4 border-b-2 border-black pb-2">Trip Manifest</h1>
                
                {/* Header */}
                <div className="grid grid-cols-3 gap-x-8 gap-y-4 mb-6 text-sm items-start">
                    <div className="col-span-3">
                        <p className="text-2xl font-semibold">{trip.name}</p>
                    </div>
                    <div><span className="font-bold">Trip #:</span> {tripObject?.tripNumber || '_______________'}</div>
                    <div className="flex items-center gap-2 pt-1"><span className="font-bold">Trip Paid in Full?</span> <Checkbox checked={isTripPaid}/></div>
                    <div className="flex items-center gap-2 pt-1"><span className="font-bold">All W/Os Invoiced?</span> <Checkbox checked={isTripInvoiced}/></div>
                    
                    <div><p className="font-bold">Start Time:</p> <FormattedDateTime timestamp={tripObject?.startTime} /></div>
                    <div><p className="font-bold">End Time:</p> <FormattedDateTime timestamp={tripObject?.endTime} /></div>
                </div>

                {trip.reasoning && (
                    <div className="my-6 p-3 bg-gray-50 border rounded-lg">
                        <h3 className="font-bold text-base mb-1">AI Planner's Notes</h3>
                        <p className="text-sm italic text-gray-700">"{trip.reasoning}"</p>
                    </div>
                )}
                
                {/* Metrics */}
                 <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="border rounded-lg p-3">
                        <h3 className="font-bold text-center mb-2">Estimated</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <MetricDisplay label="Miles" value={trip.totalMiles.toFixed(1)} />
                            <MetricDisplay label="Total Time" value={formatTime(trip.totalMinutes)} />
                            <MetricDisplay label="$/Mile" value={`$${estimatedPerMile.toFixed(2)}`} kpiClass={getKpiClass(estimatedPerMile, state.financialGoals.targetPerMileRate)} />
                            <MetricDisplay label="$/Hour" value={`$${estimatedPerHour.toFixed(2)}`} kpiClass={getKpiClass(estimatedPerHour, state.financialGoals.targetHourlyRate)} />
                        </div>
                    </div>
                     <div className="border rounded-lg p-3">
                        <h3 className="font-bold text-center mb-2">Actual</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                           <MetricDisplay label="Miles" value={tripObject?.totalMiles?.toFixed(1) || 'N/A'} />
                           <MetricDisplay label="Total Time" value={tripObject?.totalTimeSeconds ? formatTime(tripObject.totalTimeSeconds / 60) : 'N/A'} />
                           <MetricDisplay label="$/Mile" value={actualPerMile ? `$${actualPerMile.toFixed(2)}` : 'N/A'} kpiClass={getKpiClass(actualPerMile, state.financialGoals.targetPerMileRate)} />
                           <MetricDisplay label="$/Hour" value={actualPerHour ? `$${actualPerHour.toFixed(2)}` : 'N/A'} kpiClass={getKpiClass(actualPerHour, state.financialGoals.targetHourlyRate)} />
                        </div>
                    </div>
                 </div>

                <div className={`text-right mb-6 p-2 rounded-md ${getKpiClass(actualTotalPayout, state.financialGoals.targetTripPayout)}`}>
                    <p className="text-lg font-bold">Total Payout: <span className="text-2xl">${actualTotalPayout.toFixed(2)}</span></p>
                </div>

                {/* Stops Table */}
                <div className="text-xs">
                    <div className="flex items-center gap-3 mb-2">
                        {isOfficeLocation(trip.startLocation) ? <BriefcaseIcon className="w-5 h-5"/> : <MapPinIcon className="w-5 h-5"/>}
                        <p><span className="font-bold">Start:</span> {trip.startLocation}</p>
                    </div>

                    <table className="w-full text-left border-collapse my-2">
                        <thead>
                            <tr className="border-y-2 border-black">
                                <th className="p-2 w-8">Stop #</th>
                                <th className="p-2">Address</th>
                                <th className="p-2">W/O #</th>
                                <th className="p-2">Type</th>
                                <th className="p-2">Company</th>
                                <th className="p-2 text-center">Svc. Time</th>
                                <th className="p-2 text-right">Payout</th>
                                <th className="p-2 text-center">Paid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detailedStops.map(({ suggestedStop, workOrder }, index) => {
                                const payout = workOrder.baseRate + workOrder.miscFee;
                                return (
                                    <tr key={workOrder.id} className="border-b">
                                        <td className="p-2 font-bold">{index + 1}</td>
                                        <td className="p-2">{workOrder.address}</td>
                                        <td className="p-2">{workOrder.orderId}</td>
                                        <td className="p-2">{workOrder.typeName}</td>
                                        <td className="p-2">{workOrder.companyName}</td>
                                        <td className="p-2 text-center">{suggestedStop.serviceTimeMinutes} min</td>
                                        <td className="p-2 text-right">${payout.toFixed(2)}</td>
                                        <td className="p-2 text-center"><Checkbox checked={workOrder.status === OrderStatus.Paid} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                     <div className="flex items-center gap-3 mt-2">
                        {isOfficeLocation(trip.endLocation) ? <BriefcaseIcon className="w-5 h-5"/> : <MapPinIcon className="w-5 h-5"/>}
                        <p><span className="font-bold">End:</span> {trip.endLocation}</p>
                    </div>
                </div>

            </div>
        </div>
    );
};

const MetricDisplay: FC<{label:string, value:string, kpiClass?: string}> = ({label, value, kpiClass}) => (
    <div className={`p-1.5 rounded text-center ${kpiClass || 'bg-gray-100'}`}>
        <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
        <p className="font-semibold">{value}</p>
    </div>
);
