import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Check, X, Home, ArrowLeft, Filter, AlertCircle, Eye, Download, Edit } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

const PropertiesList = () => {
    const { showToast } = useToast();
    const [properties, setProperties] = useState([]);
    const [filteredProperties, setFilteredProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchProperties();
    }, []);

    useEffect(() => {
        filterProperties();
    }, [searchTerm, statusFilter, properties]);

    const filterProperties = () => {
        let result = properties;

        // Status Filter
        if (statusFilter !== 'all') {
            result = result.filter(p => p.status === statusFilter);
        }

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(p => 
                (p.title && p.title.toLowerCase().includes(lower)) ||
                (p.location && p.location.toLowerCase().includes(lower)) ||
                (p.owner_name && p.owner_name.toLowerCase().includes(lower))
            );
        }

        setFilteredProperties(result);
    };

    const fetchProperties = async () => {
        try {
            setLoading(true);
            
            // Fetch Properties
            const { data: propsData, error: propsError } = await supabase
                .from('properties')
                .select('*')
                .order('created_at', { ascending: false });

            if (propsError) throw propsError;

            // Fetch Owners (Profiles) manually to ensure we get names
            const ownerIds = [...new Set(propsData.map(p => p.owner_id).filter(Boolean))];
            let ownersMap = {};
            
            if (ownerIds.length > 0) {
                const { data: ownersData, error: ownersError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', ownerIds);
                
                if (!ownersError && ownersData) {
                    ownersData.forEach(o => ownersMap[o.id] = o);
                }
            }

            // Stitch data
            const enrichedProps = propsData.map(p => ({
                ...p,
                owner_name: ownersMap[p.owner_id]?.full_name || 'Unknown',
                owner_email: ownersMap[p.owner_id]?.email || '',
                is_owner_verified: ownersMap[p.owner_id]?.is_verified // Just in case we need it
            }));

            setProperties(enrichedProps);
            setFilteredProperties(enrichedProps);
        } catch (error) {
            console.error('Error fetching properties:', error);
            showToast('Failed to load properties', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (propertyId, action) => {
        try {
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            const { error } = await supabase
                .from('properties')
                .update({ status: newStatus })
                .eq('id', propertyId);

            if (error) throw error;

            showToast(`Property ${action}d successfully`, 'success');
            
            // Optimistic update
            setProperties(prev => prev.map(p => 
                p.id === propertyId ? { ...p, status: newStatus } : p
            ));
        } catch (error) {
            console.error(`Error ${action}ing property:`, error);
            showToast(`Failed to ${action} property`, 'error');
        }
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
        
        // Preview PDF in new tab
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
                        <h1 className="text-3xl font-bold text-gray-900">All Listings</h1>
                        <p className="text-gray-500">Manage property approvals and listings.</p>
                    </div>
                     <button 
                        onClick={() => generatePDF('Properties Report', [
                            { header: 'Property', accessor: item => item.title },
                            { header: 'Location', accessor: item => item.location },
                            { header: 'Owner', accessor: item => item.owner_name },
                            { header: 'Email', accessor: item => item.owner_email },
                            { header: 'Price', accessor: item => `Rs. ${item.price_per_night}` },
                            { header: 'Status', accessor: item => item.status },
                            { header: 'Date', accessor: item => new Date(item.created_at).toLocaleDateString() }
                        ], filteredProperties)}
                        className="bg-white p-2 rounded-full border border-gray-200 shadow-sm text-gray-500 hover:text-blue-600 hover:border-blue-200 transition"
                        title="Download Report"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                        <div className="relative w-full max-w-md">
                            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
                            <input 
                                type="text" 
                                placeholder="Search properies, locations, or owners..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition"
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                            <Filter className="w-4 h-4 text-gray-400" />
                            {['all', 'pending', 'approved', 'rejected'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition whitespace-nowrap ${
                                        statusFilter === status 
                                            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3">Property</th>
                                    <th className="px-6 py-3">Location</th>
                                    <th className="px-6 py-3">Owner</th>
                                    <th className="px-6 py-3">Price</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center">Loading properties...</td>
                                    </tr>
                                ) : filteredProperties.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center">No properties found.</td>
                                    </tr>
                                ) : (
                                    filteredProperties.map((prop) => (
                                        <tr key={prop.id} className="bg-white border-b hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden mr-3">
                                                        {prop.image_url ? (
                                                            <img src={prop.image_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Home className="w-5 h-5 text-gray-400 m-auto h-full" />
                                                        )}
                                                    </div>
                                                    <div className="font-semibold text-gray-900 line-clamp-1 max-w-xs" title={prop.title}>
                                                        {prop.title}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate" title={prop.location}>
                                                {prop.location}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{prop.owner_name}</div>
                                                <div className="text-xs text-gray-500">{prop.owner_email}</div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                ₹{prop.price_per_night}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase text-center ${
                                                        prop.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                        prop.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {prop.status}
                                                    </span>
                                                    {prop.status === 'approved' && (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-center ${
                                                            prop.availability === 'Under Maintenance' 
                                                                ? 'bg-orange-100 text-orange-700' 
                                                                : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {prop.availability || 'Available'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <a 
                                                        href={`/property/${prop.id}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </a>

                                                    <Link 
                                                        to={`/edit-property/${prop.id}`} 
                                                        className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                                                        title="Edit Property"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Link>
                                                    
                                                    {prop.status === 'pending' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleAction(prop.id, 'approve')}
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                                                title="Approve"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleAction(prop.id, 'reject')}
                                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                                                title="Reject"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
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
        </div>
    );
};

export default PropertiesList;
