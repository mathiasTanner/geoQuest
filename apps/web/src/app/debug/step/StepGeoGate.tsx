"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { haversineDistanceMeters } from "@/lib/geo/distance";

export function StepGeoGate(props: { targetLat: number; targetLng: number; radiusMeters: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { state, isSupported, start, stop } = useGeolocation();

  const distance = useMemo(() => {
    if (state.status !== "watching") return null;
    return haversineDistanceMeters(
      { lat: state.coords.lat, lng: state.coords.lng },
      { lat: props.targetLat, lng: props.targetLng }
    );
  }, [state, props.targetLat, props.targetLng]);

  const inside = useMemo(() => {
    if (distance === null) return null;
    return distance <= props.radiusMeters;
  }, [distance, props.radiusMeters]);

  if (!mounted) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Geolocation gate</h2>
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h2 className="text-lg font-semibold">Geolocation gate</h2>

      {!isSupported && (
        <p className="text-sm">Geolocation is not supported in this browser.</p>
      )}

      <div className="flex gap-2">
        <button
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          onClick={start}
          disabled={!isSupported || state.status === "watching" || state.status === "requesting"}
        >
          {state.status === "requesting" ? "Requesting…" : "Start GPS"}
        </button>

        <button
          className="rounded border px-3 py-2 disabled:opacity-50"
          onClick={stop}
          disabled={state.status === "idle"}
        >
          Stop
        </button>
      </div>

      {state.status === "idle" && <p className="text-sm">Press “Start GPS” to begin.</p>}

      {state.status === "error" && (
        <p className="text-sm text-red-600">
          GPS error: {state.message}
          <br />
          If you denied permission, enable location access in your browser settings.
        </p>
      )}

      {state.status === "watching" && (
        <div className="text-sm space-y-1">
          <div>
            <strong>Your position:</strong> {state.coords.lat.toFixed(6)}, {state.coords.lng.toFixed(6)}
          </div>
          <div>
            <strong>Accuracy:</strong> ±{Math.round(state.coords.accuracy)}m
          </div>
          <div>
            <strong>Distance to target:</strong>{" "}
            {distance === null ? "-" : `${Math.round(distance)}m`}
          </div>
          <div>
            <strong>Radius:</strong> {props.radiusMeters}m
          </div>
          <div>
            <strong>Status:</strong>{" "}
            {inside === null ? "-" : inside ? "✅ Inside radius" : "❌ Outside radius"}
          </div>
        </div>
      )}
    </div>
  );
}