import React, { useState, useEffect } from 'react';
import { User, Phone, MapPin, ShieldAlert, Save, ArrowLeft } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';
import { useNavigate, Link } from 'react-router-dom';

const ProfileSettings = () => {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState(null);
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        location: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: ''
    });

    const [errors, setErrors] = useState({
        full_name: '',
        phone: '',
        location: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }
            setUser(user);

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            if (data) {
                setFormData({
                    full_name: data.full_name || '',
                    phone: data.phone || '',
                    location: data.location || '',
                    emergency_contact_name: data.emergency_contact_name || '',
                    emergency_contact_phone: data.emergency_contact_phone || '',
                    emergency_contact_relationship: data.emergency_contact_relationship || ''
                });
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            showToast('Error loading profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Constraint: Full name alphabets only
        if ((name === 'full_name' || name === 'emergency_contact_name') && /[^a-zA-Z\s]/.test(value)) return;

        // Constraint: Phone numbers digits only and max 10
        if (name === 'phone' || name === 'emergency_contact_phone') {
            const digits = value.replace(/\D/g, '');
            if (digits.length > 10) return;
            setFormData({ ...formData, [name]: digits });
            setErrors({ ...errors, [name]: '' });
            return;
        }

        setFormData({ ...formData, [name]: value });
        setErrors({ ...errors, [name]: '' });
    };

    const validate = () => {
        const newErrors = {
            full_name: '', phone: '', location: '',
            emergency_contact_name: '', emergency_contact_phone: '',
            emergency_contact_relationship: ''
        };
        let isValid = true;

        if (!formData.full_name.trim()) {
            newErrors.full_name = 'Full name is required';
            isValid = false;
        } else if (formData.full_name.trim().length < 2) {
            newErrors.full_name = 'Name must be at least 2 characters';
            isValid = false;
        }

        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
            isValid = false;
        } else if (formData.phone.length < 10) {
            newErrors.phone = 'Phone number must be exactly 10 digits';
            isValid = false;
        }

        if (formData.emergency_contact_phone && formData.emergency_contact_phone.length < 10) {
            newErrors.emergency_contact_phone = 'Emergency phone must be 10 digits';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) {
            showToast('Please fix the errors in the form', 'error');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update(formData)
                .eq('id', user.id);

            if (error) throw error;
            showToast('Profile updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast(`Failed to update profile: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading settings...</div>;

    return (
        <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center mb-8">
                    <Link to={-1} className="mr-4 p-2 bg-white rounded-full text-gray-600 hover:text-blue-600 shadow-sm transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="flex items-center mb-6 text-blue-600 border-b border-gray-100 pb-4">
                            <User className="w-5 h-5 mr-2" />
                            <h2 className="text-lg font-bold text-gray-800">Basic Information</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input 
                                    type="text" 
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${errors.full_name ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} 
                                />
                                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input 
                                    type="tel" 
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} 
                                />
                                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <div className="relative">
                                    <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                                    <input 
                                        type="text" 
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                        placeholder="City, State"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <div className="flex items-center mb-6 text-red-600 border-b border-gray-100 pb-4">
                            <ShieldAlert className="w-5 h-5 mr-2" />
                            <h2 className="text-lg font-bold text-gray-800">Emergency Contact</h2>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">These details will be shared with property owners during an active stay for your safety.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                                <input 
                                    type="text" 
                                    name="emergency_contact_name"
                                    value={formData.emergency_contact_name}
                                    onChange={handleChange}
                                    placeholder="Emergency Contact Name"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                                <input 
                                    type="tel" 
                                    name="emergency_contact_phone"
                                    value={formData.emergency_contact_phone}
                                    onChange={handleChange}
                                    placeholder="Emergency Contact Phone"
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${errors.emergency_contact_phone ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} 
                                />
                                {errors.emergency_contact_phone && <p className="text-red-500 text-xs mt-1">{errors.emergency_contact_phone}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                                <input 
                                    type="text" 
                                    name="emergency_contact_relationship"
                                    value={formData.emergency_contact_relationship}
                                    onChange={handleChange}
                                    placeholder="e.g. Spouse, Parent, Friend"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center px-8 py-3 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : (
                                <>
                                    <Save className="w-5 h-5 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileSettings;
