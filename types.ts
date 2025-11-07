// FIX: Add minimal Google Maps types to satisfy TypeScript compiler and define 'google' on the window object.
// In a real project, this would be handled by installing @types/google.maps.
// FIX: Move google.maps namespace into a `declare global` block to make it available
// across all modules in the project, resolving "Cannot find namespace 'google'" errors.
declare global {
    namespace google {
        namespace maps {
            // Add Animation to the google.maps namespace
            export enum Animation {
                BOUNCE,
                DROP,
            }
            export class Map {
                constructor(mapDiv: HTMLElement, opts?: MapOptions);
                fitBounds(bounds: LatLngBounds | LatLngBoundsLiteral): void;
                addListener(eventName: string, handler: (...args: any[]) => void): MapsEventListener;
                panTo(latLng: LatLng | LatLngLiteral): void;
                setZoom(zoom: number): void;
                setOptions(options: MapOptions): void;
            }

            export interface MapOptions {
                center?: LatLng | LatLngLiteral;
                zoom?: number;
                mapId?: string;
                disableDefaultUI?: boolean;
                zoomControl?: boolean;
                gestureHandling?: string;
                draggable?: boolean;
            }

            // FIX: Add MapMouseEvent interface to fix typing errors.
            export interface MapMouseEvent {
                latLng: LatLng | null;
            }

            export class Marker {
                constructor(opts?: MarkerOptions);
                addListener(eventName: string, handler: (...args: any[]) => void): MapsEventListener;
                setMap(map: Map | null): void;
                getPosition(): LatLng | null;
                setAnimation(animation: Animation | null): void;
                get(key: string): any;
                set(key: string, value: any): void;
            }
            
            export class Circle {
                constructor(opts?: CircleOptions);
                setMap(map: Map | null): void;
                setCenter(center: LatLng | LatLngLiteral): void;
                setRadius(radius: number): void;
                getBounds(): LatLngBounds | null;
                // FIX: Add getRadius method to Circle definition to fix property does not exist error.
                getRadius(): number;
            }

            export interface CircleOptions {
                map?: Map;
                center?: LatLng | LatLngLiteral;
                radius?: number;
                strokeColor?: string;
                strokeOpacity?: number;
                strokeWeight?: number;
                fillColor?: string;
                fillOpacity?: number;
            }

            export interface MarkerOptions {
                position: LatLng | LatLngLiteral;
                map?: Map;
                title?: string;
                zIndex?: number;
                icon?: string | Icon | Symbol;
                anchorPoint?: Point;
                label?: string | MarkerLabel;
            }
            
            export interface MarkerLabel {
                text: string;
                color?: string;
                fontWeight?: string;
            }
            
            export class DirectionsService {
                route(
                    request: DirectionsRequest,
                    callback: (result: DirectionsResult | null, status: DirectionsStatus) => void
                ): void;
            }

            export interface DirectionsRequest {
                origin: string | LatLng | LatLngLiteral;
                destination: string | LatLng | LatLngLiteral;
                waypoints?: DirectionsWaypoint[];
                travelMode: TravelMode;
            }

            export interface DirectionsWaypoint {
                location: string | LatLng | LatLngLiteral;
                stopover: boolean;
            }

            export enum TravelMode {
                DRIVING = 'DRIVING',
            }

            export interface DirectionsResult {
                routes: DirectionsRoute[];
            }

            export interface DirectionsRoute {
                overview_polyline: string;
                legs: DirectionsLeg[];
            }
            
            export interface DirectionsLeg {
                distance?: { value: number };
                duration?: { value: number };
                // FIX: Add start_location and end_location to fix property does not exist error
                start_location: LatLng;
                end_location: LatLng;
            }

            // FIX: Added NOT_FOUND to centralize google maps types.
            export enum DirectionsStatus {
                OK = 'OK',
                NOT_FOUND = 'NOT_FOUND',
                // FIX: Add ZERO_RESULTS to DirectionsStatus enum to fix a type error.
                ZERO_RESULTS = 'ZERO_RESULTS',
            }

            export class DirectionsRenderer {
                constructor(opts?: DirectionsRendererOptions);
                setMap(map: Map | null): void;
                setDirections(directions: DirectionsResult): void;
            }

            export interface DirectionsRendererOptions {
                map?: Map;
                suppressMarkers?: boolean;
                polylineOptions?: PolylineOptions;
            }

            export interface PolylineOptions {
                strokeColor?: string;
                strokeOpacity?: number;
                strokeWeight?: number;
                path?: any;
                map?: Map;
                // FIX: Add zIndex to allow setting stacking order of polylines.
                zIndex?: number;
            }

            export interface MapsEventListener {
                remove(): void;
            }

            export class InfoWindow {
                constructor(opts?: InfoWindowOptions);
                setContent(content: string | Node): void;
                open(options: { map: Map; anchor?: MVCObject; } | Map): void;
                close(): void;
                addListener(eventName: string, handler: (...args: any[]) => void): MapsEventListener;
            }

            export interface InfoWindowOptions {
                content?: string | Node;
            }
            
            export class Point {
                constructor(x: number, y: number);
            }

            export class MVCObject {}
            export class MVCArray<T> {
                push(elem: T): number;
                getArray(): T[];
                getLength(): number;
            }

            export class Geocoder {
                geocode(
                    request: GeocoderRequest,
                    callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
                ): void;
            }

            export interface GeocoderRequest {
                address: string;
            }

            export interface GeocoderResult {
                geometry: {
                    location: LatLng;
                };
            }

            export enum GeocoderStatus {
                OK = 'OK',
            }

            export class LatLng {
                constructor(lat: number, lng: number);
                lat(): number;
                lng(): number;
            }

            export interface LatLngLiteral {
                lat: number;
                lng: number;
            }

            export class LatLngBounds {
                constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
                extend(point: LatLng | LatLngLiteral): LatLngBounds;
            }

            export interface LatLngBoundsLiteral {
                east: number;
                north: number;
                south: number;
                west: number;
            }

            export enum SymbolPath {
                CIRCLE,
            }

            export interface Symbol {
                path: SymbolPath | string;
                scale?: number;
                fillColor?: string;
                fillOpacity?: number;
                strokeColor?: string;
                strokeWeight?: number;
                anchor?: Point;
            }

            export interface Icon {}
            
            export class Polygon {
                constructor(opts?: PolygonOptions);
                setMap(map: Map | null): void;
            }
            
            export interface PolygonOptions {
                paths?: any;
                map?: Map;
                fillColor?: string;
                fillOpacity?: number;
                strokeColor?: string;
                strokeOpacity?: number;
                strokeWeight?: number;
            }

            export class Polyline {
                constructor(opts?: PolylineOptions);
                setMap(map: Map | null): void;
                getPath(): MVCArray<LatLng>;
                setPath(path: MVCArray<LatLng> | LatLng[] | LatLngLiteral[]): void;
            }

            export namespace geometry {
                export namespace spherical {
                    export function computeDistanceBetween(from: LatLng, to: LatLng): number;
                }
                export namespace poly {
                    export function containsLocation(latLng: LatLng | LatLngLiteral, polygon: Polygon): boolean;
                }
            }

            export namespace places {
                export class Autocomplete {
                    constructor(inputElement: HTMLInputElement, opts?: AutocompleteOptions);
                    addListener(eventName: string, handler: () => void): MapsEventListener;
                    getPlace(): PlaceResult;
                }

                export interface AutocompleteOptions {
                    fields?: string[];
                    types?: string[];
                }
                
                export interface PlaceResult {
                    formatted_address?: string;
                }
            }
        }
    }

    interface Window {
        google: typeof google;
        initMap: () => void;
    }
}


