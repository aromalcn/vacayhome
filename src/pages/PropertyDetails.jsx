import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { MapPin, User, Home, ArrowLeft, Star, IndianRupee, Flag, CheckCircle, ChevronLeft, ChevronRight, X, MessageSquarePlus, AlertCircle, Globe, Navigation, Utensils, Bus, Sparkles, Clock, MessageSquare } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import DatePicker from 'react-datepicker';

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
import "react-datepicker/dist/react-datepicker.css";
import { useToast } from '../components/Toast';
import HeartButton from '../components/HeartButton';
import ReviewList from '../components/ReviewList';
import PaymentModal from '../components/PaymentModal';
import ContactOwnerModal from '../components/ContactOwnerModal';

// Component to handle map center updates
const ChangeMapView = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.setView(center, map.getZoom());
        }
    }, [center[0], center[1], map]);
    return null;
};

const PropertyDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [checkIn, setCheckIn] = useState(null);
    const [checkOut, setCheckOut] = useState(null);
    const [guests, setGuests] = useState(1);
    const [excludeDates, setExcludeDates] = useState([]);
    
    // Gallery and Location State
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [allImages, setAllImages] = useState([]);
    const [nearbyPOIs, setNearbyPOIs] = useState({
        attractions: [],
        restaurants: [],
        transport: [],
        events: []
    });
    const [allPOIs, setAllPOIs] = useState([]);

    // Ratings State
    const [averageRating, setAverageRating] = useState(0);
    const [reviewCount, setReviewCount] = useState(0);
    const [refreshReviewsTrigger, setRefreshReviewsTrigger] = useState(0); // Trigger to reload reviews
    const [userReview, setUserReview] = useState(null); // Store user's existing review

    // Report Modal State
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState('Inaccurate Details');
    const [reportDescription, setReportDescription] = useState('');
    const [reportLoading, setReportLoading] = useState(false);

    // Add Review Modal State
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [newRating, setNewRating] = useState(5);
    const [newComment, setNewComment] = useState('');
    const [reviewSubmitLoading, setReviewSubmitLoading] = useState(false);

    // Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);

    // Messaging State
    const [contactModalOpen, setContactModalOpen] = useState(false);

    const { showToast } = useToast();

    const calculateTotal = () => {
        if (!checkIn || !checkOut || !property) return 0;
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (nights <= 0) return 0;
        return (nights * property.price_per_night) + 2000; // + Service fee
    };

    const handleBooking = async () => {
        if (!checkIn || !checkOut) {
            showToast('Please select check-in and check-out dates', 'error');
            return;
        }

        if (property.availability === 'Under Maintenance') {
            showToast('This property is under maintenance and cannot be booked at this time.', 'error');
            return;
        }

        const total = calculateTotal();
        if (total <= 0) {
            showToast('Invalid dates selected', 'error');
            return;
        }

        // Check if any selected date is in the excluded dates
        const selectedStart = new Date(checkIn);
        const selectedEnd = new Date(checkOut);
        
        for (const excludedDate of excludeDates) {
            const excluded = new Date(excludedDate);
            if (excluded >= selectedStart && excluded <= selectedEnd) {
                showToast('The selected dates overlap with existing bookings. Please choose different dates.', 'error');
                return;
            }
        }

        // Check login before opening payment
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('Please login to book', 'info');
            navigate('/login');
            return;
        }

        // Open Payment Modal
        setPaymentModalOpen(true);
    };

    const handlePaymentSuccess = async (transactionId) => {
        setBookingLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const total = calculateTotal();

            // Format dates as ISO strings (YYYY-MM-DD) for Supabase
            const checkInDate = checkIn.toISOString().split('T')[0];
            const checkOutDate = checkOut.toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('bookings')
                .insert({
                    property_id: property.id,
                    tourist_id: user.id,
                    owner_id: property.owner_id,
                    check_in: checkInDate,
                    check_out: checkOutDate,
                    total_price: total,
                    guests: guests,
                    status: 'pending', // Owner still needs to approve? Or auto-confirm if paid? keeping pending for now as per flow
                    payment_status: 'paid', // New field
                    transaction_id: transactionId // New field
                })
                .select()
                .single();

            if (error) throw error;

            showToast('Payment successful! Booking request sent.', 'success');
            setPaymentModalOpen(false);
            if (data?.id) {
                navigate(`/booking-confirmation/${data.id}`);
            } else {
                navigate('/tourist');
            }
        } catch (error) {
            console.error('Booking error:', error);
            showToast('Failed to create booking: ' + error.message, 'error');
        } finally {
            setBookingLoading(false);
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

    const handleReportSubmit = async (e) => {
        e.preventDefault();
        setReportLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showToast('Please login to report a property', 'info');
                navigate('/login');
                return;
            }

            const { error } = await supabase
                .from('reports')
                .insert({
                    property_id: property.id,
                    reporter_id: user.id,
                    reason: reportReason,
                    description: reportDescription
                });

            if (error) throw error;

            showToast('Report submitted successfully. Admins will review it.', 'success');
            setReportModalOpen(false);
            setReportDescription('');
        } catch (error) {
            console.error('Report error:', error);
            showToast('Failed to submit report', 'error');
        } finally {
            setReportLoading(false);
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        setReviewSubmitLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showToast('Please login to write a review', 'info');
                navigate('/login');
                return;
            }

            // Using upsert to handle both insert and update
            // Requires a unique constraint on (property_id, tourist_id) in the database
            const { error } = await supabase
                .from('reviews')
                .upsert({
                    property_id: property.id,
                    tourist_id: user.id,
                    rating: newRating,
                }, { onConflict: 'property_id, tourist_id' });

            if (error) throw error;

            showToast('Rating submitted successfully!', 'success');
            setReviewModalOpen(false);
            // setNewRating(5); // Keep existing rating if editing, or default. 
            setRefreshReviewsTrigger(prev => prev + 1); // Trigger refresh
        } catch (error) {
            console.error('Review error:', error);
            showToast('Failed to submit review: ' + error.message, 'error');
        } finally {
            setReviewSubmitLoading(false);
        }
    };

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const response = await fetch(`/api/properties/${id}`);
                if (!response.ok) throw new Error('Failed to fetch property');
                
                const data = await response.json();
                setProperty(data);
                
                if (data.latitude && data.longitude) {
                    fetchNearbyPOIs(data.latitude, data.longitude);
                }

                // Prepare images array
                let images = [];
                if (data.images && data.images.length > 0) {
                    images = data.images;
                } else if (data.image_url) {
                    images = [data.image_url];
                }
                setAllImages(images);

            } catch (error) {
                console.error('Error fetching property:', error);
            } finally {
                setLoading(false);
            }
        };

        const fetchBookings = async () => {
            if (!id) return;
            try {
                const { data, error } = await supabase
                    .from('bookings')
                    .select('check_in, check_out')
                    .eq('property_id', id)
                    .in('status', ['pending', 'confirmed']); // Only block pending and confirmed

                if (error) throw error;

                const blocked = [];
                if (data && data.length > 0) {
                    data.forEach(booking => {
                        // Parse dates and normalize to midnight to avoid timezone issues
                        const checkIn = new Date(booking.check_in + 'T00:00:00');
                        const checkOut = new Date(booking.check_out + 'T00:00:00');
                        
                        let currentDate = new Date(checkIn);
                        
                        // Block all dates from check-in to check-out (inclusive)
                        while (currentDate <= checkOut) {
                            blocked.push(new Date(currentDate));
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    });
                }
                
                setExcludeDates(blocked);
            } catch (error) {
                console.error('Error fetching bookings:', error);
            }
        };

        const fetchReviews = async () => {
            if (!id) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                const { data, error } = await supabase
                    .from('reviews')
                    .select('rating, tourist_id')
                    .eq('property_id', id);

                if (error) throw error;

                if (data && data.length > 0) {
                   const total = data.reduce((sum, r) => sum + r.rating, 0);
                   setAverageRating((total / data.length).toFixed(1));
                   setReviewCount(data.length);

                   if (user) {
                       const existingReview = data.find(r => r.tourist_id === user.id);
                       if (existingReview) {
                           setUserReview(existingReview);
                           setNewRating(existingReview.rating);
                       }
                   }
                } else {
                   setAverageRating(0);
                   setReviewCount(0);
                   setUserReview(null);
                }
            } catch (error) {
                console.error('Error fetching reviews:', error);
            }
        };

        fetchProperty();
        fetchBookings();
        fetchReviews();
    }, [id, refreshReviewsTrigger]);

    const nextImage = () => {
        setActiveImageIndex((prev) => (prev + 1) % allImages.length);
    };

    const prevImage = () => {
        setActiveImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    };

    if (loading) return <div className="text-center py-20">Loading...</div>;
    if (!property) return <div className="text-center py-20">Property not found.</div>;

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-6xl mx-auto">
                <Link to="/search" className="inline-flex items-center text-gray-600 hover:text-blue-600 mb-6 transition">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
                </Link>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Image Gallery Section */}
                    <div className="h-[500px] w-full relative bg-gray-900 group">
                        {allImages.length > 0 ? (
                            <>
                                <img 
                                    src={allImages[activeImageIndex]} 
                                    alt={`${property.title} - View ${activeImageIndex + 1}`} 
                                    className="w-full h-full object-cover transition-opacity duration-300" 
                                />
                                
                                {allImages.length > 1 && (
                                    <>
                                        <button 
                                            onClick={(e) => { e.preventDefault(); prevImage(); }}
                                            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/10 hover:bg-white/30 backdrop-blur-md p-2 rounded-full text-white transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                                        >
                                            <ChevronLeft className="w-8 h-8" />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.preventDefault(); nextImage(); }}
                                            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/10 hover:bg-white/30 backdrop-blur-md p-2 rounded-full text-white transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                                        >
                                            <ChevronRight className="w-8 h-8" />
                                        </button>
                                        
                                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                                            {allImages.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setActiveImageIndex(idx)}
                                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">No Image</div>
                        )}
                        
                        <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg text-lg font-bold text-gray-900 shadow-sm flex items-center z-10">
                            <IndianRupee className="w-5 h-5 mr-1" />{property.price_per_night} <span className="text-sm font-normal text-gray-500 ml-1">/ night</span>
                        </div>
                    </div>

                    {/* Thumbnails (only if more than 1 image) */}
                    {allImages.length > 1 && (
                        <div className="flex overflow-x-auto p-4 gap-2 border-b border-gray-100 bg-gray-50">
                            {allImages.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${idx === activeImageIndex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'}`}
                                >
                                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{property.title}</h1>
                                    <HeartButton propertyId={property.id} className="mt-[-8px]" />
                                </div>
                                <div className="flex items-center text-gray-500">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    {property.location}
                                </div>
                                <div className="flex items-center text-gray-600 mt-2 text-sm">
                                    <span className="mr-2">Hosted by <span className="font-semibold text-gray-900">{property.profiles?.full_name || 'Unknown'}</span></span>
                                    {property.profiles?.is_verified && (
                                        <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 text-xs rounded-full flex items-center font-medium">
                                            <CheckCircle className="w-3 h-3 mr-1" /> Verified Owner
                                        </span>
                                    )}
                                    <span className={`px-2 py-0.5 border text-xs rounded-full flex items-center font-medium ${
                                        property.availability === 'Under Maintenance' 
                                            ? 'bg-orange-50 text-orange-700 border-orange-200' 
                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                        <AlertCircle className="w-3 h-3 mr-1" /> {property.availability || 'Available'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1 text-yellow-500 bg-yellow-50 px-3 py-1 rounded-full">
                                <Star className="w-4 h-4 fill-current" />
                                <span className="font-bold text-gray-900">{averageRating > 0 ? averageRating : 'New'}</span>
                                <span className="text-gray-400 text-sm">({reviewCount} review{reviewCount !== 1 ? 's' : ''})</span>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8 border-b border-gray-100 pb-8">
                            <div className="flex items-center text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                                <User className="w-4 h-4 mr-2 text-blue-500" />
                                {property.max_guests} Guests
                            </div>
                            <div className="flex items-center text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                                <Home className="w-4 h-4 mr-2 text-purple-500" />
                                {property.property_type || 'Villa'}
                            </div>
                            <button 
                                onClick={() => setReportModalOpen(true)}
                                className="ml-auto flex items-center text-sm text-gray-400 hover:text-red-500 transition"
                            >
                                <Flag className="w-4 h-4 mr-1" />
                                Report
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                            <div className="lg:col-span-2">
                                <h2 className="text-xl font-bold text-gray-900 mb-4">About this place</h2>
                                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                                    {property.description}
                                </p>
                                
                                <div className="mt-12 border-t border-gray-100 pt-8">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-xl font-bold text-gray-900">Reviews</h2>
                                        <button 
                                            onClick={() => setReviewModalOpen(true)}
                                            className={`px-4 py-2 ${userReview ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-full transition font-medium flex items-center text-sm`}
                                        >
                                            <Star className="w-4 h-4 mr-2 fill-current" />
                                            {userReview ? 'Edit Your Rating' : 'Rate Property'}
                                        </button>
                                    </div>
                                    <ReviewList key={refreshReviewsTrigger} propertyId={property.id} />
                                </div>

                                        {property.latitude && property.longitude && (
                                            <div className="mt-12 border-t border-gray-100 pt-8">
                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                                                            <Sparkles className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <h2 className="text-xl font-bold text-gray-900">Local Guide</h2>
                                                            <p className="text-gray-500 text-sm">Recommendations nearby {property.title}.</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 text-[10px]">
                                                        <span className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-100 text-gray-600">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div> This Villa
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
                                                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[400px]">
                                                        <MapContainer
                                                            center={[property.latitude, property.longitude]}
                                                            zoom={14}
                                                            scrollWheelZoom={false}
                                                            style={{ height: '100%', width: '100%' }}
                                                        >
                                                            <TileLayer
                                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                            />
                                                            <ChangeMapView center={[property.latitude, property.longitude]} />
                                                            
                                                            {/* Property Marker */}
                                                            <Marker 
                                                                position={[property.latitude, property.longitude]}
                                                                icon={createCustomIcon('bg-indigo-600', 'property')}
                                                            >
                                                                <Popup>
                                                                    <div className="p-1">
                                                                        <h4 className="font-bold text-gray-900">{property.title}</h4>
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
                                                    <div className="lg:col-span-1 space-y-4 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                        {/* Sights */}
                                                        {nearbyPOIs.attractions.length > 0 && (
                                                            <div className="space-y-2">
                                                                <h3 className="text-xs font-bold text-gray-900 flex items-center justify-between">
                                                                    <span className="flex items-center gap-2">
                                                                        <MapPin className="w-3 h-3 text-red-500" /> Sights
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
                                                            <div className="space-y-2">
                                                                <h3 className="text-xs font-bold text-gray-900 flex items-center justify-between">
                                                                    <span className="flex items-center gap-2">
                                                                        <Utensils className="w-3 h-3 text-orange-500" /> Dining
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
                                                            <div className="space-y-2">
                                                                <h3 className="text-xs font-bold text-gray-900 flex items-center justify-between">
                                                                    <span className="flex items-center gap-2">
                                                                        <Bus className="w-3 h-3 text-blue-500" /> Transport
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
                                                            <div className="space-y-2">
                                                                <h3 className="text-xs font-bold text-gray-900 flex items-center justify-between">
                                                                    <span className="flex items-center gap-2">
                                                                        <Clock className="w-3 h-3 text-green-500" /> Event Alerts
                                                                    </span>
                                                                    <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">{nearbyPOIs.events.length}</span>
                                                                </h3>
                                                                {nearbyPOIs.events.map(poi => (
                                                                    <POICard key={poi.id} poi={poi} icon={Clock} colorClass="bg-green-500" />
                                                                ))}
                                                            </div>
                                                        )}

                                                        {allPOIs.length === 0 && (
                                                            <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
                                                                <MapPin className="w-6 h-6 mb-2 opacity-20" />
                                                                <p className="text-[10px] italic">No local guides found.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                            </div>
                            
                            <div className="lg:col-span-1">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-24 hover:shadow-md hover:border-blue-200 transition-all duration-300">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Book your stay</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Check-in</label>
                                                <DatePicker
                                                    selected={checkIn}
                                                    onChange={date => setCheckIn(date)}
                                                    selectsStart
                                                    startDate={checkIn}
                                                    endDate={checkOut}
                                                    minDate={new Date()}
                                                    excludeDates={excludeDates}
                                                    dateFormat="dd/MM/yyyy"
                                                    placeholderText="Add date"
                                                    className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Check-out</label>
                                                <DatePicker
                                                    selected={checkOut}
                                                    onChange={date => setCheckOut(date)}
                                                    selectsEnd
                                                    startDate={checkIn}
                                                    endDate={checkOut}
                                                    minDate={checkIn || new Date()}
                                                    excludeDates={excludeDates}
                                                    dateFormat="dd/MM/yyyy"
                                                    placeholderText="Add date"
                                                    className="w-full p-2 border border-gray-200 rounded-lg text-sm"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guests</label>
                                            <div className="relative">
                                                <select 
                                                    value={guests}
                                                    onChange={(e) => setGuests(parseInt(e.target.value))}
                                                    className="w-full p-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white"
                                                >
                                                    {[...Array(property.max_guests).keys()].map(i => (
                                                        <option key={i+1} value={i+1}>{i+1} guest{i+1 > 1 ? 's' : ''}</option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                                </div>
                                            </div>
                                        </div>

                                        {checkIn && checkOut && calculateTotal() > 0 && (
                                            <>
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>₹{property.price_per_night} x {Math.ceil((new Date(checkOut) - new Date(checkIn)) / (86400000))} nights</span>
                                                    <span>₹{calculateTotal() - 2000}</span>
                                                </div>
                                                <div className="flex justify-between text-sm text-gray-600">
                                                    <span>Service fee</span>
                                                    <span>₹2,000</span>
                                                </div>
                                                <div className="border-t pt-4 flex justify-between font-bold text-gray-900">
                                                    <span>Total</span>
                                                    <span>₹{calculateTotal()}</span>
                                                </div>
                                            </>
                                        )}

                                        <button 
                                            onClick={handleBooking}
                                            disabled={bookingLoading || property.availability === 'Under Maintenance'}
                                            className="w-full py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {property.availability === 'Under Maintenance' ? 'Under Maintenance' : bookingLoading ? 'Requesting...' : 'Book Now'}
                                        </button>
                                        
                                        <button 
                                            onClick={() => setContactModalOpen(true)}
                                            className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-full hover:bg-gray-50 hover:border-gray-300 transition font-medium flex items-center justify-center gap-2"
                                        >
                                            <MessageSquare className="w-4 h-4 text-blue-500" />
                                            Contact Owner
                                        </button>

                                        <p className="text-xs text-center text-gray-500 mt-2">
                                            {property.availability === 'Under Maintenance' ? 'This property is currently not accepting bookings.' : "You won't be charged yet"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Contact Owner Modal */}
            <ContactOwnerModal 
                isOpen={contactModalOpen}
                onClose={() => setContactModalOpen(false)}
                property={property}
                ownerName={property.profiles?.full_name}
            />

            {/* Report Modal */}
            {reportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <Flag className="w-5 h-5 mr-2 text-red-500" /> Report Property
                            </h2>
                            <button onClick={() => setReportModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleReportSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                                <select 
                                    value={reportReason}
                                    onChange={(e) => setReportReason(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500"
                                >
                                    <option>Inaccurate Details</option>
                                    <option>Scam or Fraud</option>
                                    <option>Offensive Content</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea 
                                    value={reportDescription}
                                    onChange={(e) => setReportDescription(e.target.value)}
                                    placeholder="Please provide more details..."
                                    className="w-full p-2 border border-gray-300 rounded-lg h-32 resize-none focus:ring-2 focus:ring-red-200 focus:border-red-500"
                                    required
                                />
                            </div>
                            <div className="flex space-x-3">
                                <button 
                                    type="button"
                                    onClick={() => setReportModalOpen(false)}
                                    className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={reportLoading}
                                    className="flex-1 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition font-medium disabled:opacity-50"
                                >
                                    {reportLoading ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rate Property Modal */}
            {reviewModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <Star className="w-5 h-5 mr-2 text-yellow-500" /> 
                                {userReview ? 'Edit Your Rating' : 'Rate Property'}
                            </h2>
                            <button onClick={() => setReviewModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleReviewSubmit}>
                            <div className="mb-8 flex justify-center">
                                <div className="flex space-x-3">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setNewRating(star)}
                                            className="focus:outline-none transition-transform hover:scale-110"
                                        >
                                            <Star 
                                                className={`w-10 h-10 ${star <= newRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Comment field removed as per user request */}
                            
                            <div className="flex space-x-3">
                                <button 
                                    type="button"
                                    onClick={() => setReviewModalOpen(false)}
                                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={reviewSubmitLoading}
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium disabled:opacity-50"
                                >
                                    {reviewSubmitLoading ? 'Submitting...' : 'Submit Rating'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

            )}

            {/* Payment Modal */}
            <PaymentModal
                isOpen={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                amount={calculateTotal()}
                propertyTitle={property.title}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
};

export default PropertyDetails;
