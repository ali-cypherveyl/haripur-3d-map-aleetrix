/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Globe2,
  Earth,
  Route,
  Waypoints,
  Navigation,
  Glasses,
  View,
  Building2,
  Moon,
  Sun,
  Orbit,
  Box,
  SunMoon,
  Contrast,
  Compass,
  MapPin,
  Layers,
  Globe,
  Map,
  Play,
  Square,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ArrowDown,
  Info,
  HelpCircle,
  Video,
  Minimize2,
  Move,
  Key,
  Sparkles,
  ExternalLink,
  RotateCw,
  RotateCcw,
  List,
  X
} from 'lucide-react';
import {
  CITIES,
  getCityConfig,
  DEFAULT_CITY_ID,
  CityConfig,
  LANDMARKS,
  getHaversineDistance,
  getFlightDuration,
  loadGoogleMapsScript,
  getLandmarkMarkerAltitude,
  Landmark,
  isValidGoogleMapsKey
} from './utils';
import SatelliteFallbackMap from './SatelliteFallbackMap';
import { motion, AnimatePresence } from 'motion/react';

// Google Maps API Key loaded via environment variable VITE_GOOGLE_MAPS_API_KEY
const ENV_DEV_KEY = ((import.meta as any)?.env?.VITE_GOOGLE_MAPS_API_KEY as string) ||
  (typeof process !== 'undefined' && (process.env as any)?.VITE_GOOGLE_MAPS_API_KEY as string) ||
  '';

export const DEFAULT_DEV_API_KEY: string = (ENV_DEV_KEY && ENV_DEV_KEY.trim() !== '')
  ? ENV_DEV_KEY.trim()
  : '';

function getInitialApiKey(): string {
  if (DEFAULT_DEV_API_KEY && DEFAULT_DEV_API_KEY.trim() !== '') {
    return DEFAULT_DEV_API_KEY.trim();
  }
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('gmp_custom_api_key') || localStorage.getItem('custom_maps_api_key');
    if (custom && custom.trim() !== '') {
      return custom.trim();
    }
  }
  return '';
}

function isMobileHorizontalDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Must be in landscape orientation (width > height)
  const isLandscape = window.innerWidth > window.innerHeight;
  if (!isLandscape) return false;

  // On any landscape view with compact vertical height (<= 640px),
  // it is a mobile horizontal view where vertical space is constrained.
  // Tablets (iPad, Galaxy Tab, Surface) in landscape have height >= 768px.
  // Laptops and desktop monitors have height >= 700px.
  // Mobile phones in landscape have height between 320px and 550px.
  return window.innerHeight <= 640;
}

const SOLUTION_ATTRIBUTION_ID = 'gmp_aistudio_immersivetour_v1.0.0';

