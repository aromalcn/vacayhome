import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

const HeartButton = ({ propertyId, className = "" }) => {
    const [isSaved, setIsSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        checkIfSaved();
    }, [propertyId]);

    const checkIfSaved = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('saved_properties')
                .select('id')
                .eq('user_id', user.id)
                .eq('property_id', propertyId)
                .eq('property_id', propertyId)
                .maybeSingle();

            if (data) {
                setIsSaved(true);
            }
        } catch (error) {
            // Ignore error if row not found (it just means not saved)
        } finally {
            setLoading(false);
        }
    };

    const toggleSave = async (e) => {
        e.preventDefault(); // Prevent navigating if inside a Link
        e.stopPropagation();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showToast('Please login to save properties', 'info');
            return;
        }

        // Optimistic update
        const newState = !isSaved;
        setIsSaved(newState);

        try {
            if (newState) {
                const { error } = await supabase
                    .from('saved_properties')
                    .insert({ user_id: user.id, property_id: propertyId });
                if (error) throw error;
                showToast('Property saved properly to your list', 'success');
            } else {
                const { error } = await supabase
                    .from('saved_properties')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('property_id', propertyId);
                if (error) throw error;
                showToast('Property removed from saved list', 'info');
            }
        } catch (error) {
            console.error('Error toggling save:', error);
            setIsSaved(!newState); // Revert on error
            showToast('Failed to update saved status', 'error');
        }
    };

    if (loading) return null;

    return (
        <button 
            onClick={toggleSave}
            className={`p-2 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                isSaved 
                    ? 'text-red-500 bg-red-50' 
                    : 'text-gray-400 bg-black/20 hover:bg-white hover:text-red-500'
            } ${className}`}
            title={isSaved ? "Unsave property" : "Save property"}
        >
            <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
        </button>
    );
};

export default HeartButton;
