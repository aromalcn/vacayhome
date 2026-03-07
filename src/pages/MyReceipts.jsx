import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Download, IndianRupee } from 'lucide-react';
import Receipt from '../components/Receipt';
import { formatDate } from '../utils/dateFormatter';

const MyReceipts = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        const fetchPaidBookings = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }

                const { data, error } = await supabase
                    .from('bookings')
                    .select('*, properties(title, location), profiles(full_name, email)')
                    .eq('tourist_id', user.id)
                    .eq('payment_status', 'paid')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setBookings(data || []);
            } catch (error) {
                console.error('Error fetching receipts:', error);
                showToast('Failed to load receipts', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchPaidBookings();
    }, [navigate, showToast]);

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to="/tourist" className="mr-4 p-2 bg-white rounded-full text-gray-600 hover:text-blue-600 hover:shadow-md transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">My Receipts</h1>
                        <p className="text-gray-500">Transaction history and downloads</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading transaction history...</div>
                ) : bookings.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Transaction ID</th>
                                        <th className="px-6 py-4">Property</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {bookings.map((booking) => (
                                        <tr key={booking.id} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-sm text-gray-600 font-medium whitespace-nowrap">
                                                {new Date(booking.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                                {booking.transaction_id || '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-900">{booking.properties?.title}</div>
                                                <div className="text-xs text-gray-500">{booking.properties?.location}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900 whitespace-nowrap">
                                                ₹{booking.total_price?.toLocaleString() || '0'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => setSelectedReceipt(booking)}
                                                    className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition lg:text-sm text-xs"
                                                >
                                                    <FileText className="w-4 h-4 mr-1.5" /> View Receipt
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 border-dashed">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">No Receipts Found</h3>
                        <p className="text-gray-500 mb-6">You haven't made any payments yet.</p>
                        <Link to="/search" className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium">
                            Browse Stays
                        </Link>
                    </div>
                )}
            </div>

            {/* Receipt Modal */}
            <Receipt
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                booking={selectedReceipt}
            />
        </div>
    );
};

export default MyReceipts;