export default function App() {
  // API Key State & Configuration
  const [apiKey, setApiKey] = useState<string>(getInitialApiKey);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [keyInputValue, setKeyInputValue] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gmp_custom_api_key') || localStorage.getItem('custom_maps_api_key') || '';
    }
    return '';
  });

  const isCustomKey = Boolean(apiKey && apiKey.trim() !== '' && apiKey !== DEFAULT_DEV_API_KEY);
  const isGeminiKey = Boolean(apiKey && apiKey.trim().startsWith('AQ.'));
  const [authFailed, setAuthFailed] = useState<boolean>(false);

  useEffect(() => {
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps Platform auth failure detected");
      setAuthFailed(true);
      setMapsLoaded(false);
    };
  }, []);

  const hasConfiguredKey = Boolean(
    apiKey &&
    isValidGoogleMapsKey(apiKey)
  );

  const isKeyWorking = hasConfiguredKey && !authFailed;

  const formatMaskedKey = (key: string) => {
    if (!key) return "None";
    if (key.length <= 16) return key;
    return `${key.slice(0, 8)}...${key.slice(-6)}`;
  };

  const handleSaveApiKey = () => {
    const trimmed = keyInputValue.trim();
    if (trimmed) {
      localStorage.setItem('gmp_custom_api_key', trimmed);
      localStorage.setItem('custom_maps_api_key', trimmed);
    } else {
      localStorage.removeItem('gmp_custom_api_key');
      localStorage.removeItem('custom_maps_api_key');
    }
    setShowApiKeyModal(false);
    window.location.reload();
  };

  const handleResetApiKey = () => {
    localStorage.removeItem('gmp_custom_api_key');
    localStorage.removeItem('custom_maps_api_key');
    setKeyInputValue('');
    setShowApiKeyModal(false);
    window.location.reload();
  };

  // City Selection State: Haripur is default spotlight
  const [selectedCityId, setSelectedCityId] = useState<string>(DEFAULT_CITY_ID);
  const [lang, setLang] = useState<'en' | 'ur'>('en');
  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'ur' : 'en'));
  };
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState<boolean>(false);
  const [canScrollMoreCities, setCanScrollMoreCities] = useState<boolean>(true);
  const cityDropdownScrollRef = useRef<HTMLDivElement>(null);
  const cityDropdownContainerRef = useRef<HTMLDivElement>(null);
  const selectedCity = getCityConfig(selectedCityId);

  // Check scroll position for City Dropdown menu to show/hide bottom indicator arrow
  const handleCityScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 8;
    setCanScrollMoreCities(!isAtBottom);
  };

  const handleScrollMoreCities = () => {
    if (cityDropdownScrollRef.current) {
      cityDropdownScrollRef.current.scrollBy({ top: 120, behavior: 'smooth' });
    }
  };

  // Close city dropdown when clicking outside
  useEffect(() => {
    if (!isCityDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        cityDropdownContainerRef.current &&
        !cityDropdownContainerRef.current.contains(event.target as Node)
      ) {
        setIsCityDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isCityDropdownOpen]);

  useEffect(() => {
    if (isCityDropdownOpen) {
      setTimeout(() => {
        if (cityDropdownScrollRef.current) {
          const el = cityDropdownScrollRef.current;
          setCanScrollMoreCities(el.scrollHeight > el.clientHeight + 4);
        }
      }, 50);
    }
  }, [isCityDropdownOpen]);

  // State managers
  const [landmarksList, setLandmarksList] = useState<Landmark[]>(() => getCityConfig(selectedCityId).landmarks);
  const [activeLandmark, setActiveLandmark] = useState<Landmark | null>(null);
  const [hoveredLandmark, setHoveredLandmark] = useState<Landmark | null>(null);

  const [mapMode, setMapMode] = useState<'HYBRID' | 'SATELLITE' | 'ROADMAP'>('HYBRID');
  const [forceNorth, setForceNorth] = useState<boolean>(true);
  const forceNorthRef = useRef<boolean>(true);
  const [isTouring, setIsTouring] = useState<boolean>(false);
  const [isFlying, setIsFlying] = useState<boolean>(false);
  const [hasInteractedWithTour, setHasInteractedWithTour] = useState<boolean>(false);
  const [showLandingBanner, setShowLandingBanner] = useState<boolean>(true);
  const [showMobilePlaceModal, setShowMobilePlaceModal] = useState<boolean>(false);
  const [tourIndex, setTourIndex] = useState<number>(0);
  const [mapsLoaded, setMapsLoaded] = useState<boolean>(false);
  const [placesLoaded, setPlacesLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMobileDrawerExpanded, setIsMobileDrawerExpanded] = useState<boolean>(false);
  const [showPopovers, setShowPopovers] = useState<boolean>(true);

  // Detect mobile horizontal devices (smartphone in landscape orientation)
  const [isShortLandscape, setIsShortLandscape] = useState<boolean>(isMobileHorizontalDevice);

  useEffect(() => {
    const handleResize = () => {
      setIsShortLandscape(isMobileHorizontalDevice());
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const [userToggledDescription, setUserToggledDescription] = useState<boolean | null>(null);

  // Description is VISIBLE BY DEFAULT on desktop, laptop, tablet, and portrait mobile.
  // ONLY on mobile horizontal (smartphone landscape) is it folded by default.
  const isDescriptionVisible = userToggledDescription !== null
    ? userToggledDescription
    : !isShortLandscape;

  const togglePlaceDetails = () => {
    setShowMobilePlaceModal((prev) => !prev);
  };

  const toggleDescriptionFold = () => {
    setUserToggledDescription(!isDescriptionVisible);
  };

  // Camera tour speed control state: 1x, 1.5x, 2x
  const [tourSpeed, setTourSpeed] = useState<number>(1);
  const tourSpeedRef = useRef<number>(1);

  // Theme state: 'dark' | 'light' with localStorage persistence
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'dark';
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_theme', next);
      }
      return next;
    });
  };

  // Auto-hide the initial landing guidance banner after 12 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLandingBanner(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  // Derive whether the user can manually move / orbit the 3D map (allowed whenever camera is not actively flying)
  const canUserControl = !isFlying;

  // On-map locked indicator state (shown when user clicks/touches the map while camera is moving)
  const [showLockedIndicator, setShowLockedIndicator] = useState<boolean>(false);
  const lockedIndicatorTimerRef = useRef<any>(null);

  const triggerLockedIndicator = () => {
    if (isFlying) {
      setShowLockedIndicator(true);
      if (lockedIndicatorTimerRef.current) {
        clearTimeout(lockedIndicatorTimerRef.current);
      }
      lockedIndicatorTimerRef.current = setTimeout(() => {
        setShowLockedIndicator(false);
      }, 1200);
    }
  };

  // Clicked POI from map interaction
  const [clickedPlaceId, setClickedPlaceId] = useState<string | null>(null);

  // Places UI Kit State mapping all landmark IDs and city IDs to verified Place IDs from Google
  const [placeIds, setPlaceIds] = useState<Record<string, string>>(() => {
    const dict: Record<string, string> = {};
    CITIES.forEach((c) => {
      dict[c.id] = c.placeId;
      c.landmarks.forEach((lm) => {
        if (lm.placeId) {
          dict[lm.id] = lm.placeId;
        }
      });
    });
    return dict;
  });

  const [flightStatus, setFlightStatus] = useState<string>("Ready");

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapElementRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const animationTimerRef = useRef<any>(null);
  const flightTimerRef = useRef<any>(null);
  const tourActiveRef = useRef<boolean>(false);
  const tourCurrentIndexRef = useRef<number>(0);
  const visitNextTourStepRef = useRef<((idx: number) => void) | null>(null);
  const selectAndFlyToLandmarkRef = useRef<((loc: Landmark) => void) | null>(null);
  const pauseGuidedTourRef = useRef<(() => void) | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Paused and panning trajectory tracking
  const [isTourPaused, setIsTourPaused] = useState<boolean>(false);
  const isTourPausedRef = useRef<boolean>(false);
  const panAnimFrameRef = useRef<number | null>(null);

  /**
   * Cleans up existing 3D markers and constructs/attaches new 3D Markers with custom SVG pin icons
   */
  const mountLandmarkMarkers = (map: any, landmarks: Landmark[]) => {
    // Clean up previous markers from map
    markersRef.current.forEach((marker) => {
      try {
        if (marker && marker.parentNode) {
          marker.parentNode.removeChild(marker);
        }
      } catch (e) { }
    });
    markersRef.current = [];

    const googleMaps = (window as any).google?.maps;
    if (!googleMaps) return;

    const maps3d = (googleMaps as any).maps3d;
    const MarkerClass = maps3d?.Marker3DInteractiveElement || maps3d?.Marker3DElement;
    if (!MarkerClass) return;

    landmarks.forEach((loc) => {
      try {
        const markerAltitude = getLandmarkMarkerAltitude(loc);
        const altMode = loc.altitudeMode || (loc.id === 'ferry-building' ? 'RELATIVE_TO_GROUND' : 'RELATIVE_TO_MESH');
        const marker = new MarkerClass({
          position: { lat: Number(loc.lat), lng: Number(loc.lng), altitude: markerAltitude },
          altitudeMode: altMode,
          extruded: false,
          collisionBehavior: 'REQUIRED_AND_HIDES_OPTIONAL',
          drawsWhenOccluded: true,
        });

        try {
          marker.position = { lat: Number(loc.lat), lng: Number(loc.lng), altitude: markerAltitude };
          marker.altitudeMode = altMode;
          marker.setAttribute('altitude-mode', altMode);
          marker.extruded = false;
          marker.collisionBehavior = 'REQUIRED_AND_HIDES_OPTIONAL';
          marker.drawsWhenOccluded = true;
        } catch (e) { }

        // Attach customized SVG Element template (Google Maps 3D requires SVGElement or HTMLImageElement inside <template>)
        try {
          const innerSvg = (loc.svgIcon || '')
            .replace(/^<svg[^>]*>/, '')
            .replace(/<\/svg>$/, '');

          const pinColor = loc.pinColor || '#0284C7';

          // Compact 24x30 physical marker pin
          const svgString = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30" fill="none">
  <!-- Clean compact pin body -->
  <path d="M12 1.5C6.8 1.5 2.5 5.8 2.5 11c0 7.5 9.5 17.5 9.5 17.5s9.5-10 9.5-17.5C21.5 5.8 17.2 1.5 12 1.5z" fill="${pinColor}" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
  
  <!-- Scaled Category Icon -->
  <g transform="translate(6, 5) scale(0.5)" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none">
    ${innerSvg}
  </g>
</svg>
`.trim();

          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
          const svgElement = svgDoc.documentElement;
          const template = document.createElement('template');
          template.content.append(svgElement);
          marker.append(template);
        } catch (pinErr) {
          console.warn(`Could not attach custom SVG template for ${loc.name}`, pinErr);
        }

        // Add click behavior on markers
        marker.addEventListener('gmp-click', (e: any) => {
          try {
            if (e) {
              if (typeof e.stop === 'function') e.stop();
              if (typeof e.preventDefault === 'function') e.preventDefault();
            }
            // Pause Tour if user clicks on a landmark on the map
            if (tourActiveRef.current) {
              if (pauseGuidedTourRef.current) {
                pauseGuidedTourRef.current();
              }
            }
            setClickedPlaceId(loc.placeId || null);
            if (selectAndFlyToLandmarkRef.current) {
              selectAndFlyToLandmarkRef.current(loc);
            }
          } catch (err) { }
        });

        // Add pointer hover triggers for Places UI Kit Compact Card display
        marker.addEventListener('pointerover', () => {
          try {
            setHoveredLandmark(loc);
          } catch (e) { }
        });

        marker.addEventListener('pointerout', () => {
          try {
            setHoveredLandmark(null);
          } catch (e) { }
        });

        map.appendChild(marker);
        markersRef.current.push(marker);
      } catch (markerErr) {
        console.error(`Failed to construct or append marker for ${loc.name}`, markerErr);
      }
    });
  };

  /**
   * Switches the active city, updates landmarks, remounts markers, and smoothly flies camera to the new city overview
   */
  const handleSelectCity = (cityId: string) => {
    const isSameCity = cityId === selectedCityId;

    // Stop active tour & flights immediately
    if (tourActiveRef.current) {
      stopGuidedTour();
    }
    if (flightTimerRef.current) {
      clearTimeout(flightTimerRef.current);
      flightTimerRef.current = null;
    }
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
      animationTimerRef.current = null;
    }
    if (panAnimFrameRef.current) {
      cancelAnimationFrame(panAnimFrameRef.current);
      panAnimFrameRef.current = null;
    }

    // Stop current camera animation in progress so the new flight triggers instantly
    if (mapElementRef.current && typeof mapElementRef.current.stopCameraAnimation === 'function') {
      try {
        mapElementRef.current.stopCameraAnimation();
      } catch (e) { }
    }

    const newCity = getCityConfig(cityId);
    if (!isSameCity) {
      setSelectedCityId(cityId);
      setLandmarksList(newCity.landmarks);
      setPlaceIds(prev => {
        const nextDict = { ...prev, [newCity.id]: newCity.placeId };
        newCity.landmarks.forEach(lm => {
          if (lm.placeId) {
            nextDict[lm.id] = lm.placeId;
          }
        });
        return nextDict;
      });
    }
    setActiveLandmark(null);
    setHoveredLandmark(null);
    setClickedPlaceId(null);
    setShowLandingBanner(false);
    setHasInteractedWithTour(true);
    setShowMobilePlaceModal(false);
    setIsMobileDrawerExpanded(false);
    setIsCityDropdownOpen(false);
    setFlightStatus(`Flying to ${newCity.name}...`);

    if (mapElementRef.current) {
      mountLandmarkMarkers(mapElementRef.current, newCity.landmarks);

      const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 1024;
      const targetCam = isMobileScreen ? newCity.initialCamMobile : newCity.initialCam;

      setIsFlying(true);
      try {
        mapElementRef.current.flyCameraTo({
          endCamera: {
            center: targetCam.center,
            range: targetCam.range,
            tilt: targetCam.tilt,
            heading: targetCam.heading,
          },
          durationMillis: 2200,
        });

        if (flightTimerRef.current) clearTimeout(flightTimerRef.current);
        flightTimerRef.current = setTimeout(() => {
          setIsFlying(false);
          setFlightStatus(`3D ${newCity.name} Overview Ready`);
        }, 2200);
      } catch (err) {
        console.warn("flyCameraTo city overview failed", err);
        setIsFlying(false);
      }
    }
  };

  // Auto-scroll list in Y so the active landmark and its embedded Places widget are entirely visible
  useEffect(() => {
    if (!activeLandmark) return;
    const scrollTarget = () => {
      const el = document.getElementById(`landmark-item-${activeLandmark.id}`);
      if (el && listContainerRef.current) {
        const container = listContainerRef.current;
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        if (elRect.bottom > containerRect.bottom) {
          container.scrollTo({
            top: container.scrollTop + (elRect.bottom - containerRect.bottom) + 16,
            behavior: 'smooth',
          });
        } else if (elRect.top < containerRect.top) {
          container.scrollTo({
            top: container.scrollTop - (containerRect.top - elRect.top) - 12,
            behavior: 'smooth',
          });
        }
      }
    };

    // Scroll immediately, then after component DOM expansion and Places UI kit rendering
    scrollTarget();
    const timer1 = setTimeout(scrollTarget, 100);
    const timer2 = setTimeout(scrollTarget, 300);
    const timer3 = setTimeout(scrollTarget, 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [activeLandmark?.id, showPopovers, isMobileDrawerExpanded]);

  // Load Google Maps API 3D
  useEffect(() => {
    if (!isValidGoogleMapsKey(apiKey)) {
      setMapsLoaded(false);
      setFlightStatus("High-Resolution Satellite Mode Ready");
      return;
    }

    setFlightStatus("Initializing Google 3D Maps...");
    loadGoogleMapsScript(apiKey)
      .then(() => {
        setMapsLoaded(true);
        setAuthFailed(false);
        setFlightStatus("Engine Ready — Coordinates calibrated");
      })
      .catch((err) => {
        console.warn("Google Maps 3D loading note:", err);
        setMapsLoaded(false);
        setFlightStatus("High-Resolution Satellite Mode Ready");
      });
  }, [apiKey]);

  // Initialize and mount Google Map 3D element
  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current) return;

    let isCancelled = false;

    // Clear target container first
    mapContainerRef.current.innerHTML = '';
    markersRef.current = [];

    const initialize3DMap = async () => {
      try {
        const [maps3dLib, markerLib, placesLib] = await Promise.all([
          (window as any).google.maps.importLibrary('maps3d'),
          (window as any).google.maps.importLibrary('marker'),
          (window as any).google.maps.importLibrary('places'),
        ]);

        if (isCancelled) return;

        const { Map3DElement } = maps3dLib;
        setPlacesLoaded(true);

        const currentCity = getCityConfig(selectedCityId);
        setLandmarksList(currentCity.landmarks);

        // Helper for responsive camera overview framing all markers
        const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 1024;
        const initialCam = isMobileScreen ? currentCity.initialCamMobile : currentCity.initialCam;

        // Setup Map3DElement safely with constructor options, attribution, and hiding redundant native UI widgets that overlap the bottom menu
        const map = new Map3DElement({
          center: initialCam.center,
          range: initialCam.range,
          tilt: initialCam.tilt,
          heading: initialCam.heading,
          mapId: 'ccfdf8d031b6b83ca3b365e5',
          defaultUIHidden: true,
          defaultUIDisabled: true,
          ...(SOLUTION_ATTRIBUTION_ID ? { internalUsageAttributionIds: [SOLUTION_ATTRIBUTION_ID] } : {}),
        });

        // Hide default native overlapping compass and navigation controls (since our custom control deck provides full tour, compass, speed, basemap, and theme controls)
        try {
          (map as any).defaultUIHidden = true;
          (map as any).defaultUIDisabled = true;
          map.setAttribute('default-ui-hidden', '');
          map.setAttribute('default-ui-disabled', '');
        } catch (uiErr) { }

        // Set map-id and internal-usage-attribution-ids defensively
        try {
          map.setAttribute('map-id', 'ccfdf8d031b6b83ca3b365e5');
          if (SOLUTION_ATTRIBUTION_ID) {
            (map as any).internalUsageAttributionIds = [SOLUTION_ATTRIBUTION_ID];
            map.setAttribute('internal-usage-attribution-ids', SOLUTION_ATTRIBUTION_ID);
          }
        } catch (idErr) { }

        // Set mode defensively on the element
        try {
          if (mapMode) {
            map.mode = mapMode;
            map.setAttribute('mode', mapMode);
          }
        } catch (modeErr) { }

        if (isCancelled) return;

        map.style.width = '100%';
        map.style.height = '100%';
        map.style.display = 'block';
        map.style.filter = mapMode === 'ROADMAP' ? 'none' : 'brightness(1.05) contrast(1.05)';
        mapElementRef.current = map;
        mapContainerRef.current?.appendChild(map);

        // Add dynamic POI click listener on the Map3DElement to catch POI interactions and pause active tour
        const handleMapPoiClick = async (event: any) => {
          try {
            // Check if the clicked object has a placeId
            if (event && event.placeId) {
              const clickedPlaceId = event.placeId;
              console.log('Clicked Place ID:', clickedPlaceId);

              // Prevents the default Google info window from popping up
              if (typeof event.stop === 'function') event.stop();
              if (typeof event.preventDefault === 'function') event.preventDefault();

              // Pause Tour if user clicks on a point of interest on the map
              if (tourActiveRef.current || isTourPausedRef.current) {
                if (pauseGuidedTourRef.current) {
                  pauseGuidedTourRef.current();
                }
              }

              setClickedPlaceId(clickedPlaceId);
              setShowPopovers(true);
              setHasInteractedWithTour(true);
              setShowLandingBanner(false);

              // 1. Check if clicked place is one of the predefined landmarks of current city
              const found = currentCity.landmarks.find(l => l.placeId === clickedPlaceId);
              if (found) {
                setActiveLandmark(found);
                setShowMobilePlaceModal(true);
                if (selectAndFlyToLandmarkRef.current) {
                  selectAndFlyToLandmarkRef.current(found);
                }
                return;
              }

              // 2. If it's a Roadmap / Basemap POI icon (e.g. restaurants, museums, shops, etc.)
              let lat = Number(event.position?.lat ?? event.position?.latitude ?? (currentCity.initialCam?.center?.lat ?? 33.9980));
              let lng = Number(event.position?.lng ?? event.position?.longitude ?? (currentCity.initialCam?.center?.lng ?? 72.9340));
              let placeName = 'Selected Place';
              let placeDesc = 'Point of Interest';
              let placeCategory = 'Point of Interest';

              // Fetch details using event.fetchPlace() if provided by Google Maps 3D Platform
              if (typeof event.fetchPlace === 'function') {
                try {
                  const placeObj = await event.fetchPlace();
                  if (placeObj) {
                    try {
                      await placeObj.fetchFields({
                        fields: ['displayName', 'formattedAddress', 'editorialSummary', 'location', 'primaryTypeDisplayName', 'types', 'rating', 'userRatingCount', 'websiteURI']
                      });
                    } catch (fErr) {}
                    if (placeObj.displayName || placeObj.name) {
                      placeName = placeObj.displayName || placeObj.name;
                    }
                    if (placeObj.editorialSummary || placeObj.formattedAddress) {
                      placeDesc = placeObj.editorialSummary || placeObj.formattedAddress;
                    }
                    if (placeObj.primaryTypeDisplayName) {
                      placeCategory = placeObj.primaryTypeDisplayName;
                    }
                    if (placeObj.location) {
                      const pLat = typeof placeObj.location.lat === 'function' ? placeObj.location.lat() : placeObj.location.lat;
                      const pLng = typeof placeObj.location.lng === 'function' ? placeObj.location.lng() : placeObj.location.lng;
                      if (pLat !== undefined && pLng !== undefined) {
                        lat = Number(pLat);
                        lng = Number(pLng);
                      }
                    }
                  }
                } catch (fetchErr) {
                  console.warn("Could not fetch Place details via event.fetchPlace:", fetchErr);
                }
              } else if ((window as any).google?.maps?.places?.Place && clickedPlaceId) {
                try {
                  const placeObj = new (window as any).google.maps.places.Place({ id: clickedPlaceId });
                  await placeObj.fetchFields({
                    fields: ['displayName', 'formattedAddress', 'editorialSummary', 'location', 'primaryTypeDisplayName', 'types', 'rating', 'userRatingCount', 'websiteURI']
                  });
                  if (placeObj.displayName || placeObj.name) {
                    placeName = placeObj.displayName || placeObj.name;
                  }
                  if (placeObj.editorialSummary || placeObj.formattedAddress) {
                    placeDesc = placeObj.editorialSummary || placeObj.formattedAddress;
                  }
                  if (placeObj.primaryTypeDisplayName) {
                    placeCategory = placeObj.primaryTypeDisplayName;
                  }
                  if (placeObj.location) {
                    const pLat = typeof placeObj.location.lat === 'function' ? placeObj.location.lat() : placeObj.location.lat;
                    const pLng = typeof placeObj.location.lng === 'function' ? placeObj.location.lng() : placeObj.location.lng;
                    if (pLat !== undefined && pLng !== undefined) {
                      lat = Number(pLat);
                      lng = Number(pLng);
                    }
                  }
                } catch (pErr) {}
              }

              // Create dynamic Landmark representation for this Roadmap POI
              const dynamicLandmark: Landmark = {
                id: `poi-${clickedPlaceId}`,
                name: placeName,
                placeId: clickedPlaceId,
                lat,
                lng,
                altitude: 15,
                heading: mapElementRef.current?.heading || 0,
                tilt: 55,
                camAltitude: 200,
                camRange: 600,
                camTilt: 55,
                camHeading: mapElementRef.current?.heading || 0,
                category: placeCategory,
                description: placeDesc,
                highlights: [],
                iconName: 'poi',
                pinColor: '#06b6d4',
                glyph: '📍',
                svgIcon: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
              };

              setActiveLandmark(dynamicLandmark);
              setShowMobilePlaceModal(true);
              setFlightStatus(`Viewing ${placeName}`);

              // Fly camera smoothly to the clicked Roadmap POI location
              if (mapElementRef.current && lat && lng) {
                try {
                  const currentHeading = mapElementRef.current.heading || 0;
                  mapElementRef.current.flyCameraTo({
                    endCamera: {
                      center: { lat: Number(lat), lng: Number(lng), altitude: 25 },
                      range: 650,
                      tilt: 55,
                      heading: currentHeading
                    },
                    durationMillis: 1600
                  });
                } catch (flyErr) {
                  console.warn("Could not fly to clicked POI:", flyErr);
                }
              }
            }
          } catch (clickErr) {
            console.error("Error processing map click:", clickErr);
          }
        };

        map.addEventListener('gmp-click', handleMapPoiClick);
        map.addEventListener('click', handleMapPoiClick);

        // Mount 3D Markers for the active city with custom SVG pin icons
        mountLandmarkMarkers(map, currentCity.landmarks);

        // Keep initial view as the overview showing all landmarks
        setFlightStatus(`3D ${currentCity.name} Overview Ready`);

      } catch (e) {
        console.error("3D map bootstrap failed:", e);
        setLoadError("Failed to initialize Google Maps 3D Platform. Verify your API key has Map3D and Places enabled.");
        setFlightStatus("Initialization Failed");
      }
    };

    initialize3DMap();

    // Continuous banner blocker to strip any injected alpha/experimental warning banners in DOM and shadow DOM
    const suppressAlphaBanners = () => {
      const bannerSelectors = [
        'gmp-map-3d [part="banner"]',
        'gmp-map-3d [part*="banner"]',
        '.gm-banner',
        '.gmp-banner',
        '.gm-style-banner',
        '[aria-label*="warning" i]',
        '[aria-label*="alpha" i]',
        '[aria-label*="experimental" i]',
        '[role="alert"]',
        '[role="region"][aria-label*="warning" i]',
        'div[style*="255, 238, 187"]',
        'div[style*="254, 240, 138"]'
      ];
      bannerSelectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            (el as HTMLElement).style.setProperty('display', 'none', 'important');
            (el as HTMLElement).style.setProperty('opacity', '0', 'important');
            (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
            (el as HTMLElement).style.setProperty('height', '0', 'important');
            (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
          });
        } catch (e) { }
      });

      if (mapElementRef.current?.shadowRoot) {
        try {
          const root = mapElementRef.current.shadowRoot;
          if (!root.querySelector('#alpha-banner-blocker')) {
            const style = document.createElement('style');
            style.id = 'alpha-banner-blocker';
            style.textContent = `
              *[part*="banner"], [part*="banner"], .banner, .gm-banner, .gmp-banner, [role="alert"], [role="region"],
              div[style*="255, 238, 187"], div[style*="254, 240, 138"], div[aria-label*="alpha" i], div[aria-label*="warning" i] {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                pointer-events: none !important;
              }
            `;
            root.appendChild(style);
          }
          root.querySelectorAll('*').forEach(el => {
            const text = (el.textContent || '').toLowerCase();
            const role = el.getAttribute('role') || '';
            const part = el.getAttribute('part') || '';
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            if (
              part.includes('banner') ||
              part.includes('warning') ||
              role === 'alert' ||
              aria.includes('warning') ||
              aria.includes('alpha') ||
              aria.includes('experimental') ||
              (text.includes('alpha') && el.children.length === 0) ||
              (text.includes('experimental') && el.children.length === 0)
            ) {
              (el as HTMLElement).style.setProperty('display', 'none', 'important');
              (el as HTMLElement).style.setProperty('opacity', '0', 'important');
              (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
              (el as HTMLElement).style.setProperty('height', '0', 'important');
            }
          });
        } catch (e) { }
      }
    };

    suppressAlphaBanners();
    const bannerTimer = setInterval(suppressAlphaBanners, 200);

    return () => {
      isCancelled = true;
      clearInterval(bannerTimer);
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      if (panAnimFrameRef.current) cancelAnimationFrame(panAnimFrameRef.current);
    };
  }, [mapsLoaded]);

  // Update map style mode and visual CSS filter dynamically
  useEffect(() => {
    if (mapElementRef.current) {
      try {
        mapElementRef.current.mode = mapMode;
      } catch (e) { }
      try {
        mapElementRef.current.setAttribute('mode', mapMode);
      } catch (e) { }
      try {
        mapElementRef.current.style.filter = mapMode === 'ROADMAP' ? 'none' : 'brightness(1.05) contrast(1.05)';
      } catch (e) { }
    }
  }, [mapMode]);

  const handleMapModeChange = (mode: 'HYBRID' | 'SATELLITE' | 'ROADMAP') => {
    setMapMode(mode);
    if (mapElementRef.current) {
      try {
        mapElementRef.current.mode = mode;
      } catch (e) { }
      try {
        mapElementRef.current.setAttribute('mode', mode);
      } catch (e) { }
      try {
        mapElementRef.current.style.filter = mode === 'ROADMAP' ? 'none' : 'brightness(1.05) contrast(1.05)';
      } catch (e) { }
    }
  };

  const cycleMapMode = () => {
    const modes: Array<'HYBRID' | 'SATELLITE' | 'ROADMAP'> = ['HYBRID', 'SATELLITE', 'ROADMAP'];
    const currentIndex = modes.indexOf(mapMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    handleMapModeChange(nextMode);
  };

  // Auto-resolve live Place IDs directly from Google Places API for any landmark with potential Place ID changes
  useEffect(() => {
    if (!placesLoaded || !(window as any).google?.maps) return;

    const currentCity = getCityConfig(selectedCityId);
    const google = (window as any).google;
    const PlacesService = google.maps?.places?.PlacesService;
    const PlaceClass = google.maps?.places?.Place;

    currentCity.landmarks.forEach(async (lm) => {
      try {
        if (PlaceClass && typeof PlaceClass.searchByText === 'function') {
          const { places } = await PlaceClass.searchByText({
            textQuery: `${lm.name}, ${currentCity.name}`,
            fields: ['id', 'displayName', 'location'],
            locationBias: { lat: lm.lat, lng: lm.lng },
            maxResultCount: 1,
          });
          if (places && places.length > 0 && places[0].id) {
            setPlaceIds(prev => ({ ...prev, [lm.id]: places[0].id }));
            return;
          }
        }

        if (PlacesService) {
          const dummyEl = document.createElement('div');
          const service = new PlacesService(dummyEl);
          service.findPlaceFromQuery(
            {
              query: `${lm.name}, ${currentCity.name}`,
              fields: ['place_id', 'name'],
            },
            (results: any[], status: any) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]?.place_id) {
                setPlaceIds(prev => ({ ...prev, [lm.id]: results[0].place_id }));
              }
            }
          );
        }
      } catch (e) {
        // Fallback gracefully to default placeId
      }
    });
  }, [placesLoaded, selectedCityId]);

  const handleToggleForceNorth = () => {
    const nextForceNorth = !forceNorth;
    setForceNorth(nextForceNorth);
    forceNorthRef.current = nextForceNorth;

    if (!mapElementRef.current) return;

    // Case 1: Guided Tour is currently active
    if (tourActiveRef.current) {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      if (flightTimerRef.current) {
        clearTimeout(flightTimerRef.current);
      }

      const currentIdx = tourCurrentIndexRef.current;
      const targetLandmark = landmarksList[currentIdx] || activeLandmark || landmarksList[0];

      // Calculate distance from the current camera place to target landmark
      let dist = 1.5;
      if (mapElementRef.current.center) {
        dist = getHaversineDistance(
          mapElementRef.current.center.lat,
          mapElementRef.current.center.lng,
          targetLandmark.lat,
          targetLandmark.lng
        );
      }

      // Re-animate camera from current place to landmark with newly selected heading
      runAutofitsCameraAnimation(targetLandmark, null, dist);

      const rawFlightMs = Math.min(5500, Math.max(3400, Math.round(dist * 500 + 3000)));
      const flightDurationMs = Math.max(1400, Math.round(rawFlightMs / (tourSpeedRef.current || 1)));
      const dwellMs = Math.max(1200, Math.round(4500 / (tourSpeedRef.current || 1)));
      const totalWaitMs = flightDurationMs + dwellMs;

      // Continue tour loop seamlessly after completing flight + dwell at this landmark
      animationTimerRef.current = setTimeout(() => {
        if (!tourActiveRef.current) return;
        if (visitNextTourStepRef.current) {
          visitNextTourStepRef.current(currentIdx + 1);
        } else {
          startGuidedTour(currentIdx + 1);
        }
      }, totalWaitMs);
      return;
    }

    // Case 2: Tour is not active, but a landmark is selected
    if (activeLandmark) {
      let dist = 1.0;
      if (mapElementRef.current.center) {
        dist = getHaversineDistance(
          mapElementRef.current.center.lat,
          mapElementRef.current.center.lng,
          activeLandmark.lat,
          activeLandmark.lng
        );
      }
      runAutofitsCameraAnimation(activeLandmark, null, dist);
      return;
    }

    // Case 3: Overview mode - smoothly adjust heading of current view
    try {
      const curCenter = mapElementRef.current.center || {
        lat: 37.773,
        lng: -122.442,
        altitude: 0
      };
      const curRange = mapElementRef.current.range || 22000;
      const curTilt = mapElementRef.current.tilt || 32;
      const targetHeading = nextForceNorth ? 0 : 0;
      setIsFlying(true);
      mapElementRef.current.flyCameraTo({
        endCamera: {
          center: curCenter,
          range: curRange,
          tilt: curTilt,
          heading: targetHeading,
        },
        durationMillis: 1000
      });
      if (flightTimerRef.current) clearTimeout(flightTimerRef.current);
      flightTimerRef.current = setTimeout(() => {
        setIsFlying(false);
      }, 1000);
    } catch (e) {
      try {
        mapElementRef.current.heading = nextForceNorth ? 0 : 0;
      } catch (err) { }
      setIsFlying(false);
    }
  };

  // Implement the core AutofitsCameraAnimation-style cinematic camera fitting
  const runAutofitsCameraAnimation = (
    targetLandmark: Landmark,
    sourceLandmark: Landmark | null = null,
    explicitCustomDist: number | null = null
  ) => {
    // Cancel any active custom panning or flight timers
    if (panAnimFrameRef.current) {
      cancelAnimationFrame(panAnimFrameRef.current);
      panAnimFrameRef.current = null;
    }
    if (flightTimerRef.current) {
      clearTimeout(flightTimerRef.current);
      flightTimerRef.current = null;
    }

    if (!mapElementRef.current || typeof mapElementRef.current.flyCameraTo !== 'function') {
      setIsFlying(false);
      setFlightStatus(`Viewing ${targetLandmark.name}`);
      return;
    }

    // Stop any in-progress camera flight immediately so the new flight starts without delay
    try {
      if (typeof mapElementRef.current.stopCameraAnimation === 'function') {
        mapElementRef.current.stopCameraAnimation();
      }
    } catch (e) { }

    // Distance calculation for smooth cinematic timing (3.6s - 5.5s, doubled duration)
    let distance = 2.5;
    if (explicitCustomDist !== null) {
      distance = explicitCustomDist;
    } else if (sourceLandmark) {
      distance = getHaversineDistance(
        sourceLandmark.lat,
        sourceLandmark.lng,
        targetLandmark.lat,
        targetLandmark.lng
      );
    } else if (mapElementRef.current && mapElementRef.current.center) {
      distance = getHaversineDistance(
        mapElementRef.current.center.lat,
        mapElementRef.current.center.lng,
        targetLandmark.lat,
        targetLandmark.lng
      );
    }

    const rawDurationMs = Math.min(5500, Math.max(3400, Math.round(distance * 500 + 3000)));
    const totalDurationMs = Math.max(1400, Math.round(rawDurationMs / (tourSpeedRef.current || 1)));
    const targetTilt = Number(targetLandmark.camTilt || 60);
    const targetRange = Number(targetLandmark.camRange || 800);
    const landmarkHeading = Number(targetLandmark.camHeading ?? targetLandmark.heading ?? 0);
    // When forceNorth is ON: lock heading directly to 0 (North).
    // When forceNorth is OFF: fly directly to the landmark's designated scenic angle in a single unified trajectory.
    const targetHeading = forceNorthRef.current ? 0 : landmarkHeading;

    setIsFlying(true);
    setFlightStatus(`Flying to ${targetLandmark.name}...`);

    try {
      mapElementRef.current.flyCameraTo({
        endCamera: {
          center: {
            lat: Number(targetLandmark.lat),
            lng: Number(targetLandmark.lng),
            altitude: Number(targetLandmark.altitude || 0),
          },
          range: targetRange,
          tilt: targetTilt,
          heading: targetHeading,
        },
        durationMillis: totalDurationMs,
      });

      flightTimerRef.current = setTimeout(() => {
        setIsFlying(false);
        setFlightStatus(`Viewing ${targetLandmark.name}`);
      }, totalDurationMs);
    } catch (flyErr) {
      console.error("Error flying camera:", flyErr);
      setIsFlying(false);
      setFlightStatus(`Viewing ${targetLandmark.name}`);
    }
  };

  // Immediate speed adjustment: cycles 1x -> 1.5x -> 2x and immediately speeds up active flight / animation
  const cycleTourSpeed = () => {
    const speeds = [1, 1.5, 2];
    const currentIdx = speeds.indexOf(tourSpeedRef.current);
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
    setTourSpeed(nextSpeed);
    tourSpeedRef.current = nextSpeed;

    if (!mapElementRef.current) return;

    // Case 1: If Guided Tour is currently active, immediately speed up flight to current destination
    if (tourActiveRef.current) {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      if (flightTimerRef.current) {
        clearTimeout(flightTimerRef.current);
      }

      const currentIdx = tourCurrentIndexRef.current;
      const targetLandmark = landmarksList[currentIdx] || activeLandmark || landmarksList[0];

      // Calculate distance from current camera place to target landmark
      let dist = 1.5;
      if (mapElementRef.current.center) {
        dist = getHaversineDistance(
          mapElementRef.current.center.lat,
          mapElementRef.current.center.lng,
          targetLandmark.lat,
          targetLandmark.lng
        );
      }

      // Re-animate immediately with the new speed factor
      runAutofitsCameraAnimation(targetLandmark, null, dist);

      const rawFlightMs = Math.min(5500, Math.max(3400, Math.round(dist * 500 + 3000)));
      const flightDurationMs = Math.max(1400, Math.round(rawFlightMs / nextSpeed));
      const dwellMs = Math.max(1200, Math.round(4500 / nextSpeed));
      const totalWaitMs = flightDurationMs + dwellMs;

      animationTimerRef.current = setTimeout(() => {
        if (!tourActiveRef.current) return;
        if (visitNextTourStepRef.current) {
          visitNextTourStepRef.current(currentIdx + 1);
        } else {
          startGuidedTour(currentIdx + 1);
        }
      }, totalWaitMs);
      return;
    }

    // Case 2: If single landmark is in mid-flight, immediately accelerate to target
    if (activeLandmark && isFlying) {
      let dist = 1.0;
      if (mapElementRef.current.center) {
        dist = getHaversineDistance(
          mapElementRef.current.center.lat,
          mapElementRef.current.center.lng,
          activeLandmark.lat,
          activeLandmark.lng
        );
      }
      runAutofitsCameraAnimation(activeLandmark, null, dist);
    }
  };

  // Pause and Resume helpers for guided tour
  const pauseGuidedTour = () => {
    tourActiveRef.current = false;
    setIsTourPaused(true);
    isTourPausedRef.current = true;
    setIsFlying(false);
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }
    if (flightTimerRef.current) {
      clearTimeout(flightTimerRef.current);
    }
    setFlightStatus("Tour paused");
  };
  pauseGuidedTourRef.current = pauseGuidedTour;

  const resumeGuidedTour = () => {
    if (!isTourPausedRef.current) return;
    setIsTourPaused(false);
    isTourPausedRef.current = false;
    const currentIndex = activeLandmark ? landmarksList.findIndex(l => l.id === activeLandmark.id) : 0;
    const resumeIndex = currentIndex >= 0 ? currentIndex : 0;
    startGuidedTour(resumeIndex);
  };

  // Flying to standard landmarks
  const selectAndFlyToLandmark = (landmark: Landmark) => {
    setHasInteractedWithTour(true);
    if (tourActiveRef.current) {
      const idx = landmarksList.findIndex(l => l.id === landmark.id);
      if (idx !== -1) {
        startGuidedTour(idx);
        return;
      }
    }
    if (isTourPausedRef.current) {
      setIsTourPaused(false);
      isTourPausedRef.current = false;
      setIsTouring(false);
    }
    const parentSource = activeLandmark;
    setActiveLandmark(landmark);
    setClickedPlaceId(landmark.placeId || null);
    runAutofitsCameraAnimation(landmark, parentSource);
  };
  selectAndFlyToLandmarkRef.current = selectAndFlyToLandmark;

  // Autonomous Guided Tour controller
  const startGuidedTour = (startIndex: number = 0) => {
    setHasInteractedWithTour(true);
    tourActiveRef.current = false;
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }
    if (flightTimerRef.current) {
      clearTimeout(flightTimerRef.current);
    }

    tourActiveRef.current = true;
    setIsTouring(true);
    setTourIndex(startIndex);

    const visitNext = (idx: number) => {
      if (!tourActiveRef.current) {
        return;
      }

      const wrappedIndex = idx % landmarksList.length;
      tourCurrentIndexRef.current = wrappedIndex;
      const nextLandmark = landmarksList[wrappedIndex];

      setTourIndex(wrappedIndex);
      setActiveLandmark(nextLandmark);
      setClickedPlaceId(nextLandmark.placeId || null);

      const previousIndex = wrappedIndex > 0 ? wrappedIndex - 1 : landmarksList.length - 1;
      const previous = landmarksList[previousIndex];
      const dist = getHaversineDistance(previous.lat, previous.lng, nextLandmark.lat, nextLandmark.lng);

      try {
        runAutofitsCameraAnimation(nextLandmark, previous);
      } catch (err) {
        console.error("Fly error during guided tour:", err);
      }

      const baseFlightMs = Math.min(5500, Math.max(3400, Math.round(dist * 500 + 3000)));
      const flightDurationMs = Math.max(1400, Math.round(baseFlightMs / (tourSpeedRef.current || 1)));
      const dwellMs = Math.max(1200, Math.round(4500 / (tourSpeedRef.current || 1)));
      const totalWaitMs = flightDurationMs + dwellMs;

      animationTimerRef.current = setTimeout(() => {
        if (!tourActiveRef.current) return;
        visitNext(idx + 1);
      }, totalWaitMs);
    };

    visitNextTourStepRef.current = visitNext;
    visitNext(startIndex);
  };

  const stopGuidedTour = () => {
    tourActiveRef.current = false;
    setIsTouring(false);
    setIsFlying(false);
    setIsTourPaused(false);
    isTourPausedRef.current = false;
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }
    if (flightTimerRef.current) {
      clearTimeout(flightTimerRef.current);
    }
    if (mapElementRef.current && typeof mapElementRef.current.stopCameraAnimation === 'function') {
      try {
        mapElementRef.current.stopCameraAnimation();
      } catch (err) { }
    }
    setFlightStatus("Ready");
  };

  const handlePrev = () => {
    setHasInteractedWithTour(true);
    const currentIndex = activeLandmark ? landmarksList.findIndex(l => l.id === activeLandmark.id) : 0;
    const prevIndex = (currentIndex - 1 + landmarksList.length) % landmarksList.length;
    const target = landmarksList[prevIndex];
    setTourIndex(prevIndex);

    if (tourActiveRef.current) {
      startGuidedTour(prevIndex);
    } else {
      selectAndFlyToLandmark(target);
    }
  };

  const handleNext = () => {
    setHasInteractedWithTour(true);
    const currentIndex = activeLandmark ? landmarksList.findIndex(l => l.id === activeLandmark.id) : -1;
    const nextIndex = (currentIndex + 1) % landmarksList.length;
    const target = landmarksList[nextIndex];
    setTourIndex(nextIndex);

    if (tourActiveRef.current) {
      startGuidedTour(nextIndex);
    } else {
      selectAndFlyToLandmark(target);
    }
  };

  const flyToOverview = () => {
    if (tourActiveRef.current) {
      stopGuidedTour();
    }
    const currentCity = getCityConfig(selectedCityId);
    setActiveLandmark(null);
    setClickedPlaceId(null);
    setShowMobilePlaceModal(false);
    setFlightStatus(`3D ${currentCity.name} Overview`);
    setIsFlying(true);
    if (mapElementRef.current && typeof mapElementRef.current.flyCameraTo === 'function') {
      try {
        const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 1024;
        const targetCam = isMobileScreen ? currentCity.initialCamMobile : currentCity.initialCam;
        const duration = Math.max(1600, Math.round(3600 / (tourSpeedRef.current || 1)));

        mapElementRef.current.flyCameraTo({
          endCamera: {
            center: targetCam.center,
            range: targetCam.range,
            tilt: targetCam.tilt,
            heading: targetCam.heading,
          },
          durationMillis: duration,
        });

        if (flightTimerRef.current) clearTimeout(flightTimerRef.current);
        flightTimerRef.current = setTimeout(() => {
          setIsFlying(false);
          setFlightStatus(`3D ${currentCity.name} Overview Ready`);
        }, duration);
      } catch (err) {
        console.warn("flyCameraTo overview failed", err);
        setIsFlying(false);
      }
    } else {
      setIsFlying(false);
    }
  };

  const isDarkControls = theme === 'dark';

    return (
    <div className="relative w-screen h-screen bg-slate-900 text-slate-800 font-sans select-none antialiased overflow-hidden">
      
      {/* 100% Width and Height 3D Map Canvas */}
      <main className={`w-full h-full absolute inset-0 z-0 ${isDarkControls ? 'bg-slate-900' : 'bg-slate-100'} ${canUserControl ? 'cursor-grab active:cursor-grabbing' : 'cursor-wait'}`}>
        <div
          className={`w-full h-full absolute inset-0 z-0 ${isDarkControls ? 'bg-slate-900' : 'bg-slate-100'} relative overflow-hidden`}
          onPointerDown={triggerLockedIndicator}
          onTouchStart={triggerLockedIndicator}
        >
          {mapsLoaded ? (
            <div ref={mapContainerRef} className={`w-full h-full ${isFlying ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'}`} />
          ) : (
            <div className="w-full h-full">
              <SatelliteFallbackMap
                landmarks={landmarksList}
                activeLandmark={activeLandmark}
                onSelectLandmark={selectAndFlyToLandmark}
                center={{
                  lat: selectedCity.initialCam.center.lat,
                  lng: selectedCity.initialCam.center.lng,
                }}
                mapMode={mapMode}
                isFlying={isFlying}
              />
            </div>
          )}

          {/* Transparent pointer capture layer when camera is programmatically moving */}
          {isFlying && (
            <div
              className="absolute inset-0 z-20 cursor-wait select-none"
              onPointerDown={triggerLockedIndicator}
              onTouchStart={triggerLockedIndicator}
            />
          )}

          {/* Subtle On-Map Camera Moving Indicator: Minimal animated icon, no text obstruction */}
          <AnimatePresence>
            {showLockedIndicator && isFlying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none select-none flex items-center justify-center"
              >
                <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-slate-950/75 backdrop-blur-md border border-white/20 shadow-2xl">
                  {/* Orbiting dashed indicator ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute inset-1 rounded-full border border-dashed border-cyan-400/50"
                  />
                  {/* Animated Camera Flight Icon with subtle Move lock hint */}
                  <div className="relative flex items-center justify-center">
                    <Video className="w-6 h-6 text-cyan-400 animate-pulse" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                      <Move className="w-2.5 h-2.5 text-slate-500 opacity-60" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Determine theme based on basemap */}
            {/* TOP BAR: Immersive Tour & City Menu, Recenter button, and Demo/Custom Key button */}
            <header
              className={`absolute ${
                isShortLandscape
                  ? 'top-1.5 h-8 w-[calc(100%-1rem)] max-w-[380px] px-2 gap-1 rounded-xl'
                  : 'top-3 h-10 w-[calc(100%-1.5rem)] sm:w-[460px] max-w-[460px] px-2 sm:px-3 gap-1 sm:gap-2 rounded-2xl'
              } left-1/2 -translate-x-1/2 flex items-center justify-between shadow-xl backdrop-blur-md transition-colors duration-200 border pointer-events-auto z-40 ${
                isDarkControls
                  ? 'bg-[#1a1c1e]/90 text-white border-white/10 shadow-2xl'
                  : 'bg-white/95 text-slate-800 border-slate-300/90'
              }`}
            >
              <div className="relative flex items-center gap-1 sm:gap-1.5 min-w-0">
                <div
                  className={`${
                    isShortLandscape ? 'w-4 h-4 rounded-md' : 'w-5 h-5 rounded-lg'
                  } flex items-center justify-center shrink-0 border ${
                    isDarkControls
                      ? 'bg-cyan-950/80 border-cyan-700/40 text-cyan-400'
                      : 'bg-cyan-50 border-cyan-200 text-cyan-600'
                  }`}
                >
                  <Globe2 className={isShortLandscape ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
                </div>

                <span className={`font-bold ${isShortLandscape ? 'text-[11px]' : 'text-xs sm:text-sm'} tracking-tight shrink-0 whitespace-nowrap`}>
                  Immersive Tour
                </span>
                <span className="hidden sm:inline text-slate-400 text-xs font-light">|</span>

                <div ref={cityDropdownContainerRef} className="relative">
                  <button
                    onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                    className={`flex items-center gap-1 ${
                      isShortLandscape ? 'px-1 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-xs sm:text-sm'
                    } rounded-lg font-semibold tracking-tight border transition-colors cursor-pointer ${
                      isDarkControls
                        ? 'bg-white/5 hover:bg-white/10 text-cyan-400 border-white/10'
                        : 'bg-slate-100 hover:bg-slate-200/70 text-cyan-700 border-slate-200'
                    }`}
                    aria-label="Select City Tour"
                    title="Select City Tour"
                  >
                    <span className={isShortLandscape ? 'text-xs' : 'text-xs sm:text-sm'}>{selectedCity.flag}</span>
                    <span className="hidden sm:inline truncate max-w-[120px]">{selectedCity.name}</span>
                    <span className="sm:hidden truncate max-w-[70px]">
                      {selectedCity.id === 'san-francisco' ? 'SF' : selectedCity.name}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isCityDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {isCityDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute top-full left-0 mt-1.5 w-48 sm:w-52 rounded-xl shadow-2xl backdrop-blur-md border z-50 overflow-hidden flex flex-col ${
                          isDarkControls
                            ? 'bg-[#1a1c1e]/98 border-white/15 text-white shadow-black/60'
                            : 'bg-white/98 border-slate-200 text-slate-800 shadow-slate-300/50'
                        }`}
                      >
                        {/* Scrollable container displaying up to 7 cities simultaneously */}
                        <div
                          ref={cityDropdownScrollRef}
                          onScroll={handleCityScroll}
                          className="max-h-[min(238px,45vh)] overflow-y-auto py-1 scrollbar-thin divide-y-0"
                        >
                          {CITIES.map((city) => {
                            const isSelected = city.id === selectedCityId;
                            return (
                              <button
                                key={city.id}
                                onClick={() => handleSelectCity(city.id)}
                                className={`w-full px-2.5 py-1.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                  isSelected
                                    ? isDarkControls
                                      ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                                      : 'bg-cyan-50 text-cyan-700 font-semibold'
                                    : isDarkControls
                                    ? 'hover:bg-white/10 text-slate-200'
                                    : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="text-sm shrink-0">{city.flag}</span>
                                  <span className="truncate">{city.name}</span>
                                </div>
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0 ml-1.5" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Visual indicator arrow showing more cities exist below */}
                        {canScrollMoreCities && (
                          <button
                            onClick={handleScrollMoreCities}
                            className={`w-full py-1 px-2 flex items-center justify-center gap-1 border-t text-[10px] font-medium transition-colors cursor-pointer shrink-0 ${
                              isDarkControls
                                ? 'bg-[#141618] hover:bg-[#202226] border-white/10 text-cyan-400'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-cyan-700'
                            }`}
                            title="Scroll down for more cities"
                            aria-label="Scroll for more cities"
                          >
                            <span className="tracking-tight">More cities</span>
                            <ChevronDown className="w-3 h-3 text-cyan-400 animate-bounce" />
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Language Switcher Button (English / اردو) */}
                <button
                  onClick={toggleLanguage}
                  className={`${
                    isShortLandscape ? 'h-6 px-1.5 rounded-md text-[9.5px]' : 'h-7 px-2 rounded-lg text-[10px] sm:text-[11px]'
                  } border transition-all cursor-pointer flex items-center gap-1 font-bold shadow-2xs ${
                    lang === 'ur'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-950/40'
                      : isDarkControls
                      ? 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/15'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                  }`}
                  title="Switch Language / زبان تبدیل کریں (English / اردو)"
                  aria-label="Toggle Language"
                >
                  <span>{lang === 'ur' ? 'اردو' : 'EN'}</span>
                </button>

                {/* Recenter Camera View (Focus on all landmarks like page load) */}
                <button
                  onClick={() => {
                    flyToOverview();
                  }}
                  className={`${
                    isShortLandscape ? 'w-6 h-6 rounded-md' : 'w-7 h-7 rounded-lg'
                  } border transition-all cursor-pointer flex items-center justify-center shadow-2xs ${
                    isDarkControls
                      ? 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/15 hover:text-cyan-400'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 hover:text-cyan-600'
                  }`}
                  title="Recenter view to all landmarks (City Overview)"
                  aria-label="Recenter Map"
                >
                  <MapPin className={`${isShortLandscape ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-cyan-400 shrink-0`} />
                </button>

                {/* API Key Modal Button */}
                <button
                  onClick={() => {
                    setKeyInputValue(localStorage.getItem('gmp_custom_api_key') || localStorage.getItem('custom_maps_api_key') || '');
                    setShowApiKeyModal(true);
                  }}
                  className={`${
                    isShortLandscape
                      ? 'h-6 px-1.5 rounded-md text-[9.5px]'
                      : 'h-7 px-2 rounded-lg text-[10px] sm:text-[11px]'
                  } border transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 font-medium shadow-2xs ${
                    isDarkControls
                      ? 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/15'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                  }`}
                  title={mapsLoaded ? "Google Maps 3D Active" : isGeminiKey ? "Satellite View Active (Gemini key detected — click to add Maps key)" : "Google Maps API Key Setup"}
                  aria-label="API Key Settings"
                >
                  <Key className={`${isShortLandscape ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-blue-500 shrink-0`} />
                  <span className="font-semibold hidden sm:inline">{mapsLoaded ? (isCustomKey ? 'Custom Key' : 'Demo Key') : isGeminiKey ? 'Satellite Mode' : 'Key'}</span>
                  <span className="font-semibold sm:hidden">{mapsLoaded ? '3D' : 'Key'}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${mapsLoaded ? 'bg-emerald-500' : isGeminiKey ? 'bg-amber-400' : isCustomKey ? 'bg-rose-500' : 'bg-slate-400'}`} />
                </button>
              </div>
            </header>

            {/* BOTTOM BAR ON TOP OF THE MAP: Place name, description or places info, tour & arrow buttons, and upward expanding drawer */}
            <div className={`absolute ${
              isShortLandscape
                ? 'bottom-1.5 w-[calc(100%-1rem)] max-w-[390px]'
                : 'bottom-3 w-[calc(100%-1.5rem)] sm:w-[460px] max-w-[460px]'
            } left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex flex-col items-stretch`}>
              {/* Upward-Expanding Landmark Selection List */}
              <AnimatePresence>
                {isMobileDrawerExpanded && (
                  <motion.div
                    initial={{ y: 20, opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`w-full mb-1.5 sm:mb-2 ${
                      isShortLandscape ? 'max-h-[min(35vh,200px)] rounded-xl' : 'max-h-[min(40vh,280px)] rounded-2xl'
                    } flex flex-col shadow-2xl backdrop-blur-md transition-colors duration-200 border overflow-hidden ${
                      isDarkControls
                        ? 'bg-[#1a1c1e]/95 text-white border-white/15'
                        : 'bg-white/95 text-slate-800 border-slate-300'
                    }`}
                  >
                    <div className={`flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 border-b shrink-0 ${
                      isDarkControls ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                    }`}>
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Select Landmark</span>
                      </span>
                      <button
                        onClick={() => setIsMobileDrawerExpanded(false)}
                        className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer"
                        title="Close list"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div ref={listContainerRef} className="p-1.5 space-y-1 overflow-y-auto scrollbar-thin">
                      {landmarksList.map((loc) => {
                        const isActive = activeLandmark?.id === loc.id;
                        return (
                          <button
                            key={loc.id}
                            id={`landmark-item-${loc.id}`}
                            onClick={() => {
                              selectAndFlyToLandmark(loc);
                              setIsMobileDrawerExpanded(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                              isActive
                                ? isDarkControls
                                  ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-xs'
                                  : 'bg-cyan-50 border-cyan-300 text-cyan-950 shadow-xs'
                                : isDarkControls
                                  ? 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'
                                  : 'bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 truncate">
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all ${
                                  isActive
                                    ? 'bg-cyan-600 text-white shadow-2xs'
                                    : isDarkControls
                                      ? 'bg-white/10 text-cyan-400'
                                      : 'bg-slate-200 text-cyan-700'
                                }`}
                                dangerouslySetInnerHTML={{
                                  __html: (loc.svgIcon || '')
                                    .replace(/stroke="[^"]*"/, isActive ? 'stroke="#FFFFFF"' : isDarkControls ? 'stroke="#38bdf8"' : 'stroke="#0284C7"')
                                    .replace(/width="[^"]*"/, 'width="12"')
                                    .replace(/height="[^"]*"/, 'height="12"')
                                }}
                              />
                              <div className="min-w-0 flex flex-col leading-tight">
                                <span className="font-semibold text-xs truncate">
                                  {lang === 'ur' && loc.urduName ? loc.urduName : loc.name}
                                </span>
                                {loc.urduName && (
                                  <span className={`text-[9.5px] truncate font-normal ${isActive ? (isDarkControls ? 'text-cyan-200' : 'text-cyan-800') : 'text-slate-400'}`}>
                                    {lang === 'ur' ? loc.name : loc.urduName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isActive && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: loc.pinColor || '#06b6d4' }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* The Bottom Bar Card: Name/Description OR Place Info Widget, Tour, Prev/Next, and Utility Controls */}
              <div
                className={`w-full ${
                  isShortLandscape ? 'rounded-xl p-1.5 space-y-1' : 'rounded-2xl p-2 sm:p-2.5 space-y-1.5'
                } shadow-2xl backdrop-blur-md transition-colors duration-200 border ${
                  isDarkControls
                    ? 'bg-[#1a1c1e]/95 text-white border-white/15'
                    : 'bg-white/95 text-slate-800 border-slate-300/90'
                }`}
              >
                {!showMobilePlaceModal ? (
                  <>
                    {/* Row 1: Landmark Name & Action Toggles */}
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                      <div
                        onClick={() => toggleDescriptionFold()}
                        className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 cursor-pointer select-none group"
                        title={isDescriptionVisible ? "Click to fold description" : "Click to unfold description"}
                      >
                        {activeLandmark ? (
                          <span
                            className={`${
                              isShortLandscape ? 'w-4.5 h-4.5' : 'w-5 h-5 sm:w-6 sm:h-6'
                            } rounded-md flex items-center justify-center shrink-0 bg-cyan-600 text-white shadow-2xs`}
                            dangerouslySetInnerHTML={{
                              __html: (activeLandmark.svgIcon || '')
                                .replace(/stroke="[^"]*"/, 'stroke="#FFFFFF"')
                                .replace(/width="[^"]*"/, isShortLandscape ? 'width="11"' : 'width="13"')
                                .replace(/height="[^"]*"/, isShortLandscape ? 'height="11"' : 'height="13"')
                            }}
                          />
                        ) : (
                          <div className={`${
                            isShortLandscape ? 'w-4.5 h-4.5' : 'w-5 h-5 sm:w-6 sm:h-6'
                          } rounded-md flex items-center justify-center shrink-0 bg-cyan-900/60 border border-cyan-500/40 text-cyan-300`}>
                            <Globe className={isShortLandscape ? "w-3 h-3" : "w-3.5 h-3.5"} />
                          </div>
                        )}
                        <div className="min-w-0 flex flex-col">
                          <h2 className={`font-bold ${
                            isShortLandscape ? 'text-[11px]' : 'text-xs sm:text-sm'
                          } truncate leading-tight group-hover:text-cyan-400 transition-colors`}>
                            {activeLandmark
                              ? (lang === 'ur' && activeLandmark.urduName ? activeLandmark.urduName : activeLandmark.name)
                              : (lang === 'ur' ? (selectedCity.id === 'haripur' ? 'ہری پور فضائی جائزہ' : `${selectedCity.name} جائزہ`) : `${selectedCity.name} Overview`)}
                          </h2>
                          {activeLandmark?.urduName && (
                            <span className="text-[10px] text-slate-400 truncate">
                              {lang === 'ur' ? activeLandmark.name : activeLandmark.urduName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Description Fold / Unfold Button */}
                        <button
                          onClick={toggleDescriptionFold}
                          className={`${
                            isShortLandscape ? 'p-0.5 rounded-md' : 'p-1 sm:p-1.5 rounded-lg'
                          } border transition-all cursor-pointer flex items-center justify-center ${
                            isDescriptionVisible
                              ? isDarkControls
                                ? 'bg-white/10 hover:bg-white/20 text-cyan-400 border-white/10'
                                : 'bg-slate-100 hover:bg-slate-200 text-cyan-700 border-slate-200'
                              : isDarkControls
                                ? 'bg-white/5 hover:bg-white/10 text-slate-400 border-white/5'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                          title={isDescriptionVisible ? "Fold description" : "Unfold description"}
                          aria-label={isDescriptionVisible ? "Fold description" : "Unfold description"}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isDescriptionVisible ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Landmark list drawer trigger */}
                        <button
                          onClick={() => setIsMobileDrawerExpanded(!isMobileDrawerExpanded)}
                          className={`${
                            isShortLandscape ? 'p-0.5 rounded-md' : 'p-1 sm:p-1.5 rounded-lg'
                          } border transition-all cursor-pointer flex items-center justify-center ${
                            isMobileDrawerExpanded
                              ? 'bg-cyan-600 text-white border-cyan-500'
                              : isDarkControls
                                ? 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                          title={isMobileDrawerExpanded ? "Hide Landmarks List" : "Show Landmarks List"}
                          aria-label={isMobileDrawerExpanded ? "Hide Landmarks List" : "Show Landmarks List"}
                        >
                          {isMobileDrawerExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <List className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Landmark Description (Visible by default on desktop/laptop/tablet/portrait, folded by default ONLY on mobile horizontal) */}
                    <AnimatePresence>
                      {isDescriptionVisible && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className={`${
                            isShortLandscape ? 'max-h-[36px]' : 'max-h-[52px] sm:max-h-[68px]'
                          } overflow-y-auto scrollbar-thin pr-1 select-text pt-0.5 pb-0.5`}>
                            <p className={`${
                              isShortLandscape ? 'text-[9.5px]' : 'text-[10.5px] sm:text-[11.5px]'
                            } leading-relaxed ${
                              isDarkControls ? 'text-slate-300' : 'text-slate-600'
                            } ${lang === 'ur' ? 'text-right font-medium' : ''}`}>
                              {activeLandmark
                                ? (lang === 'ur' && activeLandmark.urduDescription ? activeLandmark.urduDescription : activeLandmark.description)
                                : (lang === 'ur'
                                  ? (selectedCity.id === 'haripur'
                                    ? 'خانپور ڈیم، تربیلا ڈیم، جولیاں گندھارا سٹوپا اور ہری پور کے دلکش مقامات کی تھری ڈی فضائی سیر کریں۔'
                                    : `${selectedCity.name} کے مشہور مقامات کی تھری ڈی فضائی سیر کریں۔`)
                                  : `Discover ${selectedCity.name}'s most iconic landmarks with 3D photorealistic tiles, elevation profiles, and live Google Place data.`)}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  /* Place Info Widget: Replaces Name & Description smoothly so there is zero overlap and no repeated name */
                  <div className="relative w-full rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowMobilePlaceModal(false)}
                      className={`absolute top-1.5 right-1.5 z-10 p-1 rounded-md transition-colors cursor-pointer ${
                        isDarkControls
                          ? 'bg-black/60 hover:bg-black/80 text-slate-300 hover:text-white'
                          : 'bg-white/80 hover:bg-white text-slate-600 hover:text-slate-900 shadow-xs'
                      }`}
                      title="Close place details"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className={`w-full rounded-xl p-1 border transition-all ${
                      isDarkControls
                        ? 'bg-black/40 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}>
                      <div className={`places-ui-kit-wrapper w-full ${
                        isShortLandscape ? 'min-h-[75px] max-h-[110px]' : 'min-h-[85px] max-h-[140px]'
                      } overflow-y-auto scrollbar-thin`}>
                        {placesLoaded ? (
                          <gmp-place-details-compact
                            key={`bottom-docked-${clickedPlaceId || activeLandmark?.placeId || (activeLandmark ? placeIds[activeLandmark.id] : undefined) || selectedCity.placeId}`}
                            orientation="HORIZONTAL"
                            style={{
                              width: '100%',
                              minHeight: isShortLandscape ? '75px' : '85px',
                              padding: 0,
                              margin: 0,
                              border: 'none',
                              backgroundColor: 'transparent',
                              colorScheme: isDarkControls ? 'dark' : 'light',
                              '--gmp-details-background': 'transparent',
                              '--gmp-details-color': isDarkControls ? '#f1f5f9' : '#0f172a',
                              '--gmp-details-font-family': 'inherit',
                            }}
                          >
                            <gmp-place-details-place-request
                              place={(() => {
                                const targetPlaceId = clickedPlaceId || activeLandmark?.placeId || (activeLandmark ? placeIds[activeLandmark.id] : undefined) || selectedCity.placeId;
                                return targetPlaceId.trim().replace(/^places\//, '');
                              })()}
                            />
                            <gmp-place-content-config>
                              <gmp-place-media lightbox-preferred="true" />
                              <gmp-place-rating />
                              <gmp-place-type />
                              <gmp-place-price />
                              <gmp-place-accessible-entrance-icon />
                              <gmp-place-open-now-status />
                              <gmp-place-attribution
                                light-scheme-color="gray"
                                dark-scheme-color="gray"
                              />
                            </gmp-place-content-config>
                          </gmp-place-details-compact>
                        ) : (
                          <div className="font-mono text-[10px] text-slate-400 py-3 text-center w-full">Loading Places Details...</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 3: Tour Navigation Deck with Prev, Tour, Next, Info, Force North, Speed, Basemap, Theme */}
                <div className={`flex items-center justify-between ${
                  isShortLandscape ? 'pt-1 gap-1' : 'pt-1.5 gap-1 sm:gap-2'
                } border-t ${
                  isDarkControls ? 'border-white/10' : 'border-slate-200'
                }`}>
                  {/* Left: Previous, Tour (with tasteful active state & recording indicator), Next */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <button
                      onClick={handlePrev}
                      className={`${
                        isShortLandscape ? 'w-6 h-6 rounded-md' : 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl'
                      } flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs ${
                        isDarkControls
                          ? 'bg-[#2b2d30] border border-white/10 text-slate-200 hover:text-cyan-400'
                          : 'bg-slate-100 border border-slate-200 text-slate-700 hover:text-cyan-600'
                      }`}
                      title="Previous Location"
                    >
                      <ChevronLeft className={isShortLandscape ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"} />
                    </button>

                    {/* Tour Button: Refined active tour style with subtle pulsing recording dot instead of eye-distracting solid red */}
                    <button
                      onClick={() => {
                        setHasInteractedWithTour(true);
                        setShowLandingBanner(false);
                        if (isTouring) {
                          stopGuidedTour();
                        } else {
                          const currentIdx = activeLandmark ? landmarksList.findIndex(l => l.id === activeLandmark.id) : 0;
                          startGuidedTour(currentIdx >= 0 ? currentIdx : 0);
                        }
                      }}
                      className={`${
                        isShortLandscape
                          ? 'py-0.5 px-2 rounded-md text-[10px] gap-1'
                          : 'py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs gap-1.5'
                      } font-bold tracking-wide transition-all flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 ${
                        isTouring
                          ? isDarkControls
                            ? 'bg-[#282a30] hover:bg-[#32353c] text-slate-100 border border-cyan-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                      title={isTouring ? "Click to stop Tour" : "Start Tour"}
                    >
                      {isTouring ? (
                        <>
                          <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-rose-500"></span>
                          </span>
                          <Square className="w-2 h-2 sm:w-2.5 sm:h-2.5 fill-current text-slate-200" />
                        </>
                      ) : (
                        <Play className={isShortLandscape ? "w-2.5 h-2.5 fill-white" : "w-3 h-3 sm:w-3.5 sm:h-3.5 fill-white"} />
                      )}
                      <span>Tour</span>
                    </button>

                    <button
                      onClick={handleNext}
                      className={`${
                        isShortLandscape ? 'w-6 h-6 rounded-md' : 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl'
                      } flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-2xs ${
                        isDarkControls
                          ? 'bg-[#2b2d30] border border-white/10 text-slate-200 hover:text-cyan-400'
                          : 'bg-slate-100 border border-slate-200 text-slate-700 hover:text-cyan-600'
                      }`}
                      title="Next Location"
                    >
                      <ChevronRight className={isShortLandscape ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"} />
                    </button>
                  </div>

                  {/* Right Controls: In requested order (Info -> Force North -> Camera Speed -> Basemap Mode -> Theme Change) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {/* 1. Google Place Details Widget Toggle */}
                    <button
                      onClick={togglePlaceDetails}
                      className={`${
                        isShortLandscape ? 'w-6 h-6 rounded-md' : 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl'
                      } flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xs shrink-0 ${
                        showMobilePlaceModal
                          ? isDarkControls
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-cyan-50 text-cyan-700 border border-cyan-300'
                          : isDarkControls
                            ? 'bg-[#2b2d30] border border-white/10 text-slate-300 hover:text-white'
                            : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                      title={showMobilePlaceModal ? "Hide Place Details" : "Show Place Details"}
                      aria-label="Place Details"
                    >
                      <Info className={isShortLandscape ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"} />
                    </button>

                    {/* 2. Force North / Lock North */}
                    <button
                      onClick={handleToggleForceNorth}
                      className={`${
                        isShortLandscape ? 'w-6 h-6 rounded-md' : 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl'
                      } flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-2xs shrink-0 ${
                        forceNorth
                          ? isDarkControls
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-cyan-50 text-cyan-700 border border-cyan-300'
                          : isDarkControls
                            ? 'bg-[#2b2d30] border border-white/10 text-slate-300 hover:text-white'
                            : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                      title={forceNorth ? "Lock North is ON (Facing North / Top)" : "Lock North is OFF (Scenic angles enabled)"}
                      aria-label="Toggle Lock North"
                    >
                      <Compass
                        className={`${
                          isShortLandscape ? 'w-3 h-3' : 'w-3.5 h-3.5 sm:w-4 sm:h-4'
                        } transition-transform duration-300 ease-out ${
                          forceNorth ? '-rotate-45' : 'rotate-45'
                        }`}
                      />
                    </button>

                    {/* 3. Camera Tour Speed: 1x, 1.5x, 2x with fixed width to prevent layout jitter */}
                    <button
                      onClick={cycleTourSpeed}
                      className={`${
                        isShortLandscape
                          ? 'w-6 h-6 rounded-md text-[9px]'
                          : 'w-7.5 h-7 sm:w-8.5 sm:h-8 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px]'
                      } flex items-center justify-center font-bold transition-all shrink-0 select-none active:scale-90 cursor-pointer shadow-2xs ${
                        tourSpeed !== 1
                          ? isDarkControls
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-cyan-50 text-cyan-700 border border-cyan-300'
                          : isDarkControls
                            ? 'bg-[#2b2d30] border border-white/10 text-slate-300 hover:text-white'
                            : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                      title={`Camera Tour Speed: ${tourSpeed}x (Click to cycle: 1x → 1.5x → 2x)`}
                      aria-label={`Camera Tour Speed ${tourSpeed}x`}
                    >
                      <span className="font-mono tabular-nums text-center leading-none">{tourSpeed}x</span>
                    </button>

                    {/* 4. Basemap Mode Cycle */}
                    <button
                      onClick={cycleMapMode}
                      className={`${
                        isShortLandscape ? 'w-6 h-6 rounded-md' : 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl'
                      } flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-2xs shrink-0 ${
                        isDarkControls
                          ? 'bg-[#2b2d30] border border-white/10 text-slate-300 hover:text-cyan-400'
                          : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-cyan-700'
                      }`}
                      title={`Basemap Mode: ${mapMode} (Click to switch)`}
                      aria-label="Switch Basemap Mode"
                    >
                      {mapMode === 'HYBRID' && <Layers className={isShortLandscape ? "w-3 h-3 text-cyan-400" : "w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400"} />}
                      {mapMode === 'SATELLITE' && <Globe className={isShortLandscape ? "w-3 h-3 text-cyan-400" : "w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400"} />}
                      {mapMode === 'ROADMAP' && <Map className={isShortLandscape ? "w-3 h-3 text-cyan-400" : "w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400"} />}
                    </button>

                    {/* 5. Theme Change Light / Dark (Moon flipping to Sun, keeping theme consistent without yellow) */}
                    <button
                      onClick={toggleTheme}
                      className={`${
                        isShortLandscape ? 'w-6 h-6 rounded-md' : 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl'
                      } flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-2xs shrink-0 ${
                        isDarkControls
                          ? 'bg-[#2b2d30] border border-white/10 text-slate-300 hover:text-cyan-400'
                          : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-cyan-700'
                      }`}
                      title={isDarkControls ? "Current Theme: Dark (Click to flip to Light Theme)" : "Current Theme: Light (Click to flip to Dark Theme)"}
                      aria-label={isDarkControls ? "Switch to Light Theme" : "Switch to Dark Theme"}
                    >
                      <div className={`transition-transform duration-300 ease-out flex items-center justify-center ${isDarkControls ? 'rotate-0' : 'rotate-180'}`}>
                        {isDarkControls ? (
                          <Moon className={isShortLandscape ? "w-3 h-3 text-cyan-400" : "w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400"} />
                        ) : (
                          <Sun className={isShortLandscape ? "w-3 h-3 text-slate-700" : "w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-700"} />
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* INITIAL WELCOME OVERLAY IN MAP CENTER */}
            <AnimatePresence>
              {showLandingBanner && !hasInteractedWithTour && !isTouring && activeLandmark === null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 10, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-auto select-none w-[92vw] max-w-[370px]"
                >
                  <div
                    className={`relative rounded-2xl shadow-2xl backdrop-blur-xl border p-4 sm:p-5 transition-colors duration-200 ${
                      isDarkControls
                        ? 'bg-[#181a1d]/95 text-white border-white/15 shadow-black/70'
                        : 'bg-white/95 text-slate-800 border-slate-200/90 shadow-slate-400/40'
                    }`}
                  >
                    {/* Dismiss Button in top corner */}
                    <button
                      onClick={() => {
                        setShowLandingBanner(false);
                        setHasInteractedWithTour(true);
                      }}
                      className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition-colors cursor-pointer ${
                        isDarkControls
                          ? 'text-slate-400 hover:text-white hover:bg-white/10'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      title="Dismiss"
                      aria-label="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2.5 mb-2.5">
                      <span className="text-2xl drop-shadow-sm">🇵🇰</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-sm sm:text-base tracking-tight">Haripur 3D Tour</h3>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            KPK
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-400/90 font-medium">ہری پور کی دلکش فضائی سیر</p>
                      </div>
                    </div>

                    <p className={`text-xs mb-3.5 leading-relaxed ${isDarkControls ? 'text-slate-300' : 'text-slate-600'}`}>
                      Experience cinematic 3D aerial flyovers across <strong className="text-cyan-400 font-semibold">Khanpur Dam</strong>, the colossal <strong className="text-blue-400 font-semibold">Tarbela Dam</strong>, ancient UNESCO <strong className="text-amber-400 font-semibold">Jaulian Monastery</strong>, and Hazara mountain ridges.
                    </p>

                    {/* Action: Tap / Click to start the tour */}
                    <button
                      onClick={() => {
                        setShowLandingBanner(false);
                        setHasInteractedWithTour(true);
                        startGuidedTour(0);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 active:scale-[0.99] text-white font-bold text-xs sm:text-sm shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer group"
                    >
                      <Play className="w-3.5 h-3.5 fill-white text-white group-hover:translate-x-0.5 transition-transform" />
                      <span>Start Tour / سیر شروع کریں</span>
                    </button>

                    {/* Secondary Note: 12 Handcrafted Landmarks */}
                    <div className="mt-2.5 text-center">
                      <p
                        className={`inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-medium select-none ${
                          isDarkControls ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        <MapPin className="w-3 h-3 shrink-0 opacity-70 text-cyan-400" />
                        <span>12 Handcrafted Landmarks • 3D Aerial Paths</span>
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

      {/* Google Maps API Key Setup Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiKeyModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 shadow-2xl text-slate-800 space-y-5 border border-slate-100 z-10"
            >
              {/* Header: Icon, Titles, Close */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                      Google Maps API Key Setup
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Set via <code className="font-mono text-blue-600 font-semibold bg-blue-50 px-1 py-0.5 rounded border border-blue-100 text-[11px]">VITE_GOOGLE_MAPS_API_KEY</code>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Active Key Card */}
              <div className="rounded-2xl border border-slate-200/90 p-4 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">
                    Active Mode
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      mapsLoaded
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : isGeminiKey
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : authFailed
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {mapsLoaded
                      ? 'Google Maps 3D Mesh (Active)'
                      : isGeminiKey
                      ? 'Satellite Mode (Gemini key entered)'
                      : authFailed
                      ? 'Maps Auth Issue'
                      : 'Satellite Mode (Active)'}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500 truncate">
                  Key: {formatMaskedKey(apiKey)}
                </div>

                {isGeminiKey && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed space-y-1">
                    <p className="font-semibold text-amber-800 flex items-center gap-1">
                      <span>💡 Gemini API Key Detected</span>
                    </p>
                    <p>
                      The current key starts with <code className="font-mono bg-amber-100 px-1 py-0.2 rounded text-[10px]">AQ.</code>, which is an AI Studio Gemini key.
                      Google Maps Platform requires an API key starting with <code className="font-mono bg-amber-100 px-1 py-0.2 rounded text-[10px]">AIzaSy...</code>.
                    </p>
                    <p className="text-amber-700 text-[10.5px]">
                      The app is running smoothly in <strong>High-Resolution Satellite Tour mode</strong>. Enter an <code className="font-mono text-[10px]">AIzaSy...</code> key below to activate Google 3D photorealistic mesh!
                    </p>
                  </div>
                )}
              </div>

              {/* Get Demo Key Link */}
              <div className="pt-0.5">
                <a
                  href="https://mapsplatform.google.com/maps-demo-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <span>Get your free Google Maps Demo Key</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Input Section */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Enter your Key
                </label>
                <input
                  type="text"
                  value={keyInputValue}
                  onChange={(e) => setKeyInputValue(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 font-mono text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                />
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleSaveApiKey}
                  className="w-full py-3 px-4 rounded-2xl font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Save & Reload</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
