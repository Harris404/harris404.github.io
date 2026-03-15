import { useState, useEffect } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        // Silently fail — location is optional
        console.log('Geolocation not available or denied');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  return location;
}
