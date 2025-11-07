import { AppState, WorkOrder, WorkOrderType, Trip, Company, ImportProfile, OfficeLocation, TripSettings, FinancialGoals, TripGoal, TripGoalSetting } from '../types';

const LOCAL_STORAGE_KEY = 'fieldServiceAppState';

// --- Default Initial State ---
const initialCompanies: Company[] = [
    { id: 'c1', name: 'First Title Co.', contactRep: 'Jane Doe', contactEmail: 'jane@firsttitle.com', contactPhone: '555-1111', isArchived: false, defaultImportProfileId: 'p1' },
    { id: 'c2', name: 'Reliable Inspectors', contactRep: 'John Smith', contactEmail: 'john@reliable.com', contactPhone: '555-2222', isArchived: false },
    { id: 'c3', name: 'Speedy Couriers', contactRep: 'Sam Wilson', contactEmail: 'sam@speedy.com', contactPhone: '555-3333', isArchived: false },
];

const initialWorkOrderTypes: WorkOrderType[] = [
    { id: '1', typeName: 'Refinance Signing', defaultCompanyId: 'c1', defaultBaseRate: 150, defaultResourcesNeeded: ['Notary Stamp', 'Laser Printer'], isArchived: false, defaultServiceTimeSeconds: 3600, useAverageServiceTime: false },
    { id: '2', typeName: 'Home Inspection', defaultCompanyId: 'c2', defaultBaseRate: 400, defaultResourcesNeeded: ['Inspection Kit', 'Camera'], isArchived: false, defaultServiceTimeSeconds: 9000, useAverageServiceTime: false },
    { id: '3', typeName: 'Courier Delivery', defaultCompanyId: 'c3', defaultBaseRate: 50, defaultResourcesNeeded: ['Vehicle', 'Scanner'], isArchived: false, defaultServiceTimeSeconds: 900, useAverageServiceTime: false },
];

const initialImportProfiles: ImportProfile[] = [
    { id: 'p1', companyId: 'c1', name: 'Standard Title Co. Format', mapping: { orderId: 'Order Number', dueDate: 'Closing Date', clientName: 'Client Name', address1: 'Property Address', city: 'City', state: 'State', zip: 'Zip Code', typeName: 'Work Type' } },
    { id: 'p2', companyId: 'c1', name: 'Rush Orders Format', mapping: { orderId: 'RUSH_ID', dueDate: 'DUE', clientName: 'CLIENT', address1: 'ADDRESS', typeName: 'TYPE' } }
];

const initialOfficeLocations: OfficeLocation[] = [
    { id: 'o1', name: 'Main Office', address: '123 Main St, Traverse City, MI 49684' }
];

const defaultTripSettings: TripSettings = {
    maxTripTimeSeconds: 8 * 3600, maxTripMileage: 300,
    priorities: [
        { goal: TripGoal.HOURLY_RATE, enabled: true }, { goal: TripGoal.PER_MILE_RATE, enabled: true },
        { goal: TripGoal.TOTAL_PAYOUT, enabled: true }, { goal: TripGoal.STOP_COUNT, enabled: true },
    ]
};

const defaultFinancialGoals: FinancialGoals = {
    targetHourlyRate: 75, targetPerMileRate: 2, targetTripPayout: 500,
};

const getInitialState = (): AppState => ({
  workOrderTypes: initialWorkOrderTypes,
  workOrders: [],
  trips: [],
  companies: initialCompanies,
  importProfiles: initialImportProfiles,
  officeLocations: initialOfficeLocations,
  tripSettings: defaultTripSettings,
  financialGoals: defaultFinancialGoals,
  editingTarget: null,
  printRequest: null,
});


// --- Data Access Helpers ---
const getState = (): AppState => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure state shape is consistent with defaults after loading
        return {
            ...getInitialState(),
            ...parsed,
            tripSettings: { ...defaultTripSettings, ...(parsed.tripSettings || {}) },
            financialGoals: { ...defaultFinancialGoals, ...(parsed.financialGoals || {}) },
        };
    }
    return getInitialState();
};

const saveState = (state: AppState) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
};

