import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Star, Trash2, ArrowLeft, Search, Filter, Home, User, Download, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/dateFormatter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmDialog from '../components/ConfirmDialog';

const ReviewsList = () => {
    const { showToast } = useToast();
    const [reviews, setReviews] = useState([]);
    const [filteredReviews, setFilteredReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [ratingFilter, setRatingFilter] = useState('all');
    const [deleteReviewId, setDeleteReviewId] = useState(null);

    useEffect(() => {
        fetchReviews();
    }, []);

    useEffect(() => {
        filterReviews();
    }, [searchTerm, ratingFilter, reviews]);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            
            // 1. Fetch Reviews
            const { data: reviewsData, error: reviewsError } = await supabase
                .from('reviews')
                .select('*')
                .order('created_at', { ascending: false });

            if (reviewsError) throw reviewsError;

            if (!reviewsData || reviewsData.length === 0) {
                setReviews([]);
                setFilteredReviews([]);
                return;
            }

            // 2. Fetch Properties and User Profiles manually (since joins can be tricky)
            const propertyIds = [...new Set(reviewsData.map(r => r.property_id).filter(Boolean))];
            const touristIds = [...new Set(reviewsData.map(r => r.tourist_id).filter(Boolean))];

            let propertiesMap = {};
            if (propertyIds.length > 0) {
                const { data: props } = await supabase
                    .from('properties')
                    .select('id, title')
                    .in('id', propertyIds);
                props?.forEach(p => propertiesMap[p.id] = p);
            }

            let profilesMap = {};
            if (touristIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', touristIds);
                profiles?.forEach(p => profilesMap[p.id] = p);
            }

            // 3. Enriched reviews
            const enriched = reviewsData.map(r => ({
                ...r,
                property_title: propertiesMap[r.property_id]?.title || 'Unknown Property',
                tourist_name: profilesMap[r.tourist_id]?.full_name || 'Anonymous',
                tourist_email: profilesMap[r.tourist_id]?.email || ''
            }));

            setReviews(enriched);
            setFilteredReviews(enriched);
        } catch (error) {
            console.error('Error fetching reviews:', error);
            showToast('Failed to load reviews', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filterReviews = () => {
        let result = reviews;

        if (ratingFilter !== 'all') {
            result = result.filter(r => r.rating === parseInt(ratingFilter));
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(r => 
                r.property_title.toLowerCase().includes(lower) ||
                r.tourist_name.toLowerCase().includes(lower) ||
                (r.comment && r.comment.toLowerCase().includes(lower))
            );
        }

        setFilteredReviews(result);
    };

    const handleDelete = async () => {
        if (!deleteReviewId) return;

        try {
            const { error } = await supabase
                .from('reviews')
                .delete()
                .eq('id', deleteReviewId);

            if (error) throw error;

            showToast('Review deleted successfully', 'success');
            setReviews(prev => prev.filter(r => r.id !== deleteReviewId));
            setDeleteReviewId(null);
        } catch (error) {
            console.error('Error deleting review:', error);
            showToast('Failed to delete review', 'error');
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Review Moderation Report', 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        
        const tableData = filteredReviews.map(r => [
            r.property_title,
            r.tourist_name,
            `${r.rating} Stars`,
            r.comment || 'No comment',
            formatDate(r.created_at)
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Property', 'Reviewer', 'Rating', 'Comment', 'Date']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });
        
        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <Link to="/admin" className="text-gray-500 hover:text-blue-600 flex items-center mb-2 transition">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">Review Moderation</h1>
                        <p className="text-gray-500">View and manage all user reviews.</p>
                    </div>
                    <button 
                        onClick={generatePDF}
                        disabled={filteredReviews.length === 0}
                        className="bg-white p-2 rounded-full border border-gray-200 shadow-sm text-gray-500 hover:text-blue-600 hover:border-blue-200 transition disabled:opacity-50"
                        title="Download Report"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                            <input 
                                type="text" 
                                placeholder="Search property, reviewer, or content..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                            <Filter className="w-4 h-4 text-gray-400" />
                            {['all', '5', '4', '3', '2', '1'].map(rate => (
                                <button
                                    key={rate}
                                    onClick={() => setRatingFilter(rate)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition whitespace-nowrap flex items-center gap-1 ${
                                        ratingFilter === rate 
                                            ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                                    }`}
                                >
                                    {rate === 'all' ? 'All Ratings' : `${rate} Stars`}
                                    {rate !== 'all' && <Star className="w-3 h-3 fill-current" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3">Property</th>
                                    <th className="px-6 py-3">Reviewer</th>
                                    <th className="px-6 py-3">Rating</th>
                                    <th className="px-6 py-3">Comment</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center">Loading reviews...</td>
                                    </tr>
                                ) : filteredReviews.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center">No reviews found.</td>
                                    </tr>
                                ) : (
                                    filteredReviews.map((review) => (
                                        <tr key={review.id} className="bg-white border-b hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900 group">
                                                    <Link to={`/property/${review.property_id}`} target="_blank" className="hover:text-blue-600 flex items-center gap-1 transition">
                                                        {review.property_title}
                                                        <AlertCircle className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                                    </Link>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{review.tourist_name}</div>
                                                <div className="text-xs text-gray-500">{review.tourist_email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex text-yellow-500">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star 
                                                            key={i} 
                                                            className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-200'}`} 
                                                        />
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs">
                                                <p className="line-clamp-2 text-gray-600" title={review.comment}>
                                                    {review.comment || <span className="italic text-gray-400">No comment</span>}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {formatDate(review.created_at)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => setDeleteReviewId(review.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                    title="Delete Review"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ConfirmDialog 
                isOpen={!!deleteReviewId}
                title="Delete Review"
                message="Are you sure you want to delete this review? This action cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setDeleteReviewId(null)}
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
};

export default ReviewsList;
