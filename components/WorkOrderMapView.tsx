import React, { useState, useEffect, useRef } from 'react';
import { WorkOrder, Trip, OrderStatus, OfficeLocation, SuggestedTrip } from '../types';
import { loadGoogleMapsScript } from '../utils/googleMapsLoader';

// --- Helper Functions & Constants ---
type PinStatus = 'overdue' | 'ready' | 'assigned' | 'upcoming';
const pinConfig: Record<PinStatus, { fill: string, stroke: string, zIndex: number }> = {
    overdue: { fill: '#ef4444', stroke: '#b91c1c', zIndex: 4 },
    ready: { fill: '#22c55e', stroke: '#15803d', zIndex: 3 },
    assigned: { fill: '#3b82f6', stroke: '#1d4ed8', zIndex: 2 },
    upcoming: { fill: '#9ca3af', stroke: '#4b5563', zIndex: 1 },
};

const houseIconPath = 'M12 2L2 12h3v8h14v-8h3L12 2z';

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.split('T')[0] + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};


// --- Component ---
interface WorkOrderMapViewProps {
    workOrders: WorkOrder[];
    trips: Trip[];
    officeLocations: OfficeLocation[];
    onPinClick: (order: WorkOrder) => void;
    suggestedTrips?: SuggestedTrip[];
    tripOverlay?: SuggestedTrip;
    mode?: 'overview' | 'detail';
    highlightedWorkOrderId?: string | null;
    isCircleToolActive?: boolean;
    onMapSelection?: (selectedIds: string[]) => void;
}

interface GeocodedPoint<T> {
    data: T;
    position: { lat: number, lng: number };
}
interface GeocodedOrder extends GeocodedPoint<WorkOrder> {
    pinStatus: PinStatus;
}
type GeocodedOffice = GeocodedPoint<OfficeLocation>;

