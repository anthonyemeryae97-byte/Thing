
import React, { useState, useEffect, ReactNode, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { WorkOrderType, Company, ImportProfile, CsvColumnMapping, OfficeLocation, TripGoal, TripGoalSetting } from '../types';
import { CompanyEditorModal } from '../components/CompanyEditorModal';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { ChevronUpIcon } from '../components/icons/ChevronUpIcon';
import { AddressAutocomplete } from '../components/AddressAutocomplete';

type ModalState = {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: (() => void) | null;
  confirmText: string;
  isAlert?: boolean;
};

type SettingsView = 'main' | 'types' | 'companies';

const goalLabels: Record<TripGoal, { title: string; description: string }> = {
  [TripGoal.HOURLY_RATE]: { title: 'Maximize Hourly Rate', description: 'Prioritizes routes that yield the most profit for time spent.' },
  [TripGoal.PER_MILE_RATE]: { title: 'Maximize Per-Mile Rate', description: 'Prioritizes routes that are efficient in terms of distance.' },
  [TripGoal.TOTAL_PAYOUT]: { title: 'Maximize Total Payout', description: 'Prioritizes routes with the highest gross revenue.' },
  [TripGoal.STOP_COUNT]: { title: 'Maximize Number of Stops', description: 'Prioritizes completing as many jobs as possible.' },
};

const SettingsScreen: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const [view, setView] = useState<SettingsView>('main');

  // Modals
  const [editingType, setEditingType] = useState<WorkOrderType | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingProfile, setEditingProfile] = useState<ImportProfile | null>(null);
  const [editingOffice, setEditingOffice] = useState<OfficeLocation | null>(null);
  const [profileCompanyId, setProfileCompanyId] = useState<string | null>(null);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', message: '', onConfirm: null, confirmText: 'OK' });

  // --- Cross-screen Editing Handler ---
  useEffect(() => {
    if (state.editingTarget) {
      const { type, id } = state.editingTarget;
      if (type === 'workOrderType') {
        const typeToEdit = state.workOrderTypes.find(t => t.id === id);
        if (typeToEdit) {
          setView('types');
          openTypeModalForEdit(typeToEdit);
        }
      } else if (type === 'company') {
        const companyToEdit = state.companies.find(c => c.id === id);
        if (companyToEdit) {
          setView('companies');
          openCompanyModalForEdit(companyToEdit);
        }
      }
      // Clear the target once handled
      dispatch({ type: 'SET_EDITING_TARGET', payload: null });
    }
  }, [state.editingTarget, state.workOrderTypes, state.companies, dispatch]);


  const closeConfirmationModal = () => setModalState({ ...modalState, isOpen: false });

  // --- Work Order Type Handlers ---
  const openTypeModalForNew = (companyId?: string) => {
    setEditingType({
      id: '', typeName: '', defaultCompanyId: companyId || state.companies.find(c => !c.isArchived)?.id || '', defaultBaseRate: 0, defaultResourcesNeeded: [], isArchived: false, defaultServiceTimeSeconds: 0,
    });
    setIsTypeModalOpen(true);
  };
  const openTypeModalForEdit = (type: WorkOrderType) => {
    setEditingType(type);
    setIsTypeModalOpen(true);
  };
  const closeTypeModal = () => {
    setIsTypeModalOpen(false);
    setEditingType(null);
  };
  const handleSaveType = (type: WorkOrderType) => {
    if (!type.defaultCompanyId) {
      alert("Please select a default company.");
      return;
    }
    if (type.id) {
      dispatch({ type: 'UPDATE_WORK_ORDER_TYPE', payload: type });
    } else {
      dispatch({ type: 'ADD_WORK_ORDER_TYPE', payload: { ...type, id: Date.now().toString() } });
    }
    closeTypeModal();
  };

  // --- Company Handlers ---
  const openCompanyModalForNew = () => {
    setEditingCompany({ id: '', name: '', contactRep: '', contactEmail: '', contactPhone: '', isArchived: false });
    setIsCompanyModalOpen(true);
  };
  const openCompanyModalForEdit = (company: Company) => {
    setEditingCompany(company);
    setIsCompanyModalOpen(true);
  };
  const closeCompanyModal = () => {
    setIsCompanyModalOpen(false);
    setEditingCompany(null);
  };
  const handleSaveCompany = (company: Company) => {
    if (company.id) {
      dispatch({ type: 'UPDATE_COMPANY', payload: company });
    } else {
      dispatch({ type: 'ADD_COMPANY', payload: { ...company, id: Date.now().toString() } });
    }
    closeCompanyModal();
  };

  // --- Office Location Handlers ---
  const openOfficeModalForNew = () => {
    setEditingOffice({ id: '', name: 'Office', address: '' });
    setIsOfficeModalOpen(true);
  };
  const openOfficeModalForEdit = (office: OfficeLocation) => {
    setEditingOffice(office);
    setIsOfficeModalOpen(true);
  };
  const closeOfficeModal = () => {
    setIsOfficeModalOpen(false);
    setEditingOffice(null);
  };
  const handleSaveOffice = (office: OfficeLocation) => {
    if (office.id) {
        dispatch({ type: 'UPDATE_OFFICE_LOCATION', payload: office });
    } else {
        dispatch({ type: 'ADD_OFFICE_LOCATION', payload: { ...office, id: Date.now().toString() } });
    }
    closeOfficeModal();
  };
  

  const renderView = () => {
    switch (view) {
        case 'types':
            return <TypesView setView={setView} openModalForNew={openTypeModalForNew} openModalForEdit={openTypeModalForEdit} setModalState={setModalState} />;
        case 'companies':
            return <CompaniesView 
                      setView={setView} 
                      openCompanyModalForNew={openCompanyModalForNew} 
                      openCompanyModalForEdit={openCompanyModalForEdit}
                      openTypeModalForNew={openTypeModalForNew}
                      openProfileModalForNew={(companyId: string) => { setEditingProfile({ id: '', name: '', mapping: {}, companyId }); setProfileCompanyId(companyId); setIsProfileModalOpen(true); }}
                      openProfileModalForEdit={(profile: ImportProfile) => { setEditingProfile(profile); setProfileCompanyId(profile.companyId); setIsProfileModalOpen(true); }}
                      setModalState={setModalState}
                    />;
        case 'main':
        default:
            return <SettingsMenu 
                      setView={setView} 
                      openOfficeModalForNew={openOfficeModalForNew} 
                      openOfficeModalForEdit={openOfficeModalForEdit} 
                      setModalState={setModalState}
                    />;
    }
  }

  return (
    <div className="space-y-8">
      {renderView()}
      
      {/* --- Modals --- */}
      {isTypeModalOpen && editingType && (
        <TypeEditorModal type={editingType} companies={state.companies} onSave={handleSaveType} onClose={closeTypeModal} />
      )}
      {isCompanyModalOpen && editingCompany && (
        <CompanyEditorModal company={editingCompany} onSave={handleSaveCompany} onClose={closeCompanyModal} />
      )}
      {isProfileModalOpen && editingProfile && profileCompanyId && (
        <ImportProfileEditorModal profile={editingProfile} onSave={(profile) => { if (profile.id) { dispatch({ type: 'UPDATE_IMPORT_PROFILE', payload: profile }); } else { dispatch({ type: 'ADD_IMPORT_PROFILE', payload: { ...profile, id: Date.now().toString() } }); } setIsProfileModalOpen(false);}} onClose={() => setIsProfileModalOpen(false)} />
      )}
      {isOfficeModalOpen && editingOffice && (
        <OfficeLocationEditorModal office={editingOffice} onSave={handleSaveOffice} onClose={closeOfficeModal} />
      )}
      {modalState.isOpen && (
        <ConfirmationModal {...modalState} onCancel={closeConfirmationModal} />
      )}
    </div>
  );
};


