/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Landmark } from './utils';

interface SatelliteFallbackMapProps {
  landmarks: Landmark[];
  activeLandmark: Landmark | null;
  onSelectLandmark: (loc: Landmark) => void;
  center: { lat: number; lng: number };
  mapMode: 'HYBRID' | 'SATELLITE' | 'ROADMAP';
  isFlying?: boolean;
}

export default function SatelliteFallbackMap({
  landmarks,
  activeLandmark,
  onSelectLandmark,
  center,
  mapMode,
}: SatelliteFallbackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update base tiles when mapMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelsLayerRef.current) {
      map.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    if (mapMode === 'ROADMAP') {
      // Clean modern roadmap tiles
      tileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19 }
      ).addTo(map);
    } else {
      // High-resolution satellite tiles (Esri World Imagery)
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map);

      // Add boundary and place labels overlay if HYBRID mode
      if (mapMode === 'HYBRID') {
        labelsLayerRef.current = L.tileLayer(
          'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { maxZoom: 19 }
        ).addTo(map);
      }
    }
  }, [mapMode]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    landmarks.forEach((loc) => {
      const pinColor = loc.pinColor || '#0284C7';
      const innerSvg = (loc.svgIcon || '')
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '');

      const customHtml = `
        <div class="custom-leaflet-pin group relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95" style="width: 32px; height: 38px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 24 30" fill="none">
            <path d="M12 1.5C6.8 1.5 2.5 5.8 2.5 11c0 7.5 9.5 17.5 9.5 17.5s9.5-10 9.5-17.5C21.5 5.8 17.2 1.5 12 1.5z" fill="${pinColor}" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"/>
            <g transform="translate(6, 5) scale(0.5)" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none">
              ${innerSvg}
            </g>
          </svg>
          <div class="absolute -bottom-1 w-2.5 h-1 bg-black/40 rounded-full blur-[1px]"></div>
        </div>
      `;

      const icon = L.divIcon({
        html: customHtml,
        className: 'custom-pin-container',
        iconSize: [30, 36],
        iconAnchor: [15, 36],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);

      marker.on('click', () => {
        onSelectLandmark(loc);
      });

      markersRef.current.push(marker);
    });
  }, [landmarks, onSelectLandmark]);

  // Fly to active landmark or center overview
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (activeLandmark) {
      map.flyTo([activeLandmark.lat, activeLandmark.lng], 15, {
        duration: 2.0,
        easeLinearity: 0.25,
      });
    } else {
      map.flyTo([center.lat, center.lng], 11, {
        duration: 2.0,
      });
    }
  }, [activeLandmark, center]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full" style={{ zIndex: 0 }} />
    </div>
  );
}
