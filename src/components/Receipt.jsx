import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckCircle } from 'lucide-react';

const ReceiptContent = ({ booking }) => (
    <div className="p-10 bg-white" id="receipt-content">
        {/* Header */}
        <div className="border-b-2 border-gray-100 pb-8 mb-8 flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold text-blue-600 mb-2">VacayHome</h1>
                <p className="text-gray-500 text-sm">{(booking.payment_status === 'refunded' || booking.payment_status === 'refunded_partial') ? 'Refund Receipt' : 'Receipt for your reservation'}</p>
            </div>
            <div className="text-right">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{(booking.payment_status === 'refunded' || booking.payment_status === 'refunded_partial') ? 'REFUND' : 'RECEIPT'}</h3>
                <p className="text-gray-500 font-mono text-sm">#{booking.transaction_id || 'PENDING'}</p>
                <div className={`mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                    (booking.payment_status === 'refunded' || booking.payment_status === 'refunded_partial') ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                }`}>
                    {(booking.payment_status === 'refunded' || booking.payment_status === 'refunded_partial') ? (
                        <>Refunded</>
                    ) : (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Paid</>
                    )}
                </div>
            </div>
        </div>

        {/* Bill To & Property Info */}
        <div className="grid grid-cols-2 gap-12 mb-10">
            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Billed To</h4>
                <p className="font-bold text-gray-900 text-lg mb-1">{booking.profiles?.full_name || 'Guest'}</p>
                <p className="text-gray-600">{booking.profiles?.email || 'N/A'}</p>
            </div>
            <div className="text-right">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Property Details</h4>
                <p className="font-bold text-gray-900 text-lg mb-1">{booking.properties?.title}</p>
                <p className="text-gray-600 mb-1">{booking.properties?.location || 'N/A'}</p>
            </div>
        </div>

        {/* Booking Dates Table */}
        <div className="mb-10 bg-gray-50 rounded-lg p-6 border border-gray-100">
            <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                    <p className="font-bold text-gray-500 mb-1 uppercase text-xs">Check In</p>
                    <p className="font-semibold text-gray-900">{new Date(booking.check_in).toLocaleDateString()}</p>
                </div>
                <div>
                    <p className="font-bold text-gray-500 mb-1 uppercase text-xs">Check Out</p>
                    <p className="font-semibold text-gray-900">{new Date(booking.check_out).toLocaleDateString()}</p>
                </div>
                <div>
                    <p className="font-bold text-gray-500 mb-1 uppercase text-xs">Guests</p>
                    <p className="font-semibold text-gray-900">{booking.guests}</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-gray-500 mb-1 uppercase text-xs">Nights</p>
                    <p className="font-semibold text-gray-900">
                        {Math.ceil((new Date(booking.check_out) - new Date(booking.check_in)) / (1000 * 60 * 60 * 24))}
                    </p>
                </div>
            </div>
        </div>

        {/* Payment Details */}
        <div className="border-t border-gray-200 pt-8">
            <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">Total Paid Originally</span>
                <span className="font-medium text-gray-900">₹{booking.total_price?.toLocaleString() || '0'}</span>
            </div>
            
            {(booking.payment_status === 'refunded' || booking.payment_status === 'refunded_partial') && (
                <>
                    {booking.payment_status === 'refunded_partial' && (
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-gray-600 italic">Cancellation Fee (20%)</span>
                            <span className="font-medium text-red-600">-₹{((booking.total_price || 0) * 0.2).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
                        <span className="text-xl font-bold text-gray-900">Total Refunded</span>
                        <span className="text-xl font-bold text-orange-600">
                            ₹{(booking.payment_status === 'refunded_partial' ? (booking.total_price || 0) * 0.8 : (booking.total_price || 0)).toLocaleString()}
                        </span>
                    </div>
                </>
            )}

            {booking.payment_status !== 'refunded' && booking.payment_status !== 'refunded_partial' && (
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
                    <span className="text-xl font-bold text-gray-900">Total Paid</span>
                    <span className="text-xl font-bold text-blue-600">₹{booking.total_price?.toLocaleString() || '0'}</span>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-center text-gray-500 text-sm">
            <p className="mb-2">Thank you for choosing VacayHome!</p>
            <p className="text-xs">If you have any questions, please support@vacayhome.com</p>
            <p className="text-xs mt-4 text-gray-300">Transaction ID: {booking.transaction_id}</p>
        </div>
    </div>
);

const Receipt = ({ isOpen, onClose, booking, inline = false }) => {
    const [printPortalNode, setPrintPortalNode] = useState(null);
    const [uiPortalNode, setUiPortalNode] = useState(null);

    useEffect(() => {
        // Create a persistent container for the PRINT VERSION only
        const div = document.createElement('div');
        div.id = 'receipt-print-only-root';
        document.body.appendChild(div);
        setPrintPortalNode(div);

        return () => {
            if (div.parentNode) div.parentNode.removeChild(div);
        };
    }, []);

    useEffect(() => {
        if (!inline) {
            const div = document.createElement('div');
            div.id = 'receipt-ui-modal-root';
            document.body.appendChild(div);
            setUiPortalNode(div);
            return () => {
                if(div.parentNode) div.parentNode.removeChild(div);
            };
        }
    }, [inline]);

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen && !inline) return null;
    if (!booking) return null;

    // --- UI RENDER (Inline or Modal) ---
    // This part is for the screen. It should be HIDDEN during print.
    const containerClasses = inline 
        ? "w-full outline-none print:hidden" 
        : "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto print:hidden";
    
    const contentClasses = inline
        ? "bg-white w-full max-w-4xl mx-auto rounded-xl shadow-sm border border-gray-200"
        : "bg-white w-full max-w-2xl rounded-sm shadow-2xl my-8";

    const uiContent = (
        <div className={containerClasses}>
            <div className={contentClasses}>
                {/* Controls */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 rounded-t-sm">
                    <h2 className="text-lg font-bold text-gray-700">
                        {(booking.payment_status === 'refunded' || booking.payment_status === 'refunded_partial') ? 'Refund Receipt' : 'Payment Receipt'}
                    </h2>
                    <div className="flex space-x-2">
                        <button 
                            onClick={handlePrint}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                            <Printer className="w-4 h-4 mr-2" /> Print
                        </button>
                        {!inline && (
                            <button 
                                onClick={onClose}
                                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                            >
                                <X className="w-4 h-4 mr-2" /> Close
                            </button>
                        )}
                        {inline && (
                             <button 
                                onClick={onClose}
                                className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                            >
                                Back
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Actual Receipt Content for Screen */}
                <ReceiptContent booking={booking} />
            </div>
        </div>
    );

    // --- PRINT RENDER (Portal) ---
    // This part is for the PRINTER. It should be VISIBLE ONLY during print.
    const printContent = printPortalNode ? createPortal(
        <div id="print-view-container">
            <ReceiptContent booking={booking} />
        </div>,
        printPortalNode
    ) : null;

    return (
        <>
            <style>
                {`
                    /* Default state: Hide print portal */
                    #receipt-print-only-root {
                        display: none;
                    }

                    @media print {
                        @page { size: auto; margin: 0mm; }
                        
                        /* Hide entire React App Root */
                        #root, #receipt-ui-modal-root { 
                            display: none !important; 
                        }

                        /* Ensure body allows full print */
                        body, html { 
                            visibility: visible !important; 
                            background: white !important; 
                            height: auto !important; 
                            width: 100% !important;
                            overflow: visible !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        /* Show print portal */
                        #receipt-print-only-root { 
                            display: block !important;
                            visibility: visible !important; 
                            position: absolute !important; 
                            top: 0 !important; 
                            left: 0 !important; 
                            width: 100% !important; 
                            height: auto !important;
                            z-index: 2147483647 !important; /* Max z-index */
                            background: white !important;
                        }
                        
                        #print-view-container {
                            width: 100%;
                            background: white !important;
                            padding: 20px !important;
                        }

                        /* Target content */
                        #receipt-content {
                            width: 100% !important;
                            max-width: none !important;
                            margin: 0 !important;
                            padding: 20px !important;
                            background: white !important;
                            color: black !important;
                        }

                        /* Force colors */
                        #receipt-content * {
                            color: black !important;
                            visibility: visible !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        
                        /* Hide buttons specifically if they exist in content */
                        button {
                            display: none !important;
                        }
                    }
                `}
            </style>

            {/* Render UI: Inline or via Portal */}
            {inline ? uiContent : (uiPortalNode ? createPortal(uiContent, uiPortalNode) : null)}
            
            {/* Render Print View: Always via dedicated Portal */}
            {printContent}
        </>
    );
};

export default Receipt;
