
const GOOGLE_MAPS_API_KEY = "AIzaSyBWa8YhTRhKAHAOHlzr8pkpAKFLFXRChso";

let scriptLoadingPromise: Promise<void> | null = null;

export const loadGoogleMapsScript = (): Promise<void> => {
    if (scriptLoadingPromise) {
        return scriptLoadingPromise;
    }

    scriptLoadingPromise = new Promise((resolve, reject) => {
        if (window.google && window.google.maps && window.google.maps.geometry && window.google.maps.places) {
            return resolve();
        }

        if (!GOOGLE_MAPS_API_KEY) {
            return reject(new Error("Google Maps API key is missing."));
        }

        window.initMap = () => {
            // The callback resolves the promise, indicating the script has executed.
            resolve();
        };

        const existingScript = document.getElementById('google-maps-script');
        if (existingScript) {
            // If the script tag exists but the libraries aren't ready,
            // it might still be loading. We can poll for it.
            const checkInterval = setInterval(() => {
                if (window.google?.maps?.geometry && window.google.maps.places) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=geometry,places`;
        script.async = true;
        
        script.onerror = () => {
            reject(new Error("Google Maps script failed to load."));
            scriptLoadingPromise = null; 
        };
        
        document.head.appendChild(script);
    });

    return scriptLoadingPromise;
};