export enum OrderStatus {
  PendingReview = 'Pending Review',
  Pending = 'Pending Assignment', // Ready for trip planning
  Active = 'Active',
  Completed = 'Completed',
  Invoiced = 'Invoiced',
  Paid = 'Paid',
}

export interface Company {
  id: string;
  name: string;
  contactRep: string;
  contactEmail: string;
  contactPhone: string;
  contractFileName?: string;
  isArchived?: boolean;
  defaultImportProfileId?: string;
}

export interface WorkOrderType {
  id:string;
  typeName: string;
  defaultCompanyId: string;
  defaultBaseRate: number;
  defaultResourcesNeeded: string[];
  isArchived?: boolean;
  defaultServiceTimeSeconds: number;
  useAverageServiceTime?: boolean;
}

export interface WorkOrder {
  id: string;
  orderId: string;
  dueDate: string;
  startDate?: string;
  typeName: string;
  clientName: string;
  companyName: string;
  baseRate: number;
  miscFee: number;
  resources: string[];
  isFollowUp: boolean;
  status: OrderStatus;
  address: string;
  description?: string;
  completedDate?: string;
  invoicedDate?: string;
}

export interface TripStop {
  workOrderId: string;
  isCompleted: boolean;
  timeSpentSeconds: number;
}

export interface Trip {
  id: string;
  name: string;
  tripNumber: string;
  stops: TripStop[];
  startTime?: number | null; // timestamp
  endTime?: number;   // timestamp
  totalTimeSeconds: number;
  status: 'Planning' | 'Planned' | 'Active' | 'Completed';
  startLocation: string;
  endLocation: string;
  totalMiles?: number;
  estimatedPayout?: number;
}

