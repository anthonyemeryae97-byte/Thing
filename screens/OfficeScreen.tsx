
import React, { useMemo, useState, FC } from 'react';
import { useAppContext } from '../context/AppContext';
import { OrderStatus, WorkOrder, CompanyPerformanceStats, Company, Trip, SuggestedTrip, WorkOrderType } from '../types';
import { SettingsIcon } from '../components/icons/SettingsIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { ChevronUpIcon } from '../components/icons/ChevronUpIcon';
import { PrintOptionsModal } from '../components/PrintOptionsModal';
import { PrinterIcon } from '../components/icons/PrinterIcon';

const OfficeScreen: React.FC = () => {
  const { state, setEditingTarget, setPrintRequest } = useAppContext();
  const { workOrders, trips, companies } = state;

  const [serviceSortOrder, setServiceSortOrder] = useState<'asc' | 'desc'>('desc');
  const [companySortKey, setCompanySortKey] = useState<keyof Omit<CompanyPerformanceStats, 'companyId' | 'companyName'>>('totalRevenue');
  const [isCompanyPerfOpen, setIsCompanyPerfOpen] = useState(true);
  const [isCompletedTripsOpen, setIsCompletedTripsOpen] = useState(true);

  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [tripToPrint, setTripToPrint] = useState<Trip | null>(null);

  const serviceTimeStats = useMemo(() => {
    const completedStops = trips
        .filter(t => t.status === 'Completed')
        .flatMap(t => t.stops)
        .filter(s => s.isCompleted);

    const stopsByTypeName: Record<string, number[]> = {};

    completedStops.forEach(stop => {
        const order = workOrders.find(wo => wo.id === stop.workOrderId);
        if (order) {
            if (!stopsByTypeName[order.typeName]) {
                stopsByTypeName[order.typeName] = [];
            }
            if (stop.timeSpentSeconds > 0) {
              stopsByTypeName[order.typeName].push(stop.timeSpentSeconds);
            }
        }
    });

    const stats = Object.entries(stopsByTypeName).map(([typeName, times]) => {
        const total = times.reduce((sum, time) => sum + time, 0);
        const average = times.length > 0 ? total / times.length : 0;
        return {
            typeName,
            averageSeconds: average,
            completedCount: times.length
        };
    });
    
    const completedTypeNames = new Set(stats.map(s => s.typeName));
    state.workOrderTypes.forEach(wot => {
        if (!completedTypeNames.has(wot.typeName)) {
            stats.push({ typeName: wot.typeName, averageSeconds: 0, completedCount: 0 });
        }
    });

    return stats;
  }, [trips, workOrders, state.workOrderTypes]);

  const sortedServiceTimeStats = useMemo(() => {
      return [...serviceTimeStats].sort((a, b) => {
          return serviceSortOrder === 'desc' 
              ? b.averageSeconds - a.averageSeconds 
              : a.averageSeconds - b.averageSeconds;
      });
  }, [serviceTimeStats, serviceSortOrder]);
  
  const companyPerformanceStats = useMemo(() => {
    const completedStatuses = [OrderStatus.Completed, OrderStatus.Invoiced, OrderStatus.Paid];
    const completedOrders = workOrders.filter(wo => completedStatuses.includes(wo.status));

    const companyStats: CompanyPerformanceStats[] = companies
    .filter(c => !c.isArchived)
    .map(company => {
        const companyOrders = completedOrders.filter(wo => wo.companyName === company.name);
        const totalRevenue = companyOrders.reduce((sum, wo) => sum + wo.baseRate + wo.miscFee, 0);
        const completedJobs = companyOrders.length;
        const averageJobValue = completedJobs > 0 ? totalRevenue / completedJobs : 0;
        
        return {
            companyId: company.id,
            companyName: company.name,
            totalRevenue,
            completedJobs,
            averageJobValue
        };
    });

    return companyStats.sort((a, b) => b[companySortKey] - a[companySortKey]);

  }, [workOrders, companies, companySortKey]);
  
  const completedTrips = useMemo(() => {
    return state.trips
        .filter(t => t.status === 'Completed')
        .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
  }, [state.trips]);

  const toggleServiceSortOrder = () => setServiceSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');

  const formatSeconds = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return [
      h > 0 ? `${h}h` : '',
      m > 0 ? `${m}m` : '',
      s > 0 && h === 0 && m < 15 ? `${s}s` : ''
    ].filter(Boolean).join(' ') || '0m';
  };


  const kpis = useMemo(() => {
    const completedOrders = workOrders.filter(wo => wo.status === OrderStatus.Completed || wo.status === OrderStatus.Invoiced || wo.status === OrderStatus.Paid);
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    const revenueWTD = completedOrders.filter(wo => new Date(wo.completedDate || 0) >= startOfWeek).reduce((sum, wo) => sum + wo.baseRate + wo.miscFee, 0);
    const revenueMTD = completedOrders.filter(wo => new Date(wo.completedDate || 0) >= startOfMonth).reduce((sum, wo) => sum + wo.baseRate + wo.miscFee, 0);
    const revenueQTD = completedOrders.filter(wo => new Date(wo.completedDate || 0) >= startOfQuarter).reduce((sum, wo) => sum + wo.baseRate + wo.miscFee, 0);
    const revenueYTD = completedOrders.filter(wo => new Date(wo.completedDate || 0) >= startOfYear).reduce((sum, wo) => sum + wo.baseRate + wo.miscFee, 0);

    const uninvoicedCount = workOrders.filter(wo => wo.status === OrderStatus.Completed).length;
    
    const agingOrders = {
        '14': workOrders.filter(wo => wo.status === OrderStatus.Invoiced && (Date.now() - new Date(wo.invoicedDate || 0).getTime()) > 14 * 86400000).length,
        '30': workOrders.filter(wo => wo.status === OrderStatus.Invoiced && (Date.now() - new Date(wo.invoicedDate || 0).getTime()) > 30 * 86400000).length,
        '60': workOrders.filter(wo => wo.status === OrderStatus.Invoiced && (Date.now() - new Date(wo.invoicedDate || 0).getTime()) > 60 * 86400000).length,
        '90+': workOrders.filter(wo => wo.status === OrderStatus.Invoiced && (Date.now() - new Date(wo.invoicedDate || 0).getTime()) > 90 * 86400000).length,
    };
    
    const tripsWithFollowup = workOrders.filter(wo => wo.isFollowUp).length;

    const totalTimeHours = trips.reduce((sum, trip) => sum + trip.totalTimeSeconds, 0) / 3600;
    const totalRevenue = revenueYTD;
    const perHourRate = totalTimeHours > 0 ? totalRevenue / totalTimeHours : 0;
    const perMileRate = 2.50;

    return { revenueWTD, revenueMTD, revenueQTD, revenueYTD, uninvoicedCount, agingOrders, tripsWithFollowup, perHourRate, perMileRate };
  }, [workOrders, trips]);

  const handleEditType = (typeName: string) => {
    const type = state.workOrderTypes.find(t => t.typeName === typeName);
    if (type) {
      setEditingTarget({ type: 'workOrderType', id: type.id });
    }
  };

  const handleEditCompany = (companyId: string) => {
      setEditingTarget({ type: 'company', id: companyId });
  };
  
  const handlePrintClick = (trip: Trip) => {
    setTripToPrint(trip);
    setIsPrintOptionsOpen(true);
  };

  const handleGenerateReport = (includeMap: boolean) => {
      if (!tripToPrint) return;

      const getOrder = (id: string): WorkOrder | undefined => state.workOrders.find(wo => wo.id === id);
      const getType = (typeName: string): WorkOrderType | undefined => state.workOrderTypes.find(t => t.typeName === typeName);

      const detailedStops = tripToPrint.stops.map(stop => {
          const order = getOrder(stop.workOrderId);
          const type = order ? getType(order.typeName) : undefined;
          const serviceTime = Math.round((type?.defaultServiceTimeSeconds || 0) / 60);
          return { workOrderId: stop.workOrderId, address: order?.address || '', serviceTimeMinutes: serviceTime };
      });
      
      const serviceMinutes = detailedStops.reduce((sum, stop) => sum + stop.serviceTimeMinutes, 0);

      // This creates the "Estimated" or "Planned" version of the trip data.
      const tripForReport: SuggestedTrip = {
          id: tripToPrint.id, 
          name: tripToPrint.name, 
          stops: detailedStops,
          totalMinutes: tripToPrint.totalTimeSeconds / 60,
          travelMinutes: (tripToPrint.totalTimeSeconds / 60) - serviceMinutes,
          serviceMinutes: serviceMinutes,
          totalMiles: tripToPrint.totalMiles || 0,
          estimatedPayout: tripToPrint.estimatedPayout || 0,
          reasoning: '', 
          startLocation: tripToPrint.startLocation, 
          endLocation: tripToPrint.endLocation,
          // Actuals are passed via the full trip object
      };

      setPrintRequest({ 
            trip: tripForReport, 
            tripObject: tripToPrint, // Pass the original trip object for actuals
            includeMap 
        });

      setIsPrintOptionsOpen(false);
      setTripToPrint(null);
  };


  const SortButton: React.FC<{
    sortKey: keyof Omit<CompanyPerformanceStats, 'companyId' | 'companyName'>;
    label: string
  }> = ({ sortKey, label }) => (
    <button
        onClick={() => setCompanySortKey(sortKey)}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${companySortKey === sortKey ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
    >
        {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {isPrintOptionsOpen && (
        <PrintOptionsModal
            onClose={() => setIsPrintOptionsOpen(false)}
            onGenerate={handleGenerateReport}
        />
      )}
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Per Hour Rate" value={`$${kpis.perHourRate.toFixed(2)}`} />
        <KpiCard title="Per Mile Rate" value={`$${kpis.perMileRate.toFixed(2)}`} />
        <KpiCard title="Follow-up Trips" value={kpis.tripsWithFollowup.toString()} />
        <KpiCard title="Uninvoiced" value={kpis.uninvoicedCount.toString()} />
      </div>

      {/* Company Performance */}
      <div className="bg-white rounded-lg shadow">
        <button onClick={() => setIsCompanyPerfOpen(!isCompanyPerfOpen)} className="w-full flex justify-between items-center p-4 text-left">
            <h2 className="text-xl font-semibold">Company Performance</h2>
            {isCompanyPerfOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
        </button>
        {isCompanyPerfOpen && (
            <div className="px-4 pb-4 border-t">
                <div className="flex justify-end items-center space-x-2 py-3">
                    <span className="text-xs font-medium text-gray-500">Sort by:</span>
                    <SortButton sortKey="totalRevenue" label="Total Revenue" />
                    <SortButton sortKey="averageJobValue" label="Avg. Job Value" />
                </div>
                <ul className="space-y-2">
                    {companyPerformanceStats.map(stat => (
                        <li key={stat.companyId} className="flex justify-between items-center p-2 bg-gray-50 rounded-md group">
                            <div className="flex items-center">
                                <button onClick={() => handleEditCompany(stat.companyId)} className="mr-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Edit ${stat.companyName}`}>
                                    <SettingsIcon className="w-4 h-4" />
                                </button>
                                <span className="font-medium text-gray-700">{stat.companyName}</span>
                            </div>
                            <div className="text-right">
                                <span className="font-semibold text-gray-800">${stat[companySortKey].toFixed(2)}</span>
                                <span className="text-xs text-gray-500 ml-2">({stat.completedJobs} jobs)</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>

      {/* Revenue */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3">Revenue</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><p className="text-sm text-gray-500">WTD</p><p className="text-2xl font-semibold">${kpis.revenueWTD.toFixed(2)}</p></div>
            <div><p className="text-sm text-gray-500">MTD</p><p className="text-2xl font-semibold">${kpis.revenueMTD.toFixed(2)}</p></div>
            <div><p className="text-sm text-gray-500">QTD</p><p className="text-2xl font-semibold">${kpis.revenueQTD.toFixed(2)}</p></div>
            <div><p className="text-sm text-gray-500">YTD</p><p className="text-2xl font-semibold">${kpis.revenueYTD.toFixed(2)}</p></div>
        </div>
      </div>
      
       {/* Completed Trips */}
       <div className="bg-white rounded-lg shadow">
            <button onClick={() => setIsCompletedTripsOpen(!isCompletedTripsOpen)} className="w-full flex justify-between items-center p-4 text-left">
                <h2 className="text-xl font-semibold">Completed Trip Reports</h2>
                {isCompletedTripsOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
            </button>
            {isCompletedTripsOpen && (
                <div className="px-4 pb-4 border-t">
                    <ul className="space-y-2 mt-4">
                        {completedTrips.length > 0 ? completedTrips.map(trip => (
                            <CompletedTripItem key={trip.id} trip={trip} onPrint={() => handlePrintClick(trip)} />
                        )) : <p className="text-center text-gray-500 py-4">No trips have been completed yet.</p>}
                    </ul>
                </div>
            )}
        </div>

      {/* Service Times & A/R */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Average Service Times */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">Average Service Times</h2>
            <button onClick={toggleServiceSortOrder} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              Sort {serviceSortOrder === 'desc' ? 'Lowest' : 'Highest'}
            </button>
          </div>
          <ul className="space-y-2">
            {sortedServiceTimeStats.map(stat => (
              <li key={stat.typeName} className="flex justify-between items-center p-2 bg-gray-50 rounded-md group">
                <div className="flex items-center">
                    <button onClick={() => handleEditType(stat.typeName)} className="mr-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Edit ${stat.typeName}`}>
                        <SettingsIcon className="w-4 h-4" />
                    </button>
                    <span className="font-medium text-gray-700">{stat.typeName}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-800">{formatSeconds(stat.averageSeconds)}</span>
                  <span className="text-xs text-gray-500 ml-2">({stat.completedCount} jobs)</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Accounts Receivable */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Aging Unpaid Orders</h2>
          <div className="flex justify-around text-center h-full items-center">
              <div><p className="text-sm text-gray-500">14 Days</p><p className="text-2xl font-semibold">{kpis.agingOrders['14']}</p></div>
              <div><p className="text-sm text-gray-500">30 Days</p><p className="text-2xl font-semibold">{kpis.agingOrders['30']}</p></div>
              <div><p className="text-sm text-gray-500">60 Days</p><p className="text-2xl font-semibold">{kpis.agingOrders['60']}</p></div>
              <div><p className="text-sm text-gray-500">90+ Days</p><p className="text-2xl font-semibold">{kpis.agingOrders['90+']}</p></div>
          </div>
        </div>
      </div>
      
       {/* Reports Placeholder */}
       <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Reports</h2>
          <button className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">
            View Profit & Loss Summary
          </button>
       </div>
    </div>
  );
};

const KpiCard: React.FC<{ title: string, value: string }> = ({ title, value }) => (
    <div className="bg-white p-4 rounded-lg shadow text-center">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-3xl font-bold text-blue-600">{value}</p>
    </div>
);

const CompletedTripItem: FC<{ trip: Trip, onPrint: () => void }> = ({ trip, onPrint }) => {
  const formatDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString() : 'N/A';
  return (
    <li className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
      <div>
        <p className="font-medium">{trip.name} <span className="text-sm text-gray-500">({trip.tripNumber})</span></p>
        <p className="text-sm text-gray-600">Completed on {formatDate(trip.endTime)}</p>
      </div>
      <button onClick={onPrint} className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-200">
          <PrinterIcon className="w-4 h-4" />
          Print Report
      </button>
    </li>
  );
};


export default OfficeScreen;
