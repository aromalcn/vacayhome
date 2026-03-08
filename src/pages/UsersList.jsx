import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Check, AlertCircle, ArrowLeft, Download, ChevronDown, X, ShieldAlert, Edit2, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

const FilterDropdown = ({ options, value, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-full text-sm text-gray-600 bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm min-w-[140px] justify-between"
            >
                <span>{selectedOption ? selectedOption.label : label}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="absolute z-10 mt-2 w-full min-w-[160px] bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                value === option.value 
                                    ? 'bg-blue-50 text-blue-600 font-medium' 
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const UsersList = () => {
    const { showToast } = useToast();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        let filtered = users;

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(u => 
                (u.full_name && u.full_name.toLowerCase().includes(lower)) ||
                (u.email && u.email.toLowerCase().includes(lower))
            );
        }

        if (roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === roleFilter);
        }

        if (statusFilter !== 'all') {
            if (statusFilter === 'verified') {
                filtered = filtered.filter(u => u.is_verified && u.role !== 'tourist');
            } else if (statusFilter === 'pending') {
                filtered = filtered.filter(u => !u.is_verified && u.role !== 'tourist');
            } else if (statusFilter === 'na') {
                filtered = filtered.filter(u => u.role === 'tourist');
            }
        }

        setFilteredUsers(filtered);
    }, [searchTerm, roleFilter, statusFilter, users]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            
            setUsers(data || []);
            setFilteredUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            showToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOwner = async (ownerId) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`/api/users/${ownerId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ is_verified: true })
            });

            if (!response.ok) throw new Error('Failed to update verification status');

            showToast('User verified successfully', 'success');
            setUsers(prev => prev.map(u => u.id === ownerId ? { ...u, is_verified: true } : u));
            if (selectedUser?.id === ownerId) {
                setSelectedUser(prev => ({ ...prev, is_verified: true }));
            }
        } catch (error) {
            console.error('Error verifying user:', error);
            showToast('Failed to verify user', 'error');
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch(`/api/users/${selectedUser.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(editFormData)
            });

            if (!response.ok) throw new Error('Failed to update user profile');

            showToast('User profile updated successfully', 'success');
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...editFormData } : u));
            setSelectedUser({ ...selectedUser, ...editFormData });
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating user:', error);
            showToast('Failed to update user profile: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleEdit = () => {
        if (!isEditing) {
            setEditFormData({
                full_name: selectedUser.full_name || '',
                phone: selectedUser.phone || '',
                location: selectedUser.location || '',
                emergency_contact_name: selectedUser.emergency_contact_name || '',
                emergency_contact_phone: selectedUser.emergency_contact_phone || '',
                emergency_contact_relationship: selectedUser.emergency_contact_relationship || ''
            });
        }
        setIsEditing(!isEditing);
    };

    const handleEditChange = (e) => {
        setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    };

    const generatePDF = (title, columns, data) => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        
        autoTable(doc, {
            startY: 40,
            head: [columns.map(col => col.header)],
            body: data.map(item => columns.map(col => col.accessor(item))),
            theme: 'grid',
            headStyles: { fillColor: [66, 66, 66] }
        });
        
        const pdfOutput = doc.output('blob');
        const blobURL = URL.createObjectURL(pdfOutput);
        window.open(blobURL, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <Link to="/admin" className="text-gray-500 hover:text-blue-600 flex items-center mb-2 transition">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">All Users</h1>
                        <p className="text-gray-500">Manage tourists, owners, and admins.</p>
                    </div>
                    <button 
                        onClick={() => generatePDF('Users Report', [
                            { header: 'Name', accessor: item => item.full_name || 'N/A' },
                            { header: 'Email', accessor: item => item.email || 'N/A' },
                            { header: 'Role', accessor: item => item.role },
                            { header: 'Verified', accessor: item => item.is_verified ? 'Yes' : 'No' },
                            { header: 'Joined', accessor: item => new Date(item.created_at).toLocaleDateString() }
                        ], filteredUsers)}
                        className="bg-white p-2 rounded-full border border-gray-200 shadow-sm text-gray-500 hover:text-blue-600 hover:border-blue-200 transition"
                        title="Download Report"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>


                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                            <input 
                                type="text" 
                                placeholder="Search by name or email..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition"
                            />
                        </div>
                        
                        <div className="flex items-center space-x-3 w-full md:w-auto pb-2 md:pb-0 z-20">
                            <FilterDropdown 
                                value={roleFilter}
                                onChange={setRoleFilter}
                                label="Role"
                                options={[
                                    { value: 'all', label: 'All Roles' },
                                    { value: 'tourist', label: 'Tourist' },
                                    { value: 'owner', label: 'Owner' },
                                    { value: 'admin', label: 'Admin' }
                                ]}
                            />

                            <FilterDropdown 
                                value={statusFilter}
                                onChange={setStatusFilter}
                                label="Status"
                                options={[
                                    { value: 'all', label: 'All Status' },
                                    { value: 'verified', label: 'Verified' },
                                    { value: 'pending', label: 'Pending' },
                                    { value: 'na', label: 'N/A (Tourists)' }
                                ]}
                            />
                        </div>

                        <div className="text-sm text-gray-500 hidden xl:block whitespace-nowrap">
                            Showing {filteredUsers.length} users
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3">User</th>
                                    <th className="px-6 py-3">Role</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Joined</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center">Loading users...</td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center">No users found matching "{searchTerm}"</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <tr key={user.id} className="bg-white border-b hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold mr-3">
                                                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{user.full_name || 'N/A'}</div>
                                                        <div className="text-xs text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                                                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                    user.role === 'owner' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.role === 'tourist' ? (
                                                    <span className="text-gray-400 text-xs font-medium">N/A</span>
                                                ) : user.is_verified ? (
                                                    <span className="text-green-600 flex items-center text-xs font-medium">
                                                        <Check className="w-3 h-3 mr-1"/> Verified
                                                    </span>
                                                ) : (
                                                    <span className="text-orange-500 flex items-center text-xs font-medium">
                                                        <AlertCircle className="w-3 h-3 mr-1"/> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {new Date(user.created_at || Date.now()).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setIsEditing(false);
                                                        }}
                                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-gray-200 transition"
                                                    >
                                                        Details
                                                    </button>
                                                    {!user.is_verified && user.role === 'owner' && (
                                                        <button 
                                                            onClick={() => handleVerifyOwner(user.id)}
                                                            className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs hover:bg-blue-700 transition shadow-sm"
                                                        >
                                                            Verify
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* User Details & Edit Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">
                                {isEditing ? 'Edit User Profile' : 'User Details'}
                            </h3>
                            <button 
                                onClick={() => {
                                    setSelectedUser(null);
                                    setIsEditing(false);
                                }}
                                className="p-2 hover:bg-gray-200 rounded-full transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUpdateUser}>
                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold">
                                        {selectedUser.full_name ? selectedUser.full_name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                        {isEditing ? (
                                            <input 
                                                type="text"
                                                name="full_name"
                                                value={editFormData.full_name}
                                                onChange={handleEditChange}
                                                className="text-xl font-bold text-gray-900 border-b border-blue-500 focus:outline-none bg-blue-50 px-2 rounded"
                                                autoFocus
                                            />
                                        ) : (
                                            <h4 className="text-2xl font-bold text-gray-900">{selectedUser.full_name || 'N/A'}</h4>
                                        )}
                                        <p className="text-gray-500">{selectedUser.email}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Role</p>
                                        <p className="font-semibold text-gray-900 capitalize">{selectedUser.role}</p>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Status</p>
                                        <p className={`font-semibold ${selectedUser.is_verified ? 'text-green-600' : 'text-orange-500'}`}>
                                            {selectedUser.role === 'tourist' ? 'N/A' : (selectedUser.is_verified ? 'Verified' : 'Pending Verification')}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h5 className="font-bold text-gray-900 border-b pb-2">Contact Information</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold mb-1 italic">Phone</p>
                                            {isEditing ? (
                                                <input 
                                                    type="tel"
                                                    name="phone"
                                                    value={editFormData.phone}
                                                    onChange={handleEditChange}
                                                    className="w-full text-sm text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            ) : (
                                                <p className="text-sm text-gray-900">{selectedUser.phone || 'Not provided'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold mb-1 italic">Location</p>
                                            {isEditing ? (
                                                <input 
                                                    type="text"
                                                    name="location"
                                                    value={editFormData.location}
                                                    onChange={handleEditChange}
                                                    className="w-full text-sm text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                />
                                            ) : (
                                                <p className="text-sm text-gray-900">{selectedUser.location || 'Not provided'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-red-50 rounded-2xl border border-red-100 space-y-4">
                                    <div className="flex items-center text-red-700 font-bold border-b border-red-200 pb-2">
                                        <ShieldAlert className="w-5 h-5 mr-2" />
                                        Emergency Contact Details
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-red-600 font-bold mb-1">Name</p>
                                            {isEditing ? (
                                                <input 
                                                    type="text"
                                                    name="emergency_contact_name"
                                                    value={editFormData.emergency_contact_name}
                                                    onChange={handleEditChange}
                                                    className="w-full text-sm font-semibold text-gray-900 border border-red-200 rounded px-2 py-1 focus:outline-none"
                                                />
                                            ) : (
                                                <p className="text-sm font-semibold text-gray-900">{selectedUser.emergency_contact_name || 'N/A'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-red-600 font-bold mb-1">Relationship</p>
                                            {isEditing ? (
                                                <input 
                                                    type="text"
                                                    name="emergency_contact_relationship"
                                                    value={editFormData.emergency_contact_relationship}
                                                    onChange={handleEditChange}
                                                    className="w-full text-sm font-semibold text-gray-900 border border-red-200 rounded px-2 py-1 focus:outline-none"
                                                />
                                            ) : (
                                                <p className="text-sm font-semibold text-gray-900">{selectedUser.emergency_contact_relationship || 'N/A'}</p>
                                            )}
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-xs text-red-600 font-bold mb-1">Phone Number</p>
                                            {isEditing ? (
                                                <input 
                                                    type="tel"
                                                    name="emergency_contact_phone"
                                                    value={editFormData.emergency_contact_phone}
                                                    onChange={handleEditChange}
                                                    className="w-full text-sm font-bold text-blue-600 border border-red-200 rounded px-2 py-1 focus:outline-none"
                                                />
                                            ) : (
                                                <p className="text-sm font-bold text-blue-600">{selectedUser.emergency_contact_phone || 'N/A'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                                <div className="flex space-x-2">
                                    {isEditing ? (
                                        <>
                                            <button 
                                                type="submit"
                                                disabled={saving}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 flex items-center"
                                            >
                                                {saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={toggleEdit}
                                                className="px-6 py-2 bg-white text-gray-700 border border-gray-200 rounded-full font-bold hover:bg-gray-100 transition"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                type="button"
                                                onClick={toggleEdit}
                                                className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30 flex items-center"
                                            >
                                                <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                                            </button>
                                            {!selectedUser.is_verified && selectedUser.role === 'owner' && (
                                                <button 
                                                    type="button"
                                                    onClick={() => handleVerifyOwner(selectedUser.id)}
                                                    className="px-6 py-2 bg-green-600 text-white rounded-full font-bold hover:bg-green-700 transition shadow-lg shadow-green-500/30"
                                                >
                                                    Verify User
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                                {!isEditing && (
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedUser(null)}
                                        className="px-6 py-2 bg-white text-gray-700 border border-gray-200 rounded-full font-bold hover:bg-gray-100 transition"
                                    >
                                        Close
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersList;
