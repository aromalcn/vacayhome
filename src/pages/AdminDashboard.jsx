import { useState, useEffect } from "react";
import {
  Check,
  X,
  Shield,
  User,
  Home as HomeIcon,
  AlertCircle,
  Eye,
  FileText,
  Download,
  Star,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { useToast } from "../components/Toast";

const AdminDashboard = () => {
  const { showToast } = useToast();
  const [recentUsers, setRecentUsers] = useState([]);
  const [stats, setStats] = useState({
    users: 0,
    listings: 0,
    reports: 0,
    pending: 0,
    reviews: 0,
  });
  const [pendingProperties, setPendingProperties] = useState([]);
  const [unverifiedOwners, setUnverifiedOwners] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Users (Recent)
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (usersError) throw usersError;
      setRecentUsers(usersData || []);

      // 2. Fetch Unverified Owners
      const { data: ownersData, error: ownersError } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "owner")
        .eq("is_verified", false)
        .order("updated_at", { ascending: false });
      if (ownersError) throw ownersError;
      setUnverifiedOwners(ownersData || []);

      // 3. Fetch Pending Properties (Raw)
      const { data: propsData, error: propsError } = await supabase
        .from("properties")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (propsError) throw propsError;

      // 4. Fetch Reports (Raw)
      const { data: reportsData, error: reportsError } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (reportsError) throw reportsError;

      // --- MANUAL JOIN LOGIC (Bypass DB Relations) ---

      // Collect all User IDs needed (owners of pending props + reporters)
      const userIdsToFetch = new Set(
        [
          ...(propsData || []).map((p) => p.owner_id),
          ...(reportsData || []).map((r) => r.reporter_id),
        ].filter(Boolean)
      );

      // Collect all Property IDs needed (for reports)
      const propIdsToFetch = new Set(
        [...(reportsData || []).map((r) => r.property_id)].filter(Boolean)
      );

      // Fetch Profiles
      let profilesMap = {};
      if (userIdsToFetch.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(userIdsToFetch));
        profiles?.forEach((p) => (profilesMap[p.id] = p));
      }

      // Fetch Properties (for reports details)
      let propertiesMap = {};
      if (propIdsToFetch.size > 0) {
        const { data: props } = await supabase
          .from("properties")
          .select("id, title, owner_id")
          .in("id", Array.from(propIdsToFetch));
        props?.forEach((p) => (propertiesMap[p.id] = p));
      }

      // Stitch Data for Pending Properties
      const enrichedProps = (propsData || []).map((p) => ({
        ...p,
        profiles: profilesMap[p.owner_id] || { full_name: "Unknown" }, // Manual Attach
      }));
      setPendingProperties(enrichedProps);

      // Stitch Data for Reports
      const enrichedReports = (reportsData || []).map((r) => ({
        ...r,
        properties: propertiesMap[r.property_id] || {
          title: "Deleted Property",
          owner_id: null,
        },
        profiles: profilesMap[r.reporter_id] || { full_name: "Anonymous" },
      }));
      setReports(enrichedReports);

      // --- END MANUAL JOIN ---

      // Fetch Counts
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      const { count: propsCount } = await supabase
        .from("properties")
        .select("*", { count: "exact", head: true });
      const { count: reviewsCount } = await supabase
        .from("reviews")
        .select("*", { count: "exact", head: true });

      setStats({
        users: usersCount || 0,
        listings: propsCount || 0,
        reports: reportsData?.length || 0,
        pending: propsData?.length || 0,
        reviews: reviewsCount || 0,
      });
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showToast("Failed to load admin data: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handlePropertyAction = async (propertyId, action) => {
    try {
      const { error } = await supabase
        .from("properties")
        .update({ status: action === "approve" ? "approved" : "rejected" })
        .eq("id", propertyId);

      if (error) throw error;

      showToast(`Property ${action}d successfully`, "success");
      fetchAdminData();
    } catch (error) {
      console.error(`Error ${action}ing property:`, error);
      showToast(`Failed to ${action} property: ` + error.message, "error");
    }
  };

  const handleVerifyOwner = async (ownerId) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", ownerId);

      if (error) throw error;

      showToast("Owner verified successfully", "success");
      fetchAdminData();
    } catch (error) {
      console.error("Error verifying owner:", error);
      showToast("Failed to verify owner", "error");
    }
  };

  const handleReportAction = async (reportId, status) => {
    try {
      const { error } = await supabase
        .from("reports")
        .update({ status: status })
        .eq("id", reportId);

      if (error) throw error;
      fetchAdminData();
      showToast(`Report marked as ${status}`, "success");
    } catch (error) {
      console.error("Error updating report:", error);
      showToast("Failed to update report", "error");
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
      head: [columns.map((col) => col.header)],
      body: data.map((item) => columns.map((col) => col.accessor(item))),
      theme: "grid",
      headStyles: { fillColor: [66, 66, 66] },
    });

    // Preview PDF in new tab
    const pdfOutput = doc.output('blob');
    const blobURL = URL.createObjectURL(pdfOutput);
    window.open(blobURL, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-gray-500">System overview and management</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>System Active</span>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link
            to="/admin/users"
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 text-sm font-medium group-hover:text-blue-600 transition">
                Total Users
              </h3>
              <User className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.users}</p>
          </Link>
          <Link
            to="/admin/properties"
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 text-sm font-medium group-hover:text-blue-600 transition">
                Total Listings
              </h3>
              <HomeIcon className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.listings}</p>
          </Link>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 text-sm font-medium">
                Pending Approvals
              </h3>
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.pending + unverifiedOwners.length}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 text-sm font-medium">
                Open Reports
              </h3>
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {reports.filter((r) => r.status === "open").length}
            </p>
          </div>
          <Link
            to="/admin/reviews"
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 text-sm font-medium group-hover:text-blue-600 transition">
                Manage Reviews
              </h3>
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.reviews || 0}</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Owner Verifications */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-orange-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-orange-900 flex items-center">
                                <AlertCircle className="w-5 h-5 mr-2" />
                                Owner Verifications ({unverifiedOwners.length})
                            </h2>
                            <button 
                                onClick={() => generatePDF('Owner Verifications', [
                                    { header: 'Name', accessor: item => item.full_name || 'N/A' },
                                    { header: 'Email', accessor: item => item.email || 'N/A' },
                                    { header: 'Role', accessor: item => item.role },
                                    { header: 'Joined', accessor: item => new Date(item.created_at).toLocaleDateString() }
                                ], unverifiedOwners)}
                                className="p-2 bg-white text-orange-600 rounded-lg hover:bg-orange-100 transition shadow-sm"
                                title="Download Report"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {unverifiedOwners.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No pending owner verifications.
                </p>
              ) : (
                unverifiedOwners.map((owner) => (
                  <div
                    key={owner.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="mb-4 sm:mb-0">
                      <h4 className="font-semibold text-gray-900">
                        {owner.full_name || "No Name"}
                      </h4>
                      <p className="text-sm text-gray-500">{owner.email}</p>
                      <p className="text-xs text-orange-600 mt-1">
                        Pending Verification
                      </p>
                    </div>
                    <button
                      onClick={() => handleVerifyOwner(owner.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition flex items-center justify-center shrink-0"
                    >
                      <Check className="w-4 h-4 mr-2" /> Verify
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Properties */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-blue-50 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-blue-900 flex items-center">
                                <HomeIcon className="w-5 h-5 mr-2" />
                                Property Approvals ({pendingProperties.length})
                            </h2>
                            <button 
                                onClick={() => generatePDF('Property Approvals', [
                                    { header: 'Property Title', accessor: item => item.title },
                                    { header: 'Owner', accessor: item => item.profiles?.full_name || 'Unknown' },
                                    { header: 'Location', accessor: item => item.location },
                                    { header: 'Price', accessor: item => `Rs. ${item.price_per_night}` },
                                    { header: 'Date Added', accessor: item => new Date(item.created_at).toLocaleDateString() }
                                ], pendingProperties)}
                                className="p-2 bg-white text-blue-600 rounded-lg hover:bg-blue-100 transition shadow-sm"
                                title="Download Report"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {pendingProperties.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No pending property approvals.
                </p>
              ) : (
                pendingProperties.map((prop) => (
                  <div
                    key={prop.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="mb-4 sm:mb-0 flex-1 mr-4">
                      <h4 className="font-semibold text-gray-900">
                        {prop.title}
                      </h4>
                      <p className="text-sm text-gray-500">
                        By: {prop.profiles?.full_name} • {prop.location}
                      </p>
                      <p className="text-sm font-medium text-blue-600">
                        ₹{prop.price_per_night}/night
                      </p>
                    </div>
                    <div className="flex space-x-2 shrink-0">
                      <a
                        href={`/property/${prop.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handlePropertyAction(prop.id, "approve")}
                        className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePropertyAction(prop.id, "reject")}
                        className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Reports Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-red-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-red-900 flex items-center">
                            <Shield className="w-5 h-5 mr-2" />
                            Recent Reports
                        </h2>
                        <button 
                            onClick={() => generatePDF('Incident Reports', [
                                { header: 'Property', accessor: item => item.properties?.title || 'Unknown' },
                                { header: 'Reporter', accessor: item => item.profiles?.full_name || 'Anonymous' },
                                { header: 'Reason', accessor: item => item.reason },
                                { header: 'Status', accessor: item => item.status },
                                { header: 'Date', accessor: item => new Date(item.created_at).toLocaleDateString() }
                            ], reports)}
                            className="p-2 bg-white text-red-600 rounded-lg hover:bg-red-100 transition shadow-sm"
                            title="Download Report"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Property</th>
                  <th className="px-6 py-3">Reporter</th>
                  <th className="px-6 py-3">Reason</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No reports found.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr
                      key={report.id}
                      className="bg-white border-b hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {report.properties?.title || "Unknown Property"}
                      </td>
                      <td className="px-6 py-4">
                        {report.profiles?.full_name || "Anonymous"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 font-medium">
                          {report.reason}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 max-w-xs truncate"
                        title={report.description}
                      >
                        {report.description}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            report.status === "open"
                              ? "bg-red-100 text-red-700"
                              : report.status === "resolved"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {report.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {report.status === "open" && (
                          <div className="flex space-x-2">
                            <button
                              onClick={() =>
                                handleReportAction(report.id, "resolved")
                              }
                              className="text-green-600 hover:underline"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() =>
                                handleReportAction(report.id, "dismissed")
                              }
                              className="text-gray-500 hover:underline"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-900">Recently Join Users</h2>
                        <button 
                            onClick={() => generatePDF('Recent Users', [
                                { header: 'Name', accessor: item => item.full_name || 'N/A' },
                                { header: 'Email', accessor: item => item.email || 'N/A' },
                                { header: 'Role', accessor: item => item.role },
                                { header: 'Verified', accessor: item => item.is_verified ? 'Yes' : 'No' },
                                { header: 'Joined', accessor: item => new Date(item.created_at).toLocaleDateString() }
                            ], recentUsers)}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition shadow-sm"
                            title="Download Report"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Verified</th>
                  <th className="px-6 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="bg-white border-b hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {user.full_name || "N/A"}
                    </td>
                    <td className="px-6 py-4 capitalize">{user.role}</td>
                    <td className="px-6 py-4">
                      {user.role === "tourist" ? (
                        <span className="text-gray-400">N/A</span>
                      ) : user.is_verified ? (
                        <span className="text-green-600 flex items-center">
                          <Check className="w-4 h-4 mr-1" /> Yes
                        </span>
                      ) : (
                        <span className="text-orange-500 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(
                        user.updated_at || Date.now()
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
