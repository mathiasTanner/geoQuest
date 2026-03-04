// apps/web/src/lib/geo/useGeolocation.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GeoState =
  | { status: "idle" }
  | { status: "requesting" }
  | {
      status: "watching";
      coords: { lat: number; lng: number; accuracy: number; heading: number | null };
      timestamp: number;
    }
  | { status: "error"; message: string };

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const watchIdRef = useRef<number | null>(null);

  const isSupported = useMemo(
    () => typeof window !== "undefined" && "geolocation" in navigator,
    []
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState({ status: "idle" });
  }, [isSupported]);

  const start = useCallback(() => {
    if (!isSupported) {
      setState({ status: "error", message: "Geolocation is not supported in this browser." });
      return;
    }

    setState({ status: "requesting" });

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: "watching",
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
          },
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        setState({ status: "error", message: err.message || "Failed to get location." });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      }
    );

    watchIdRef.current = id;
  }, [isSupported]);

  // cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { state, isSupported, start, stop };
}
