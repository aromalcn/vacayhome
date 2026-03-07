import { useState, useEffect } from 'react';
import { Calendar, Home, User, IndianRupee, MapPin, Edit, Trash2, Plus, Settings, AlertCircle, MessageSquare, ShieldAlert, Phone } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { formatDate } from '../utils/dateFormatter';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const OwnerDashboard = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [properties, setProperties] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, propertyId: null, propertyTitle: '' });
    const [isVerified, setIsVerified] = useState(true);
    const [userName, setUserName] = useState('');

    const fetchBookingRequests = async (userId) => {
        const { data: requestsData, error } = await supabase
            .from('bookings')
            .select('*, properties(title), profiles(full_name, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship)')
            .eq('owner_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        setRequests(requestsData || []);
    };

    useEffect(() => {
        const fetchOwnerData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    // Fetch fresh profile to check verification status and name
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('is_verified, full_name')
                        .eq('id', user.id)
                        .single();
                    
                    if (profile) {
                        setIsVerified(profile.is_verified);
                        setUserName(profile.full_name);
                    }

                    // Fetch properties
                    const { data: propertiesData } = await supabase
                        .from('properties')
                        .select('*')
                        .eq('owner_id', user.id)
                        // .eq('status', 'approved') // STRICT FILTER REMOVED: Show all including pending
                        .order('created_at', { ascending: false });
                    
                    setProperties(propertiesData || []);

                    // Fetch pending booking requests
                    await fetchBookingRequests(user.id);
                }
            } catch (error) {
                console.error('Error fetching owner data:', error);
                showToast('Error fetching owner data', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchOwnerData();
    }, []);

    const handleBookingAction = async (bookingId, newStatus) => {
        try {
            console.log('Attempting to update booking:', bookingId, 'to status:', newStatus);
            
            const { data, error } = await supabase
                .from('bookings')
                .update({ status: newStatus })
                .eq('id', bookingId)
                .select();
            
            if (error) {
                console.error('Supabase error details:', error);
                throw error;
            }

            console.log('Update successful:', data);

            // Update local state
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await fetchBookingRequests(user.id);
            }
            showToast(`Booking ${newStatus} successfully`, 'success');
        } catch (error) {
            console.error('Error updating booking:', error);
            console.error('Error message:', error.message);
            console.error('Error details:', error.details);
            console.error('Error hint:', error.hint);
            showToast('Failed to update booking: ' + (error.message || 'Unknown error'), 'error');
        }
    };

    const handleDeleteClick = (propertyId, propertyTitle) => {
        setDeleteDialog({ isOpen: true, propertyId, propertyTitle });
    };

    const handleDeleteConfirm = async () => {
        const { propertyId } = deleteDialog;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) throw new Error('You must be logged in');

            const { error } = await supabase
                .from('properties')
                .delete()
                .eq('id', propertyId)
                .eq('owner_id', user.id);

            if (error) throw error;

            // Refresh properties list
            const { data: propertiesData } = await supabase
                .from('properties')
                .select('*')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });
            
            setProperties(propertiesData || []);
            showToast('Property deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting property:', error);
            showToast('Failed to delete property: ' + (error.message || 'Unknown error'), 'error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Welcome back{userName ? `, ${userName}` : ''}!
                        </h1>
                        <p className="text-gray-500">Manage your properties and bookings</p>
                    </div>
                    <Link to="/add-property" className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-lg shadow-blue-500/30">
                        <Plus className="w-5 h-5 mr-2" />
                        Add Property
                    </Link>
                </div>

                {!isVerified && (
                    <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start">
                        <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                            <h3 className="font-semibold text-orange-800">Verification Pending</h3>
                            <p className="text-orange-700 text-sm mt-1">
                                Your account is currently under review. You can list properties, but they will not be visible to tourists until an admin verifies your profile.
                            </p>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center hover:shadow-md hover:border-blue-200 transition-all duration-300 cursor-pointer">
                        <div className="p-3 bg-blue-100 rounded-2xl text-blue-600 mr-4">
                            <Home className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Properties</p>
                            <h3 className="text-2xl font-bold">{properties.length}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center">
                        <div className="p-3 bg-green-100 rounded-2xl text-green-600 mr-4">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Active Bookings</p>
                            <h3 className="text-2xl font-bold">
                                {requests.filter(r => r.status === 'confirmed').length}
                            </h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center">
                        <div className="p-3 bg-purple-100 rounded-2xl text-purple-600 mr-4">
                            <Settings className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Earnings</p>
                            <h3 className="text-2xl font-bold">
                                ₹{requests
                                    .filter(r => r.status === 'confirmed')
                                    .reduce((sum, r) => sum + (Number(r.total_price) || 0), 0)
                                    .toLocaleString()}
                            </h3>
                        </div>
                    </div>
                    <Link to="/messages" className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center hover:shadow-md hover:border-blue-200 transition-all duration-300">
                        <div className="p-3 bg-orange-100 rounded-2xl text-orange-600 mr-4">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Messages</p>
                            <h3 className="text-2xl font-bold">Inbox</h3>
                        </div>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Properties List */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">My Properties</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {loading ? (
                                <p className="text-gray-500 col-span-2">Loading properties...</p>
                            ) : properties.length === 0 ? (
                                <div className="col-span-2 text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                                    <p className="text-gray-500 mb-4">You haven't listed any properties yet.</p>
                                    <Link to="/add-property" className="text-blue-600 font-medium hover:underline">Create your first listing</Link>
                                </div>
                            ) : (
                                properties.map((prop) => {
                                    const pendingCount = requests.filter(r => r.property_id === prop.id && r.status === 'pending').length;
                                    return (
                                        <div key={prop.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
                                        <div className="h-48 overflow-hidden bg-gray-100 relative group">
                                            {prop.image_url ? (
                                                <img src={prop.image_url} alt={prop.title} className="w-full h-full object-cover transform hover:scale-105 transition duration-500" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                                            )}
                                            {pendingCount > 0 && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/booking-requests?propertyId=${prop.id}`);
                                                    }}
                                                    className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 flex items-center justify-center rounded-full shadow-lg hover:scale-110 transition-transform animate-pulse z-10"
                                                    title={`${pendingCount} pending requests`}
                                                >
                                                    <span className="font-bold text-sm">{pendingCount}</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-semibold truncate pr-2">{prop.title}</h3>
                                                {prop.status === 'approved' ? (
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 whitespace-nowrap">Active</span>
                                                        <span className={`px-2 py-1 text-[10px] rounded-full whitespace-nowrap ${
                                                            prop.availability === 'Under Maintenance' 
                                                                ? 'bg-orange-100 text-orange-700' 
                                                                : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {prop.availability || 'Available'}
                                                        </span>
                                                    </div>
                                                ) : prop.status === 'rejected' ? (
                                                    <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 whitespace-nowrap">Rejected</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 whitespace-nowrap">Pending Approval</span>
                                                )}
                                            </div>
                                            <p className="text-gray-500 text-sm mb-4 truncate">{prop.location}</p>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-blue-600">₹{prop.price_per_night}/night</span>
                                                <div className="flex space-x-2">
                                                    <button 
                                                        onClick={() => navigate(`/edit-property/${prop.id}`)}
                                                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition"
                                                        title="Edit property"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteClick(prop.id, prop.title)}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                                                        title="Delete property"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Booking Requests */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit hover:shadow-md hover:border-gray-200 transition-all duration-300">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Booking Requests</h2>
                        <div className="space-y-4">
                            {requests.slice(0, 3).map((req) => (
                                <div key={req.id} className="p-4 border border-gray-200 rounded-2xl bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-semibold text-gray-800">Guest: {req.profiles?.full_name || 'Guest'}</h4>
                                            <div className="flex items-center text-sm text-gray-500 mt-1">
                                                <User className="w-4 h-4 mr-1" />
                                                <span>{req.guests || 1} Guests</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded block mb-1">Pending</span>
                                            <span className="font-bold text-gray-900">₹{req.total_price}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">Request for <strong>{req.properties?.title}</strong></p>
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                        <div className="flex items-center bg-gray-50 p-2 rounded">
                                            <Calendar className="w-3 h-3 mr-1" />
                                            <span>{formatDate(req.check_in)} - {formatDate(req.check_out)}</span>
                                        </div>
                                        <Link 
                                            to={`/messages?propertyId=${req.property_id}&userId=${req.tourist_id}`}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition"
                                            title="Message Guest"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </Link>
                                    </div>

                                    {req.status === 'confirmed' && req.profiles?.emergency_contact_name && (
                                        <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                                            <div className="flex items-center text-red-700 font-bold text-xs mb-1">
                                                <ShieldAlert className="w-3 h-3 mr-1" />
                                                Guest Emergency Contact
                                            </div>
                                            <div className="text-[11px] text-gray-700">
                                                <p className="font-semibold">{req.profiles.emergency_contact_name} ({req.profiles.emergency_contact_relationship})</p>
                                                <p className="flex items-center mt-0.5 text-blue-600 font-bold">
                                                    <Phone className="w-2.5 h-2.5 mr-1" />
                                                    {req.profiles.emergency_contact_phone}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {req.status === 'pending' && new Date(req.check_in).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0) ? (
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={() => handleBookingAction(req.id, 'confirmed')}
                                                className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded-full hover:bg-green-700 transition"
                                            >
                                                Accept
                                            </button>
                                            <button 
                                                onClick={() => handleBookingAction(req.id, 'rejected')}
                                                className="flex-1 py-1.5 bg-red-100 text-red-600 text-sm rounded-full hover:bg-red-200 transition"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    ) : req.status === 'pending' ? (
                                        <div className="py-1.5 bg-gray-100 text-gray-500 text-sm rounded-full text-center font-medium italic">
                                            Expired
                                        </div>
                                    ) : req.status === 'confirmed' ? (
                                        <div className="py-1.5 bg-green-100 text-green-700 text-sm rounded-full text-center font-medium">
                                            ✓ Confirmed
                                        </div>
                                    ) : (
                                        <div className="py-1.5 bg-red-100 text-red-700 text-sm rounded-full text-center font-medium">
                                            ✗ Rejected
                                        </div>
                                    )}
                                </div>
                            ))}
                            {requests.length === 0 && <p className="text-gray-500 text-center py-4">No new booking requests.</p>}
                            
                            {requests.length > 3 && (
                                <div className="text-center pt-2">
                                    <Link to="/booking-requests" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                                        View All Requests ({requests.length})
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.isOpen}
                onClose={() => setDeleteDialog({ isOpen: false, propertyId: null, propertyTitle: '' })}
                onConfirm={handleDeleteConfirm}
                title="Delete Property"
                message={`Are you sure you want to delete "${deleteDialog.propertyTitle}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />
        </div>
    );
};

export default OwnerDashboard;
