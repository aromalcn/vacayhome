import { useState, useEffect } from 'react';
import { X, CreditCard, Lock, Loader2 } from 'lucide-react';

const PaymentModal = ({ isOpen, onClose, amount, onSuccess, propertyTitle }) => {
    const [loading, setLoading] = useState(false);
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Reset state when modal opens
            setLoading(false);
            setCardName('');
            setCardNumber('');
            setExpiry('');
            setCvv('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (cardNumber.length < 16 || expiry.length < 5 || cvv.length < 3) {
            setError('Please enter valid card details');
            return;
        }

        setLoading(true);

        // Simulate payment processing delay
        setTimeout(() => {
            setLoading(false);
            // Generate a random transaction ID
            const transactionId = 'TXN' + Date.now() + Math.floor(Math.random() * 1000);
            onSuccess(transactionId);
        }, 2000);
    };

    // Format card number with spaces
    const handleCardNumberChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').substring(0, 16);
        setCardNumber(value);
    };

    // Format expiry as MM/YY
    const handleExpiryChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').substring(0, 4);
        if (value.length >= 2) {
            setExpiry(`${value.substring(0, 2)}/${value.substring(2)}`);
        } else {
            setExpiry(value);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 scale-100 transition-transform">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <Lock className="w-5 h-5 mr-2 text-green-600" /> Secure Payment
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">Payment for</p>
                    <h3 className="font-semibold text-gray-900 truncate">{propertyTitle}</h3>
                    <div className="mt-2 flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-gray-600 font-medium">Total Amount</span>
                        <span className="text-xl font-bold text-blue-600">₹{amount.toLocaleString()}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cardholder Name</label>
                        <input
                            type="text"
                            value={cardName}
                            onChange={(e) => setCardName(e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none"
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Card Number</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={cardNumber.replace(/(.{4})/g, '$1 ').trim()}
                                onChange={handleCardNumberChange}
                                className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none font-mono"
                                placeholder="0000 0000 0000 0000"
                                required
                            />
                            <CreditCard className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Expiry Date</label>
                            <input
                                type="text"
                                value={expiry}
                                onChange={handleExpiryChange}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none text-center"
                                placeholder="MM/YY"
                                maxLength="5"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CVV</label>
                            <input
                                type="password"
                                value={cvv}
                                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').substring(0, 3))}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all outline-none text-center"
                                placeholder="123"
                                maxLength="3"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...
                                </>
                            ) : (
                                `Pay ₹${amount.toLocaleString()}`
                            )}
                        </button>
                        <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center">
                            <Lock className="w-3 h-3 mr-1" /> Payments are secure and encrypted
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaymentModal;
