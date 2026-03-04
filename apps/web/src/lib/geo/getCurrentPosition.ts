"use client";

export type OneShotCoords = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

export function getCurrentPositionOnce(options?: PositionOptions): Promise<OneShotCoords> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => reject(new Error(err.message || "Failed to get location.")),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        ...options,
      }
    );
  });
}
