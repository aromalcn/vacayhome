import { useEffect } from 'react';
import { Search, MapPin, Calendar, Shield, MousePointer, Star } from 'lucide-react';
import { supabase } from '../supabaseClient';
import HeartButton from '../components/HeartButton';
import { Link, useNavigate } from 'react-router-dom';

const Home = () => {
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;

        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user && mounted) {
                // Fetch profile to get role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                
                if (mounted && profile) {
                    if (profile.role === 'owner') {
                        navigate('/owner', { replace: true });
                    } else if (profile.role === 'tourist') {
                        navigate('/tourist', { replace: true });
                    }
                }
            }
        };
        checkUser();

        return () => {
            mounted = false;
        };
    }, [navigate]);

    return (
        <div className="min-h-screen pt-16">
            {/* Hero Section */}
            <section className="relative bg-white bg-[url('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center bg-no-repeat bg-gray-700 bg-blend-multiply h-[600px] flex items-center justify-center">
                <div className="px-4 mx-auto max-w-screen-xl text-center py-24 lg:py-56 relative z-10">
                    <h1 className="mb-4 text-4xl font-extrabold tracking-tight leading-none text-white md:text-5xl lg:text-6xl">
                        Find Your Perfect Getaway
                    </h1>
                    <p className="mb-8 text-lg font-normal text-gray-300 lg:text-xl sm:px-16 lg:px-48">
                        Discover affordable, verified vacation homes tailored for your comfort. From cozy cottages to luxurious villas, we have it all.
                    </p>
                    <div className="flex flex-col space-y-4 sm:flex-row sm:justify-center sm:space-y-0">
                        <Link to="/search" className="inline-flex justify-center items-center py-3 px-5 text-base font-medium text-center text-white rounded-full bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 shadow-lg hover:shadow-white-500/50 transition-all transform hover:-translate-y-1">
                            Find a Home
                            <Search className="w-3.5 h-3.5 ms-2 rtl:rotate-180" />
                        </Link>

                    </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900/90 pointer-events-none"></div>
            </section>

            {/* Features Section */}
            <section className="py-16 bg-white">
                <div className="py-8 px-4 mx-auto max-w-screen-xl sm:py-16 lg:px-6">
                    <div className="max-w-screen-md mb-8 lg:mb-16">
                        <h2 className="mb-4 text-4xl tracking-tight font-extrabold text-gray-900">
                            Designed for effortless travel
                        </h2>
                        <p className="text-gray-500 sm:text-xl">
                            VacayHome connects you with verified homeowners for a seamless booking experience.
                        </p>
                    </div>
                    <div className="space-y-8 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-12 md:space-y-0">
                        <div>
                            <div className="flex justify-center items-center mb-4 w-10 h-10 rounded-full bg-blue-100 lg:h-12 lg:w-12 dark:bg-blue-900">
                                <Shield className="w-5 h-5 text-blue-600 lg:w-6 lg:h-6" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold">Verified Homes</h3>
                            <p className="text-gray-500">Every listing is verified by our admin team to ensure quality and safety.</p>
                        </div>
                        <div>
                            <div className="flex justify-center items-center mb-4 w-10 h-10 rounded-full bg-green-100 lg:h-12 lg:w-12 dark:bg-green-900">
                                <Star className="w-5 h-5 text-green-600 lg:w-6 lg:h-6" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold">Top Rated Stays</h3>
                            <p className="text-gray-500">Browse homes rated by other travelers for the best experience.</p>
                        </div>
                        <div>
                            <div className="flex justify-center items-center mb-4 w-10 h-10 rounded-full bg-purple-100 lg:h-12 lg:w-12 dark:bg-purple-900">
                                <Search className="w-5 h-5 text-purple-600 lg:w-6 lg:h-6" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold">Easy Search</h3>
                            <p className="text-gray-500">Filter by location, price, and amenities to find exactly what you need.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
