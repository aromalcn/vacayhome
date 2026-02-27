import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { CheckCircle, Home, ArrowRight } from 'lucide-react';
import Receipt from '../components/Receipt';

const BookingConfirmation = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBooking = async () => {
            try {
                const { data, error } = await supabase
                    .from('bookings')
                    .select('*, properties(*), profiles(*)')
                    .eq('id', id)
                    .single();
                
                if (error) throw error;
                setBooking(data);
            } catch (error) {
                console.error('Error fetching booking:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchBooking();
        }
    }, [id]);

    if (loading) return <div className="flex items-center justify-center min-h-screen">Loading confirmation...</div>;
    if (!booking) return <div className="flex items-center justify-center min-h-screen">Booking not found.</div>;

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Success Banner */}
                <div className="bg-green-600 text-white rounded-xl p-8 shadow-lg text-center relative overflow-hidden">
                    <div className="relative z-10">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-200" />
                        <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
                        <p className="text-green-100 text-lg">Your booking has been confirmed.</p>
                        <p className="mt-4 text-sm font-mono bg-green-700/50 inline-block px-4 py-1 rounded-full">
                            Transaction ID: {booking.transaction_id}
                        </p>
                    </div>
                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
                </div>

                {/* Actions */}
                <div className="flex justify-center space-x-4">
                    <Link to="/tourist" className="px-6 py-2 bg-white text-gray-700 rounded-full font-medium shadow-sm border border-gray-200 hover:bg-gray-50 flex items-center">
                        <ArrowRight className="w-4 h-4 mr-2 rotate-180" /> Dashboard
                    </Link>
                    <Link to="/" className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium shadow-sm hover:bg-blue-700 flex items-center">
                        <Home className="w-4 h-4 mr-2" /> Go Home
                    </Link>
                </div>

                {/* Receipt */}
                <div>
                   <h2 className="text-xl font-bold text-gray-900 mb-4 ml-2">Your Receipt</h2>
                   <Receipt 
                        isOpen={true} 
                        booking={booking} 
                        inline={true} 
                        onClose={() => navigate('/tourist')} 
                    />
                </div>

            </div>
        </div>
    );
};

export default BookingConfirmation;
