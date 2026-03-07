import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, MapPin, Phone, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';

// --- Password Strength Helper ---
const getPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score === 0) return null;
    if (score === 1) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/4' };
    if (score === 2) return { label: 'Fair', color: 'bg-orange-400', width: 'w-2/4' };
    if (score === 3) return { label: 'Strong', color: 'bg-blue-500', width: 'w-3/4' };
    return { label: 'Very Strong', color: 'bg-green-500', width: 'w-full' };
};

const Register = () => {
    const [role, setRole] = useState('tourist');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [message, setMessage] = useState(null);
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        location: ''
    });

    const [errors, setErrors] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        location: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Restrict fullName to alphabets and spaces only
        if (name === 'fullName' && /[^a-zA-Z\s]/.test(value)) return;

        // Restrict phone to digits only and max 10
        if (name === 'phone') {
            const digitsOnly = value.replace(/\D/g, '');
            if (digitsOnly.length > 10) return;
            setFormData(prev => ({ ...prev, phone: digitsOnly }));
            setErrors(prev => ({ ...prev, phone: '' }));
            return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
        setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const newErrors = {
            fullName: '', email: '', password: '',
            confirmPassword: '', phone: '', location: ''
        };
        let isValid = true;

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Full name is required.';
            isValid = false;
        } else if (!/^[a-zA-Z\s]+$/.test(formData.fullName.trim())) {
            newErrors.fullName = 'Full name should only contain alphabets.';
            isValid = false;
        } else if (formData.fullName.trim().length < 2) {
            newErrors.fullName = 'Name must be at least 2 characters.';
            isValid = false;
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required.';
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            newErrors.email = 'Enter a valid email address.';
            isValid = false;
        }

        if (!formData.password) {
            newErrors.password = 'Password is required.';
            isValid = false;
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters.';
            isValid = false;
        } else if (!/[A-Z]/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one uppercase letter.';
            isValid = false;
        } else if (!/[0-9]/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one number.';
            isValid = false;
        } else if (!/[^A-Za-z0-9]/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one special character.';
            isValid = false;
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password.';
            isValid = false;
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match.';
            isValid = false;
        }

        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required.';
            isValid = false;
        } else if (formData.phone.replace(/\D/g, '').length < 7) {
            newErrors.phone = 'Enter a valid phone number (min 7 digits).';
            isValid = false;
        } else if (formData.phone.replace(/\D/g, '').length > 10) {
            newErrors.phone = 'Phone number should not exceed 10 digits.';
            isValid = false;
        }

        if (role === 'owner' && !formData.location.trim()) {
            newErrors.location = 'Location is required for owners.';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(null);
        if (!validate()) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email: formData.email.trim(),
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName.trim(),
                        phone: formData.phone.trim(),
                        role: role,
                        location: role === 'owner' ? formData.location.trim() : null
                    }
                }
            });
            if (error) throw error;

            setMessage({ type: 'success', text: "Registration successful! Redirecting to login..." });
            setTimeout(() => navigate('/login'), 1500);
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const strength = getPasswordStrength(formData.password);

    const inputClass = (field) =>
        `w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors[field] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 pt-20 bg-gray-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 overflow-hidden relative border border-gray-200">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-blue-500"></div>

                <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Create Account</h2>
                <p className="text-gray-500 text-center mb-6">Join VacayHome today</p>

                {message && (
                    <div className={`p-4 mb-4 text-sm rounded-2xl ${
                        message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`} role="alert">
                        <span className="font-medium">{message.type === 'success' ? 'Success!' : 'Error!'}</span> {message.text}
                    </div>
                )}

                {/* Role Toggles */}
                <div className="flex justify-center mb-8">
                    <div className="bg-gray-100 p-1 rounded-2xl flex">
                        {['tourist', 'owner'].map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={`px-6 py-2 rounded-full text-sm font-medium transition-all capitalize ${role === r
                                    ? 'bg-white shadow text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6" noValidate>
                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <div className="relative">
                            <User className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="John Doe"
                                className={inputClass('fullName')}
                            />
                        </div>
                        {errors.fullName
                            ? <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>
                            : <p className="text-gray-400 text-xs mt-1">Alphabets only</p>
                        }
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <div className="relative">
                            <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="john@example.com"
                                className={inputClass('email')}
                            />
                        </div>
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className={`w-full pl-10 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none">
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {/* Password Strength Bar */}
                        {formData.password && strength && (
                            <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}></div>
                                </div>
                                <p className={`text-xs mt-1 font-medium ${
                                    strength.label === 'Weak' ? 'text-red-500' :
                                    strength.label === 'Fair' ? 'text-orange-400' :
                                    strength.label === 'Strong' ? 'text-blue-500' : 'text-green-500'
                                }`}>{strength.label}</p>
                            </div>
                        )}
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                        <div className="relative">
                            <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className={`w-full pl-10 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 focus:outline-none">
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <div className="relative">
                            <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="10-digit number"
                                maxLength={10}
                                className={inputClass('phone')}
                            />
                        </div>
                        {errors.phone
                            ? <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                            : <p className="text-gray-400 text-xs mt-1">Digits only, max 10</p>
                        }
                    </div>

                    {/* Location (Owner only) */}
                    {role === 'owner' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Location / City</label>
                            <div className="relative">
                                <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    placeholder="New York, NY"
                                    className={inputClass('location')}
                                />
                            </div>
                            {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-full transition-transform transform active:scale-95 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating Account...' : `Register as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
                        </button>
                    </div>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    Already have an account?
                    <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500 ml-1">Sign in</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
