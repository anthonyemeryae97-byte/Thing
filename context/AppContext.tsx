import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState, useCallback } from 'react';
import { WorkOrder, WorkOrderType, Trip, Company, ImportProfile, AppState, OfficeLocation, TripSettings, FinancialGoals, TripGoalSetting, PrintRequest } from '../types';
import { dataService } from '../services/dataService';

// --- INITIAL STATE ---
// The true initial state will now be loaded async from the dataService
const emptyState: AppState = {
  workOrderTypes: [],
  workOrders: [],
  trips: [],
  companies: [],
  importProfiles: [],
  officeLocations: [],
  tripSettings: { maxTripTimeSeconds: 0, maxTripMileage: 0, priorities: [] },
  financialGoals: { targetHourlyRate: 0, targetPerMileRate: 0, targetTripPayout: 0 },
  editingTarget: null,
  printRequest: null,
};

// --- ACTION TYPES ---
type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'ADD_WORK_ORDER_TYPE'; payload: WorkOrderType }
  | { type: 'UPDATE_WORK_ORDER_TYPE'; payload: WorkOrderType }
  | { type: 'DELETE_WORK_ORDER_TYPE'; payload: string } // id
  | { type: 'ADD_WORK_ORDER'; payload: WorkOrder }
  | { type: 'UPDATE_WORK_ORDER'; payload: WorkOrder }
  | { type: 'ADD_TRIP'; payload: Trip }
  | { type: 'UPDATE_TRIP'; payload: Trip }
  | { type: 'DELETE_TRIP'; payload: string } // id
  | { type: 'ADD_COMPANY'; payload: Company }
  | { type: 'UPDATE_COMPANY'; payload: Company }
  | { type: 'DELETE_COMPANY'; payload: string } // id
  | { type: 'ADD_IMPORT_PROFILE'; payload: ImportProfile }
  | { type: 'UPDATE_IMPORT_PROFILE'; payload: ImportProfile }
  | { type: 'DELETE_IMPORT_PROFILE'; payload: string } // id
  | { type: 'ADD_OFFICE_LOCATION'; payload: OfficeLocation }
  | { type: 'UPDATE_OFFICE_LOCATION'; payload: OfficeLocation }
  | { type: 'DELETE_OFFICE_LOCATION'; payload: string } // id
  | { type: 'UPDATE_TRIP_SETTINGS'; payload: TripSettings }
  | { type: 'UPDATE_FINANCIAL_GOALS'; payload: FinancialGoals }
  | { type: 'SET_EDITING_TARGET'; payload: { type: 'company' | 'workOrderType', id: string } | null }
  | { type: 'SET_PRINT_REQUEST'; payload: PrintRequest | null };

