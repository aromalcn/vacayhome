import { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

const ContactOwnerModal = ({ isOpen, onClose, property, ownerName }) => {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const { showToast } = useToast();

    if (!isOpen) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        setSending(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showToast('Please login to send messages', 'error');
                return;
            }

            const { error } = await supabase
                .from('messages')
                .insert({
                    property_id: property.id,
                    sender_id: user.id,
                    receiver_id: property.owner_id,
                    content: message,
                    is_read: false
                });

            if (error) throw error;

            showToast('Message sent successfully!', 'success');
            setMessage('');
            onClose();
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message', 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <MessageSquare className="w-5 h-5 mr-2 text-blue-600" /> 
                        Contact {ownerName || 'Owner'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-4">
                    <div className="w-16 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {property.image_url ? (
                            <img src={property.image_url} alt={property.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">No img</div>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{property.title}</h3>
                        <p className="text-xs text-gray-500">{property.location}</p>
                    </div>
                </div>

                <form onSubmit={handleSend}>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Your Message</label>
                        <textarea 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Write your question or request here..."
                            className="w-full p-4 border border-gray-300 rounded-xl h-32 resize-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                            required
                        />
                    </div>
                    
                    <div className="flex space-x-3">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={sending || !message.trim()}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                        >
                            {sending ? 'Sending...' : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Message
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ContactOwnerModal;
