import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Send, User, Home, ArrowLeft, Search, MessageSquare, Clock } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils/dateFormatter';

const MessageCenter = () => {
    const { showToast } = useToast();
    const location = useLocation();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        fetchInitialData();
        
        // Subscription for new messages
        const channel = supabase
            .channel('public:messages')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages' 
            }, payload => {
                handleNewMessage(payload.new);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.property_id, selectedConversation.other_party_id);
            markAsRead(selectedConversation.property_id, selectedConversation.other_party_id);
        }
    }, [selectedConversation]);

    useEffect(scrollToBottom, [messages]);

    const fetchInitialData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUser(user);

            const convs = await fetchConversations(user.id);
            handleDeepLinking(convs, user.id);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeepLinking = async (convs, userId) => {
        const params = new URLSearchParams(location.search);
        const propertyId = params.get('propertyId');
        const otherUserId = params.get('userId');

        if (propertyId && otherUserId) {
            // Check if conversation exists
            const existing = convs.find(c => c.property_id === propertyId && c.other_party_id === otherUserId);
            if (existing) {
                setSelectedConversation(existing);
            } else {
                // Create virtual conversation
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const headers = { 'Authorization': `Bearer ${session?.access_token}` };
                    
                    const [propRes, userRes] = await Promise.all([
                        fetch(`/api/properties/${propertyId}`, { headers }),
                        fetch(`/api/users/${otherUserId}`, { headers })
                    ]);

                    const propData = propRes.ok ? await propRes.json() : null;
                    const userData = userRes.ok ? await userRes.json() : null;

                    if (propData && userData) {
                        const virtual = {
                            property_id: propertyId,
                            property_title: propData.title,
                            property_image: propData.image_url,
                            other_party_id: otherUserId,
                            other_party_name: userData.full_name,
                            last_message: 'Start a new conversation',
                            last_timestamp: new Date().toISOString(),
                            unread_count: 0,
                            is_virtual: true
                        };
                        setConversations(prev => [virtual, ...prev]);
                        setSelectedConversation(virtual);
                    }
                } catch (err) {
                    console.error('Error fetching virtual conversation data:', err);
                }
            }
        }
    };

    const fetchConversations = async (userId) => {
        try {
            // Fetch all messages involving the user
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    *,
                    property:property_id(title, image_url),
                    sender:sender_id(full_name),
                    receiver:receiver_id(full_name)
                `)
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Group messages into conversations by (property_id, other_party_id)
            const groups = {};
            data.forEach(msg => {
                const otherPartyId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
                const otherPartyName = msg.sender_id === userId ? msg.receiver?.full_name : msg.sender?.full_name;
                const key = `${msg.property_id}-${otherPartyId}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        property_id: msg.property_id,
                        property_title: msg.property?.title || 'Unknown Property',
                        property_image: msg.property?.image_url,
                        other_party_id: otherPartyId,
                        other_party_name: otherPartyName || 'Anonymous',
                        last_message: msg.content,
                        last_timestamp: msg.created_at,
                        unread_count: (!msg.is_read && msg.receiver_id === userId) ? 1 : 0
                    };
                } else if (!msg.is_read && msg.receiver_id === userId) {
                    groups[key].unread_count++;
                }
            });

            setConversations(Object.values(groups));
            return Object.values(groups);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }
    };

    const fetchMessages = async (propertyId, otherPartyId) => {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('property_id', propertyId)
                .or(`sender_id.eq.${currentUser.id},sender_id.eq.${otherPartyId}`)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const handleNewMessage = async (payload) => {
        // If the new message belongs to the active conversation, add it to the list
        if (selectedConversation && 
            payload.property_id === selectedConversation.property_id && 
            (payload.sender_id === selectedConversation.other_party_id || payload.receiver_id === selectedConversation.other_party_id)) {
            setMessages(prev => [...prev, payload]);
            await markAsRead(payload.property_id, payload.sender_id);
        }
        
        // Refresh conversations list to update "last message" and "unread count"
        if (currentUser) fetchConversations(currentUser.id);
    };

    const markAsRead = async (propertyId, senderId) => {
        if (!currentUser) return;
        
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('property_id', propertyId)
            .eq('sender_id', senderId)
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);

        if (error) {
            console.error('Error marking as read:', error);
            showToast('Failed to sync read status. Please check your connection.', 'error');
        } else {
            fetchConversations(currentUser.id);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation) return;

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    property_id: selectedConversation.property_id,
                    sender_id: currentUser.id,
                    receiver_id: selectedConversation.other_party_id,
                    content: newMessage,
                    is_read: false
                });

            if (error) throw error;
            setNewMessage('');

            // If it was a virtual conversation, it's real now
            if (selectedConversation.is_virtual) {
                const realConv = { ...selectedConversation };
                delete realConv.is_virtual;
                setSelectedConversation(realConv);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message', 'error');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-7xl mx-auto h-[calc(100vh-120px)] flex flex-col">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Message Center</h1>
                    <p className="text-gray-500">Manage your chats with owners and travelers.</p>
                </div>

                <div className="flex-grow bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex">
                    {/* Sidebar: Conversations List */}
                    <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-gray-100 flex-col bg-gray-50/50`}>
                        <div className="p-4 border-b border-gray-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="Search chats..." 
                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-300 transition"
                                />
                            </div>
                        </div>
                        
                        <div className="flex-grow overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center text-gray-400 text-sm">Loading chats...</div>
                            ) : conversations.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">No messages yet.</div>
                            ) : (
                                conversations.map(conv => (
                                    <button
                                        key={`${conv.property_id}-${conv.other_party_id}`}
                                        onClick={() => setSelectedConversation(conv)}
                                        className={`w-full p-4 flex gap-4 text-left border-b border-gray-100 transition-colors relative ${selectedConversation?.other_party_id === conv.other_party_id && selectedConversation?.property_id === conv.property_id ? 'bg-white shadow-sm ring-1 ring-black/5 z-10' : 'hover:bg-white'}`}
                                    >
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                            {conv.property_image ? (
                                                <img src={conv.property_image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600">
                                                    <Home className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-gray-900 truncate text-sm">{conv.other_party_name}</h3>
                                                <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                    {formatDate(conv.last_timestamp)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-blue-600 font-medium truncate mb-1">{conv.property_title}</p>
                                            <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                                                {conv.last_message}
                                            </p>
                                        </div>
                                        {conv.unread_count > 0 && (
                                            <span className="absolute top-4 right-4 w-2 h-2 bg-blue-600 rounded-full"></span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Window */}
                    <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-grow flex-col bg-white`}>
                        {selectedConversation ? (
                            <>
                                {/* Chat Header */}
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setSelectedConversation(null)}
                                            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition"
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </button>
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 relative">
                                            <User className="w-5 h-5" />
                                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 leading-none mb-1">{selectedConversation.other_party_name}</h3>
                                            <p className="text-xs text-gray-500 flex items-center">
                                                <Home className="w-3 h-3 mr-1" /> {selectedConversation.property_title}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link 
                                            to={`/property/${selectedConversation.property_id}`}
                                            className="hidden sm:block text-xs text-blue-600 font-medium hover:underline"
                                        >
                                            View Property
                                        </Link>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                                    {messages.map((msg, idx) => {
                                        const isMine = msg.sender_id === currentUser.id;
                                        return (
                                            <div 
                                                key={msg.id} 
                                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[70%] group relative animate-in fade-in slide-in-from-${isMine ? 'right' : 'left'}-4 duration-300`}>
                                                    <div className={`p-4 rounded-2xl text-sm shadow-sm ${isMine ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-white text-gray-700 rounded-tl-none border border-gray-100'}`}>
                                                        {msg.content}
                                                    </div>
                                                    <div className={`mt-1 flex items-center gap-1 text-[10px] text-gray-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {formatDate(msg.created_at)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 border-t border-gray-100 bg-white">
                                    <form onSubmit={handleSendMessage} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Type a message..." 
                                            className="flex-grow px-4 py-3 bg-gray-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                        />
                                        <button 
                                            type="submit"
                                            disabled={!newMessage.trim()}
                                            className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-500/20"
                                        >
                                            <Send className="w-5 h-5" />
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="flex-grow flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                                <div className="p-6 bg-white rounded-3xl shadow-sm border border-gray-100 mb-4">
                                    <MessageSquare className="w-12 h-12 text-blue-100" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Your Inbox</h3>
                                <p className="text-sm">Select a conversation to start chatting</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageCenter;
