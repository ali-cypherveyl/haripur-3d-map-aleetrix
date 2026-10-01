# City 3D Immersive Tour — San Francisco & Beyond

An interactive, cinematic 3D urban tour web application built with **Google Maps Platform Web Components (Maps 3D API & Places UI Kit)**, React 19, TypeScript, and Tailwind CSS.

---

## 🌟 What This Tool Does

- **Cinematic 3D Camera Navigation**: Smoothly glides across photorealistic 3D cityscapes with dynamic altitude, tilt (pitch), and heading transitions using `<gmp-map-3d>`.
- **Landmark Tour Mode**: Automatically or manually journeys through curated city landmarks with smooth ease-in-out camera flights.
- **Places UI Kit Compact Details**: Live rich metadata overlays (ratings, review counts, opening hours, place categories, place photos, accessibility, and direct Google Maps links) powered by `<gmp-place-details-compact>`.
- **Interactive 3D Markers**: 3D pin markers (`<gmp-marker-3d>`) anchored directly in the 3D world with custom category icons and interactive selection.
- **Map View Modes**: Switch on-the-fly between **Hybrid / Photorealistic 3D Mesh**, **Satellite**, and **Roadmap** viewports.
- **Dynamic Orientation & Controls**: "Lock North" heading lock, compass heading, tilt reset, and responsive mobile-first tour menus.

---

## 🗺️ Google Maps Platform APIs Used

1. **Maps JavaScript API (3D Maps)**
   - `<gmp-map-3d>`: High-performance WebGL 3D photorealistic mesh tiles renderer.
   - `<gmp-marker-3d>`: 3D-space anchored markers with elevation and orientation.
   - Native camera controls: `flyCameraTo`, `flyCameraAround`, `center`, `range`, `tilt`, `heading`, `roll`.

2. **Places UI Kit (Web Components)**
   - `<gmp-place-details-compact>`: Out-of-the-box, accessible, and branded Google Maps place cards.
   - `<gmp-place-details-place-request>`: Requests place information using Place IDs.
   - `<gmp-place-media>`: Place photos with lightbox support.
   - `<gmp-place-rating>`, `<gmp-place-open-now-status>`, `<gmp-place-type>`, `<gmp-place-price>`.

3. **Google Maps Demo Key & Quota Support**
   - Free prototyping with Google Maps Demo Key support and instant fallback rendering.

---

## 🔑 Setup & Demo API Key

### Default Behavior
The application is pre-configured with a default demo key environment variable (`VITE_GOOGLE_MAPS_API_KEY`) for instant prototyping.

### Setting Up Your Own Key in the UI
1. Click the **Env Key** / **API Key Setup** button in the top navigation bar.
2. In the modal:
   - Paste your **Google Maps Platform API Key** (`AIzaSy...`) or a custom **Google Maps Demo Key**.
   - Click **Save & Reload Map**.
   - Your key is saved locally in your browser (`localStorage`) and used for all subsequent 3D map and Places requests.
3. Click **Reset to Demo Key** anytime to revert to the built-in demo environment.

### Setting Up Your Own Key via `.env`
Create or edit `.env` in the root directory:
```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY