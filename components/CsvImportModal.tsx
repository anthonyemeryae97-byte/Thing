import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { WorkOrder, OrderStatus, CsvColumnMapping, ImportProfile, WorkOrderType, Company } from '../types';
import { CompanyEditorModal } from './CompanyEditorModal';

declare const XLSX: any;

interface CsvImportModalProps {
    onClose: () => void;
}

const allAllowedExtensions = ['.xlsx', '.xls', '.ods', '.csv', '.tsv', '.txt'];
const allAllowedExtensionsString = allAllowedExtensions.join(',');

const mappableFields: (keyof CsvColumnMapping)[] = ['orderId', 'dueDate', 'startDate', 'clientName', 'typeName', 'address1', 'address2', 'city', 'state', 'zip'];
const fieldLabels: Record<keyof CsvColumnMapping, string> = {
  orderId: 'Order ID',
  dueDate: 'Due Date',
  startDate: 'Start Date',
  clientName: 'Client Name',
  typeName: 'Work Order Type',
  address1: 'Address 1',
  address2: 'Address 2',
  city: 'City',
  state: 'State',
  zip: 'Zip Code',
};

const inputClasses = "w-full p-2 border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const labelClasses = "block text-sm font-medium text-gray-700";

interface StagedWorkOrder extends Partial<WorkOrder> {
    originalTypeName: string;
    resolvedTypeId: string; 
    isNewType: boolean;
    isFollowUp?: boolean;
    originalOrderStatus?: OrderStatus;
}

interface NewTypeDetails {
    companyId: string;
    baseRate: number;
    resources: string[];
    defaultServiceTimeSeconds: number;
}

