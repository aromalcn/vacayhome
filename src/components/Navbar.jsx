import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Menu, X, Home, Search, User, LogIn, MessageSquare } from 'lucide-react';
import NotificationBell from './NotificationBell';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [homeLink, setHomeLink] = useState('/');
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [roleLoading, setRoleLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        let mounted = true;

        const fetchUserRole = async (session) => {
            if (!session?.user) {
                if (mounted) {
                    setUser(null);
                    setHomeLink('/');
                    setUserRole(null);
                    setRoleLoading(false);
                }
                return;
            }

            // If we already have the correct user and role loaded, skip fetching
            if (user?.id === session.user.id && userRole) {
                 if (mounted) setRoleLoading(false);
                 return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();

                if (mounted) {
                    setUser(session.user);
                    if (data?.role) {
                        setUserRole(data.role);
                        if (data.role === 'owner') setHomeLink('/owner');
                        else if (data.role === 'tourist') setHomeLink('/tourist');
                        else if (data.role === 'admin') setHomeLink('/admin');
                        else setHomeLink('/');
                    } else {
                        setUserRole(null);
                        setHomeLink('/');
                    }
                }
            } catch (err) {
                console.error("Error fetching role:", err);
            } finally {
                if (mounted) setRoleLoading(false);
            }
        };

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            fetchUserRole(session);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            fetchUserRole(session);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    return (
        <nav className="fixed w-full z-50 top-0 start-0 border-b border-white/20 bg-white/70 backdrop-blur-md shadow-sm">
            <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
                <Link to={homeLink} className="flex items-center space-x-3 rtl:space-x-reverse">
                    <span className="self-center text-2xl font-bold whitespace-nowrap bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                        VacayHome
                    </span>
                </Link>

                <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse items-center gap-2">
                    {user && userRole !== 'admin' && <NotificationBell />}
                    {user ? (
                        <button 
                            onClick={handleLogout}
                            className="text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-full text-sm px-4 py-2 text-center transition-all duration-300 hover:scale-105"
                        >
                            Logout
                        </button>
                    ) : (
                        <Link to="/login" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-full text-sm px-4 py-2 text-center transition-all duration-300 hover:scale-105 shadow-lg shadow-blue-500/30">
                            Get started
                        </Link>
                    )}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        type="button"
                        className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        aria-controls="navbar-sticky"
                        aria-expanded={isOpen}
                    >
                        <span className="sr-only">Open main menu</span>
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                <div className={`items-center justify-between w-full md:flex md:w-auto md:order-1 ${isOpen ? 'block' : 'hidden'}`} id="navbar-sticky">
                    <ul className="flex flex-col p-4 md:p-0 mt-4 font-medium border border-gray-100 rounded-lg bg-gray-50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-transparent">
                        <li>
                            <Link 
                                to={homeLink} 
                                className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                    location.pathname === homeLink 
                                    ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                    : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                }`}
                                aria-current={location.pathname === homeLink ? "page" : undefined}
                            >
                                Home
                            </Link>
                        </li>
                        {!roleLoading && userRole !== 'owner' && userRole !== 'admin' && (
                            <>
                                <li>
                                    <Link 
                                        to="/search" 
                                        className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                            location.pathname === '/search' 
                                            ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                            : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                        }`}
                                    >
                                        Find Stays
                                    </Link>
                                </li>
                                {user && (
                                    <li>
                                        <Link 
                                            to="/my-bookings" 
                                            className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                                location.pathname === '/my-bookings' 
                                                ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                                : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                            }`}
                                        >
                                            My Bookings
                                        </Link>
                                    </li>
                                )}
                                {user && (
                                    <li>
                                        <Link 
                                            to="/my-receipts" 
                                            className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                                location.pathname === '/my-receipts' 
                                                ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                                : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                            }`}
                                        >
                                            My Receipts
                                        </Link>
                                    </li>
                                )}
                                {user && (
                                    <>
                                        <li>
                                            <Link 
                                                to="/messages" 
                                                className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                                    location.pathname === '/messages' 
                                                    ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                                    : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                                }`}
                                            >
                                                Messages
                                            </Link>
                                        </li>
                                        <li>
                                            <Link 
                                                to="/profile" 
                                                className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                                    location.pathname === '/profile' 
                                                    ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                                    : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                                }`}
                                            >
                                                Profile
                                            </Link>
                                        </li>
                                    </>
                                )}
                            </>
                        )}

                        {!roleLoading && userRole === 'owner' && (
                            <>
                                <li>
                                    <Link 
                                        to="/booking-requests" 
                                        className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                            location.pathname === '/booking-requests' 
                                            ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                            : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                        }`}
                                    >
                                        Incoming Requests
                                    </Link>
                                </li>
                                <li>
                                    <Link 
                                        to="/messages" 
                                        className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                            location.pathname === '/messages' 
                                            ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                            : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                        }`}
                                    >
                                        Messages
                                    </Link>
                                </li>
                                <li>
                                    <Link 
                                        to="/profile" 
                                        className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                            location.pathname === '/profile' 
                                            ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                            : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                        }`}
                                    >
                                        Profile
                                    </Link>
                                </li>
                            </>
                        )}

                        {!roleLoading && userRole === 'admin' && (
                            <>
                                <li>
                                    <Link 
                                        to="/admin/users" 
                                        className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                            location.pathname === '/admin/users' 
                                            ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                            : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                        }`}
                                    >
                                        Users
                                    </Link>
                                </li>
                                <li>
                                    <Link 
                                        to="/admin/properties" 
                                        className={`block py-2 px-3 rounded md:p-0 transition-colors ${
                                            location.pathname === '/admin/properties' 
                                            ? 'text-white bg-blue-700 md:bg-transparent md:text-blue-700' 
                                            : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700'
                                        }`}
                                    >
                                        Properties
                                    </Link>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