// --- Simulated API Service ---
const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const dataService = {
    loadState: async (): Promise<AppState> => {
        await simulateDelay(300);
        return getState();
    },

    // --- Work Order Types ---
    addWorkOrderType: async (type: WorkOrderType): Promise<WorkOrderType> => {
        await simulateDelay(50);
        const state = getState();
        const newType = { ...type, id: Date.now().toString() };
        state.workOrderTypes.push(newType);
        saveState(state);
        return newType;
    },
    updateWorkOrderType: async (type: WorkOrderType): Promise<WorkOrderType> => {
        await simulateDelay(50);
        const state = getState();
        state.workOrderTypes = state.workOrderTypes.map(t => t.id === type.id ? type : t);
        saveState(state);
        return type;
    },
    deleteWorkOrderType: async (id: string): Promise<string> => {
        await simulateDelay(50);
        const state = getState();
        state.workOrderTypes = state.workOrderTypes.filter(t => t.id !== id);
        saveState(state);
        return id;
    },

    // --- Work Orders ---
    addWorkOrder: async (order: WorkOrder): Promise<WorkOrder> => {
        await simulateDelay(50);
        const state = getState();
        const newOrder = { ...order, id: Date.now().toString() };
        state.workOrders.push(newOrder);
        saveState(state);
        return newOrder;
    },
    updateWorkOrder: async (order: WorkOrder): Promise<WorkOrder> => {
        await simulateDelay(50);
        const state = getState();
        state.workOrders = state.workOrders.map(wo => wo.id === order.id ? order : wo);
        saveState(state);
        return order;
    },

    // --- Trips ---
    addTrip: async (trip: Trip): Promise<Trip> => {
        await simulateDelay(100);
        const state = getState();
        const newTrip = { ...trip, id: Date.now().toString() };

        const tripDate = newTrip.startTime ? new Date(newTrip.startTime) : new Date();
        const year = tripDate.getFullYear().toString().slice(-2);
        const month = (tripDate.getMonth() + 1).toString().padStart(2, '0');
        const day = tripDate.getDate().toString().padStart(2, '0');
        const datePrefix = `${month}${day}${year}`;
        
        const tripsOnSameDay = state.trips.filter(t => t.tripNumber && t.tripNumber.startsWith(datePrefix));
        const newSuffix = tripsOnSameDay.length + 1;
        newTrip.tripNumber = `${datePrefix}-${newSuffix}`;

        state.trips.push(newTrip);
        saveState(state);
        return newTrip;
    },
    updateTrip: async (trip: Trip): Promise<Trip> => {
        await simulateDelay(50);
        const state = getState();
        state.trips = state.trips.map(t => t.id === trip.id ? trip : t);
        saveState(state);
        return trip;
    },
    deleteTrip: async (id: string): Promise<string> => {
        await simulateDelay(50);
        const state = getState();
        state.trips = state.trips.filter(t => t.id !== id);
        saveState(state);
        return id;
    },
    
    // --- Companies ---
    addCompany: async (company: Company): Promise<Company> => {
        await simulateDelay(50);
        const state = getState();
        const newCompany = { ...company, id: Date.now().toString() };
        state.companies.push(newCompany);
        saveState(state);
        return newCompany;
    },
    updateCompany: async (company: Company): Promise<Company> => {
        await simulateDelay(50);
        const state = getState();
        state.companies = state.companies.map(c => c.id === company.id ? company : c);
        saveState(state);
        return company;
    },
    deleteCompany: async (id: string): Promise<string> => {
        await simulateDelay(50);
        const state = getState();
        state.companies = state.companies.filter(c => c.id !== id);
        state.importProfiles = state.importProfiles.filter(p => p.companyId !== id);
        saveState(state);
        return id;
    },
    
    // --- Import Profiles ---
    addImportProfile: async (profile: ImportProfile): Promise<ImportProfile> => {
        await simulateDelay(50);
        const state = getState();
        const newProfile = { ...profile, id: Date.now().toString() };
        state.importProfiles.push(newProfile);
        saveState(state);
        return newProfile;
    },
    updateImportProfile: async (profile: ImportProfile): Promise<ImportProfile> => {
        await simulateDelay(50);
        const state = getState();
        state.importProfiles = state.importProfiles.map(p => p.id === profile.id ? profile : p);
        saveState(state);
        return profile;
    },
    deleteImportProfile: async (id: string): Promise<string> => {
        await simulateDelay(50);
        const state = getState();
        state.importProfiles = state.importProfiles.filter(p => p.id !== id);
        saveState(state);
        return id;
    },
    
    // --- Office Locations ---
    addOfficeLocation: async (office: OfficeLocation): Promise<OfficeLocation> => {
        await simulateDelay(50);
        const state = getState();
        const newOffice = { ...office, id: Date.now().toString() };
        state.officeLocations.push(newOffice);
        saveState(state);
        return newOffice;
    },
    updateOfficeLocation: async (office: OfficeLocation): Promise<OfficeLocation> => {
        await simulateDelay(50);
        const state = getState();
        state.officeLocations = state.officeLocations.map(o => o.id === office.id ? office : o);
        saveState(state);
        return office;
    },
    deleteOfficeLocation: async (id: string): Promise<string> => {
        await simulateDelay(50);
        const state = getState();
        state.officeLocations = state.officeLocations.filter(o => o.id !== id);
        saveState(state);
        return id;
    },
    
    // --- Settings ---
    updateTripSettings: async (settings: TripSettings): Promise<TripSettings> => {
        await simulateDelay(50);
        const state = getState();
        state.tripSettings = settings;
        saveState(state);
        return settings;
    },
    updateFinancialGoals: async (goals: FinancialGoals): Promise<FinancialGoals> => {
        await simulateDelay(50);
        const state = getState();
        state.financialGoals = goals;
        saveState(state);
        return goals;
    },
};
