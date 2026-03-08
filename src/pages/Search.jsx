import { useState, useEffect } from 'react';
import { Search as SearchIcon, MapPin, Calendar, IndianRupee, Star, Heart } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { applyOverwrites } from '../utils/propertyOverwrites';
import HeartButton from '../components/HeartButton';

const Search = () => {
    const [properties, setProperties] = useState([]);
    const [filteredProperties, setFilteredProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [location, setLocation] = useState('');
    const [priceRange, setPriceRange] = useState('');
    const [guestCount, setGuestCount] = useState('');
    const [propertyType, setPropertyType] = useState('Any');

    useEffect(() => {
        fetchProperties();
    }, []);

    const fetchProperties = async () => {
        try {
            setLoading(true);
            
            // Get user role
            let role = null;
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                role = profileData?.role;
            }

            // 1. Fetch Main Properties
            const response = await fetch('/api/properties');
            if (!response.ok) throw new Error('Failed to fetch properties');
            const data = await response.json();

            let allProps = data || [];
            allProps = applyOverwrites(allProps);
            
            // STRICT FRONTEND FILTER (Requested by User)
            // Even if RLS allows owners to see their pending items, we hide them here.
            // Only Admins see everything.
            if (role !== 'admin') {
                allProps = allProps.filter(p => p.status?.toLowerCase() === 'approved');
            }

            setProperties(allProps);
            setFilteredProperties(allProps);
        } catch (err) {
            console.error('Error fetching data:', err);
            setFetchError(err.message || 'Unknown error fetching properties');
        } finally {
            setLoading(false);
        }
    };

    // Filter Effect (Client-side Search Inputs only)
    useEffect(() => {
        let res = properties;
        
        // 1. Text Search (Location, Title, or Description)
        if (location) {
            const term = location.toLowerCase();
            res = res.filter(p => 
                p.location.toLowerCase().includes(term) || 
                p.title.toLowerCase().includes(term) ||
                (p.description && p.description.toLowerCase().includes(term))
            );
        }

        // 2. Price Filter
        if (priceRange) {
             res = res.filter(p => p.price_per_night <= parseInt(priceRange));
        }

        // 3. Guest Capacity Filter
        if (guestCount) {
            res = res.filter(p => p.max_guests >= parseInt(guestCount));
        }

        // 4. Property Type Filter
        if (propertyType && propertyType !== 'Any') {
            res = res.filter(p => p.property_type === propertyType);
        }

        setFilteredProperties(res);
    }, [location, priceRange, guestCount, propertyType, properties]);

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
             <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
                    <h1 className="text-2xl font-bold">Find Stays</h1>
                    <p className="text-gray-500">Found {filteredProperties.length} properties</p>
                </div>

                {/* Main Error Alert */}
                {fetchError && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                        <strong className="font-bold">Error Loading Properties: </strong>
                        <span className="block sm:inline">{fetchError}</span>
                    </div>
                )}

                {/* Search Inputs */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <MapPin className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input 
                            className="w-full p-2 pl-10 border border-gray-200 rounded-full focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition" 
                            placeholder="Location, Title, or Keyword..." 
                            value={location} 
                            onChange={e => setLocation(e.target.value)} 
                        />
                    </div>
                    <div className="relative w-full md:w-40">
                        <IndianRupee className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input 
                            type="number"
                            min="0"
                            className="w-full p-2 pl-10 border border-gray-200 rounded-full focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition" 
                            placeholder="Max Price" 
                            value={priceRange} 
                            onChange={e => {
                                let val = e.target.value;
                                if (val && val < 0) val = 0;
                                setPriceRange(val);
                            }}
                            onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()} 
                        />
                    </div>
                    <div className="relative w-full md:w-32">
                        <input 
                            type="number"
                            min="1"
                            className="w-full p-2 pl-4 border border-gray-200 rounded-full focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition" 
                            placeholder="Guests" 
                            value={guestCount} 
                            onChange={e => {
                                let val = e.target.value;
                                if (val && val < 0) val = 1;
                                setGuestCount(val);
                            }}
                            onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()} 
                        />
                    </div>
                    <div className="relative w-full md:w-48">
                        <select 
                            className="w-full p-2 border border-gray-200 rounded-full bg-white pr-8 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition"
                            value={propertyType}
                            onChange={e => setPropertyType(e.target.value)}
                        >
                            <option value="Any">Any Type</option>
                            <option value="Villa">Villa</option>
                            <option value="Apartment">Apartment</option>
                            <option value="Cottage">Cottage</option>
                            <option value="Guest House">Guest House</option>
                            <option value="Resort">Resort</option>
                        </select>
                    </div>
                </div>

                {/* Property Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredProperties.map(p => (
                        <div key={p.id} className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden hover:shadow-lg transition">
                            <div className="h-48 bg-gray-200 relative">
                                {p.image_url ? (
                                    <img 
                                        src={p.image_url} 
                                        className="w-full h-full object-cover" 
                                        alt={p.title} 
                                        onError={(e) => {
                                            e.target.onerror = null; 
                                            e.target.src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200";
                                        }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                                )}
                                <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
                                     <HeartButton propertyId={p.id} />
                                     {p.availability === 'Under Maintenance' && (
                                         <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                             MAINTENANCE
                                         </span>
                                     )}
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-lg">{p.title}</h3>
                                <div className="flex items-center text-gray-500 text-sm mt-1">
                                    <MapPin size={16} className="mr-1" />
                                    {p.location}
                                </div>
                                <div className="mt-4 flex justify-between items-center border-t pt-3">
                                    <span className="font-bold text-lg">₹{p.price_per_night}</span>
                                    <Link to={`/property/${p.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700">
                                        View Details
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {filteredProperties.length === 0 && !loading && (
                    <div className="text-center py-20 text-gray-500">
                        <p>No properties found matching your criteria.</p>
                    </div>
                )}
             </div>
        </div>
    );
};

export default Search;
