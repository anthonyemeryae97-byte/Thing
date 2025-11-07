
import { useState, useRef, useCallback, useEffect } from 'react';

export const useTimer = (initialSeconds = 0) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!isActive) {
      setIsActive(true);
      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
  }, [isActive]);

  const pause = useCallback(() => {
    if (isActive && intervalRef.current) {
      setIsActive(false);
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isActive]);

  const stop = useCallback(() => {
    pause();
    return elapsedSeconds;
  }, [pause, elapsedSeconds]);

  const reset = useCallback((seconds = 0) => {
    pause();
    setElapsedSeconds(seconds);
  }, [pause]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  // Update initial time if prop changes
  useEffect(() => {
    if (!isActive) {
        setElapsedSeconds(initialSeconds);
    }
  }, [initialSeconds, isActive])

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return { elapsedSeconds, isActive, start, pause, stop, reset, formattedTime: formatTime(elapsedSeconds) };
};
