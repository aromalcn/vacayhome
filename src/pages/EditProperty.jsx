import { useState, useEffect } from 'react';
import { Upload, MapPin, IndianRupee, Home, X, Globe } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import MapPicker from '../components/MapPicker';
import LocalGuideManager from '../components/LocalGuideManager';

const EditProperty = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(false);
    const [fetchingProperty, setFetchingProperty] = useState(true);
    const [userRole, setUserRole] = useState(null);
    
    // State for multiple images
    // existingImages are URLs already in DB
    const [existingImages, setExistingImages] = useState([]);
    // newImageFiles are Files selected for upload
    const [newImageFiles, setNewImageFiles] = useState([]);
    // previewUrls for newImageFiles
    const [newPreviewUrls, setNewPreviewUrls] = useState([]);
    
    const [formData, setFormData] = useState({
        title: '',
        location: '',
        price: '',
        capacity: '',
        type: 'Villa',
        description: '',
        availability: 'Available',
        latitude: null,
        longitude: null
    });

    useEffect(() => {
        const fetchProperty = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    showToast('You must be logged in', 'error');
                    navigate('/login');
                    return;
                }

                // Fetch user role
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                
                const role = profileData?.role;
                setUserRole(role);

                let query = supabase
                    .from('properties')
                    .select('*')
                    .eq('id', id);

                // Only filter by owner_id if NOT an admin
                if (role !== 'admin') {
                    query = query.eq('owner_id', user.id);
                }

                const { data, error } = await query.single();

                if (error) throw error;

                if (!data) {
                    showToast('Property not found or you do not have permission to edit it', 'error');
                    navigate(role === 'admin' ? '/admin/properties' : '/owner');
                    return;
                }

                // Pre-populate form with existing data
                setFormData({
                    title: data.title || '',
                    location: data.location || '',
                    price: data.price_per_night || '',
                    capacity: data.max_guests || '',
                    type: data.property_type || 'Villa',
                    description: data.description || '',
                    availability: data.availability || 'Available',
                    latitude: data.latitude,
                    longitude: data.longitude
                });
                
                // Handle images
                // If 'images' column has data, use it. Fallback to 'image_url' if 'images' is empty/null but image_url exists
                if (data.images && data.images.length > 0) {
                    setExistingImages(data.images);
                } else if (data.image_url) {
                    setExistingImages([data.image_url]);
                }
            } catch (error) {
                console.error('Error fetching property:', error);
                showToast('Error loading property details', 'error');
                navigate('/owner');
            } finally {
                setFetchingProperty(false);
            }
        };

        fetchProperty();
    }, [id, navigate, showToast]);

    const handleChange = (e) => {
        let value = e.target.value;
        if (e.target.type === 'number') {
             if (value < 0) value = 0; // Prevent negative inputs
        }
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const totalImages = existingImages.length + newImageFiles.length + files.length;
        
        if (totalImages > 5) {
            showToast('You can have a maximum of 5 images total', 'error');
            return;
        }

        const validFiles = [];
        const newPreviews = [];

        files.forEach(file => {
             if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showToast(`File ${file.name} is too large (max 5MB)`, 'error');
            } else {
                validFiles.push(file);
                newPreviews.push(URL.createObjectURL(file));
            }
        });

        setNewImageFiles(prev => [...prev, ...validFiles]);
        setNewPreviewUrls(prev => [...prev, ...newPreviews]);
    };

    const removeExistingImage = (index) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewImage = (index) => {
        setNewImageFiles(prev => prev.filter((_, i) => i !== index));
        setNewPreviewUrls(prev => {
            const newPreviews = prev.filter((_, i) => i !== index);
            URL.revokeObjectURL(prev[index]);
            return newPreviews;
        });
    };

    const uploadImage = async (file) => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('property-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from('property-images')
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) throw new Error('You must be logged in to update a property');

            // Upload new images
            const newlyUploadedUrls = [];
            for (const file of newImageFiles) {
                try {
                    const url = await uploadImage(file);
                    newlyUploadedUrls.push(url);
                } catch (uploadError) {
                    showToast('Failed to upload one or more images', 'error');
                    setLoading(false);
                    return;
                }
            }

            // Combine existing and new URLs
            const allImages = [...existingImages, ...newlyUploadedUrls];

            // Primary image url for backward compatibility
            const mainImageUrl = allImages.length > 0 ? allImages[0] : '';

            let updateQuery = supabase
                .from('properties')
                .update({
                    title: formData.title,
                    location: formData.location,
                    price_per_night: formData.price,
                    max_guests: formData.capacity,
                    property_type: formData.type,
                    description: formData.description,
                    image_url: mainImageUrl, 
                    images: allImages,
                    availability: formData.availability,
                    latitude: formData.latitude,
                    longitude: formData.longitude
                })
                .eq('id', id);

            // Only filter by owner_id if NOT an admin
            if (userRole !== 'admin') {
                updateQuery = updateQuery.eq('owner_id', user.id);
            }

            const { error } = await updateQuery;

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }

            showToast('Property updated successfully!', 'success');
            navigate(userRole === 'admin' ? '/admin/properties' : '/owner');

        } catch (error) {
            console.error('Error updating property:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (fetchingProperty) {
        return (
            <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4 flex items-center justify-center">
                <p className="text-gray-500">Loading property details...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all duration-300">
                <div className="p-8 border-b border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900">Edit Property</h1>
                    <p className="text-gray-500">Update your property details</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Property Title</label>
                            <div className="relative">
                                <Home className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input 
                                    id="title"
                                    type="text" 
                                    name="title" 
                                    value={formData.title} 
                                    onChange={handleChange} 
                                    placeholder="e.g. Cozy Cottage in Hills" 
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500" 
                                    required 
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                            <div className="relative">
                                <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input 
                                    id="location"
                                    type="text" 
                                    name="location" 
                                    value={formData.location} 
                                    onChange={handleChange} 
                                    placeholder="City, State" 
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500" 
                                    required 
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">Price per Night (₹)</label>
                            <div className="relative">
                                <IndianRupee className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input 
                                    id="price"
                                    type="number" 
                                    min="0"
                                    name="price" 
                                    value={formData.price} 
                                    onChange={handleChange} 
                                    onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                                    placeholder="5000" 
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500" 
                                    required 
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-1">Capacity (Max Guests)</label>
                            <input 
                                id="capacity"
                                type="number" 
                                min="1"
                                name="capacity" 
                                value={formData.capacity} 
                                onChange={handleChange} 
                                onKeyDown={(e) => (e.key === '-' || e.key === 'e') && e.preventDefault()}
                                placeholder="4" 
                                className="w-full px-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500" 
                                required 
                            />
                        </div>

                        <div>
                            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                            <select 
                                id="type"
                                name="type" 
                                value={formData.type} 
                                onChange={handleChange} 
                                className="w-full px-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Villa">Villa</option>
                                <option value="Apartment">Apartment</option>
                                <option value="Cottage">Cottage</option>
                                <option value="Guest House">Guest House</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="availability" className="block text-sm font-medium text-gray-700 mb-1">Availability Status</label>
                            <select 
                                id="availability"
                                name="availability" 
                                value={formData.availability} 
                                onChange={handleChange} 
                                className="w-full px-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Available">Available</option>
                                <option value="Under Maintenance">Under Maintenance</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea 
                                id="description"
                                name="description" 
                                value={formData.description} 
                                onChange={handleChange} 
                                rows="4" 
                                className="w-full px-4 py-2 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500" 
                                placeholder="Describe your property..."
                            ></textarea>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2 whitespace-nowrap flex items-center">
                                <Globe className="w-4 h-4 mr-2 text-blue-500" />
                                Tag Location on Map
                            </label>
                            <MapPicker 
                                initialLocation={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null}
                                onLocationSelect={(loc) => setFormData({ ...formData, latitude: loc.lat, longitude: loc.lng })} 
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Images (Max 5)</label>
                            <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-2xl transition cursor-pointer relative ${(existingImages.length + newPreviewUrls.length) > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                                <div className="space-y-1 text-center w-full">
                                    {/* Display Existing + New Images */}
                                    {(existingImages.length > 0 || newPreviewUrls.length > 0) ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                            {/* Existing Images */}
                                            {existingImages.map((url, index) => (
                                                <div key={`existing-${index}`} className="relative group">
                                                    <img src={url} alt={`Existing ${index}`} className="h-24 w-full object-cover rounded-md" />
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            removeExistingImage(index);
                                                        }}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            {/* New Images */}
                                            {newPreviewUrls.map((url, index) => (
                                                <div key={`new-${index}`} className="relative group">
                                                    <img src={url} alt={`New ${index}`} className="h-24 w-full object-cover rounded-md" />
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            removeNewImage(index);
                                                        }}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                    )}
                                    
                                    <div className="flex text-sm text-gray-600 justify-center">
                                        <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                            <span>{(existingImages.length + newPreviewUrls.length) > 0 ? 'Add more photos' : 'Upload photos'}</span>
                                            <input 
                                                type="file" 
                                                className="sr-only" 
                                                accept="image/*"
                                                multiple
                                                onChange={handleImageChange}
                                            />
                                        </label>
                                        <p className="pl-1">or drag and drop</p>
                                    </div>
                                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                                </div>
                            </div>
                        </div>

                        {/* Local Guide Manager */}
                        <div className="col-span-2 mt-8 pt-8 border-t border-gray-100">
                            <LocalGuideManager 
                                propertyId={id} 
                                latitude={formData.latitude} 
                                longitude={formData.longitude} 
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-6">
                        <button type="button" onClick={() => navigate(userRole === 'admin' ? '/admin/properties' : '/owner')} className="mr-4 px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 disabled:opacity-50"
                        >
                            {loading ? 'Updating...' : 'Update Property'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProperty;
