/**
 * BloodConnect — Interactive Leaflet Map Manager
 */

let mapInstance = null;
let markersLayer = null;
let radiusCircle = null;
let selectedLocationMarker = null;

const MapManager = {
  init(containerId = 'leaflet-map', initialLat = 17.4938, initialLon = 78.3188, initialZoom = 12) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }

    // Initialize Map with dark tiles
    mapInstance = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([initialLat, initialLon], initialZoom);

    // High quality Dark Mode Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapInstance);

    markersLayer = L.layerGroup().addTo(mapInstance);

    // Enable click-to-pick location for form inputs if active
    mapInstance.on('click', (e) => {
      const { lat, lng } = e.latlng;
      this.setSelectedPin(lat, lng);
      
      // Update form inputs if available
      const latInput = document.getElementById('req-latitude') || document.getElementById('reg-latitude');
      const lonInput = document.getElementById('req-longitude') || document.getElementById('reg-longitude');
      if (latInput && lonInput) {
        latInput.value = lat.toFixed(4);
        lonInput.value = lng.toFixed(4);
        if (window.showToast) {
          window.showToast(`Selected Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
        }
      }
    });

    // Invalidate size on layout changes
    setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, 300);
  },

  setSelectedPin(lat, lon, label = 'Target Location') {
    if (!mapInstance) return;

    if (selectedLocationMarker) {
      markersLayer.removeLayer(selectedLocationMarker);
    }

    const pinIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `<div style="background:#e11d48; width:28px; height:28px; border-radius:50%; border:3px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 15px rgba(225,29,72,0.8); font-size:14px; color:#fff;">📍</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    selectedLocationMarker = L.marker([lat, lon], { icon: pinIcon })
      .bindPopup(`<b>${label}</b><br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`)
      .addTo(markersLayer);
  },

  setSearchCenterAndRadius(lat, lon, radiusKm = 10) {
    if (!mapInstance) return;

    if (radiusCircle) {
      markersLayer.removeLayer(radiusCircle);
    }

    // Draw Translucent Radar Circle
    radiusCircle = L.circle([lat, lon], {
      color: '#e11d48',
      fillColor: '#e11d48',
      fillOpacity: 0.12,
      weight: 2,
      radius: radiusKm * 1000 // meters
    }).addTo(markersLayer);

    this.setSelectedPin(lat, lon, 'Search Center');
  },

  renderDonorsAndHospitals(donors = [], hospitals = [], centerLat = 17.4938, centerLon = 78.3188, radiusKm = 15) {
    if (!mapInstance) {
      this.init('leaflet-map', centerLat, centerLon);
    }

    if (markersLayer) {
      markersLayer.clearLayers();
    }

    this.setSearchCenterAndRadius(centerLat, centerLon, radiusKm);

    // 1. Render Donors
    donors.forEach((donor) => {
      const isAvail = donor.availability;
      const bg = isAvail ? '#10b981' : '#64748b';
      const iconHtml = `
        <div style="background:${bg}; width:32px; height:32px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 12px ${bg}; color:#fff; font-weight:800; font-size:11px;">
          ${donor.blood_group}
        </div>
      `;

      const donorIcon = L.divIcon({
        className: 'donor-map-marker',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const popupContent = `
        <div style="color:#0f172a; padding:4px; font-family:'Plus Jakarta Sans', sans-serif;">
          <h4 style="margin:0 0 4px; color:#e11d48; font-size:14px;">${donor.name}</h4>
          <p style="margin:2px 0; font-size:12px;"><b>Blood Group:</b> <span style="background:#fee2e2; color:#b91c1c; padding:1px 5px; border-radius:4px; font-weight:700;">${donor.blood_group}</span></p>
          <p style="margin:2px 0; font-size:12px;"><b>Area:</b> ${donor.area || donor.city}</p>
          <p style="margin:2px 0; font-size:12px;"><b>Status:</b> ${isAvail ? '<span style="color:#059669; font-weight:bold;">🟢 Available</span>' : '<span style="color:#dc2626;">🔴 Busy</span>'}</p>
          ${donor.distance_km !== undefined ? `<p style="margin:4px 0 0; font-weight:bold; color:#059669; font-size:12px;">Distance: ${donor.distance_km} km</p>` : ''}
          <button onclick="window.App.requestSpecificDonor(${donor.donor_id || donor.id}, '${(donor.name || '').replace(/'/g, "\\'")}', '${donor.blood_group}', '${(donor.area || donor.city || '').replace(/'/g, "\\'")}')" 
            style="margin-top:8px; width:100%; background:#e11d48; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-weight:700; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;">
            🎯 Request Blood from ${donor.name.split(' ')[0]}
          </button>
        </div>
      `;

      L.marker([donor.latitude, donor.longitude], { icon: donorIcon })
        .bindPopup(popupContent)
        .addTo(markersLayer);
    });

    // 2. Render Hospitals
    hospitals.forEach((hosp) => {
      const hospIcon = L.divIcon({
        className: 'hosp-map-marker',
        html: `<div style="background:#3b82f6; width:30px; height:30px; border-radius:8px; border:2px solid #fff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 10px rgba(59,130,246,0.6); color:#fff; font-size:14px;">🏥</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const hospPopup = `
        <div style="color:#0f172a; padding:4px; font-family:'Plus Jakarta Sans', sans-serif;">
          <h4 style="margin:0 0 4px; color:#2563eb; font-size:14px;">${hosp.name}</h4>
          <p style="margin:2px 0; font-size:12px;"><b>City:</b> ${hosp.city} (${hosp.area || ''})</p>
          <p style="margin:2px 0; font-size:12px;"><b>Emergency:</b> ${hosp.phone}</p>
          <p style="margin:2px 0; font-size:11px; color:#059669;">Verified Blood Bank Partner</p>
        </div>
      `;

      L.marker([hosp.latitude, hosp.longitude], { icon: hospIcon })
        .bindPopup(hospPopup)
        .addTo(markersLayer);
    });

    // Auto fit bounds
    if (donors.length > 0 || hospitals.length > 0) {
      const group = new L.featureGroup(markersLayer.getLayers());
      mapInstance.fitBounds(group.getBounds().pad(0.15));
    }
  },

  invalidateSize() {
    if (mapInstance) {
      setTimeout(() => {
        try {
          mapInstance.invalidateSize();
        } catch (e) {
          console.warn('Map resize error:', e);
        }
      }, 150);
    }
  }
};

window.MapManager = MapManager;
Object.defineProperty(window, 'mapInstance', {
  get: () => mapInstance,
  configurable: true
});

