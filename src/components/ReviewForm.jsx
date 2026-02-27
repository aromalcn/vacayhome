import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

const ReviewForm = ({ bookingId, propertyId, onClose, onReviewSubmitted }) => {
    const { showToast } = useToast();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (rating === 0) {
            showToast('Please select a star rating', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be logged in');

            const { error } = await supabase
                .from('reviews')
                .insert([
                    {
                        booking_id: bookingId,
                        property_id: propertyId,
                        tourist_id: user.id,
                        rating,
                        comment
                    }
                ]);

            if (error) throw error;

            showToast('Review submitted successfully!', 'success');
            if (onReviewSubmitted) onReviewSubmitted();
            if (onClose) onClose();

        } catch (error) {
            console.error('Error submitting review:', error);
            showToast('Failed to submit review', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 relative shadow-xl">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold text-gray-900 mb-2">Write a Review</h2>
                <p className="text-gray-500 mb-6">How was your stay?</p>

                <form onSubmit={handleSubmit}>
                    <div className="flex justify-center mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                className="p-1 focus:outline-none transition-transform hover:scale-110"
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                onClick={() => setRating(star)}
                            >
                                <Star 
                                    className={`w-10 h-10 ${
                                        star <= (hoverRating || rating) 
                                            ? 'text-yellow-400 fill-yellow-400' 
                                            : 'text-gray-300'
                                    }`} 
                                />
                            </button>
                        ))}
                    </div>

                    <div className="mb-6">
                        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                            Share your experience (optional)
                        </label>
                        <textarea
                            id="comment"
                            rows="4"
                            className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-gray-50 resize-none"
                            placeholder="What did you like? What could be improved?"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 font-medium rounded-full hover:bg-gray-50 transition"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition disabled:opacity-50"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReviewForm;
