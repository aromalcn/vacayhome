import { useState, useEffect } from 'react';

import { Calendar, User, IndianRupee, ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom'; // Assuming useNavigate is used for 'navigate'
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/dateFormatter';
import ReviewForm from '../components/ReviewForm';
import Receipt from '../components/Receipt';

const MyBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [reviewModal, setReviewModal] = useState({ isOpen: false, bookingId: null, propertyId: null });
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    const navigate = useNavigate(); // Initialize useNavigate
    const { showToast } = useToast(); // Initialize useToast

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    navigate('/login');
                    return;
                }

                const { data, error } = await supabase
                    .from('bookings')
                    .select('*, properties(*)')
                    .eq('tourist_id', user.id)
                    .order('check_in', { ascending: false });

                if (error) throw error;
                setBookings(data || []);
            } catch (error) {
                console.error('Error fetching bookings:', error);
                showToast('Error loading bookings', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchBookings();
    }, [navigate, showToast]);

    const filteredBookings = bookings.filter(booking => {
        const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
        
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            booking.properties?.title?.toLowerCase().includes(searchLower) ||
            booking.properties?.location?.toLowerCase().includes(searchLower) ||
            booking.total_price?.toString().includes(searchLower) ||
            booking.guests?.toString().includes(searchLower);
            
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to="/tourist" className="mr-4 p-2 bg-white rounded-full text-gray-600 hover:text-blue-600 hover:shadow-md transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
                        <p className="text-gray-500">View and manage all your trips</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    {/* Filter Tabs */}
                    <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                        {['all', 'pending', 'confirmed', 'rejected'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-2xl font-medium text-sm capitalize transition-colors whitespace-nowrap ${
                                    filterStatus === status 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search properties..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition duration-150 ease-in-out"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid gap-6">
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Loading your bookings...</div>
                    ) : filteredBookings.length > 0 ? (
                        filteredBookings.map((booking) => (
                            <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300">
                                <div className="flex flex-col md:flex-row">
                                    <div className="w-full md:w-1/3 h-48 md:h-56 bg-gray-100 relative">
                                        {booking.properties?.image_url ? (
                                            <img 
                                                src={booking.properties.image_url} 
                                                alt={booking.properties.title} 
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                No Image
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold text-gray-800">
                                            {booking.properties?.property_type || 'Stay'}
                                        </div>
                                    </div>
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-xl font-bold text-gray-900">{booking.properties?.title}</h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                                                    booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                    booking.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {booking.status}
                                                </span>
                                            </div>
                                            <div className="flex items-center text-gray-500 text-sm mb-4">
                                                <MapPin className="w-4 h-4 mr-1" />
                                                {booking.properties?.location}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                                                <div className="flex items-center">
                                                    {formatDate(booking.check_in)}
                                                </div>
                                                <div className="flex items-center">
                                                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                                                    {formatDate(booking.check_out)}
                                                </div>
                                                <div className="flex items-center">
                                                    <User className="w-4 h-4 mr-2 text-gray-400" />
                                                    {booking.guests || 1} Guests
                                                </div>
                                                <div className="flex items-center font-bold text-gray-900">
                                                    <IndianRupee className="w-4 h-4 mr-2 text-gray-400" />
                                                    {booking.total_price}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between pt-4 border-t border-gray-100 items-center">
                                            {/* Left Side: Receipt */}
                                            <div>
                                                {booking.payment_status === 'paid' && (
                                                    <button
                                                        onClick={() => setSelectedReceipt(booking)}
                                                        className="text-green-600 font-medium hover:bg-green-50 px-3 py-1.5 rounded-full transition text-sm flex items-center"
                                                    >
                                                        <IndianRupee className="w-3 h-3 mr-1" /> View Receipt
                                                    </button>
                                                )}
                                            </div>

                                            {/* Right Side: Actions */}
                                            <div className="flex items-center gap-4">
                                                {booking.status === 'confirmed' && (
                                                    <button
                                                        onClick={() => setReviewModal({ isOpen: true, bookingId: booking.id, propertyId: booking.property_id })}
                                                        className="text-blue-600 font-medium hover:bg-blue-50 px-3 py-1.5 rounded-full transition text-sm"
                                                    >
                                                        Write a Review
                                                    </button>
                                                )}
                                                <Link to={`/property/${booking.property_id}`} className="text-gray-600 font-medium hover:text-gray-900 text-sm">
                                                    View Property Details →
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                            <p className="text-gray-500 mb-4">No {filterStatus !== 'all' ? filterStatus : ''} bookings found.</p>
                            <Link to="/search" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium">
                                Browse Available Stays
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {reviewModal.isOpen && (
                <ReviewForm
                    bookingId={reviewModal.bookingId}
                    propertyId={reviewModal.propertyId}
                    onClose={() => setReviewModal({ isOpen: false, bookingId: null, propertyId: null })}
                    onReviewSubmitted={() => {
                        // Optionally refresh bookings or show success
                        // fetchBookings(); // If we want to hide the button or something
                    }}
                />
            )}

            {/* Receipt Modal */}
            <Receipt
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                booking={selectedReceipt}
            />
        </div>
    );
};

export default MyBookings;
