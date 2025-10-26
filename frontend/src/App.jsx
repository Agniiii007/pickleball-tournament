import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, Mail, Phone, MapPin, User, Users } from 'lucide-react';

const CATEGORIES = [
  { id: 'u12_girls', name: 'U12 Girls', events: ['Singles', 'Doubles'], price: { Singles: 850, Doubles: 1500 } },
  { id: 'u12_boys', name: 'U12 Boys', events: ['Singles', 'Doubles'], price: { Singles: 850, Doubles: 1500 } },
  { id: 'u19_girls', name: 'U19 Girls', events: ['Singles', 'Doubles'], price: { Singles: 850, Doubles: 1500 } },
  { id: 'u19_boys', name: 'U19 Boys', events: ['Singles', 'Doubles'], price: { Singles: 850, Doubles: 1500 } },
  { id: 'open_beginners_men', name: 'Open Beginners Men', events: ['Singles', 'Doubles'], price: { Singles: 850, Doubles: 1500 } },
  { id: 'open_beginners_women', name: 'Open Beginners Women', events: ['Singles', 'Doubles'], price: { Singles: 850, Doubles: 1500 } },
  { id: 'open_mixed', name: 'Open Mixed', events: ['Mixed'], price: { Mixed: 1500 } },
  { id: 'open_men_adv', name: 'Open Men Advanced', events: ['Singles', 'Doubles', 'Mixed'], price: { Singles: 850, Doubles: 1500, Mixed: 1500 } },
  { id: '35plus_men', name: '35+ Men', events: ['Singles', 'Doubles', 'Mixed'], price: { Singles: 850, Doubles: 1500, Mixed: 1500 } },
  { id: '35plus_women', name: '35+ Women', events: ['Singles', 'Doubles', 'Mixed'], price: { Singles: 850, Doubles: 1500, Mixed: 1500 } },
  { id: '50plus_men', name: '50+ Men', events: ['Singles', 'Doubles', 'Mixed'], price: { Singles: 850, Doubles: 1500, Mixed: 1500 } },
  { id: '50plus_women', name: '50+ Women', events: ['Singles', 'Doubles', 'Mixed'], price: { Singles: 850, Doubles: 1500, Mixed: 1500 } }
];

