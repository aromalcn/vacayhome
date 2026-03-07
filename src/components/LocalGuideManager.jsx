import React, { useState } from 'react';
import { Plus, X, MapPin, Utensils, Bus, Clock, Save, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';

const LocalGuideManager = ({ propertyId, latitude, longitude }) => {
    const { showToast } = useToast();
    const [pois, setPois] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newPoi, setNewPoi] = useState({
        name: '',
        category: 'attraction',
        description: '',
        latitude: latitude || '',
        longitude: longitude || '',
        info: {}
    });
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [editingPoiId, setEditingPoiId] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, id: null });

    const resetForm = () => {
        setNewPoi({
            name: '',
            category: 'attraction',
            description: '',
            latitude: latitude || '',
            longitude: longitude || '',
            info: {}
        });
        setEditingPoiId(null);
        setShowAddForm(false);
    };

    // Get current user and role
    React.useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                setIsAdmin(profile?.role === 'admin');
            }
        };
        getUser();
    }, []);

    // Fetch existing POIs near this property
    const fetchPois = async () => {
        if (!latitude || !longitude) return;
        setFetching(true);
        try {
            const range = 0.135; // 15km
            const { data, error } = await supabase
                .from('location_pois')
                .select('*')
                .gte('latitude', latitude - range)
                .lte('latitude', latitude + range)
                .gte('longitude', longitude - range)
                .lte('longitude', longitude + range);

            if (error) throw error;
            setPois(data || []);
        } catch (error) {
            console.error('Error fetching POIs:', error);
        } finally {
            setFetching(false);
        }
    };

    React.useEffect(() => {
        fetchPois();
    }, [latitude, longitude]);

    const handleAddPoi = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingPoiId) {
                const { error } = await supabase
                    .from('location_pois')
                    .update({
                        ...newPoi,
                        latitude: parseFloat(newPoi.latitude),
                        longitude: parseFloat(newPoi.longitude)
                    })
                    .eq('id', editingPoiId);

                if (error) throw error;
                showToast('POI updated successfully!', 'success');
            } else {
                const { error } = await supabase
                    .from('location_pois')
                    .insert([{
                        ...newPoi,
                        latitude: parseFloat(newPoi.latitude),
                        longitude: parseFloat(newPoi.longitude),
                        created_by: currentUserId,
                        property_id: propertyId
                    }]);

                if (error) throw error;
                showToast('POI added successfully!', 'success');
            }

            resetForm();
            fetchPois();
        } catch (error) {
            console.error('Error saving POI:', error);
            showToast('Failed to save POI', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePoi = async (id) => {
        setConfirmDelete({ isOpen: true, id });
    };

    const processDeletePoi = async () => {
        const id = confirmDelete.id;
        try {
            const { error } = await supabase
                .from('location_pois')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('POI deleted', 'info');
            fetchPois();
        } catch (error) {
            console.error('Error deleting POI:', error);
            showToast('Failed to delete POI', 'error');
        }
    };

    const categories = [
        { id: 'attraction', label: 'Sights', icon: MapPin, color: 'text-red-500', bg: 'bg-red-50' },
        { id: 'restaurant', label: 'Dining', icon: Utensils, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'transport', label: 'Transport', icon: Bus, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'event', label: 'Event', icon: Clock, color: 'text-green-500', bg: 'bg-green-50' }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Nearby Recommendations</h3>
                    <p className="text-gray-500 text-sm">Manage the local guide for this property</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        if (showAddForm) resetForm();
                        else setShowAddForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-md shadow-indigo-100"
                >
                    {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAddForm ? 'Cancel' : 'Add Recommendation'}
                </button>
            </div>

            {showAddForm && (
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleAddPoi} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newPoi.name}
                                    onChange={(e) => setNewPoi({ ...newPoi, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. Waterfront Cafe"
                                />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                                <select
                                    value={newPoi.category}
                                    onChange={(e) => setNewPoi({ ...newPoi, category: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                                >
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Short Description</label>
                                <textarea
                                    required
                                    value={newPoi.description}
                                    onChange={(e) => setNewPoi({ ...newPoi, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                                    placeholder="Briefly describe why you recommend this place..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Latitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    value={newPoi.latitude}
                                    onChange={(e) => setNewPoi({ ...newPoi, latitude: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Longitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    required
                                    value={newPoi.longitude}
                                    onChange={(e) => setNewPoi({ ...newPoi, longitude: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Additional Details (Optional)</label>
                                <div className="space-y-2">
                                    {Object.entries(newPoi.info).map(([key, val], idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={key}
                                                readOnly
                                                className="w-1/3 px-3 py-1 bg-gray-100 border border-gray-200 rounded-lg text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={val}
                                                onChange={(e) => {
                                                    const updatedInfo = { ...newPoi.info };
                                                    updatedInfo[key] = e.target.value;
                                                    setNewPoi({ ...newPoi, info: updatedInfo });
                                                }}
                                                className="flex-grow px-3 py-1 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updatedInfo = { ...newPoi.info };
                                                    delete updatedInfo[key];
                                                    setNewPoi({ ...newPoi, info: updatedInfo });
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            id="new-info-key"
                                            placeholder="Label (e.g. Fee)"
                                            className="w-1/3 px-3 py-1 border border-gray-200 rounded-lg text-sm"
                                        />
                                        <input
                                            type="text"
                                            id="new-info-val"
                                            placeholder="Value (e.g. Free)"
                                            className="flex-grow px-3 py-1 border border-gray-200 rounded-lg text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const k = document.getElementById('new-info-key').value;
                                                const v = document.getElementById('new-info-val').value;
                                                if (k && v) {
                                                    setNewPoi({ ...newPoi, info: { ...newPoi.info, [k]: v } });
                                                    document.getElementById('new-info-key').value = '';
                                                    document.getElementById('new-info-val').value = '';
                                                }
                                            }}
                                            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300"
                                        >
                                            Add Tag
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setNewPoi({ ...newPoi, latitude: latitude || '', longitude: longitude || '' });
                                    showToast('Coordinates reset to property location', 'info');
                                }}
                                className="px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                            >
                                Use Property Coordinates
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {loading ? 'Saving...' : editingPoiId ? 'Update Recommendation' : 'Save Recommendation'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fetching ? (
                    <div className="col-span-2 py-10 text-center text-gray-400">Loading recommendations...</div>
                ) : pois.length > 0 ? (
                    pois.map(poi => {
                        const cat = categories.find(c => c.id === poi.category);
                        const Icon = cat?.icon || MapPin;
                        return (
                            <div key={poi.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-start justify-between group hover:border-indigo-200 transition-all">
                                <div className="flex gap-3">
                                    <div className={`p-2 rounded-lg ${cat?.bg || 'bg-gray-50'} ${cat?.color || 'text-gray-500'}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">{poi.name}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-1">{poi.description}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-gray-400">{poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {(isAdmin || poi.created_by === currentUserId) && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    setNewPoi({
                                                        name: poi.name,
                                                        category: poi.category,
                                                        description: poi.description,
                                                        latitude: poi.latitude,
                                                        longitude: poi.longitude,
                                                        info: poi.info || {}
                                                    });
                                                    setEditingPoiId(poi.id);
                                                    setShowAddForm(true);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Edit Recommendation"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePoi(poi.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Delete Recommendation"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-2 py-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No local recommendations yet. Add some to help your guests!</p>
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={processDeletePoi}
                title="Delete Recommendation"
                message="Are you sure you want to delete this recommendation? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />
        </div>
    );
};

export default LocalGuideManager;
