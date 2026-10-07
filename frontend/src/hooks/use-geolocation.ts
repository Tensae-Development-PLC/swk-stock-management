"use client";

import { useCallback, useEffect, useState } from "react";

export type GeoState =
  | { status: "loading" }
  | { status: "ready"; latitude: number; longitude: number; accuracy: number }
  | { status: "denied"; message: string }
  | { status: "unavailable"; message: string };

export function useGeolocation(enabled = true) {
  const [geo, setGeo] = useState<GeoState>({ status: "loading" });

  const request = useCallback(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({
        status: "unavailable",
        message: "This device does not support GPS. Use a phone with location services.",
      });
      return;
    }
    setGeo({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: "ready",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeo({
            status: "denied",
            message:
              "Location access was denied. Enable GPS / location permission for this site, then tap Retry.",
          });
        } else {
          setGeo({
            status: "unavailable",
            message: err.message || "Could not get your location. Try again outdoors.",
          });
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, [enabled]);

  useEffect(() => {
    request();
  }, [request]);

  return { geo, retry: request };
}
