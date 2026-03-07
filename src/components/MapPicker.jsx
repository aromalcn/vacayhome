import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Navigation, MapPin } from 'lucide-react';
import { useToast } from './Toast';

// Fix for default marker icons in Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const LocationMarker = ({ position, setPosition, onLocationSelect }) => {
  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationSelect({ lat, lng });
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
};

// Component to handle map center updates
const ChangeView = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
};

const MapPicker = ({ onLocationSelect, initialLocation }) => {
  const { showToast } = useToast();
  const [position, setPosition] = useState(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const defaultCenter = [20.5937, 78.9629]; // India

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const newPos = [parseFloat(lat), parseFloat(lon)];
        setPosition(newPos);
        onLocationSelect({ lat: parseFloat(lat), lng: parseFloat(lon) });
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newPos = [latitude, longitude];
        setPosition(newPos);
        onLocationSelect({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        showToast('Could not get your location. Please check your browser permissions.', 'error');
        setLocating(false);
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex-grow flex gap-2">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder="Search for a place..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <button 
                type="submit"
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium whitespace-nowrap"
            >
                {searching ? '...' : 'Search'}
            </button>
        </form>
        
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-2xl hover:bg-blue-50 transition text-sm font-medium disabled:opacity-50"
        >
          <Navigation className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} />
          {locating ? 'Locating...' : 'Locate Me'}
        </button>
      </div>
      
      <div className="h-[300px] w-full rounded-2xl overflow-hidden border border-gray-200 z-0 shadow-inner relative group">
        <MapContainer
          center={position || defaultCenter}
          zoom={position ? 15 : 5}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} onLocationSelect={onLocationSelect} />
          {position && <ChangeView center={position} />}
        </MapContainer>
        
        {/* Visual feedback overlay when clicked */}
        <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                <MapPin className="w-3 h-3" />
                {position ? 'Location Fixed' : 'Select Location'}
            </div>
        </div>
      </div>
      
      <p className="text-xs text-gray-500 italic flex items-center">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
        Click on the map or use the tools above to set the exact property marker.
      </p>
    </div>
  );
};

export default MapPicker;
