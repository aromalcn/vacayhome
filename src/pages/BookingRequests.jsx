import { useState, useEffect } from 'react';
import { Calendar, User, ArrowLeft, MessageSquare } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/dateFormatter';

const BookingRequests = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchBookingRequests = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) {
                navigate('/login');
                return;
            }

            const { data: requestsData, error } = await supabase
                .from('bookings')
                .select('*, properties(*), profiles(full_name)')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(requestsData || []);
        } catch (error) {
            console.error('Error fetching booking requests:', error);
            showToast('Error loading requests', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookingRequests();
    }, []);

    const handleBookingAction = async (bookingId, newStatus) => {
        try {
            const { error } = await supabase
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', bookingId);
            
            if (error) throw error;

            // Refresh list
            await fetchBookingRequests();
            showToast(`Booking ${newStatus} successfully`, 'success');
        } catch (error) {
            console.error('Error updating booking:', error);
            showToast('Failed to update booking', 'error');
        }
    };

    const location = useLocation();
    const [filterPropertyId, setFilterPropertyId] = useState(null);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const propertyId = queryParams.get('propertyId');
        if (propertyId) {
            setFilterPropertyId(propertyId);
            // Optionally set status to 'all' or 'pending' if desired, but 'all' is default
        } else {
            setFilterPropertyId(null);
        }
    }, [location.search]);

    const filteredRequests = requests.filter(req => {
        const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
        const matchesProperty = !filterPropertyId || req.property_id === filterPropertyId;
        
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            req.properties?.title?.toLowerCase().includes(searchLower) ||
            req.properties?.location?.toLowerCase().includes(searchLower) ||
            req.tourist_id?.toLowerCase().includes(searchLower) ||
            req.total_price?.toString().includes(searchLower) ||
            req.guests?.toString().includes(searchLower);
            
        return matchesStatus && matchesSearch && matchesProperty;
    });

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to="/owner" className="mr-4 p-2 bg-white rounded-full text-gray-600 hover:text-blue-600 hover:shadow-md transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">All Booking Requests</h1>
                        <p className="text-gray-500">Manage all your incoming booking requests</p>
                        {filterPropertyId && (
                            <div className="mt-2 inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
                                <span>Filtering: {requests.find(r => r.property_id === filterPropertyId)?.properties?.title || 'Specific Property'}</span>
                                <button 
                                    onClick={() => navigate('/booking-requests')}
                                    className="ml-2 hover:bg-blue-100 rounded-full p-0.5"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    {/* Filter Tabs */}
                    <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                        {['all', 'pending', 'confirmed', 'rejected', 'cancelled'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-full font-medium text-sm capitalize transition-colors whitespace-nowrap ${
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

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Loading requests...</div>
                    ) : (
                        <div className="space-y-4">
                            {filteredRequests.map((req) => (
                                <div key={req.id} className="p-6 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white hover:border-blue-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                                    <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-bold text-lg text-gray-800">Request for {req.properties?.title}</h4>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                                                    req.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                    req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                    req.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {req.status}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                <div className="flex items-center text-sm text-gray-500 mb-1">
                                            <User className="w-4 h-4 mr-2" />
                                            Guest: <span className="font-semibold text-gray-900 ml-1">{req.profiles?.full_name || 'Guest'}</span>
                                        </div>
                                                <div className="flex items-center">
                                                    <User className="w-4 h-4 mr-2 text-gray-400" />
                                                    {req.guests || 1} Guests
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-gray-900">₹{req.total_price}</div>
                                            <div className="flex items-center gap-3 justify-end mt-1">
                                                <Link 
                                                    to={`/messages?propertyId=${req.property_id}&userId=${req.tourist_id}`}
                                                    className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-3 py-1 rounded-full transition"
                                                >
                                                    <MessageSquare className="w-4 h-4 mr-1" />
                                                    Message Guest
                                                </Link>
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <Calendar className="w-4 h-4 mr-2" />
                                                    {formatDate(req.check_in)} - {formatDate(req.check_out)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {req.status === 'pending' && new Date(req.check_in).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0) ? (
                                        <div className="flex space-x-3 pt-2 border-t border-gray-200 mt-4">
                                            <button 
                                                onClick={() => handleBookingAction(req.id, 'confirmed')}
                                                className="flex-1 py-2 bg-green-600 text-white font-medium rounded-full hover:bg-green-700 transition shadow-sm"
                                            >
                                                Accept Request
                                            </button>
                                            <button 
                                                onClick={() => handleBookingAction(req.id, 'rejected')}
                                                className="flex-1 py-2 bg-white border border-red-200 text-red-600 font-medium rounded-full hover:bg-red-50 transition"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    ) : req.status === 'pending' && (
                                        <div className="pt-2 border-t border-gray-200 mt-4 text-center text-gray-400 italic text-sm">
                                            This request has expired as the check-in date has passed.
                                        </div>
                                    )}
                                </div>
                            ))}
                            {filteredRequests.length === 0 && (
                                <div className="text-center py-12">
                                    <p className="text-gray-500 mb-4">No {filterStatus !== 'all' ? filterStatus : ''} booking requests found.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BookingRequests;
