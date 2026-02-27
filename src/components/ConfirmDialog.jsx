import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) => {
    if (!isOpen) return null;

    const typeStyles = {
        danger: {
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
            confirmBtn: 'bg-red-600 hover:bg-red-700 text-white'
        },
        warning: {
            iconBg: 'bg-yellow-100',
            iconColor: 'text-yellow-600',
            confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 text-white'
        }
    };

    const style = typeStyles[type] || typeStyles.danger;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-30 z-[100] transition-opacity"
                onClick={onClose}
            />
            
            {/* Dialog */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-scale-in">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-start gap-4">
                            <div className={`${style.iconBg} p-3 rounded-full`}>
                                <AlertTriangle className={`w-6 h-6 ${style.iconColor}`} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                                <p className="text-sm text-gray-600 mt-1">{message}</p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-6 flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-full text-gray-700 hover:bg-gray-50 font-medium transition"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`px-4 py-2 rounded-full font-medium transition shadow-lg ${style.confirmBtn}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ConfirmDialog;
