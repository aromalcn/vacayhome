import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ToastProvider } from './components/Toast';
import ScrollToTop from './components/ScrollToTop';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import OwnerDashboard from './pages/OwnerDashboard';
import AddProperty from './pages/AddProperty';
import EditProperty from './pages/EditProperty';
import Search from './pages/Search';
import AdminDashboard from './pages/AdminDashboard';
import UsersList from './pages/UsersList';
import PropertiesList from './pages/PropertiesList';
import ReviewsList from './pages/ReviewsList';

import TouristDashboard from './pages/TouristDashboard';
import PropertyDetails from './pages/PropertyDetails';
import MyBookings from './pages/MyBookings';
import BookingRequests from './pages/BookingRequests';
import SavedHomes from './pages/SavedHomes';
import BookingConfirmation from './pages/BookingConfirmation';
import MyReceipts from './pages/MyReceipts';
import MessageCenter from './pages/MessageCenter';
import ProfileSettings from './pages/ProfileSettings';


function App() {
  return (
    <ToastProvider>
      <Router>
        <ScrollToTop />
        <div className="flex flex-col min-h-screen bg-gray-50">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<Search />} />
              <Route path="/property/:id" element={<PropertyDetails />} />
              <Route path="/owner" element={<OwnerDashboard />} />
              <Route path="/tourist" element={<TouristDashboard />} />
              <Route path="/saved-homes" element={<SavedHomes />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/my-receipts" element={<MyReceipts />} />
              <Route path="/messages" element={<MessageCenter />} />
              <Route path="/profile" element={<ProfileSettings />} />
              <Route path="/booking-confirmation/:id" element={<BookingConfirmation />} />
              <Route path="/booking-requests" element={<BookingRequests />} />
              <Route path="/add-property" element={<AddProperty />} />
              <Route path="/edit-property/:id" element={<EditProperty />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UsersList />} />
              <Route path="/admin/properties" element={<PropertiesList />} />
              <Route path="/admin/reviews" element={<ReviewsList />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