const WorkOrderMapView: React.FC<WorkOrderMapViewProps> = ({ 
    workOrders, 
    trips, 
    officeLocations, 
    onPinClick, 
    suggestedTrips = [],
    tripOverlay,
    mode = 'overview',
    highlightedWorkOrderId = null,
    isCircleToolActive = false,
    onMapSelection,
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<Record<string, google.maps.Marker>>({});
    const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
    const directionsRenderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
    const highlightedMarkerRef = useRef<google.maps.Marker | null>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);

    // Freehand drawing state
    const drawingPolylineRef = useRef<google.maps.Polyline | null>(null);
    const isDrawingRef = useRef(false);

    const [geocodedOrders, setGeocodedOrders] = useState<GeocodedOrder[]>([]);
    const [geocodedOffices, setGeocodedOffices] = useState<GeocodedOffice[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let isMounted = true;
        const geocodeCache = new Map<string, { lat: number, lng: number }>();
        
        const initialize = async () => {
            try {
                await loadGoogleMapsScript();
                if (!isMounted) return;

                const geocoder = new window.google.maps.Geocoder();
                
                const pointsToProcess = [
                    ...workOrders
                        .filter(wo => wo.status === OrderStatus.Pending || wo.status === OrderStatus.Active)
                        .map(wo => ({ type: 'order', data: wo })),
                    ...officeLocations.map(office => ({ type: 'office', data: office }))
                ];

                const geocodePromises = pointsToProcess.map(point => {
                    if (geocodeCache.has(point.data.address)) {
                        return Promise.resolve({ ...point, position: geocodeCache.get(point.data.address)! });
                    }
                    return new Promise<{ type: string, data: WorkOrder | OfficeLocation, position: { lat: number, lng: number } } | null>((resolve) => {
                        geocoder.geocode({ address: point.data.address }, (results, status) => {
                            if (status === 'OK' && results && results[0]) {
                                const position = {
                                    lat: results[0].geometry.location.lat(),
                                    lng: results[0].geometry.location.lng()
                                };
                                geocodeCache.set(point.data.address, position);
                                resolve({ ...point, position });
                            } else {
                                console.warn(`Geocoding failed for '${point.data.address}': ${status}`);
                                resolve(null);
                            }
                        });
                    });
                });
                
                const geocodedResults = (await Promise.all(geocodePromises)).filter((r): r is { type: string, data: WorkOrder | OfficeLocation, position: { lat: number, lng: number } } => r !== null);
                if (!isMounted) return;

                const today = new Date(); today.setHours(0, 0, 0, 0);
                const ordersInTrips = new Set(trips.flatMap(t => t.stops.map(s => s.workOrderId)));
                
                const finalOrders: GeocodedOrder[] = [];
                const finalOffices: GeocodedOffice[] = [];

                geocodedResults.forEach(result => {
                    if (result.type === 'order') {
                        const wo = result.data as WorkOrder;
                        let pinStatus: PinStatus;
                        if (new Date(wo.dueDate.split('T')[0]) < today) pinStatus = 'overdue';
                        else if (wo.status === OrderStatus.Active || ordersInTrips.has(wo.id)) pinStatus = 'assigned';
                        else if (wo.startDate && new Date(wo.startDate.split('T')[0]) > today) pinStatus = 'upcoming';
                        else pinStatus = 'ready';
                        finalOrders.push({ data: wo, position: result.position, pinStatus });
                    } else if (result.type === 'office') {
                        finalOffices.push({ data: result.data as OfficeLocation, position: result.position });
                    }
                });
                
                setGeocodedOrders(finalOrders);
                setGeocodedOffices(finalOffices);
                setStatus('ready');

            } catch (err) {
                if (isMounted) {
                    setStatus('error');
                    setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred.');
                }
            }
        };
        
        initialize();
        return () => { isMounted = false; };
    }, [workOrders, trips, officeLocations]);
    
    // Main map and marker rendering effect
    useEffect(() => {
        if (status !== 'ready' || !mapRef.current) return;
        
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center: { lat: 39.8283, lng: -98.5795 }, // Center of US
                zoom: 4,
                mapId: 'FS_MAP_LIGHT',
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: 'cooperative',
            });

            infoWindowRef.current = new window.google.maps.InfoWindow();

            mapInstanceRef.current.addListener('click', () => {
                infoWindowRef.current?.close();
            });
        }
        
        const map = mapInstanceRef.current;
        Object.keys(markersRef.current).forEach(key => markersRef.current[key].setMap(null));
        const currentMarkers: Record<string, google.maps.Marker> = {};
        const bounds = new window.google.maps.LatLngBounds();

        if (geocodedOrders.length > 0 || geocodedOffices.length > 0) {
            geocodedOrders.forEach(orderItem => {
                const config = pinConfig[orderItem.pinStatus];
                const markerOptions: google.maps.MarkerOptions = {
                    position: orderItem.position,
                    map: map,
                    title: `${orderItem.data.address} | Due: ${formatDate(orderItem.data.dueDate)} | ${orderItem.data.orderId}`,
                    zIndex: config.zIndex,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 7,
                        fillColor: config.fill,
                        fillOpacity: 1,
                        strokeColor: config.stroke,
                        strokeWeight: 1.5,
                    }
                };
                
                if (mode === 'detail' && suggestedTrips.length === 1) {
                    const stopIndex = suggestedTrips[0].stops.findIndex(s => s.workOrderId === orderItem.data.id);
                    if (stopIndex !== -1) {
                        markerOptions.label = { text: (stopIndex + 1).toString(), color: 'white', fontWeight: 'bold' };
                    }
                }

                const marker = new window.google.maps.Marker(markerOptions);
                marker.set('workOrderId', orderItem.data.id);
                
                marker.addListener('click', () => onPinClick(orderItem.data));

                bounds.extend(orderItem.position);
                currentMarkers[orderItem.data.id] = marker;
            });
            
            geocodedOffices.forEach(officeItem => {
                 const marker = new window.google.maps.Marker({
                    position: officeItem.position,
                    map: map,
                    title: officeItem.data.name,
                    zIndex: 5,
                    icon: {
                        path: houseIconPath,
                        fillColor: '#6366f1',
                        fillOpacity: 1,
                        strokeColor: '#3730a3',
                        strokeWeight: 1.5,
                        scale: 1.2,
                        anchor: new window.google.maps.Point(12, 12),
                    },
                });
                bounds.extend(officeItem.position);
                currentMarkers[officeItem.data.id] = marker;
            });
            
            if (!suggestedTrips || suggestedTrips.length === 0) {
              map.fitBounds(bounds);
            }
        }
        
        markersRef.current = currentMarkers;

        // Draw Routes
        const directionsService = new window.google.maps.DirectionsService();
        directionsRenderersRef.current.forEach(renderer => renderer.setMap(null));
        directionsRenderersRef.current = [];
        
        const drawTripRoute = (trip: SuggestedTrip, isOverlay: boolean = false) => {
            const MAX_WAYPOINTS_PER_REQUEST = 25;
            if (!trip.startLocation || !trip.endLocation) return;
    
            const allStops = trip.stops.map(s => s.address);
            const locations = [trip.startLocation, ...allStops, trip.endLocation];
    
            for (let i = 0; i < locations.length - 1; i += (MAX_WAYPOINTS_PER_REQUEST + 1)) {
                const origin = locations[i];
                const chunkEndIndex = Math.min(i + MAX_WAYPOINTS_PER_REQUEST + 1, locations.length - 1);
                const destination = locations[chunkEndIndex];
                const waypoints = locations.slice(i + 1, chunkEndIndex)
                    .map(location => ({ location, stopover: true }));
    
                const renderer = new window.google.maps.DirectionsRenderer({
                    map,
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: isOverlay ? '#52525B' : (trip.color || '#0000FF'),
                        strokeOpacity: isOverlay ? 0.6 : 0.8,
                        strokeWeight: isOverlay ? 4 : 6,
                        zIndex: isOverlay ? 1 : 2,
                    },
                });
    
                directionsService.route({
                    origin,
                    destination,
                    waypoints,
                    travelMode: window.google.maps.TravelMode.DRIVING
                }, (response, status) => {
                    if (status === 'OK' && response) {
                        renderer.setDirections(response);
                        if (!isOverlay) {
                            const routesBounds = new window.google.maps.LatLngBounds();
                            let boundsHavePoints = false;
                            response.routes[0].legs.forEach(leg => {
                                if (leg.start_location) { routesBounds.extend(leg.start_location); boundsHavePoints = true; }
                                if (leg.end_location) { routesBounds.extend(leg.end_location); boundsHavePoints = true; }
                            });
                            if (boundsHavePoints) map.fitBounds(routesBounds);
                        }
                    } else {
                        // Error is handled in the parent component's UI, no need to log here.
                    }
                });
                directionsRenderersRef.current.push(renderer);
            }
        };

        if (tripOverlay) {
            drawTripRoute(tripOverlay, true);
        }
        if (suggestedTrips && suggestedTrips.length > 0) {
            suggestedTrips.forEach(trip => drawTripRoute(trip, false));
        }

        return () => { 
            directionsRenderersRef.current.forEach(renderer => renderer.setMap(null));
        };

    }, [status, geocodedOrders, geocodedOffices, onPinClick, suggestedTrips, mode, tripOverlay]);
    
    // Effect to handle highlighting a marker
    useEffect(() => {
        if (mode !== 'detail' || !mapInstanceRef.current) return;
        const map = mapInstanceRef.current;

        if (highlightedMarkerRef.current) {
            highlightedMarkerRef.current.setAnimation(null);
            highlightedMarkerRef.current = null;
        }

        if (highlightedWorkOrderId) {
            // FIX: Cast Object.values to google.maps.Marker[] to fix type inference issues.
            const markerToHighlight = (Object.values(markersRef.current) as google.maps.Marker[]).find(m => m.get('workOrderId') === highlightedWorkOrderId);
            if (markerToHighlight) {
                const position = markerToHighlight.getPosition();
                if (position) {
                    map.panTo(position);
                }
                markerToHighlight.setAnimation(window.google.maps.Animation.BOUNCE);
                highlightedMarkerRef.current = markerToHighlight;
                
                setTimeout(() => {
                    markerToHighlight.setAnimation(null);
                }, 1400); // two bounces
            }
        }

    }, [highlightedWorkOrderId, mode]);

    // Effect for freehand drawing tool
    useEffect(() => {
        if (!mapInstanceRef.current || !window.google.maps.geometry?.poly) return;
        const map = mapInstanceRef.current;

        // This listener will be attached to the window to ensure mouseup is always caught.
        const handleMouseUp = () => {
            // Stop listening for this event on the window immediately.
            window.removeEventListener('mouseup', handleMouseUp, true);

            if (!isDrawingRef.current || !drawingPolylineRef.current) return;
            
            const path = drawingPolylineRef.current.getPath();

            if (path.getLength() > 2 && onMapSelection) {
                const polygon = new window.google.maps.Polygon({ paths: path.getArray() });
                
                const selectedIds: string[] = [];
                // FIX: Cast Object.values to google.maps.Marker[] to fix type inference issues.
                (Object.values(markersRef.current) as google.maps.Marker[]).forEach(marker => {
                    const workOrderId = marker.get('workOrderId');
                    const position = marker.getPosition();
                    if (workOrderId && position && window.google.maps.geometry.poly.containsLocation(position, polygon)) {
                        selectedIds.push(workOrderId);
                    }
                });
                onMapSelection(selectedIds);
            }

            // Clean up the drawing
            if (drawingPolylineRef.current) {
                drawingPolylineRef.current.setMap(null);
                drawingPolylineRef.current = null;
            }
            
            isDrawingRef.current = false;
            // Since the tool remains active, we don't restore map settings here.
            // They will be restored when isCircleToolActive becomes false.
        };

        const handleMouseMove = (e: google.maps.MapMouseEvent) => {
            if (!isDrawingRef.current || !drawingPolylineRef.current || !e.latLng) return;
            const path = drawingPolylineRef.current.getPath();
            path.push(e.latLng);
        };
        
        const handleMouseDown = (e: google.maps.MapMouseEvent) => {
            if (!isCircleToolActive || !e.latLng) return;
            
            isDrawingRef.current = true;
            
            if (drawingPolylineRef.current) {
                drawingPolylineRef.current.setMap(null);
            }

            drawingPolylineRef.current = new window.google.maps.Polyline({
                map,
                path: [e.latLng],
                strokeColor: '#007bff',
                strokeOpacity: 0.7,
                strokeWeight: 2,
            });

            // Add the robust mouseup listener to the window.
            window.addEventListener('mouseup', handleMouseUp, true);
        };

        // This effect manages the map listeners and settings based on the tool's active state.
        if (isCircleToolActive) {
            // Deactivate map panning and set cursor
            map.setOptions({ gestureHandling: 'none', draggable: false });
            if (mapRef.current) mapRef.current.classList.add('crosshair-cursor');

            // Attach listeners for drawing
            const downListener = map.addListener('mousedown', handleMouseDown);
            const moveListener = map.addListener('mousemove', handleMouseMove);
            
            return () => {
                // Cleanup function when the tool is deactivated
                downListener.remove();
                moveListener.remove();
                window.removeEventListener('mouseup', handleMouseUp, true);

                // Restore map settings
                map.setOptions({ gestureHandling: 'cooperative', draggable: true });
                if (mapRef.current) mapRef.current.classList.remove('crosshair-cursor');

                if (drawingPolylineRef.current) {
                    drawingPolylineRef.current.setMap(null);
                    drawingPolylineRef.current = null;
                }
                isDrawingRef.current = false;
            };
        }

    }, [isCircleToolActive, onMapSelection]);


    return (
        <div className="relative w-full h-96 md:h-[500px] rounded-lg shadow-inner overflow-hidden bg-gray-200">
            {status === 'loading' && <div className="flex items-center justify-center h-full"><p>Loading Map & Geocoding Addresses...</p></div>}
            {status === 'error' && <div className="flex items-center justify-center h-full text-center p-4"><p className="text-red-600 font-semibold">{errorMessage}</p></div>}
            <div ref={mapRef} className="w-full h-full" style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }} />
             {status === 'ready' && (
                <div className="absolute bottom-2 left-2 bg-white bg-opacity-80 p-2 rounded-md shadow">
                    <div className="flex items-center space-x-4">
                        {Object.entries(pinConfig).map(([status, config]) => (
                            <div key={status} className="flex items-center space-x-1.5">
                                <div style={{backgroundColor: config.fill, borderColor: config.stroke}} className={`w-3 h-3 rounded-full border`}></div>
                                <span className="text-xs capitalize text-gray-700">{status}</span>
                            </div>
                        ))}
                    </div>
                </div>
             )}
        </div>
    );
};

export default WorkOrderMapView;