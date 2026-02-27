import { useState } from 'react';
import { Upload, MapPin, IndianRupee, Home, X, Globe } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import MapPicker from '../components/MapPicker';

const AddProperty = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [imageFiles, setImageFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        location: '',
        price: '',
        capacity: '',
        type: 'Villa',
        description: '',
        latitude: null,
        longitude: null
    });

    const handleChange = (e) => {
        let value = e.target.value;
        if (e.target.type === 'number') {
             if (value < 0) value = 0; // Prevent negative inputs
        }
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 5) {
            showToast('You can upload a maximum of 5 images', 'error');
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

        setImageFiles(prev => [...prev, ...validFiles]);
        setPreviewUrls(prev => [...prev, ...newPreviews]);
    };

    const removeImage = (index) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => {
            const newPreviews = prev.filter((_, i) => i !== index);
            // Revoke the URL to avoid memory leaks
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
            // Validate images
            if (imageFiles.length === 0) {
                 showToast('Please upload at least one image', 'error');
                 setLoading(false);
                 return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) throw new Error('You must be logged in to list a property');

            const uploadedImageUrls = [];

            // Upload all images
            for (const file of imageFiles) {
                try {
                    const url = await uploadImage(file);
                    uploadedImageUrls.push(url);
                } catch (uploadError) {
                    showToast('Failed to upload one or more images', 'error');
                    setLoading(false);
                    return;
                }
            }

            const mainImageUrl = uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : `https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800`;

            const { error } = await supabase
                .from('properties')
                .insert([{
                    owner_id: user.id,
                    title: formData.title,
                    location: formData.location,
                    price_per_night: formData.price,
                    max_guests: formData.capacity,
                    property_type: formData.type,
                    description: formData.description,
                    image_url: mainImageUrl,
                    images: uploadedImageUrls,
                    availability: 'Available',
                    latitude: formData.latitude,
                    longitude: formData.longitude
                }]);

            if (error) throw error;
            
            showToast('Property submitted! It will be visible after admin approval.', 'success');
            navigate('/owner');

        } catch (error) {
            console.error('Error adding property:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-200 transition-all duration-300">
                <div className="p-8 border-b border-gray-100">
                    <h1 className="text-2xl font-bold text-gray-900">List Your Property</h1>
                    <p className="text-gray-500">Fill in the details to list your home on VacayHome</p>
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
                                onLocationSelect={(loc) => setFormData({ ...formData, latitude: loc.lat, longitude: loc.lng })} 
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Upload Images (Max 5)</label>
                            <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-2xl transition cursor-pointer relative ${previewUrls.length > 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                                <div className="space-y-1 text-center w-full">
                                    {previewUrls.length > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                            {previewUrls.map((url, index) => (
                                                <div key={index} className="relative group">
                                                    <img src={url} alt={`Preview ${index}`} className="h-24 w-full object-cover rounded-md" />
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            removeImage(index);
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
                                            <span>{previewUrls.length > 0 ? 'Add more photos' : 'Upload photos'}</span>
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
                    </div>

                    <div className="flex justify-end pt-6">
                        <button type="button" onClick={() => navigate('/owner')} className="mr-4 px-6 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 disabled:opacity-50"
                        >
                            {loading ? 'Listing...' : 'Submit Listing'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddProperty;
