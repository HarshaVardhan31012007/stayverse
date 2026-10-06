/**
 * StayVerse MapLibre GL Integration
 * High-performance vector tile rendering for property locations and geospatial discovery
 */

document.addEventListener('DOMContentLoaded', () => {
  const propertyMapEl = document.getElementById('propertyMap');

  if (propertyMapEl && typeof maplibregl !== 'undefined') {
    const rawLng = propertyMapEl.dataset.lng;
    const rawLat = propertyMapEl.dataset.lat;
    const title = propertyMapEl.dataset.title || 'Property Location';
    const address = propertyMapEl.dataset.address || '';
    const city = propertyMapEl.dataset.city || '';

    const lng = parseFloat(rawLng);
    const lat = parseFloat(rawLat);

    if (!isNaN(lng) && !isNaN(lat)) {
      // Clear any placeholder
      propertyMapEl.innerHTML = '';

      // Reliable, beautiful free vector tile style (Carto Voyager GL)
      const mapStyle =
        window.MAPLIBRE_STYLE_URL ||
        'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

      try {
        const map = new maplibregl.Map({
          container: 'propertyMap',
          style: mapStyle,
          center: [lng, lat],
          zoom: 13,
          scrollZoom: false, // Prevent accidental scrolling when browsing page
        });

        // Add standard navigation controls
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        map.addControl(new maplibregl.FullscreenControl(), 'top-right');

        // Create interactive popup
        const popupContent = `
          <div class="map-popup-card">
            <h4 class="map-popup-title">${title}</h4>
            <p class="map-popup-address"><i class="fa-solid fa-location-dot"></i> ${address ? address + ', ' : ''}${city}</p>
            <span class="map-popup-badge">Exact location provided upon booking</span>
          </div>
        `;

        const popup = new maplibregl.Popup({
          offset: 30,
          closeButton: false,
          className: 'stayverse-map-popup',
        }).setHTML(popupContent);

        // Custom styled StayVerse marker
        const markerEl = document.createElement('div');
        markerEl.className = 'stayverse-custom-marker';
        markerEl.innerHTML = `
          <div class="marker-pin">
            <i class="fa-solid fa-house"></i>
          </div>
          <div class="marker-pulse"></div>
        `;

        new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        // Open popup by default
        popup.addTo(map);

        // Ensure map renders properly after layout calculations
        map.on('load', () => {
          map.resize();
        });
      } catch (err) {
        console.error('[StayVerse MapLibre] Error initializing map:', err);
      }
    }
  }
});
