import React, { useRef, useEffect } from 'react';
import { loadGoogleMapsScript } from '../utils/googleMapsLoader';
import type {} from '../types';

interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onCommit: (value: string) => void;
    placeholder?: string;
    className?: string;
    id?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ value, onChange, onCommit, placeholder, className, id }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const listenerRef = useRef<google.maps.MapsEventListener | null>(null);

    useEffect(() => {
        if (!inputRef.current) return;

        let isMounted = true;

        loadGoogleMapsScript().then(() => {
            if (!isMounted || !inputRef.current) return;

            autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                fields: ["formatted_address"],
                types: ["address"],
            });

            listenerRef.current = autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current?.getPlace();
                if (place && place.formatted_address) {
                    onCommit(place.formatted_address);
                }
            });

        }).catch(error => {
            console.error("Error loading Google Maps for Autocomplete:", error);
        });
        
        return () => {
            isMounted = false;
            if (listenerRef.current) {
                listenerRef.current.remove();
            }
            if (autocompleteRef.current) {
                 const pacContainers = document.querySelectorAll('.pac-container');
                 pacContainers.forEach(container => container.remove());
            }
        };
    }, [onCommit]);
    
    useEffect(() => {
        if (inputRef.current && value !== inputRef.current.value) {
            inputRef.current.value = value;
        }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <input
            ref={inputRef}
            id={id}
            type="text"
            defaultValue={value}
            onChange={handleInputChange}
            onBlur={(e) => onCommit(e.target.value)}
            placeholder={placeholder}
            className={className}
        />
    );
};