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
        console.error('[StayVerse MapLibre] Error initializing property map:', err);
      }
    }
  }

  // 2. Multi-Property Explorer Map (Properties Index Discovery)
  const explorerMapEl = document.getElementById('explorerMap');
  if (explorerMapEl && typeof maplibregl !== 'undefined') {
    const geojsonUrl = explorerMapEl.dataset.geojsonUrl || '/api/properties/geojson';
    const mapStyle =
      window.MAPLIBRE_STYLE_URL ||
      'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

    try {
      const map = new maplibregl.Map({
        container: 'explorerMap',
        style: mapStyle,
        center: [78.9629, 20.5937], // Center of India / default world
        zoom: 4,
        scrollZoom: true,
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');

      fetch(geojsonUrl)
        .then((res) => res.json())
        .then((data) => {
          if (!data || !data.features || data.features.length === 0) return;

          const bounds = new maplibregl.LngLatBounds();

          data.features.forEach((feature) => {
            const coords = feature.geometry.coordinates;
            const p = feature.properties;

            bounds.extend(coords);

            // Custom price pill marker
            const markerEl = document.createElement('div');
            markerEl.className = 'stayverse-price-marker';
            markerEl.innerHTML = `<span>&#8377;${Number(p.price).toLocaleString('en-IN')}</span>`;

            const popupContent = `
              <div class="explorer-map-popup">
                <img src="${p.image}" alt="${p.title}" class="popup-thumb" onerror="this.src='https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80'" />
                <div class="popup-body">
                  <div class="popup-rating"><i class="fa-solid fa-star text-warning"></i> ${p.rating > 0 ? p.rating.toFixed(1) : 'New'}</div>
                  <h4 class="popup-title">${p.title}</h4>
                  <p class="popup-location"><i class="fa-solid fa-location-dot"></i> ${p.city}, ${p.country}</p>
                  <p class="popup-price"><strong>&#8377;${Number(p.price).toLocaleString('en-IN')}</strong> / ${p.priceUnit || 'night'}</p>
                  <a href="/properties/${p.id}" class="btn btn-primary btn-sm btn-block">View Stay</a>
                </div>
              </div>
            `;

            const popup = new maplibregl.Popup({
              offset: 20,
              closeButton: true,
              className: 'stayverse-explorer-popup',
            }).setHTML(popupContent);

            new maplibregl.Marker({ element: markerEl, anchor: 'center' })
              .setLngLat(coords)
              .setPopup(popup)
              .addTo(map);
          });

          // Fit map to show all discovered properties
          map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
        })
        .catch((err) => console.error('[StayVerse MapLibre] Error fetching GeoJSON:', err));

      window.stayverseExplorerMap = map;
    } catch (err) {
      console.error('[StayVerse MapLibre] Error initializing explorer map:', err);
    }
  }

  // 3. "Near Me" GPS Proximity Geolocation (Click to enable, Click again to toggle OFF)
  const nearMeBtn = document.getElementById('nearMeBtn');
  if (nearMeBtn) {
    nearMeBtn.addEventListener('click', () => {
      const lngInput = document.getElementById('geoLng');
      const latInput = document.getElementById('geoLat');
      const filterForm = document.getElementById('propertyFilterForm');

      // If Near Me is already active, clicking it toggles it OFF!
      if (latInput && latInput.value) {
        lngInput.value = '';
        latInput.value = '';
        sessionStorage.removeItem('stayverse_filter_url');
        nearMeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clearing GPS...';
        nearMeBtn.disabled = true;
        if (filterForm) filterForm.submit();
        return;
      }

      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      nearMeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
      nearMeBtn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (lngInput && latInput && filterForm) {
            lngInput.value = pos.coords.longitude;
            latInput.value = pos.coords.latitude;
            filterForm.submit();
          }
        },
        (err) => {
          console.warn('[Geolocation] Failed to get user position:', err.message);
          alert('Could not determine your location. Please check browser permissions.');
          nearMeBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Near Me';
          nearMeBtn.disabled = false;
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  // 4. Auto-trigger Nearby GPS search when visiting /properties/nearby or requested via autoNearMe
  const isNearbyRequest =
    window.location.pathname === '/properties/nearby' ||
    window.location.search.includes('autoNearMe=true') ||
    window.location.search.includes('nearMe=1');

  if (isNearbyRequest && nearMeBtn) {
    const latInput = document.getElementById('geoLat');
    if (latInput && !latInput.value) {
      setTimeout(() => {
        nearMeBtn.click();
      }, 400);
    }
  }
});
