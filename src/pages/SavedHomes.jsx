import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Heart, MapPin, IndianRupee, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import HeartButton from '../components/HeartButton';

const SavedHomes = () => {
    const [savedProperties, setSavedProperties] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSavedProperties();
    }, []);

    const fetchSavedProperties = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('saved_properties')
                .select('property_id, properties(*)')
                .eq('user_id', user.id);

            if (error) throw error;
            if (data) {
                setSavedProperties(data.map(item => item.properties));
            }
        } catch (error) {
            console.error('Error fetching saved properties:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 bg-gray-50 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to="/tourist" className="mr-4 p-2 rounded-full hover:bg-gray-200 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Saved Homes</h1>
                        <p className="text-gray-600 mt-1">Your collection of favorite stays.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20">Loading...</div>
                ) : savedProperties.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-200">
                        <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No saved homes yet</h3>
                        <p className="text-gray-500 mb-6">Start exploring and save your favorite places!</p>
                        <Link to="/search" className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition font-medium">
                            Explore Stays
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {savedProperties.map((property) => (
                            <Link key={property.id} to={`/property/${property.id}`} className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <div className="relative h-64 overflow-hidden bg-gray-200">
                                    {property.image_url ? (
                                        <img 
                                            src={property.image_url} 
                                            alt={property.title} 
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                                    )}
                                    <div className="absolute top-3 right-3">
                                        <HeartButton propertyId={property.id} />
                                    </div>
                                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg text-sm font-bold text-gray-900 shadow-sm">
                                        ₹{property.price_per_night} <span className="font-normal text-gray-500 text-xs">/night</span>
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate group-hover:text-blue-600 transition-colors">{property.title}</h3>
                                    <div className="flex items-center text-gray-500 text-sm mb-4">
                                        <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                                        {property.location}
                                    </div>
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-sm text-gray-500">
                                        <span>{property.max_guests} Guests</span>
                                        <span>{property.property_type}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SavedHomes;
