import { useState, useEffect } from 'react';
import { Star, User } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { formatDate } from '../utils/dateFormatter';

const ReviewList = ({ propertyId }) => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [averageRating, setAverageRating] = useState(0);

    const fetchReviews = async () => {
        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('*') // We might want to join a profiles table here eventually if we had one
                .eq('property_id', propertyId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            setReviews(data || []);

            // Calculate average
            if (data && data.length > 0) {
                const total = data.reduce((sum, r) => sum + r.rating, 0);
                setAverageRating((total / data.length).toFixed(1));
            } else {
                setAverageRating(0);
            }

        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (propertyId) {
            fetchReviews();
        }
    }, [propertyId]);

    // Expose refresh function or use context/parent state if needed for instant updates after submission
    // For now, we'll just load on mount/prop change

    if (loading) return <div className="text-gray-500 py-4">Loading reviews...</div>;

    if (reviews.length === 0) {
        return (
            <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-gray-500">No reviews yet. Be the first to review!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center">
                    <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                    <span className="text-2xl font-bold ml-2 text-gray-900">{averageRating}</span>
                </div>
                <span className="text-gray-500">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
            </div>

            <div className="space-y-6">
                {reviews.map((review) => (
                    <div key={review.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-900">Guest</div>
                                    <div className="text-xs text-gray-400">{formatDate(review.created_at)}</div>
                                </div>
                            </div>
                            <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                    <Star 
                                        key={i} 
                                        className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} 
                                    />
                                ))}
                            </div>
                        </div>
                        {review.comment && (
                            <p className="text-gray-600 leading-relaxed text-sm">
                                {review.comment}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReviewList;
