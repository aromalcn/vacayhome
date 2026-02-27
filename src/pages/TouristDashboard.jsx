import { useState, useEffect } from 'react';
import { Calendar, Heart, MapPin, Search, User, IndianRupee, MessageSquare, Clock, ShieldAlert, Phone, Utensils, Bus, Sparkles, Navigation, Home, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { formatDate } from '../utils/dateFormatter';
import HeartButton from '../components/HeartButton';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet icon fix
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Component to handle map center updates
const ChangeMapView = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
};

const TouristDashboard = () => {
    const [properties, setProperties] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [savedProperties, setSavedProperties] = useState([]);
    const [recentMessages, setRecentMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [emergencyContact, setEmergencyContact] = useState(null);
    const [nearbyPOIs, setNearbyPOIs] = useState({
        attractions: [],
        restaurants: [],
        transport: [],
        events: []
    });
    const [allPOIs, setAllPOIs] = useState([]);
    const [nextBooking, setNextBooking] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Fetch User Profile Name and Emergency Contact
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship')
                    .eq('id', user.id)
                    .single();
                
                if (profile) {
                    setUserName(profile.full_name);
                    if (profile.emergency_contact_name) {
                        setEmergencyContact({
                            name: profile.emergency_contact_name,
                            phone: profile.emergency_contact_phone,
                            relationship: profile.emergency_contact_relationship
                        });
                    }
                }

                // Fetch User Bookings with joined Property details
                const { data: bookingsData, error } = await supabase
                    .from('bookings')
                    .select('*, properties(*)')
                    .eq('tourist_id', user.id)
                    .order('check_in', { ascending: true });
                
                if (error) console.error('Error fetching bookings:', error);
                const userBookings = bookingsData || [];
                setBookings(userBookings);

                // Find next confirmed/pending booking to show nearby guide
                const upcoming = userBookings.find(b => 
                    (b.status === 'confirmed' || b.status === 'pending') && 
                    new Date(b.check_in) >= new Date()
                );
                
                if (upcoming && upcoming.properties) {
                    setNextBooking(upcoming);
                    fetchNearbyPOIs(upcoming.properties.latitude, upcoming.properties.longitude);
                }

                // Fetch Saved Properties
                const { data: savedData, error: savedError } = await supabase
                    .from('saved_properties')
                    .select('property_id, properties(*)')
                    .eq('user_id', user.id);

                if (savedError) console.error('Error fetching saved properties:', savedError);
                if (savedData) {
                    const savedProps = savedData.map(item => item.properties);
                    setSavedProperties(savedProps);
                }

                // Fetch Recent Messages
                const { data: messagesData } = await supabase
                    .from('messages')
                    .select(`
                        content,
                        created_at,
                        is_read,
                        receiver_id,
                        property:property_id(title, image_url),
                        sender:sender_id(full_name),
                        receiver:receiver_id(full_name)
                    `)
                    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                    .order('created_at', { ascending: false });

                if (messagesData) {
                    const groups = {};
                    messagesData.forEach(msg => {
                        const otherPartyId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
                        const key = otherPartyId;
                        if (!groups[key]) {
                            groups[key] = {
                                other_party_name: msg.sender_id === user.id ? msg.receiver?.full_name : msg.sender?.full_name,
                                last_message: msg.content,
                                last_timestamp: msg.created_at,
                                property_title: msg.property?.title,
                                unread: !msg.is_read && msg.receiver_id === user.id
                            };
                        }
                    });
                    setRecentMessages(Object.values(groups).slice(0, 3));
                }
            }

            // Fetch Properties for Explore
            const { data: propertiesData } = await supabase
                .from('properties')
                .select('*, profiles!inner(is_verified), reviews(rating)')
                .eq('status', 'approved');
            
            let processedProperties = (propertiesData || []).map(prop => {
                const reviews = prop.reviews || [];
                const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
                const avgRating = reviews.length > 0 ? totalRating / reviews.length : 0;
                const reviewCount = reviews.length;
                return { ...prop, avgRating, reviewCount };
            });

            const validProperties = processedProperties
                .filter(prop => {
                    const owner = Array.isArray(prop.profiles) ? prop.profiles[0] : prop.profiles;
                    return owner && owner.is_verified === true && prop.availability !== 'Under Maintenance';
                })
                .sort((a, b) => b.avgRating - a.avgRating);

            setProperties(validProperties);

        } catch (error) {
            console.error('Error dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchNearbyPOIs = async (lat, lng) => {
        if (!lat || !lng) return;

        try {
            // Simple bounding box for ~15km (approx 0.135 degrees lat/lng)
            const range = 0.135; 
            const { data, error } = await supabase
                .from('location_pois')
                .select('*')
                .gte('latitude', lat - range)
                .lte('latitude', lat + range)
                .gte('longitude', lng - range)
                .lte('longitude', lng + range);

            if (error) throw error;

            if (data) {
                setAllPOIs(data);
                const categorized = {
                    attractions: data.filter(p => p.category === 'attraction'),
                    restaurants: data.filter(p => p.category === 'restaurant'),
                    transport: data.filter(p => p.category === 'transport'),
                    events: data.filter(p => p.category === 'event')
                };
                setNearbyPOIs(categorized);
            }
        } catch (err) {
            console.error('Error fetching nearby POIs:', err);
        }
    };

    // Custom Icons for Map
    const createCustomIcon = (color, type) => {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div class="relative flex items-center justify-center">
                    <div class="w-8 h-8 ${color} rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transform hover:scale-110 transition-transform">
                        <span class="pointer-events-none">${type === 'property' ? '🏠' : type === 'attraction' ? '🏛️' : type === 'restaurant' ? '🍽️' : type === 'transport' ? '🚌' : '🎉'}</span>
                    </div>
                    <div class="absolute -bottom-1 w-2 h-2 ${color} rotate-45 border-r border-b border-white"></div>
                </div>
            `,
            iconSize: [32, 38],
            iconAnchor: [16, 38]
        });
    };

    const POICard = ({ poi, icon: Icon, colorClass }) => (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10 shrink-0`}>
                    <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-gray-900 text-sm truncate">{poi.name}</h4>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{poi.description}</p>
                    {poi.info && Object.keys(poi.info).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(poi.info).slice(0, 2).map(([key, val]) => (
                                <span key={key} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-100">
                                    {val}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <a 
                href={`https://www.google.com/maps/dir/?api=1&destination=${poi.latitude},${poi.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition"
            >
                <Navigation className="w-3 h-3" />
                Directions
            </a>
        </div>
    );

    return (
        <div className="min-h-screen pt-20 bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-800">
                        Welcome back{userName ? `, ${userName}` : ''}!
                    </h1>
                    <div className="flex justify-between items-end">
                        <p className="text-gray-600">Manage your trips and saved homes.</p>
                        <div className="flex gap-4">
                            <Link to="/messages" className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center">
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Messages
                            </Link>
                            <Link to="/my-receipts" className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center">
                                View All Receipts &rarr;
                            </Link>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Local Guide Section */}
                    {nextBooking && (
                        <div className="md:col-span-2 lg:col-span-3 mb-10">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800">Your Local Guide for {nextBooking.properties.title}</h2>
                                        <p className="text-gray-500 text-sm">Hand-picked recommendations within 10km of your stay.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                        <div className="w-2 h-2 rounded-full bg-indigo-600"></div> Your Stay
                                    </span>
                                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                        <div className="w-2 h-2 rounded-full bg-red-500"></div> Sights
                                    </span>
                                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div> Dining
                                    </span>
                                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div> Transport
                                    </span>
                                    <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div> Events
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Map Container */}
                                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[400px] lg:h-[500px]">
                                    <MapContainer
                                        center={[nextBooking.properties.latitude, nextBooking.properties.longitude]}
                                        zoom={14}
                                        scrollWheelZoom={false}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        />
                                        <ChangeMapView center={[nextBooking.properties.latitude, nextBooking.properties.longitude]} />
                                        
                                        {/* Property Marker */}
                                        <Marker 
                                            position={[nextBooking.properties.latitude, nextBooking.properties.longitude]}
                                            icon={createCustomIcon('bg-indigo-600', 'property')}
                                        >
                                            <Popup>
                                                <div className="p-1">
                                                    <h4 className="font-bold text-gray-900">{nextBooking.properties.title}</h4>
                                                    <p className="text-xs text-gray-500">Your Base Camp</p>
                                                </div>
                                            </Popup>
                                        </Marker>

                                        {/* POI Markers */}
                                        {allPOIs.map(poi => (
                                            <Marker 
                                                key={poi.id} 
                                                position={[poi.latitude, poi.longitude]}
                                                icon={createCustomIcon(
                                                    poi.category === 'attraction' ? 'bg-red-500' :
                                                    poi.category === 'restaurant' ? 'bg-orange-500' :
                                                    poi.category === 'transport' ? 'bg-blue-500' : 'bg-green-500',
                                                    poi.category
                                                )}
                                            >
                                                <Popup>
                                                    <div className="p-2 min-w-[150px]">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                            poi.category === 'attraction' ? 'text-red-500' :
                                                            poi.category === 'restaurant' ? 'text-orange-500' :
                                                            poi.category === 'transport' ? 'text-blue-500' : 'text-green-500'
                                                        }`}>
                                                            {poi.category}
                                                        </span>
                                                        <h4 className="font-bold text-gray-900 text-sm mt-0.5">{poi.name}</h4>
                                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{poi.description}</p>
                                                        <a 
                                                            href={`https://www.google.com/maps/dir/?api=1&destination=${poi.latitude},${poi.longitude}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-2 flex items-center gap-1 text-[10px] font-bold text-blue-600"
                                                        >
                                                            <Navigation className="w-3 h-3" /> Get Directions
                                                        </a>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        ))}
                                    </MapContainer>
                                </div>

                                {/* Recommendation Columns - Scrollable on Desktop */}
                                <div className="lg:col-span-1 space-y-6 lg:h-[540px] lg:overflow-y-auto pr-2 custom-scrollbar">
                                    {/* Sights */}
                                    {nearbyPOIs.attractions.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between group cursor-default">
                                                <span className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-red-500" /> Nearby Attractions
                                                </span>
                                                <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{nearbyPOIs.attractions.length}</span>
                                            </h3>
                                            {nearbyPOIs.attractions.map(poi => (
                                                <POICard key={poi.id} poi={poi} icon={MapPin} colorClass="bg-red-500" />
                                            ))}
                                        </div>
                                    )}

                                    {/* Dining */}
                                    {nearbyPOIs.restaurants.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between cursor-default">
                                                <span className="flex items-center gap-2">
                                                    <Utensils className="w-4 h-4 text-orange-500" /> Top Dining
                                                </span>
                                                <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{nearbyPOIs.restaurants.length}</span>
                                            </h3>
                                            {nearbyPOIs.restaurants.map(poi => (
                                                <POICard key={poi.id} poi={poi} icon={Utensils} colorClass="bg-orange-500" />
                                            ))}
                                        </div>
                                    )}

                                    {/* Transport */}
                                    {nearbyPOIs.transport.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between cursor-default">
                                                <span className="flex items-center gap-2">
                                                    <Bus className="w-4 h-4 text-blue-500" /> Getting Around
                                                </span>
                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{nearbyPOIs.transport.length}</span>
                                            </h3>
                                            {nearbyPOIs.transport.map(poi => (
                                                <POICard key={poi.id} poi={poi} icon={Bus} colorClass="bg-blue-500" />
                                            ))}
                                        </div>
                                    )}

                                    {/* Events */}
                                    {nearbyPOIs.events.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-bold text-gray-900 flex items-center justify-between cursor-default">
                                                <span className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-green-500" /> Event Alerts
                                                </span>
                                                <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">{nearbyPOIs.events.length}</span>
                                            </h3>
                                            {nearbyPOIs.events.map(poi => (
                                                <POICard key={poi.id} poi={poi} icon={Clock} colorClass="bg-green-500" />
                                            ))}
                                        </div>
                                    )}

                                    {allPOIs.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-40 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
                                            <MapPin className="w-8 h-8 mb-2 opacity-20" />
                                            <p className="text-xs italic">No recommendations found within 10km.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Featured Stays - Show only 3 */}
                    <div className="md:col-span-2 lg:col-span-3">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <div className="p-3 bg-green-100 rounded-2xl text-green-600 mr-4">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">Featured Stays</h2>
                                    <p className="text-gray-500">Discover handpicked properties for your next getaway.</p>
                                </div>
                            </div>
                            <Link to="/search" className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center">
                                View All
                                <Search className="w-4 h-4 ml-1" />
                            </Link>
                        </div>

                        {loading ? (
                            <div className="text-center py-12">Loading stays...</div>
                        ) : properties.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                                <p className="text-gray-500 mb-4">No properties available at the moment.</p>
                                <Link to="/search" className="text-blue-600 hover:text-blue-700 font-medium">
                                    Browse All Stays
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {properties.slice(0, 3).map((property) => (
                                        <div key={property.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col">
                                            <div className="h-48 bg-gray-200 relative">
                                                {property.image_url ? (
                                                    <img 
                                                        src={property.image_url} 
                                                        alt={property.title} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                                        <span className="text-xs">No Image</span>
                                                    </div>
                                                )}
                                                <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
                                                    <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold text-gray-800">
                                                        ₹{property.price_per_night}/night
                                                    </div>
                                                    <HeartButton propertyId={property.id} />
                                                </div>
                                            </div>
                                            <div className="p-4 flex flex-col flex-grow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-bold text-gray-900 truncate pr-4">{property.title}</h3>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded-full mb-1">{property.property_type}</span>
                                                        {property.avgRating > 0 && (
                                                            <div className="flex items-center text-xs font-bold text-yellow-500">
                                                                <span className="mr-1">★</span>{property.avgRating.toFixed(1)} <span className="text-gray-400 font-normal ml-1">({property.reviewCount})</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center text-gray-500 text-sm mb-3">
                                                    <MapPin className="w-3 h-3 mr-1" />
                                                    {property.location}
                                                </div>
                                                <p className="text-gray-600 text-sm line-clamp-2 mb-4 flex-grow">{property.description}</p>
                                                <Link to={`/property/${property.id}`} className="block w-full text-center py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors text-sm font-medium mt-auto">
                                                    View Details
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {properties.length > 3 && (
                                    <div className="text-center mt-6">
                                        <Link to="/search" className="inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors font-medium">
                                            Browse All {properties.length} Stays
                                            <Search className="w-4 h-4 ml-2" />
                                        </Link>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* My Bookings Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 md:col-span-2 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center mb-4">
                            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                                <Calendar className="w-6 h-6" />
                            </div>
                            <h2 className="ml-4 text-xl font-semibold text-gray-800">My Bookings</h2>
                        </div>
                        {bookings.length > 0 ? (
                            <div className="space-y-4">
                                {bookings.slice(0, 3).map((booking) => (
                                    <div key={booking.id} className="p-4 border border-gray-200 rounded-2xl bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-gray-900">{booking.properties?.title}</h3>
                                                <p className="text-sm text-gray-500">{booking.properties?.location}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                                                booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {booking.status}
                                            </span>
                                        </div>
                                        
                                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                                            <div className="flex items-center">
                                                <Calendar className="w-4 h-4 mr-2" />
                                                {formatDate(booking.check_in)} - {formatDate(booking.check_out)}
                                            </div>
                                            <div className="flex items-center">
                                                <User className="w-4 h-4 mr-2" />
                                                {booking.guests || 1} Guests
                                            </div>
                                            <div className="flex items-center font-medium text-gray-900">
                                                <IndianRupee className="w-4 h-4 mr-2" />
                                                Total: {booking.total_price}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {bookings.length > 3 && (
                                    <div className="text-center pt-2">
                                        <Link to="/my-bookings" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                                            View All Bookings ({bookings.length})
                                        </Link>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-500 mb-4">No upcoming trips booked yet.</p>
                                <button className="text-blue-600 font-medium hover:text-blue-700 hover:underline">
                                    Browse Homes below
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Saved Properties Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-red-200 hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center mb-4">
                            <div className="p-3 bg-red-100 rounded-2xl text-red-600">
                                <Heart className="w-6 h-6" />
                            </div>
                            <h2 className="ml-4 text-xl font-semibold text-gray-800">Saved Homes</h2>
                        </div>
                        <div className="space-y-4">
                            {savedProperties.length > 0 ? (
                                <>
                                    {savedProperties.slice(0, 4).map((property) => (
                                        <div key={property.id} className="flex gap-4 p-4 border border-gray-200 rounded-2xl hover:bg-white hover:border-red-200 hover:shadow-sm transition-all duration-300">
                                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                                                {property.image_url ? (
                                                    <img src={property.image_url} alt={property.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">No img</div>
                                                )}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h3 className="font-bold text-gray-900 line-clamp-1 text-sm">{property.title}</h3>
                                                </div>
                                                <div className="flex items-center text-gray-500 text-[10px] mb-1">
                                                    <MapPin className="w-2.5 h-2.5 mr-1" />
                                                    {property.location}
                                                </div>
                                                <Link to={`/property/${property.id}`} className="text-blue-600 hover:underline text-[10px] font-medium">
                                                    View Property
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                    {savedProperties.length > 4 && (
                                        <div className="text-center pt-2">
                                            <Link to="/saved-homes" className="text-red-500 hover:text-red-700 font-medium text-xs">
                                                View All ({savedProperties.length})
                                            </Link>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 text-sm">No saved properties yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Messages Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center mb-4">
                            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                                <MessageSquare className="w-6 h-6" />
                            </div>
                            <h2 className="ml-4 text-xl font-semibold text-gray-800">Messages</h2>
                        </div>
                        <div className="space-y-4">
                            {recentMessages.length > 0 ? (
                                <>
                                    {recentMessages.map((msg, idx) => (
                                        <Link 
                                            key={idx} 
                                            to="/messages"
                                            className="block p-4 border border-gray-200 rounded-2xl bg-gray-50 hover:bg-white hover:border-blue-200 hover:shadow-sm transition-all duration-300 group"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition truncate">{msg.other_party_name}</h3>
                                                {msg.unread && (
                                                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                                )}
                                            </div>
                                            <p className="text-blue-600 text-[10px] font-medium mb-1 truncate">{msg.property_title}</p>
                                            <p className="text-xs text-gray-500 line-clamp-1">{msg.last_message}</p>
                                            <div className="mt-2 text-[10px] text-gray-400 flex items-center">
                                                <Clock className="w-2.5 h-2.5 mr-1" />
                                                {formatDate(msg.last_timestamp)}
                                            </div>
                                        </Link>
                                    ))}
                                    <div className="text-center pt-2">
                                        <Link to="/messages" className="text-blue-600 hover:text-blue-700 font-medium text-xs">
                                            Go to Message Center &rarr;
                                        </Link>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 text-sm">No recent messages.</p>
                                    <Link to="/search" className="text-blue-600 font-medium text-xs hover:underline mt-2 inline-block">
                                        Start a conversation
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Safety & Emergency Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-red-200 hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center mb-4">
                            <div className="p-3 bg-red-50 rounded-2xl text-red-600">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <h2 className="ml-4 text-xl font-semibold text-gray-800">Safety & Emergency</h2>
                        </div>
                        <div className="space-y-4">
                            {emergencyContact ? (
                                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
                                        <User className="w-4 h-4 mr-2 text-blue-600" />
                                        Your Emergency Contact
                                    </h3>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-gray-800">{emergencyContact.name}</p>
                                        <p className="text-xs text-gray-500">{emergencyContact.relationship}</p>
                                        <p className="text-sm text-blue-600 font-bold flex items-center mt-1">
                                            <Phone className="w-3 h-3 mr-1" />
                                            {emergencyContact.phone}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                    <p className="text-xs text-orange-700 mb-2">You haven't added an emergency contact yet.</p>
                                    <Link to="/profile" className="text-xs font-bold text-orange-800 hover:underline">Add contact now &rarr;</Link>
                                </div>
                            )}

                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                <h3 className="text-sm font-bold text-blue-900 mb-2 flex items-center">
                                    <ShieldAlert className="w-4 h-4 mr-2" />
                                    Local Services
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white p-2 rounded-lg border border-blue-100 flex flex-col items-center">
                                        <span className="text-gray-500 mb-1">Police</span>
                                        <span className="font-bold text-blue-700">100 / 112</span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-blue-100 flex flex-col items-center">
                                        <span className="text-gray-500 mb-1">Ambulance</span>
                                        <span className="font-bold text-blue-700">102 / 108</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TouristDashboard;