// --- VIEWS ---

const SettingsMenu: React.FC<{setView: (view: SettingsView) => void, openOfficeModalForNew: () => void, openOfficeModalForEdit: (office: OfficeLocation) => void, setModalState: React.Dispatch<React.SetStateAction<ModalState>>}> = ({ setView, openOfficeModalForNew, openOfficeModalForEdit, setModalState }) => {
    const { state, dispatch } = useAppContext();
    
    const handleTripSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, valueAsNumber } = e.target;
        let value = valueAsNumber || 0;
        if (name === 'maxTripTimeSeconds') {
            value = value * 3600; // convert hours from input to seconds for state
        }
        dispatch({ type: 'UPDATE_TRIP_SETTINGS', payload: { [name]: value } });
    };

    const handleFinancialGoalsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, valueAsNumber } = e.target;
        dispatch({ type: 'UPDATE_FINANCIAL_GOALS', payload: { [name]: valueAsNumber || 0 } });
    };
    
    const handleDeleteOffice = (office: OfficeLocation) => {
         setModalState({
            isOpen: true,
            title: 'Confirm Deletion',
            message: `Are you sure you want to permanently delete the office "${office.name}"?`,
            onConfirm: () => {
                dispatch({ type: 'DELETE_OFFICE_LOCATION', payload: office.id });
                setModalState(s => ({...s, isOpen: false}));
            },
            confirmText: 'Delete Permanently',
        });
    };

    const handlePrioritiesChange = (newPriorities: TripGoalSetting[]) => {
        dispatch({ type: 'UPDATE_TRIP_PRIORITIES', payload: newPriorities });
    }

    return (
        <div className="space-y-6">
            <SettingsButton title="Work Order Types" description="Define the types of jobs you perform" onClick={() => setView('types')} />
            <SettingsButton title="Companies & Profiles" description="Manage clients and their CSV import profiles" onClick={() => setView('companies')} />
            
            <CollapsibleSection title="Trip Settings">
                {/* Hard Limits */}
                <div>
                    <h3 className="text-md font-semibold text-gray-800 mb-1">Hard Limits</h3>
                    <p className="text-sm text-gray-600 mb-4">The AI trip planner will not generate routes that exceed these limits.</p>
                    <div className="space-y-4">
                        <SettingsInput label="Maximum trip time (hours)" description="What is the longest you want this trip to last (travel + service time)?" name="maxTripTimeSeconds" type="number" value={state.tripSettings.maxTripTimeSeconds / 3600} onChange={handleTripSettingsChange} />
                        <SettingsInput label="Maximum Trip Mileage" description="What is the absolute maximum total distance you are willing to drive?" name="maxTripMileage" type="number" value={state.tripSettings.maxTripMileage} onChange={handleTripSettingsChange} />
                    </div>
                </div>
                
                {/* Trip Priorities - Nested and styled */}
                <div className="mt-6 p-4 rounded-lg bg-purple-50 border border-purple-200">
                    <h3 className="text-md font-semibold text-purple-800 mb-1">✨️ Trip Priorities</h3>
                    <p className="text-sm text-purple-700 mb-4">Drag to reorder your route optimization priorities. The AI will attempt to build the best route based on this order. Disable goals you don't want to consider.</p>
                    <DraggableList items={state.tripSettings.priorities} onReorder={handlePrioritiesChange} />
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Financial Goals / KPIs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SettingsInput label="Target Hourly Rate ($)" description="Soft goal: Minimum hourly rate you aim to achieve." name="targetHourlyRate" type="number" value={state.financialGoals.targetHourlyRate} onChange={handleFinancialGoalsChange} />
                    <SettingsInput label="Target Per-Mile Rate ($)" description="Soft goal: Minimum amount per mile driven." name="targetPerMileRate" type="number" step="0.01" value={state.financialGoals.targetPerMileRate} onChange={handleFinancialGoalsChange} />
                </div>
                 <div className="mt-4">
                    <SettingsInput label="Target Trip Payout ($)" description="Soft goal: Desired total payout for a single trip." name="targetTripPayout" type="number" value={state.financialGoals.targetTripPayout} onChange={handleFinancialGoalsChange} />
                </div>
            </CollapsibleSection>

             <CollapsibleSection title="Office Locations" addButton={{ text: 'Add Office', onClick: openOfficeModalForNew }}>
                {state.officeLocations.length > 0 ? (
                    <ul className="divide-y divide-gray-200 -mx-4 -mb-4">
                        {state.officeLocations.map(office => (
                            <li key={office.id} className="p-4 flex justify-between items-center">
                                <div><p className="font-semibold text-lg">{office.name}</p><p className="text-gray-600">{office.address}</p></div>
                                <div className="space-x-3 flex-shrink-0">
                                    <button onClick={() => openOfficeModalForEdit(office)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                    <button onClick={() => handleDeleteOffice(office)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : <p className="text-center text-gray-500 py-4">No office locations have been added.</p>}
            </CollapsibleSection>
        </div>
    );
}

const TypesView: React.FC<{setView: (view: SettingsView) => void, openModalForNew: () => void, openModalForEdit: (type: WorkOrderType) => void, setModalState: React.Dispatch<React.SetStateAction<ModalState>>}> = ({ setView, openModalForNew, openModalForEdit, setModalState }) => {
    const { state, dispatch } = useAppContext();
    const getCompanyName = (companyId: string) => state.companies.find(c => c.id === companyId)?.name || 'N/A';

    const handleDeleteType = (type: WorkOrderType) => {
        const isTypeInUse = state.workOrders.some(wo => wo.typeName === type.typeName);
        if (isTypeInUse) {
            setModalState({ isOpen: true, title: 'Archive Work Order Type?', message: 'This type is attached to existing work orders and cannot be deleted. Would you like to archive it instead?', onConfirm: () => { dispatch({ type: 'TOGGLE_ARCHIVE_WORK_ORDER_TYPE', payload: type.id }); setModalState(s => ({...s, isOpen: false})); }, confirmText: 'Yes, Archive' });
        } else {
            setModalState({ isOpen: true, title: 'Confirm Deletion', message: `Are you sure you want to permanently delete the type "${type.typeName}"?`, onConfirm: () => { dispatch({ type: 'DELETE_WORK_ORDER_TYPE', payload: type.id }); setModalState(s => ({...s, isOpen: false})); }, confirmText: 'Delete Permanently' });
        }
    };

    return (
        <div>
            <button onClick={() => setView('main')} className="text-blue-600 hover:underline mb-4">&larr; Back to Settings</button>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Work Order Types</h2>
                <button onClick={openModalForNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition">Add New</button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {state.workOrderTypes.map(type => (
                    <li key={type.id} className={`p-4 flex justify-between items-center transition-colors ${type.isArchived ? 'bg-gray-100' : ''}`}>
                        <div className={`${type.isArchived ? 'opacity-50' : ''}`}>
                            <p className="font-semibold text-lg">{type.typeName} {type.isArchived && '(Archived)'}</p>
                            <p className="text-gray-600">{getCompanyName(type.defaultCompanyId)} - ${type.defaultBaseRate} - {type.defaultServiceTimeSeconds/60} min</p>
                        </div>
                        <div className="space-x-3 flex-shrink-0">
                            <button onClick={() => openModalForEdit(type)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                            <button onClick={() => dispatch({ type: 'TOGGLE_ARCHIVE_WORK_ORDER_TYPE', payload: type.id })} className="text-yellow-600 hover:text-yellow-800 font-medium">{type.isArchived ? 'Activate' : 'Archive'}</button>
                            <button onClick={() => handleDeleteType(type)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                        </div>
                    </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const CompaniesView: React.FC<{setView: (view: SettingsView) => void, openCompanyModalForNew: () => void, openCompanyModalForEdit: (company: Company) => void, openTypeModalForNew: (companyId: string) => void, openProfileModalForNew: (companyId: string) => void, openProfileModalForEdit: (profile: ImportProfile) => void, setModalState: React.Dispatch<React.SetStateAction<ModalState>>}> = (props) => {
    const { setView, openCompanyModalForNew, openCompanyModalForEdit, openTypeModalForNew, openProfileModalForNew, openProfileModalForEdit, setModalState } = props;
    const { state, dispatch } = useAppContext();
    const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);

    const handleDeleteCompany = (company: Company) => {
        const isCompanyInUse = state.workOrderTypes.some(wot => wot.defaultCompanyId === company.id && !wot.isArchived);
        if (isCompanyInUse) {
            setModalState({ isOpen: true, isAlert: true, title: 'Action Prohibited', message: 'Cannot delete this company as it is used by active work order types.', onConfirm: () => setModalState(s => ({...s, isOpen: false})), confirmText: 'OK' });
            return;
        }
        setModalState({ isOpen: true, title: 'Confirm Deletion', message: `Delete "${company.name}"? This will also delete all of its import profiles.`, onConfirm: () => { dispatch({ type: 'DELETE_COMPANY', payload: company.id }); setModalState(s => ({...s, isOpen: false})); }, confirmText: 'Delete Permanently' });
    };

    const handleDeleteProfile = (profile: ImportProfile) => {
        setModalState({ isOpen: true, title: 'Confirm Deletion', message: `Delete the profile "${profile.name}"?`, onConfirm: () => { dispatch({ type: 'DELETE_IMPORT_PROFILE', payload: profile.id }); setModalState(s => ({...s, isOpen: false})); }, confirmText: 'Delete Permanently' });
    };

    return (
        <div>
            <button onClick={() => setView('main')} className="text-blue-600 hover:underline mb-4">&larr; Back to Settings</button>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Companies & Profiles</h2>
                <button onClick={openCompanyModalForNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition">Add New Company</button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {state.companies.map(company => {
                    const companyProfiles = state.importProfiles.filter(p => p.companyId === company.id);
                    const companyTypes = state.workOrderTypes.filter(t => t.defaultCompanyId === company.id);
                    return (
                        <details key={company.id} className="border-b last:border-b-0" open={expandedCompanyId === company.id}>
                            <summary onClick={(e) => { e.preventDefault(); setExpandedCompanyId(prev => prev === company.id ? null : company.id)}} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 list-none">
                                <div className={`transition-opacity ${company.isArchived ? 'opacity-50' : ''}`}>
                                    <p className="font-semibold text-lg">{company.name} {company.isArchived && '(Archived)'}</p>
                                    <p className="text-gray-600">{company.contactRep} - {company.contactEmail}</p>
                                </div>
                                <div className="space-x-3 flex-shrink-0">
                                    <button onClick={(e) => {e.stopPropagation(); openCompanyModalForEdit(company)}} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                    <button onClick={(e) => {e.stopPropagation(); dispatch({ type: 'TOGGLE_ARCHIVE_COMPANY', payload: company.id })}} className="text-yellow-600 hover:text-yellow-800 font-medium">{company.isArchived ? 'Activate' : 'Archive'}</button>
                                    <button onClick={(e) => {e.stopPropagation(); handleDeleteCompany(company)}} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                                </div>
                            </summary>
                            <div className="bg-gray-50 p-4 border-t space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-gray-700">Work Order Types</h4><button onClick={() => openTypeModalForNew(company.id)} className="bg-green-600 text-white px-3 py-1 text-sm rounded-md shadow-sm hover:bg-green-700">Add Type</button></div>
                                    {companyTypes.length > 0 ? (<ul className="space-y-1">{companyTypes.map(type => (<li key={type.id} className="text-sm p-2 bg-white rounded border flex justify-between"><span>{type.typeName} {type.isArchived && '(Archived)'}</span><span>${type.defaultBaseRate}</span></li>))}</ul>) : <p className="text-sm text-gray-500 text-center py-2">No work order types for this company.</p>}
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2"><h4 className="font-semibold text-gray-700">Import Profiles</h4><button onClick={() => openProfileModalForNew(company.id)} className="bg-green-600 text-white px-3 py-1 text-sm rounded-md shadow-sm hover:bg-green-700">Add Profile</button></div>
                                    {companyProfiles.length > 0 ? (<ul className="space-y-2">{companyProfiles.map(profile => (<li key={profile.id} className="p-2 bg-white rounded-md flex justify-between items-center border"><div><p className="font-medium">{profile.name}</p>{company.defaultImportProfileId === profile.id && <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">Default</span>}</div><div className="space-x-2">{company.defaultImportProfileId !== profile.id ? (<button onClick={() => dispatch({ type: 'UPDATE_COMPANY', payload: { ...company, defaultImportProfileId: profile.id } })} className="text-xs font-medium text-blue-600 hover:underline">Set Default</button>) : (<button onClick={() => dispatch({ type: 'UPDATE_COMPANY', payload: { ...company, defaultImportProfileId: undefined } })} className="text-xs font-medium text-gray-500 hover:underline">Unset</button>)}<button onClick={() => openProfileModalForEdit(profile)} className="text-xs font-medium text-gray-600 hover:underline">Edit</button><button onClick={() => handleDeleteProfile(profile)} className="text-xs font-medium text-red-600 hover:underline">Delete</button></div></li>))}</ul>) : <p className="text-sm text-gray-500 text-center py-2">No import profiles for this company.</p>}
                                </div>
                            </div>
                        </details>
                    )
                })}
            </div>
        </div>
    );
};


// --- GENERIC COMPONENTS ---
const inputClasses = "w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClasses = "block text-sm font-medium text-gray-700 mb-1";

const SettingsButton: React.FC<{title: string, description: string, onClick: () => void}> = ({ title, description, onClick }) => (
    <button onClick={onClick} className="w-full text-left bg-white p-4 rounded-lg shadow hover:bg-gray-50 transition hover:shadow-md flex justify-between items-center">
        <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <p className="text-gray-500">{description}</p>
        </div>
        <span className="text-gray-400">&rarr;</span>
    </button>
);

const CollapsibleSection: React.FC<{title: string, children: ReactNode, addButton?: {text: string, onClick: () => void}, titleClassName?: string }> = ({ title, children, addButton, titleClassName }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
         <div className="bg-white rounded-lg shadow">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 text-left">
                <div className="flex items-center gap-4">
                    <h2 className={`text-xl font-semibold ${titleClassName || ''}`}>{title}</h2>
                    {addButton && <button onClick={(e)=>{e.stopPropagation(); addButton.onClick()}} className="bg-blue-600 text-white px-3 py-1 text-sm rounded-md shadow-sm hover:bg-blue-700">{addButton.text}</button>}
                </div>
                {isOpen ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
            </button>
            {isOpen && <div className="p-4 border-t space-y-4">{children}</div>}
        </div>
    )
}

interface SettingsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    description: string;
}
const SettingsInput: React.FC<SettingsInputProps> = ({ label, description, ...props }) => (
    <div>
        <label htmlFor={props.name} className={labelClasses}>{label}</label>
        <input id={props.name} {...props} className={inputClasses} />
        <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
);

// --- DRAGGABLE LIST FOR PRIORITIES ---
interface DraggableListProps {
    items: TripGoalSetting[];
    onReorder: (items: TripGoalSetting[]) => void;
}

const DraggableList: React.FC<DraggableListProps> = ({ items, onReorder }) => {
    const [listItems, setListItems] = useState(items);
    const draggedItem = useRef<TripGoalSetting | null>(null);
    const dropTarget = useRef<TripGoalSetting | null>(null);

    useEffect(() => {
        setListItems(items);
    }, [items]);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, item: TripGoalSetting) => {
        draggedItem.current = item;
        e.dataTransfer.effectAllowed = 'move';
        // For firefox
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML); 
    };

    const handleDragOver = (e: React.DragEvent<HTMLLIElement>, item: TripGoalSetting) => {
        e.preventDefault();
        if (draggedItem.current?.goal === item.goal) return;
        dropTarget.current = item;

        const reordered = [...listItems];
        const draggedIndex = reordered.findIndex(i => i.goal === draggedItem.current!.goal);
        const targetIndex = reordered.findIndex(i => i.goal === item.goal);
        
        const [removed] = reordered.splice(draggedIndex, 1);
        reordered.splice(targetIndex, 0, removed);
        
        setListItems(reordered);
    };

    const handleDragEnd = () => {
        onReorder(listItems);
        draggedItem.current = null;
        dropTarget.current = null;
    };

    const handleToggle = (goal: TripGoal) => {
        const updated = listItems.map(item =>
            item.goal === goal ? { ...item, enabled: !item.enabled } : item
        );
        onReorder(updated);
    };

    return (
        <ul className="space-y-2">
            {listItems.map((item, index) => (
                <li
                    key={item.goal}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragOver={(e) => handleDragOver(e, item)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 flex items-center justify-between rounded-lg border transition-all ${!item.enabled ? 'bg-gray-100' : 'bg-purple-50 border-purple-200'} cursor-grab active:cursor-grabbing hover:shadow-sm`}
                >
                    <div className="flex items-center">
                        <div className="text-purple-400 mr-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="opacity-50"><path d="M5 15h2V9H5v6zm4-2h2V9H9v4zm4 0h2V9h-2v4zm4 0h2V9h-2v4zm-8 6h2v-4H9v4zm4 0h2v-4h-2v4z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg>
                        </div>
                        <span className={`font-semibold text-gray-500 mr-2 transition-opacity ${!item.enabled ? 'opacity-50' : ''}`}>#{index + 1}</span>
                        <div className={`transition-opacity ${!item.enabled ? 'opacity-50' : ''}`}>
                            <p className="font-medium text-gray-800">{goalLabels[item.goal].title}</p>
                            <p className="text-xs text-gray-500">{goalLabels[item.goal].description}</p>
                        </div>
                    </div>
                    {/* Toggle Switch */}
                    <button
                        onClick={() => handleToggle(item.goal)}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${item.enabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                        aria-label={`Toggle ${goalLabels[item.goal].title}`}
                    >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${item.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </li>
            ))}
        </ul>
    );
};


// --- MODALS ---

interface TypeEditorModalProps {
  type: WorkOrderType;
  companies: Company[];
  onSave: (type: WorkOrderType) => void;
  onClose: () => void;
}
const TypeEditorModal: React.FC<TypeEditorModalProps> = ({ type, companies, onSave, onClose }) => {
  const [formData, setFormData] = useState(type);
  const availableCompanies = companies.filter(c => !c.isArchived || c.id === type.defaultCompanyId);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue: any = value;
    if (name === 'defaultBaseRate') processedValue = parseFloat(value) || 0;
    else if (name === 'defaultServiceTimeSeconds') processedValue = (parseFloat(value) || 0) * 60;
    setFormData(prev => ({ ...prev, [name]: processedValue } as WorkOrderType));
  };
  const handleResourcesChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, defaultResourcesNeeded: e.target.value.split(',').map(s => s.trim()) }));
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">{type.id ? 'Edit' : 'Add'} Work Order Type</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="typeName" className={labelClasses}>Type Name</label><input id="typeName" name="typeName" value={formData.typeName} onChange={handleChange} placeholder="Type Name" className={inputClasses} required /></div>
          <div><label htmlFor="defaultCompanyId" className={labelClasses}>Default Company</label><select id="defaultCompanyId" name="defaultCompanyId" value={formData.defaultCompanyId} onChange={handleChange} className={inputClasses} required><option value="" disabled>Select a Company</option>{availableCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="defaultBaseRate" className={labelClasses}>Base Rate ($)</label><input id="defaultBaseRate" name="defaultBaseRate" value={formData.defaultBaseRate} onChange={handleChange} type="number" placeholder="150" className={inputClasses} /></div>
            <div><label htmlFor="defaultServiceTimeSeconds" className={labelClasses}>Service Time (min)</label><input id="defaultServiceTimeSeconds" name="defaultServiceTimeSeconds" value={(formData.defaultServiceTimeSeconds || 0) / 60} onChange={handleChange} type="number" placeholder="e.g., 30" className={inputClasses} /></div>
          </div>
          <div><label htmlFor="resources" className={labelClasses}>Default Resources</label><input id="resources" value={formData.defaultResourcesNeeded.join(', ')} onChange={handleResourcesChange} placeholder="e.g., Notary Stamp, Scanner" className={inputClasses} /></div>
          <div className="flex justify-end space-x-2 pt-4"><button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save</button></div>
        </form>
      </div>
    </div>
  );
};

interface ImportProfileEditorModalProps {
  profile: ImportProfile;
  onSave: (profile: ImportProfile) => void;
  onClose: () => void;
}
const mappableFields: (keyof CsvColumnMapping)[] = ['orderId', 'dueDate', 'startDate', 'clientName', 'typeName', 'address1', 'address2', 'city', 'state', 'zip'];
const fieldLabels: Record<keyof CsvColumnMapping, string> = { orderId: 'Order ID', dueDate: 'Due Date', startDate: 'Start Date', clientName: 'Client Name', typeName: 'Work Order Type', address1: 'Address 1', address2: 'Address 2', city: 'City', state: 'State', zip: 'Zip Code' };
const ImportProfileEditorModal: React.FC<ImportProfileEditorModalProps> = ({ profile, onSave, onClose }) => {
    const [formData, setFormData] = useState(profile);
    // FIX: Correctly use e.target.name for the computed property to avoid using an undefined `name` variable.
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleMappingChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({...prev, mapping: {...prev.mapping, [e.target.name]: e.target.value}}));
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); }
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl"><h3 className="text-xl font-semibold mb-4">{profile.id ? 'Edit' : 'Add'} Import Profile</h3><form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="name" className={labelClasses}>Profile Name</label><input name="name" id="name" value={formData.name} onChange={handleChange} placeholder="e.g., Title Company Standard" className={inputClasses} required /></div><fieldset className="border p-4 rounded-lg"><legend className="text-base font-medium text-gray-900 px-2">CSV Column Mapping</legend><p className="text-sm text-gray-500 mb-4">Enter the exact column header name from your CSV file for each field.</p><div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">{mappableFields.map(field => (<div key={field}><label htmlFor={field} className={labelClasses}>{fieldLabels[field]}</label><input name={field} id={field} value={formData.mapping[field] || ''} onChange={handleMappingChange} placeholder={`e.g., ${fieldLabels[field]}`} className={inputClasses} /></div>))}</div></fieldset><div className="flex justify-end space-x-2 pt-4"><button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save Profile</button></div></form></div>
        </div>
    );
};

interface OfficeLocationEditorModalProps {
  office: OfficeLocation;
  onSave: (office: OfficeLocation) => void;
  onClose: () => void;
}
const OfficeLocationEditorModal: React.FC<OfficeLocationEditorModalProps> = ({ office, onSave, onClose }) => {
  const [formData, setFormData] = useState(office);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleAddressChange = (address: string) => setFormData(prev => ({...prev, address}));
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!formData.name.trim() || !formData.address.trim()) { alert("Office name and address cannot be empty."); return; } onSave(formData); };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"><h3 className="text-xl font-semibold mb-4">{office.id ? 'Edit' : 'Add'} Office Location</h3><form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="name" className={labelClasses}>Location Name</label><input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Main Office" className={inputClasses} required /></div><div><label htmlFor="address" className={labelClasses}>Address</label>{/* FIX: Added onCommit prop to satisfy AddressAutocompleteProps type requirement. */}
<AddressAutocomplete id="address" value={formData.address} onChange={handleAddressChange} onCommit={handleAddressChange} className={inputClasses} placeholder="123 Corporate Blvd, Anytown" /></div><div className="flex justify-end space-x-2 pt-4"><button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save Location</button></div></form></div>
    </div>
  );
};

interface ConfirmationModalProps extends ModalState { onCancel: () => void; }
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ title, message, onConfirm, onCancel, confirmText, isAlert }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">{title}</h3>
            <div className="text-gray-700 mb-6">{message}</div>
            <div className="flex justify-end space-x-3">{!isAlert && (<button type="button" onClick={onCancel} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>)}<button type="button" onClick={onConfirm || onCancel} className={`${isAlert ? 'bg-blue-600' : 'bg-red-600'} text-white px-4 py-2 rounded-lg ${isAlert ? 'hover:bg-blue-700' : 'hover:bg-red-700'}`}>{confirmText}</button></div>
        </div>
    </div>
);

export default SettingsScreen;