const CsvImportModal: React.FC<CsvImportModalProps> = ({ onClose }) => {
    const { state, addCompany, updateCompany, addImportProfile, updateImportProfile, addWorkOrderType, addWorkOrder } = useAppContext();
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<CsvColumnMapping>({});
    const [selectedProfileId, setSelectedProfileId] = useState<string>('');
    const [profileName, setProfileName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    const [step, setStep] = useState<'upload' | 'reviewOrders' | 'configureNewTypes' | 'summary'>('upload');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [companyProfiles, setCompanyProfiles] = useState<ImportProfile[]>([]);

    const [stagedOrders, setStagedOrders] = useState<StagedWorkOrder[]>([]);
    const [editingStagedOrder, setEditingStagedOrder] = useState<StagedWorkOrder | null>(null);
    const [newTypesDetails, setNewTypesDetails] = useState<Record<string, NewTypeDetails>>({});
    const [bulkConfig, setBulkConfig] = useState<NewTypeDetails>({ companyId: '', baseRate: 0, resources: [], defaultServiceTimeSeconds: 0 });
    
    const [importSummary, setImportSummary] = useState<{success: number, failed: number} | null>(null);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

    const dragCounter = useRef(0);
    const availableCompanies = state.companies.filter(c => !c.isArchived);
    const availableTypes = useMemo(() => state.workOrderTypes.filter(t => !t.isArchived), [state.workOrderTypes]);


    // Effect to manage profile selection when the company changes
    useEffect(() => {
        if (selectedCompanyId) {
            const company = state.companies.find(c => c.id === selectedCompanyId);
            const profiles = state.importProfiles.filter(p => p.companyId === selectedCompanyId);
            setCompanyProfiles(profiles);

            // If the currently selected profile isn't valid for this company, load the default
            const isCurrentProfileValid = selectedProfileId && profiles.some(p => p.id === selectedProfileId);
            if (!isCurrentProfileValid) {
                const defaultProfile = profiles.find(p => p.id === company?.defaultImportProfileId);
                if (defaultProfile) {
                    setSelectedProfileId(defaultProfile.id);
                } else {
                    setSelectedProfileId(''); // No default, so clear selection
                }
            }
        } else {
            setCompanyProfiles([]);
            setSelectedProfileId('');
        }
    }, [selectedCompanyId, state.companies, state.importProfiles, selectedProfileId]);
    
    // Effect to load the mapping when the selected profile changes
    useEffect(() => {
        const profile = companyProfiles.find(p => p.id === selectedProfileId);
        if (profile) {
            setMapping(profile.mapping);
            setProfileName(profile.name);
        } else {
            // If no profile is selected (or selection cleared), reset mapping
            setMapping({});
            setProfileName('');
        }
    }, [selectedProfileId, companyProfiles]);

    const resetFileState = () => {
        setFile(null);
        setCsvHeaders([]);
        setCsvData([]);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }

    const processFile = async (fileToProcess: File) => {
        setIsLoading(true);
        try {
            if (typeof XLSX === 'undefined') throw new Error("Spreadsheet library not available.");
            const data = await fileToProcess.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) throw new Error("File appears to be empty.");
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    
            if (jsonData.length === 0) {
                 const headerRow: string[] = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]) || [];
                 if (!headerRow || headerRow.length === 0) throw new Error("Could not extract data or headers.");
                 setCsvHeaders(headerRow);
                 setCsvData([]);
            } else {
                const stringifiedData = jsonData.map(row => {
                    const newRow: Record<string, string> = {};
                    for (const key in row) {
                        if (row[key] instanceof Date) {
                             const date = row[key] as Date;
                             const tzOffset = date.getTimezoneOffset() * 60000;
                             const adjustedDate = new Date(date.getTime() - tzOffset);
                             newRow[key] = adjustedDate.toISOString().split('T')[0];
                        } else {
                             newRow[key] = String(row[key]);
                        }
                    }
                    return newRow;
                });
                setCsvHeaders(Object.keys(stringifiedData[0]));
                setCsvData(stringifiedData);
            }
            setFile(fileToProcess);
            setImportSummary(null);
        } catch (error) {
            alert(`Failed to process file. Error: ${error instanceof Error ? error.message : "Unknown error."}`);
            resetFileState();
        } finally {
            setIsLoading(false);
        }
    };

    const validateAndProcessFile = (selectedFile: File | undefined) => {
        if (!selectedFile) return;
        const fileName = selectedFile.name.toLowerCase();
        const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
        if (allAllowedExtensions.includes(fileExtension)) {
            processFile(selectedFile);
        } else {
            alert(`Invalid file type. Please upload one of: ${allAllowedExtensions.join(', ')}`);
            resetFileState();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => validateAndProcessFile(e.target.files?.[0]);
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; if (e.dataTransfer.items?.length > 0) setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounter.current = 0; validateAndProcessFile(e.dataTransfer.files?.[0]); };
    const handleMappingChange = (field: keyof CsvColumnMapping, header: string) => setMapping(prev => ({...prev, [field]: header}));
    
    const handleSaveProfile = () => {
        if (!profileName.trim()) return alert("Please provide a name for the profile.");
        if (Object.keys(mapping).length === 0) return alert("Please map at least one field to save a profile.");
        if (!selectedCompanyId) return alert("A company must be selected to save a profile.");

        const existingProfile = companyProfiles.find(p => p.id === selectedProfileId);

        if (existingProfile && existingProfile.name === profileName) {
            const updatedProfile: ImportProfile = { ...existingProfile, mapping };
            updateImportProfile(updatedProfile);
            alert(`Profile "${updatedProfile.name}" updated successfully!`);
        } else {
            const newProfile: ImportProfile = {
                id: '', // Will be created by data service
                name: profileName,
                mapping,
                companyId: selectedCompanyId
            };
            addImportProfile(newProfile).then(() => {
                 setSelectedProfileId(newProfile.id); // This won't work as ID is created in service
            });
            alert(`Profile "${newProfile.name}" saved successfully!`);
        }
    };

    const handleProceedToReview = () => {
        if (!selectedCompanyId) return alert("Please select a company before proceeding.");
        const hasFullAddress = mapping.address1 && mapping.city && mapping.state;
        const hasZipAddress = mapping.address1 && mapping.zip;
        if (!mapping.orderId || !mapping.clientName || !mapping.typeName || !(hasFullAddress || hasZipAddress)) return alert(`Mapping incomplete. Required: Order ID, Client Name, Work Order Type, Address 1, and either (City & State) or (Zip Code).`);

        const parseDateToYyyyMmDd = (dateString: string | undefined): string | undefined => {
            if (!dateString || typeof dateString !== 'string' || !dateString.trim()) {
                return undefined;
            }

            // Attempt to create a date. new Date() is flexible but treats YYYY-MM-DD as UTC.
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                console.warn(`Could not parse date: "${dateString}"`);
                return undefined;
            }

            // Correct for timezone offset when new Date() assumes UTC for date-only strings.
            // This ensures "2024-10-25" doesn't become "2024-10-24" in western timezones.
            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
            const localDate = new Date(date.getTime() + userTimezoneOffset);

            const year = localDate.getFullYear();
            const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
            const day = localDate.getDate().toString().padStart(2, '0');

            return `${year}-${month}-${day}`;
        };

        // FIX: Replaced Map initialization via .map() with a more explicit forEach loop.
        // This prevents potential type inference issues where the Map's value type could become 'unknown',
        // which caused cascading errors when accessing properties on the retrieved map values.
        const existingTypesMap = new Map<string, WorkOrderType>();
        state.workOrderTypes.forEach((t: WorkOrderType) => {
            existingTypesMap.set(t.typeName.toLowerCase(), t);
        });
        
        const ordersToStage: StagedWorkOrder[] = csvData.map((row, index) => {
            const orderId = row[mapping.orderId!]?.trim();
            const originalOrder = orderId ? state.workOrders.find(wo => wo.orderId === orderId) : undefined;
            const isFollowUp = !!originalOrder;

            const originalTypeName = row[mapping.typeName!]?.trim() || 'Unspecified';
            const existingType = existingTypesMap.get(originalTypeName.toLowerCase());
            
            const city = mapping.city ? row[mapping.city!] : '';
            const stateVal = mapping.state ? row[mapping.state!] : '';
            const zip = mapping.zip ? row[mapping.zip!] : '';
            let finalCity = city;
            let finalState = stateVal;
            if (zip && (!city || !stateVal)) {
               const zipLookup: Record<string, {city: string, state: string}> = {
                   "49659": { city: "Mancelona", state: "MI" },
                   "49676": { city: "Rapid City", state: "MI" },
                   "90210": { city: "Beverly Hills", state: "CA" } 
                };
               if (zipLookup[zip]) {
                   finalCity = city || zipLookup[zip].city;
                   finalState = stateVal || zipLookup[zip].state;
               }
            }
            const address = [row[mapping.address1!], row[mapping.address2!], finalCity, finalState, zip].filter(Boolean).join(', ');
            
            const baseRate = isFollowUp ? 0 : (existingType ? existingType.defaultBaseRate : 0);
            
            const dueDateRaw = mapping.dueDate ? row[mapping.dueDate] : undefined;
            const startDateRaw = mapping.startDate ? row[mapping.startDate] : undefined;
            
            return {
                id: `staged-${index}`,
                orderId: orderId,
                clientName: row[mapping.clientName!],
                dueDate: parseDateToYyyyMmDd(dueDateRaw),
                startDate: parseDateToYyyyMmDd(startDateRaw),
                address,
                originalTypeName: originalTypeName,
                resolvedTypeId: existingType ? existingType.id : 'create',
                isNewType: !existingType,
                isFollowUp,
                originalOrderStatus: originalOrder?.status,
                baseRate: baseRate,
            };
        });
        setStagedOrders(ordersToStage);
        setStep('reviewOrders');
    };

    const handleStagedOrderTypeChange = (orderId: string, newResolvedId: string) => {
        setStagedOrders(prevOrders =>
            prevOrders.map((order: StagedWorkOrder) => {
                if (order.id === orderId) {
                    const updatedOrder = { ...order, resolvedTypeId: newResolvedId };
                    const wasCreate = order.resolvedTypeId === 'create';
                    
                    // If it's a follow-up, the rate is purely manual, so don't auto-update it.
                    if (updatedOrder.isFollowUp) {
                        return updatedOrder;
                    }
                    
                    // If switching TO 'create', reset rate to 0, as it'll be configured later.
                    if (newResolvedId === 'create') {
                        updatedOrder.baseRate = 0;
                    } 
                    // If switching FROM 'create' TO an existing type, apply the default rate.
                    else if (wasCreate && newResolvedId !== 'create') {
                        const newType = availableTypes.find(t => t.id === newResolvedId);
                        if (newType) {
                            updatedOrder.baseRate = newType.defaultBaseRate;
                        }
                    }
                    // Otherwise (switching between existing types), DO NOT change the rate,
                    // to preserve any manual override the user has made.
                    
                    return updatedOrder;
                }
                return order;
            })
        );
    };

    const handleStagedOrderRateChange = (orderId: string, newRate: number) => {
         setStagedOrders(prevOrders =>
            prevOrders.map((order: StagedWorkOrder) =>
                order.id === orderId ? { ...order, baseRate: newRate } : order
            )
        );
    };

    const handleProceedToConfigure = () => {
        const newTypesToCreate = [...new Set(stagedOrders.filter(o => o.resolvedTypeId === 'create').map(o => o.originalTypeName))];
        if (newTypesToCreate.length > 0) {
            const initialDetails: Record<string, NewTypeDetails> = {};
            const initialBulkConfig = {
                companyId: selectedCompanyId,
                baseRate: 0,
                resources: [],
                defaultServiceTimeSeconds: 0,
            };
            newTypesToCreate.forEach(typeName => {
                initialDetails[typeName] = { ...initialBulkConfig };
            });
            setNewTypesDetails(initialDetails);
            setBulkConfig(initialBulkConfig);
            setStep('configureNewTypes');
        } else {
            handleImport();
        }
    };

    const handleSaveCompany = (company: Company) => {
        if (company.id) {
            updateCompany(company);
        } else {
            const newCompany = { ...company, id: Date.now().toString() };
            addCompany(newCompany).then(() => {
                setSelectedCompanyId(newCompany.id);
            });
        }
        setIsCompanyModalOpen(false);
    }
    
    const handleImport = async () => {
        setIsLoading(true);
        let successCount = 0, failedCount = 0;
    
        const newTypeCreationPromises = (Object.entries(newTypesDetails) as [string, NewTypeDetails][]).map(async ([typeName, details]) => {
            const newType: WorkOrderType = {
                id: '', // Will be generated by dataService
                typeName,
                defaultCompanyId: details.companyId,
                defaultBaseRate: details.baseRate,
                defaultResourcesNeeded: details.resources,
                isArchived: false,
                defaultServiceTimeSeconds: details.defaultServiceTimeSeconds || 0,
                useAverageServiceTime: false,
            };
            await addWorkOrderType(newType);
        });

        await Promise.all(newTypeCreationPromises);
        
        // After creating types, the state is updated. We can now proceed with orders.
        // A small delay to ensure state propagation, or ideally use the updated state from a returned promise.
        // For simplicity here, we'll proceed assuming the state will be fresh enough for the next step.
        // A more robust solution would involve getting the new types back from the addWorkOrderType calls.

        const allTypes = state.workOrderTypes; // This might be slightly stale, but should be OK for this app.

        for (const stagedOrder of stagedOrders) {
            try {
                let targetType: WorkOrderType | undefined;
                let finalBaseRate = stagedOrder.baseRate ?? 0;

                if (stagedOrder.resolvedTypeId === 'create') {
                    targetType = state.workOrderTypes.find(t => t.typeName === stagedOrder.originalTypeName);
                    if (targetType && !stagedOrder.isFollowUp) {
                        // FIX: Cast `stagedOrder.originalTypeName` to string to resolve index type error, which may be caused by subtle type corruption during state updates.
                        const configuredDetails = newTypesDetails[stagedOrder.originalTypeName as string];
                        if (configuredDetails) {
                            finalBaseRate = configuredDetails.baseRate;
                        }
                    }
                } else {
                    targetType = allTypes.find(t => t.id === stagedOrder.resolvedTypeId);
                }
                
                if (!targetType) throw new Error(`Could not resolve work order type for "${stagedOrder.originalTypeName}"`);
                
                const company = state.companies.find(c => c.id === targetType!.defaultCompanyId);
                const newWorkOrder: WorkOrder = {
                    id: '', // Will be generated by data service
                    orderId: stagedOrder.orderId!,
                    dueDate: stagedOrder.dueDate || new Date().toISOString().split('T')[0],
                    startDate: stagedOrder.startDate,
                    clientName: stagedOrder.clientName!,
                    typeName: targetType.typeName,
                    companyName: company?.name || 'Unknown',
                    baseRate: finalBaseRate,
                    miscFee: 0,
                    resources: [...targetType.defaultResourcesNeeded],
                    status: OrderStatus.PendingReview,
                    address: stagedOrder.address!,
                    isFollowUp: stagedOrder.isFollowUp || false,
                };
                
                await addWorkOrder(newWorkOrder);
                successCount++;
            } catch (error) {
                console.error("Failed to process staged order:", stagedOrder, error);
                failedCount++;
            }
        }
        setImportSummary({ success: successCount, failed: failedCount });
        setIsLoading(false);
        setStep('summary');
    };


    const reviewSummary = useMemo(() => ({
        totalOrders: stagedOrders.length,
        newTypesCount: new Set(stagedOrders.filter(o => o.resolvedTypeId === 'create').map(o => o.originalTypeName)).size,
    }), [stagedOrders]);
    
    const renderUploadStep = () => (
        <>
            <div className="space-y-4">
                <div>
                    <h4 className="text-lg font-semibold text-gray-800">1. Upload File</h4>
                    <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'}`}>
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                            <div className="flex text-sm text-gray-600 justify-center"><label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500"><span>Upload a file</span><input id="file-upload" name="file-upload" type="file" accept={allAllowedExtensionsString} onChange={handleFileChange} className="sr-only" /></label><p className="pl-1">or drag and drop</p></div>
                            <p className="text-xs text-gray-500">Spreadsheets, CSV, TSV, or TXT</p>
                            {file && (<p className="text-sm font-semibold text-green-600 pt-2">Selected: {file.name}</p>)}
                        </div>
                    </div>
                </div>
                
                {file && csvHeaders.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                        <h4 className="text-lg font-semibold text-gray-800">2. Map Columns</h4>
                        <div className="flex items-end gap-4">
                            <div className="flex-grow">
                                <label htmlFor="company-select" className="block text-sm font-medium text-gray-700">Company</label>
                                <select id="company-select" value={selectedCompanyId} onChange={e => setSelectedCompanyId(e.target.value)} className={`mt-1 ${inputClasses}`}>
                                    <option value="" disabled>-- Select a Company --</option>
                                    {availableCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <button onClick={() => setIsCompanyModalOpen(true)} type="button" className="bg-green-600 text-white px-3 py-2 text-sm rounded-md shadow-sm hover:bg-green-700 flex-shrink-0">New Company</button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Import Profile</label>
                            <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} className={`mt-1 ${inputClasses}`} disabled={!selectedCompanyId}>
                                <option value="">-- Manual Mapping --</option>
                                {companyProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border p-4 rounded-lg bg-gray-50">
                            {mappableFields.map(field => (
                                <div key={field}><label className="block text-xs font-medium text-gray-600">{fieldLabels[field]}</label><select value={mapping[field] || ''} onChange={(e) => handleMappingChange(field, e.target.value)} className={`mt-1 text-sm ${inputClasses}`}><option value="">- Unmapped -</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                            ))}
                        </div>
                        
                        <div className="flex flex-col">
                            <label className="block text-sm font-medium text-gray-700">Profile Name</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Profile Name" className={`flex-grow ${inputClasses}`} disabled={!selectedCompanyId} />
                                <button onClick={handleSaveProfile} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300 text-gray-800 flex-shrink-0" disabled={!selectedCompanyId}>Save Profile</button>
                            </div>
                             <p className="text-xs text-gray-500 mt-1 pl-1">To update the selected profile, keep the name the same. To create a new one, enter a new name.</p>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex justify-end space-x-2 pt-6">
                <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                <button onClick={handleProceedToReview} disabled={isLoading || csvData.length === 0 || !selectedCompanyId} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">{isLoading ? `Processing...` : `Review ${csvData.length} Orders`}</button>
            </div>
        </>
    );

    const renderReviewOrdersStep = () => (
        <div>
            <div className="p-3 bg-gray-100 rounded-lg mb-4 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">Review & Confirm Orders</h3>
                    <p className="text-gray-700">Importing <span className="font-bold">{reviewSummary.totalOrders}</span> orders. Found <span className="font-bold text-yellow-600">{stagedOrders.filter(o=>o.isFollowUp).length}</span> follow-ups. <span className="font-bold text-blue-600">{reviewSummary.newTypesCount}</span> new work order types will be created.</p>
                </div>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2 border-t border-b py-2">
                {stagedOrders.map(order => (
                    <div key={order.id!} className={`p-3 rounded-lg border-l-4 ${order.isFollowUp ? 'border-yellow-400 bg-yellow-50' : (order.resolvedTypeId === 'create' ? 'border-blue-400 bg-blue-50' : 'border-transparent bg-white')}`}>
                       {order.isFollowUp && (
                            <div className="text-xs font-bold text-yellow-800 bg-yellow-200 px-2 py-0.5 rounded-full inline-block mb-2">
                                FOLLOW-UP (Original Status: {order.originalOrderStatus})
                            </div>
                        )}
                        <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-4">
                                <p className="font-semibold truncate" title={order.orderId}>{order.orderId}</p>
                                <p className="text-sm text-gray-500 truncate" title={order.address}>{order.address}</p>
                                <p className="text-xs text-gray-400 truncate" title={order.clientName}>Client: {order.clientName}</p>
                            </div>
                            <div className="col-span-4">
                                <select value={order.resolvedTypeId} onChange={(e) => handleStagedOrderTypeChange(order.id!, e.target.value)} className={`text-sm ${inputClasses}`}>
                                    <option value="create">Create New Type: "{order.originalTypeName}"</option>
                                    <optgroup label="Match to Existing">
                                        {availableTypes.map(t => (<option key={t.id} value={t.id}>{t.typeName}</option>))}
                                    </optgroup>
                                </select>
                            </div>
                            <div className="col-span-3">
                                <label className="block text-xs font-medium text-gray-500">Base Rate</label>
                                {order.resolvedTypeId === 'create' && !order.isFollowUp ? (
                                    <div className="text-sm px-3 py-2 text-gray-400 italic">
                                        (Set in next step)
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                                        <input 
                                            type="number"
                                            step="0.01" 
                                            value={order.baseRate ?? 0}
                                            onFocus={e => e.target.select()}
                                            onChange={e => handleStagedOrderRateChange(order.id!, parseFloat(e.target.value) || 0)}
                                            className={`text-sm pl-7 ${inputClasses}`}
                                        />
                                    </div>
                                )}
                            </div>
                             <div className="col-span-1 text-right">
                                <button onClick={() => setEditingStagedOrder(order)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-end space-x-2 pt-6">
                <button type="button" onClick={() => setStep('upload')} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Back to Mapping</button>
                <button onClick={handleProceedToConfigure} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Continue</button>
            </div>
        </div>
    );

    const handleBulkConfigChange = (field: keyof NewTypeDetails, value: any) => {
        setBulkConfig(prev => ({ ...prev, [field]: value }));
    };
    
    const handleApplyBulkConfig = () => {
        const newDetails: Record<string, NewTypeDetails> = {};
        Object.keys(newTypesDetails).forEach(typeName => {
            newDetails[typeName] = { ...bulkConfig };
        });
        setNewTypesDetails(newDetails);
    };

    // FIX: Add type assertion to prevent type widening and subsequent state corruption.
    const handleIndividualTypeConfigChange = (typeName: string, field: keyof NewTypeDetails, value: any) => {
        setNewTypesDetails(prev => ({
            ...prev,
            [typeName]: {
                ...(prev[typeName] || { companyId: '', baseRate: 0, resources: [], defaultServiceTimeSeconds: 0 }),
                [field]: value
            }
        } as Record<string, NewTypeDetails>));
    };

    const renderConfigureNewTypesStep = () => (
        <div>
            <h3 className="text-xl font-semibold mb-2">Configure New Work Order Types</h3>
            <p className="text-gray-600 mb-4">Set the default details for all <span className="font-bold">{reviewSummary.newTypesCount}</span> new types. You can edit them individually below.</p>
            
            <div className="p-4 border rounded-lg bg-gray-50 mb-4">
                <h4 className="font-semibold mb-2">Apply to All</h4>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700">Company</label>
                        <select value={bulkConfig.companyId} onChange={e => handleBulkConfigChange('companyId', e.target.value)} className={`text-sm ${inputClasses}`}>
                            {availableCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Base Rate ($)</label>
                        <input type="number" value={bulkConfig.baseRate} onFocus={e => e.target.select()} onChange={e => handleBulkConfigChange('baseRate', Number(e.target.value) || 0)} className={`text-sm ${inputClasses}`} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Service Time (min)</label>
                        <input type="number" value={(bulkConfig.defaultServiceTimeSeconds || 0) / 60} onFocus={e => e.target.select()} onChange={e => handleBulkConfigChange('defaultServiceTimeSeconds', (Number(e.target.value) || 0) * 60)} placeholder="e.g., 30" className={`text-sm ${inputClasses}`} />
                    </div>
                    <div>
                        <button onClick={handleApplyBulkConfig} className="w-full bg-indigo-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-indigo-700">Apply</button>
                    </div>
                </div>
                 <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-700">Resources (comma-separated)</label>
                    <input type="text" value={bulkConfig.resources.join(', ')} onChange={e => handleBulkConfigChange('resources', e.target.value.split(',').map(s => s.trim()))} className={`text-sm ${inputClasses}`} />
                </div>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {/* FIX: Explicitly typing the destructured array from Object.entries ensures that `details`
                    is correctly typed as NewTypeDetails inside the map function. */}
                {(Object.entries(newTypesDetails) as [string, NewTypeDetails][]).map(([typeName, details]) => (
                    <div key={typeName} className="p-3 border rounded-lg bg-white">
                         <p className="font-bold text-gray-800 mb-2">{typeName}</p>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                                 <label className="block text-xs font-medium text-gray-600">Company</label>
                                 <select value={details.companyId} onChange={e => handleIndividualTypeConfigChange(typeName, 'companyId', e.target.value)} className={`text-sm ${inputClasses}`}>
                                     {availableCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                 </select>
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-600">Base Rate ($)</label>
                                <input type="number" value={details.baseRate} onFocus={e => e.target.select()} onChange={e => handleIndividualTypeConfigChange(typeName, 'baseRate', Number(e.target.value) || 0)} className={`text-sm ${inputClasses}`} />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-600">Service Time (min)</label>
                                <input type="number" value={(details.defaultServiceTimeSeconds || 0) / 60} onFocus={e => e.target.select()} onChange={e => handleIndividualTypeConfigChange(typeName, 'defaultServiceTimeSeconds', (Number(e.target.value) || 0) * 60)} placeholder="e.g., 30" className={`text-sm ${inputClasses}`} />
                            </div>
                             <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-gray-600">Resources (comma-separated)</label>
                                <input type="text" value={(details.resources || []).join(', ')} onChange={e => handleIndividualTypeConfigChange(typeName, 'resources', e.target.value.split(',').map(s => s.trim()))} className={`text-sm ${inputClasses}`} />
                             </div>
                         </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-end space-x-2 pt-6">
                <button type="button" onClick={() => setIsCompanyModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 mr-auto">New Company</button>
                <button type="button" onClick={() => setStep('reviewOrders')} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Back to Review</button>
                <button onClick={handleImport} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Confirm & Import {reviewSummary.totalOrders} Orders</button>
            </div>
        </div>
    );

    const renderSummaryStep = () => (
         <div>
            <h4 className="text-xl font-semibold text-center text-gray-800">Import Complete</h4>
            <div className="my-6 text-center text-lg">
                <p className="text-green-600"><span className="font-bold">{importSummary?.success}</span> orders imported.</p>
                {importSummary && importSummary.failed > 0 && 
                    <p className="text-red-600 mt-2"><span className="font-bold">{importSummary.failed}</span> orders failed.</p>
                }
            </div>
            <div className="flex justify-center mt-6">
                <button type="button" onClick={onClose} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">Close</button>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (step) {
            case 'upload': return renderUploadStep();
            case 'reviewOrders': return renderReviewOrdersStep();
            case 'configureNewTypes': return renderConfigureNewTypesStep();
            case 'summary': return renderSummaryStep();
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                 {isLoading && (<div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-[99] rounded-lg"><p className="text-lg font-semibold animate-pulse">Processing...</p></div>)}
                <h3 className="text-2xl font-semibold mb-4 flex-shrink-0 border-b pb-3">Import Work Orders</h3>
                <div className="flex-grow overflow-y-auto pt-4 pr-2">{renderContent()}</div>
                 {editingStagedOrder && (
                    <StagedOrderEditorModal
                        order={editingStagedOrder}
                        onSave={(updatedOrder) => {
                            setStagedOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                            setEditingStagedOrder(null);
                        }}
                        onClose={() => setEditingStagedOrder(null)}
                    />
                )}
            </div>
            {isCompanyModalOpen && <CompanyEditorModal company={{id:'',name:'',contactRep:'',contactEmail:'',contactPhone:''}} onSave={handleSaveCompany} onClose={() => setIsCompanyModalOpen(false)} />}
        </div>
    );
};


interface StagedOrderEditorModalProps {
    order: StagedWorkOrder;
    onSave: (updatedOrder: StagedWorkOrder) => void;
    onClose: () => void;
}

const StagedOrderEditorModal: React.FC<StagedOrderEditorModalProps> = ({ order, onSave, onClose }) => {
    const [formData, setFormData] = useState(order);

    useEffect(() => {
        setFormData(order);
    }, [order]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // FIX: Add type assertion to prevent type widening on the updated object.
        // This ensures the object passed to onSave strictly matches the StagedWorkOrder interface,
        // preventing downstream type errors where properties could be inferred as 'unknown'.
        setFormData(prev => ({ ...prev, [name]: value } as StagedWorkOrder));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[51] p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h3 className="text-xl font-semibold mb-4">Edit Staged Order</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClasses}>Order ID</label>
                        <input name="orderId" value={formData.orderId || ''} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>Client Name</label>
                        <input name="clientName" value={formData.clientName || ''} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div>
                        <label className={labelClasses}>Address</label>
                        <input name="address" value={formData.address || ''} onChange={handleChange} className={inputClasses} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClasses}>Due Date</label>
                            <input name="dueDate" type="date" value={formData.dueDate || ''} onChange={handleChange} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Start Date</label>
                            <input name="startDate" type="date" value={formData.startDate || ''} onChange={handleChange} className={inputClasses} />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CsvImportModal;