// --- REDUCER ---
// The reducer is now simpler, only responsible for updating the in-memory state.
// All business logic (ID creation, etc.) is in the dataService.
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'ADD_WORK_ORDER_TYPE':
      return { ...state, workOrderTypes: [...state.workOrderTypes, action.payload] };
    case 'UPDATE_WORK_ORDER_TYPE':
      return { ...state, workOrderTypes: state.workOrderTypes.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_WORK_ORDER_TYPE':
      return { ...state, workOrderTypes: state.workOrderTypes.filter(t => t.id !== action.payload) };
    case 'ADD_WORK_ORDER':
        return { ...state, workOrders: [...state.workOrders, action.payload] };
    case 'UPDATE_WORK_ORDER':
        return { ...state, workOrders: state.workOrders.map(wo => wo.id === action.payload.id ? action.payload : wo) };
    case 'ADD_TRIP':
        return { ...state, trips: [...state.trips, action.payload] };
    case 'UPDATE_TRIP':
        return { ...state, trips: state.trips.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TRIP':
        return { ...state, trips: state.trips.filter(t => t.id !== action.payload) };
    case 'ADD_COMPANY':
        return { ...state, companies: [...state.companies, action.payload] };
    case 'UPDATE_COMPANY':
        return { ...state, companies: state.companies.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_COMPANY':
        return { 
            ...state, 
            companies: state.companies.filter(c => c.id !== action.payload),
            importProfiles: state.importProfiles.filter(p => p.companyId !== action.payload),
        };
    case 'ADD_IMPORT_PROFILE':
        return { ...state, importProfiles: [...state.importProfiles, action.payload] };
    case 'UPDATE_IMPORT_PROFILE':
        return { ...state, importProfiles: state.importProfiles.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_IMPORT_PROFILE':
        return { ...state, importProfiles: state.importProfiles.filter(p => p.id !== action.payload) };
    case 'ADD_OFFICE_LOCATION':
        return { ...state, officeLocations: [...state.officeLocations, action.payload] };
    case 'UPDATE_OFFICE_LOCATION':
        return { ...state, officeLocations: state.officeLocations.map(o => o.id === action.payload.id ? action.payload : o) };
    case 'DELETE_OFFICE_LOCATION':
        return { ...state, officeLocations: state.officeLocations.filter(o => o.id !== action.payload) };
    case 'UPDATE_TRIP_SETTINGS':
      return { ...state, tripSettings: action.payload };
    case 'UPDATE_FINANCIAL_GOALS':
      return { ...state, financialGoals: action.payload };
    case 'SET_EDITING_TARGET':
      return { ...state, editingTarget: action.payload };
    case 'SET_PRINT_REQUEST':
      return { ...state, printRequest: action.payload };
    default:
      return state;
  }
};

// --- CONTEXT ---
interface AppContextProps {
  state: AppState;
  isLoading: boolean;
  // Action functions
  addWorkOrderType: (type: WorkOrderType) => Promise<void>;
  updateWorkOrderType: (type: WorkOrderType) => Promise<void>;
  deleteWorkOrderType: (id: string) => Promise<void>;
  toggleArchiveWorkOrderType: (type: WorkOrderType) => Promise<void>;
  addWorkOrder: (order: WorkOrder) => Promise<void>;
  updateWorkOrder: (order: WorkOrder) => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (trip: Trip) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  addCompany: (company: Company) => Promise<void>;
  updateCompany: (company: Company) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  toggleArchiveCompany: (company: Company) => Promise<void>;
  addImportProfile: (profile: ImportProfile) => Promise<void>;
  updateImportProfile: (profile: ImportProfile) => Promise<void>;
  deleteImportProfile: (id: string) => Promise<void>;
  addOfficeLocation: (office: OfficeLocation) => Promise<void>;
  updateOfficeLocation: (office: OfficeLocation) => Promise<void>;
  deleteOfficeLocation: (id: string) => Promise<void>;
  updateTripSettings: (settings: TripSettings) => Promise<void>;
  updateFinancialGoals: (goals: FinancialGoals) => Promise<void>;
  // Simple state setters that don't need persistence
  setEditingTarget: (target: { type: 'company' | 'workOrderType', id: string } | null) => void;
  setPrintRequest: (request: PrintRequest | null) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

// --- PROVIDER ---
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, emptyState);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dataService.loadState().then(initialState => {
      dispatch({ type: 'SET_STATE', payload: initialState });
      setIsLoading(false);
    }).catch(error => {
      console.error("Failed to load initial state:", error);
      setIsLoading(false);
    });
  }, []);

  // --- Action Implementations ---
  const addWorkOrderType = useCallback(async (type: WorkOrderType) => {
    const newType = await dataService.addWorkOrderType(type);
    dispatch({ type: 'ADD_WORK_ORDER_TYPE', payload: newType });
  }, []);
  const updateWorkOrderType = useCallback(async (type: WorkOrderType) => {
    const updatedType = await dataService.updateWorkOrderType(type);
    dispatch({ type: 'UPDATE_WORK_ORDER_TYPE', payload: updatedType });
  }, []);
  const deleteWorkOrderType = useCallback(async (id: string) => {
    const deletedId = await dataService.deleteWorkOrderType(id);
    dispatch({ type: 'DELETE_WORK_ORDER_TYPE', payload: deletedId });
  }, []);
  const toggleArchiveWorkOrderType = useCallback(async (type: WorkOrderType) => {
    await updateWorkOrderType({ ...type, isArchived: !type.isArchived });
  }, [updateWorkOrderType]);
  const addWorkOrder = useCallback(async (order: WorkOrder) => {
    const newOrder = await dataService.addWorkOrder(order);
    dispatch({ type: 'ADD_WORK_ORDER', payload: newOrder });
  }, []);
  const updateWorkOrder = useCallback(async (order: WorkOrder) => {
    const updatedOrder = await dataService.updateWorkOrder(order);
    dispatch({ type: 'UPDATE_WORK_ORDER', payload: updatedOrder });
  }, []);
  const addTrip = useCallback(async (trip: Trip) => {
    const newTrip = await dataService.addTrip(trip);
    dispatch({ type: 'ADD_TRIP', payload: newTrip });
  }, []);
  const updateTrip = useCallback(async (trip: Trip) => {
    const updatedTrip = await dataService.updateTrip(trip);
    dispatch({ type: 'UPDATE_TRIP', payload: updatedTrip });
  }, []);
  const deleteTrip = useCallback(async (id: string) => {
    const deletedId = await dataService.deleteTrip(id);
    dispatch({ type: 'DELETE_TRIP', payload: deletedId });
  }, []);
  const addCompany = useCallback(async (company: Company) => {
    const newCompany = await dataService.addCompany(company);
    dispatch({ type: 'ADD_COMPANY', payload: newCompany });
  }, []);
  const updateCompany = useCallback(async (company: Company) => {
    const updatedCompany = await dataService.updateCompany(company);
    dispatch({ type: 'UPDATE_COMPANY', payload: updatedCompany });
  }, []);
  const deleteCompany = useCallback(async (id: string) => {
    const deletedId = await dataService.deleteCompany(id);
    dispatch({ type: 'DELETE_COMPANY', payload: deletedId });
  }, []);
  const toggleArchiveCompany = useCallback(async (company: Company) => {
    await updateCompany({ ...company, isArchived: !company.isArchived });
  }, [updateCompany]);
  const addImportProfile = useCallback(async (profile: ImportProfile) => {
    const newProfile = await dataService.addImportProfile(profile);
    dispatch({ type: 'ADD_IMPORT_PROFILE', payload: newProfile });
  }, []);
  const updateImportProfile = useCallback(async (profile: ImportProfile) => {
    const updatedProfile = await dataService.updateImportProfile(profile);
    dispatch({ type: 'UPDATE_IMPORT_PROFILE', payload: updatedProfile });
  }, []);
  const deleteImportProfile = useCallback(async (id: string) => {
    const deletedId = await dataService.deleteImportProfile(id);
    dispatch({ type: 'DELETE_IMPORT_PROFILE', payload: deletedId });
  }, []);
  const addOfficeLocation = useCallback(async (office: OfficeLocation) => {
    const newOffice = await dataService.addOfficeLocation(office);
    dispatch({ type: 'ADD_OFFICE_LOCATION', payload: newOffice });
  }, []);
  const updateOfficeLocation = useCallback(async (office: OfficeLocation) => {
    const updatedOffice = await dataService.updateOfficeLocation(office);
    dispatch({ type: 'UPDATE_OFFICE_LOCATION', payload: updatedOffice });
  }, []);
  const deleteOfficeLocation = useCallback(async (id: string) => {
    const deletedId = await dataService.deleteOfficeLocation(id);
    dispatch({ type: 'DELETE_OFFICE_LOCATION', payload: deletedId });
  }, []);
  const updateTripSettings = useCallback(async (settings: TripSettings) => {
    const updatedSettings = await dataService.updateTripSettings(settings);
    dispatch({ type: 'UPDATE_TRIP_SETTINGS', payload: updatedSettings });
  }, []);
  const updateFinancialGoals = useCallback(async (goals: FinancialGoals) => {
    const updatedGoals = await dataService.updateFinancialGoals(goals);
    dispatch({ type: 'UPDATE_FINANCIAL_GOALS', payload: updatedGoals });
  }, []);
  const setEditingTarget = useCallback((target: { type: 'company' | 'workOrderType', id: string } | null) => {
    dispatch({ type: 'SET_EDITING_TARGET', payload: target });
  }, []);
  const setPrintRequest = useCallback((request: PrintRequest | null) => {
    dispatch({ type: 'SET_PRINT_REQUEST', payload: request });
  }, []);
  
  const value = {
    state, isLoading, addWorkOrderType, updateWorkOrderType, deleteWorkOrderType,
    toggleArchiveWorkOrderType, addWorkOrder, updateWorkOrder, addTrip, updateTrip, deleteTrip,
    addCompany, updateCompany, deleteCompany, toggleArchiveCompany, addImportProfile, updateImportProfile,
    deleteImportProfile, addOfficeLocation, updateOfficeLocation, deleteOfficeLocation,
    updateTripSettings, updateFinancialGoals, setEditingTarget, setPrintRequest,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// --- HOOK ---
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