export enum Screen {
    DailyReview = 'Daily Review',
    Trips = 'Trips',
    ActiveTrip = 'Active Trip',
    Office = 'Office',
    Settings = 'Settings'
}

export interface CsvColumnMapping {
  orderId?: string;
  dueDate?: string;
  startDate?: string;
  clientName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  typeName?: string;
}

export interface ImportProfile {
  id: string;
  name: string;
  mapping: CsvColumnMapping;
  companyId: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string;
}

export enum TripGoal {
  HOURLY_RATE = 'HOURLY_RATE',
  PER_MILE_RATE = 'PER_MILE_RATE',
  TOTAL_PAYOUT = 'TOTAL_PAYOUT',
  STOP_COUNT = 'STOP_COUNT'
}

export interface TripGoalSetting {
  goal: TripGoal;
  enabled: boolean;
}

export interface TripSettings {
  maxTripTimeSeconds: number;
  maxTripMileage: number;
  priorities: TripGoalSetting[];
}

export interface FinancialGoals {
  targetHourlyRate: number;
  targetPerMileRate: number;
  targetTripPayout: number;
}

export interface PrintRequest {
    trip: SuggestedTrip;
    tripObject?: Trip;
    includeMap: boolean;
}

export interface AppState {
  workOrderTypes: WorkOrderType[];
  workOrders: WorkOrder[];
  trips: Trip[];
  companies: Company[];
  importProfiles: ImportProfile[];
  officeLocations: OfficeLocation[];
  tripSettings: TripSettings;
  financialGoals: FinancialGoals;
  editingTarget: { type: 'company' | 'workOrderType', id: string } | null;
  printRequest: PrintRequest | null;
}

export interface CompanyPerformanceStats {
    companyId: string;
    companyName: string;
    totalRevenue: number;
    completedJobs: number;
    averageJobValue: number;
}

export interface SuggestedStop {
    workOrderId: string;
    address: string;
    serviceTimeMinutes: number;
}

export interface SuggestedTrip {
    id: string;
    name: string;
    tripNumber?: string;
    stops: SuggestedStop[];
    totalMinutes: number; // Estimated
    travelMinutes: number; // Estimated
    serviceMinutes: number; // Estimated
    totalMiles: number; // Estimated
    estimatedPayout: number;
    reasoning: string;
    color?: string;
    startLocation: string;
    endLocation: string;
    violation_warning?: string;
    // Actuals from a completed trip
    actualTotalMinutes?: number;
    actualTotalMiles?: number;
}