export default function PickleballRegistration() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    selectedEvents: [],
    partners: {}
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');

  useEffect(() => {
    let sum = 0;
    formData.selectedEvents.forEach(event => {
      const parts = event.split('_');
      const eventTypeFromKey = parts[parts.length - 1];
      const catIdFromKey = parts.slice(0, -1).join('_');
      const category = CATEGORIES.find(c => c.id === catIdFromKey);
      if (category && category.price[eventTypeFromKey]) {
        sum += category.price[eventTypeFromKey];
      }
    });
    setTotal(sum);
  }, [formData.selectedEvents]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEventToggle = (catId, eventType) => {
    const eventKey = `${catId}_${eventType}`;
    const isSelected = formData.selectedEvents.includes(eventKey);

    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        selectedEvents: prev.selectedEvents.filter(e => e !== eventKey),
        partners: { ...prev.partners, [eventKey]: undefined }
      }));
    } else {
      if (formData.selectedEvents.length >= 3) {
        alert('Maximum 3 events allowed!');
        return;
      }
      setFormData(prev => ({
        ...prev,
        selectedEvents: [...prev.selectedEvents, eventKey]
      }));
    }
    
    // Force recalculate total
    setTimeout(() => {
      let sum = 0;
      const updatedEvents = isSelected 
        ? formData.selectedEvents.filter(e => e !== eventKey)
        : [...formData.selectedEvents, eventKey];
      
      updatedEvents.forEach(event => {
        const parts = event.split('_');
        const eventTypeFromKey = parts[parts.length - 1];
        const catIdFromKey = parts.slice(0, -1).join('_');
        const category = CATEGORIES.find(c => c.id === catIdFromKey);
        if (category && category.price[eventTypeFromKey]) {
          sum += category.price[eventTypeFromKey];
        }
      });
      setTotal(sum);
    }, 0);
  };

  const handlePartnerChange = (eventKey, field, value) => {
    setFormData(prev => ({
      ...prev,
      partners: {
        ...prev.partners,
        [eventKey]: { ...prev.partners[eventKey], [field]: value }
      }
    }));
  };

  const needsPartner = (eventType) => {
    return eventType === 'Doubles' || eventType === 'Mixed';
  };

  const validateStep1 = () => {
    const { name, email, phone, address } = formData;
    if (!name || !email || !phone || !address) {
      alert('Please fill all required fields');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email');
      return false;
    }
    if (!/^\+?[\d\s-]{10,}$/.test(phone)) {
      alert('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (formData.selectedEvents.length === 0) {
      alert('Please select at least one event');
      return false;
    }

    for (const eventKey of formData.selectedEvents) {
      const parts = eventKey.split('_');
      const eventType = parts[parts.length - 1];
      if (needsPartner(eventType)) {
        const partner = formData.partners[eventKey];
        if (!partner?.name || !partner?.phone || !partner?.email) {
          alert(`Please provide partner details for ${eventType} event`);
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partner.email)) {
          alert('Please enter a valid partner email');
          return false;
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    
    try {
      // Get API URL from environment or use localhost
      const API_URL = window.VITE_API_URL || 'https://pickleball-backend-wigs.onrender.com';
      
      const orderResponse = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const orderData = await orderResponse.json();

      // Demo mode detection
      if (orderData.demo) {
        console.log('Demo mode - simulating payment');
        // Simulate payment delay
        setTimeout(async () => {
          const verifyResponse = await fetch(`${API_URL}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: orderData.orderId,
              razorpay_payment_id: 'pay_demo_' + Date.now(),
              razorpay_signature: 'demo_signature',
              formData: formData,
            }),
          });

          const verifyData = await verifyResponse.json();

          if (verifyData.success) {
            setPaymentRef(verifyData.paymentRef);
            setSuccess(true);
          }
          setLoading(false);
        }, 2000);
        return;
      }

      // Real Razorpay integration (for production)
      if (window.Razorpay) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount * 100,
          currency: orderData.currency,
          name: 'Pickleball Tournament 2025',
          description: 'Tournament Registration',
          order_id: orderData.orderId,
          handler: async function (response) {
            const verifyResponse = await fetch(`${API_URL}/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                formData: formData,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              setPaymentRef(verifyData.paymentRef);
              setSuccess(true);
            } else {
              alert('Payment verification failed. Please contact support.');
            }
            setLoading(false);
          },
          prefill: {
            name: formData.name,
            email: formData.email,
            contact: formData.phone,
          },
          theme: {
            color: '#fbbf24',
          },
          modal: {
            ondismiss: function() {
              setLoading(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback to demo mode if Razorpay not loaded
        alert('Payment gateway not loaded. Running in demo mode.');
        const mockPaymentId = 'pay_demo_' + Date.now();
        setPaymentRef(mockPaymentId);
        setSuccess(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Payment Error:', error);
      alert('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    const partnerNames = Object.values(formData.partners)
      .filter(p => p?.name)
      .map(p => p.name)
      .join(', ');

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border-4 border-yellow-400">
          <div className="mb-6 animate-bounce">
            <div className="text-6xl mb-4">🎉</div>
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">
            CONGRATULATIONS!
          </h1>
          <p className="text-xl font-bold text-cyan-600 mb-1">{formData.name}</p>
          {partnerNames && <p className="text-lg font-bold text-cyan-600 mb-4">& {partnerNames}</p>}
          <p className="text-xl font-bold text-green-600 mb-6">You're Registered! ✓</p>
          
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-4 text-left space-y-3 border-2 border-cyan-300">
            <div>
              <p className="text-sm font-bold text-slate-600">Payment Reference</p>
              <p className="font-mono font-bold text-slate-800 text-sm">{paymentRef}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600 mb-1">Selected Events</p>
              <ul className="text-sm text-slate-700">
                {formData.selectedEvents.map(e => {
                  const parts = e.split('_');
                  const eventType = parts[parts.length - 1];
                  const catId = parts.slice(0, -1).join('_');
                  const cat = CATEGORIES.find(c => c.id === catId);
                  return cat ? <li key={e} className="font-semibold">• {cat.name} - {eventType}</li> : null;
                })}
              </ul>
            </div>
            <div className="pt-3 border-t-2 border-cyan-200">
              <p className="text-sm font-bold text-slate-600">Total Paid</p>
              <p className="text-3xl font-black text-green-600">₹{total}</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-yellow-100 rounded-lg border-2 border-yellow-400">
            <p className="text-sm font-bold text-slate-800">
              📧 Confirmation emails sent!
            </p>
            <p className="text-xs text-slate-600 mt-2">
              Check {formData.email}
              {partnerNames && ' and partner emails'}
            </p>
          </div>
          <p className="text-sm text-slate-600 mt-6 font-semibold">
            📅 Nov 11-12, 2024 | ⏰ 8:00 AM - 10:00 PM
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Match schedules will be shared soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 overflow-y-auto pb-8">
      {/* Background Pattern - Pickleball court lines */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,transparent_48%,#FFD700_48%,#FFD700_52%,transparent_52%,transparent_100%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_0%,transparent_48%,#FFD700_48%,#FFD700_52%,transparent_52%,transparent_100%)]"></div>
      </div>

      <div className="relative max-w-2xl mx-auto p-4 pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-yellow-400 mb-2 tracking-tight" style={{textShadow: '3px 3px 0px rgba(0,0,0,0.3)'}}>
            PICKLEBALL
          </h1>
          <div className="flex items-center justify-center gap-2 text-cyan-300 text-sm font-semibold mb-4">
            <span>📅 Dec 5, 6 & 7, 2025</span>
            <span>•</span>
            <span>⏰ 08:00 AM - 10:00 PM</span>
          </div>
          <p className="text-cyan-100 text-lg font-bold">TOURNAMENT REGISTRATION</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step >= 1 ? 'text-yellow-400' : 'text-gray-500'}`}>
            <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-lg bg-slate-800">1</div>
            <span className="ml-2 text-sm font-bold">Details</span>
          </div>
          <div className={`w-16 h-1 mx-4 ${step >= 2 ? 'bg-yellow-400' : 'bg-gray-600'}`}></div>
          <div className={`flex items-center ${step >= 2 ? 'text-yellow-400' : 'text-gray-500'}`}>
            <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-lg bg-slate-800">2</div>
            <span className="ml-2 text-sm font-bold">Events</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-yellow-400">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Personal Information</h2>
              
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 mr-2" />
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 mr-2" />
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 mr-2" />
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 mr-2" />
                  Address *
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  rows="3"
                  placeholder="Your complete address"
                />
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-yellow-400 text-slate-900 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition-colors shadow-lg"
              >
                Next: Select Events →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-slate-800">SELECT CATEGORY</h2>
                <span className="text-sm font-bold text-slate-600 bg-yellow-100 px-3 py-1 rounded-full">
                  {formData.selectedEvents.length}/3 selected
                </span>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {CATEGORIES.map(category => (
                  <div key={category.id} className="border-2 border-cyan-300 rounded-lg p-4 bg-gradient-to-r from-cyan-50 to-blue-50">
                    <h3 className="font-black text-slate-800 mb-3 text-lg text-cyan-700">{category.name}</h3>
                    <div className="space-y-3">
                      {category.events.map(eventType => {
                        const eventKey = `${category.id}_${eventType}`;
                        const isSelected = formData.selectedEvents.includes(eventKey);
                        const requiresPartner = needsPartner(eventType);

                        return (
                          <div key={eventKey}>
                            <label className="flex items-center justify-between cursor-pointer hover:bg-white p-2 rounded transition-colors">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleEventToggle(category.id, eventType)}
                                  className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500"
                                />
                                <span className="ml-3 text-gray-800 font-semibold">
                                  {eventType}
                                  {requiresPartner && <Users className="inline w-4 h-4 ml-1 text-cyan-600" />}
                                </span>
                              </div>
                              <span className="font-black text-cyan-700 text-lg">
                                ₹{category.price[eventType]}
                              </span>
                            </label>

                            {isSelected && requiresPartner && (
                              <div className="mt-3 ml-8 space-y-2 p-3 bg-yellow-50 rounded border-2 border-yellow-300">
                                <p className="text-xs font-bold text-slate-700 mb-2">⚡ Partner Details Required</p>
                                <input
                                  type="text"
                                  placeholder="Partner Name *"
                                  value={formData.partners[eventKey]?.name || ''}
                                  onChange={(e) => handlePartnerChange(eventKey, 'name', e.target.value)}
                                  className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                />
                                <input
                                  type="tel"
                                  placeholder="Partner Phone *"
                                  value={formData.partners[eventKey]?.phone || ''}
                                  onChange={(e) => handlePartnerChange(eventKey, 'phone', e.target.value)}
                                  className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                />
                                <input
                                  type="email"
                                  placeholder="Partner Email *"
                                  value={formData.partners[eventKey]?.email || ''}
                                  onChange={(e) => handlePartnerChange(eventKey, 'email', e.target.value)}
                                  className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-300 border-4 border-yellow-500 rounded-lg p-4 shadow-xl">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-black text-slate-900">TOTAL AMOUNT</span>
                  <span className="text-4xl font-black text-slate-900">₹{total}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-600 text-white py-4 rounded-lg font-bold hover:bg-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || formData.selectedEvents.length === 0}
                  className="flex-1 bg-yellow-400 text-slate-900 py-4 rounded-lg font-bold hover:bg-yellow-300 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg text-lg"
                >
                  {loading ? 'Processing...' : 'Proceed to Payment 💳'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}