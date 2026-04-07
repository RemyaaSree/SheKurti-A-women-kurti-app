import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import {
  checkout,
  createAddress,
  getAddresses,
  type AddressPayload,
  type AddressResponse,
} from '../services/api';
import '../styles/PaymentPage.css';

type AddressMode = 'saved' | 'manual';

type PaymentMethod =
  | 'debit_card'
  | 'credit_card'
  | 'net_banking'
  | 'upi'
  | 'cod';

const paymentMethodLabels: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'net_banking', label: 'Net Banking' },
  { value: 'cod', label: 'Cash on Delivery' },
];

const createEmptyManualAddress = (): AddressPayload => ({
  full_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
});

const createEmptyCardDetails = () => ({
  card_number: '',
  cardholder_name: '',
  expiry_month: '',
  expiry_year: '',
  cvv: '',
});

const createEmptyUpiDetails = () => ({
  provider: '',
  upi_id: '',
});

const createEmptyNetBankingDetails = () => ({
  bank_name: '',
  account_holder: '',
});

const mapAddressLabel = (address: AddressResponse) =>
  `${address.full_name}, ${address.line1}${address.line2 ? `, ${address.line2}` : ''}, ${address.city}, ${address.state} ${address.postal_code}, ${address.country}`;

export const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, clearCart } = useCart();
  const [processing, setProcessing] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AddressResponse[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressMode, setAddressMode] = useState<AddressMode>('saved');
  const [selectedAddressId, setSelectedAddressId] = useState<number | ''>('');
  const [manualAddress, setManualAddress] = useState<AddressPayload>(createEmptyManualAddress());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('debit_card');
  const [cardDetails, setCardDetails] = useState(createEmptyCardDetails());
  const [upiDetails, setUpiDetails] = useState(createEmptyUpiDetails());
  const [netBankingDetails, setNetBankingDetails] = useState(createEmptyNetBankingDetails());

  useEffect(() => {
    let mounted = true;
    const loadAddresses = async () => {
      setLoadingAddresses(true);
      try {
        const data = await getAddresses();
        if (mounted) {
          setSavedAddresses(data);
          if (data.length > 0) {
            setSelectedAddressId(data[0].id);
          } else {
            setAddressMode('manual');
          }
        }
      } catch (error) {
        console.error('Failed to load addresses', error);
        if (mounted) {
          setSavedAddresses([]);
          setAddressMode('manual');
        }
      } finally {
        if (mounted) {
          setLoadingAddresses(false);
        }
      }
    };

    loadAddresses();
    return () => {
      mounted = false;
    };
  }, []);

  const isManualAddressValid = useMemo(() => {
    const required = [
      manualAddress.full_name,
      manualAddress.phone,
      manualAddress.line1,
      manualAddress.city,
      manualAddress.state,
      manualAddress.postal_code,
      manualAddress.country,
    ];
    return required.every((value) => value.trim().length > 0);
  }, [manualAddress]);

  const updateManualAddress = (key: keyof AddressPayload, value: string) => {
    setManualAddress((previous) => ({ ...previous, [key]: value }));
  };

  const handleSaveManualAddress = async () => {
    if (!isManualAddressValid) {
      alert('Please fill all required address fields before saving.');
      return;
    }

    setSavingAddress(true);
    try {
      const created = await createAddress(manualAddress);
      setSavedAddresses((previous) => [created, ...previous]);
      setSelectedAddressId(created.id);
      setAddressMode('saved');
      setManualAddress(createEmptyManualAddress());
      alert('Address saved successfully.');
    } catch (error) {
      console.error('Failed to save address', error);
      alert('Unable to save address. Please try again.');
    } finally {
      setSavingAddress(false);
    }
  };

  const isCardMethod = paymentMethod === 'debit_card' || paymentMethod === 'credit_card';
  const isUpiMethod = paymentMethod === 'upi';
  const isNetBankingMethod = paymentMethod === 'net_banking';

  const validatePaymentDetails = (): string | null => {
    if (isCardMethod) {
      const cardNumber = cardDetails.card_number.replace(/\s+/g, '');
      if (!/^\d{12,19}$/.test(cardNumber)) return 'Enter a valid card number';
      if (!cardDetails.cardholder_name.trim()) return 'Enter card holder name';
      if (!/^(0?[1-9]|1[0-2])$/.test(cardDetails.expiry_month)) return 'Enter valid expiry month';
      if (!/^\d{2,4}$/.test(cardDetails.expiry_year)) return 'Enter valid expiry year';
      if (!/^\d{3,4}$/.test(cardDetails.cvv)) return 'Enter valid CVV';
    }

    if (isUpiMethod) {
      if (!upiDetails.provider.trim()) return 'Select UPI app';
      if (!/^[^@\s]+@[^@\s]+$/.test(upiDetails.upi_id.trim())) return 'Enter valid UPI ID';
    }

    if (isNetBankingMethod) {
      if (!netBankingDetails.bank_name.trim()) return 'Select a bank';
      if (!netBankingDetails.account_holder.trim()) return 'Enter account holder name';
    }

    return null;
  };

  const buildPaymentDetails = (): Record<string, string> => {
    if (isCardMethod) {
      return {
        card_number: cardDetails.card_number,
        cardholder_name: cardDetails.cardholder_name,
        expiry_month: cardDetails.expiry_month,
        expiry_year: cardDetails.expiry_year,
        cvv: cardDetails.cvv,
      };
    }

    if (isUpiMethod) {
      return { upi_id: upiDetails.upi_id };
    }

    if (isNetBankingMethod) {
      return {
        bank_name: netBankingDetails.bank_name,
        account_holder: netBankingDetails.account_holder,
      };
    }

    return {};
  };

  const resolvePaymentMethod = (): PaymentMethod | 'upi_gpay' | 'upi_phonepe' | 'upi_paytm' => {
    if (!isUpiMethod) {
      return paymentMethod;
    }
    const provider = upiDetails.provider.trim().toLowerCase();
    if (provider === 'phonepe') return 'upi_phonepe';
    if (provider === 'paytm') return 'upi_paytm';
    return 'upi_gpay';
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      alert('Your cart is empty.');
      navigate('/shop');
      return;
    }

    if (addressMode === 'saved' && !selectedAddressId) {
      alert('Please choose a saved address or switch to manual address.');
      return;
    }

    if (addressMode === 'manual' && !isManualAddressValid) {
      alert('Please fill all required manual address fields.');
      return;
    }

    const paymentValidationError = validatePaymentDetails();
    if (paymentValidationError) {
      alert(paymentValidationError);
      return;
    }

    setProcessing(true);
    try {
      const resolvedMethod = resolvePaymentMethod();
      const response = await checkout({
        payment_method: resolvedMethod,
        payment_details: buildPaymentDetails(),
        ...(addressMode === 'saved'
          ? { address_id: Number(selectedAddressId) }
          : { shipping_address: manualAddress }),
      });
      await clearCart();
      alert(`Order placed successfully. Order ID: ${response.order.id}`);
      navigate('/profile/orders');
    } catch (error) {
      console.error('Checkout failed', error);
      const errorMessage = (error as any)?.response?.data?.detail || 'Payment failed. Please try again.';
      alert(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="payment-page">
      <div className="container payment-container">
        <h1 className="payment-title">Payment</h1>
        <div className="payment-grid">
          <section className="payment-card">
            <h2>Delivery Address</h2>

            <div className="address-mode-switch">
              <label>
                <input
                  type="radio"
                  name="addressMode"
                  checked={addressMode === 'saved'}
                  onChange={() => setAddressMode('saved')}
                />
                Use Saved Address
              </label>
              <label>
                <input
                  type="radio"
                  name="addressMode"
                  checked={addressMode === 'manual'}
                  onChange={() => setAddressMode('manual')}
                />
                Enter Address Manually
              </label>
            </div>

            {addressMode === 'saved' && (
              <div className="saved-address-block">
                {loadingAddresses ? <p>Loading saved addresses...</p> : null}
                {!loadingAddresses && savedAddresses.length === 0 ? (
                  <div className="saved-address-empty">
                    <p>No saved address found. Enter details below and save.</p>
                    <div className="payment-form-grid">
                      <input
                        type="text"
                        placeholder="Full name *"
                        value={manualAddress.full_name}
                        onChange={(event) => updateManualAddress('full_name', event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Phone number *"
                        value={manualAddress.phone}
                        onChange={(event) => updateManualAddress('phone', event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Address line 1 *"
                        value={manualAddress.line1}
                        onChange={(event) => updateManualAddress('line1', event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Address line 2"
                        value={manualAddress.line2 ?? ''}
                        onChange={(event) => updateManualAddress('line2', event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="City *"
                        value={manualAddress.city}
                        onChange={(event) => updateManualAddress('city', event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="State *"
                        value={manualAddress.state}
                        onChange={(event) => updateManualAddress('state', event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Pincode *"
                        value={manualAddress.postal_code}
                        onChange={(event) => updateManualAddress('postal_code', event.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Country *"
                        value={manualAddress.country}
                        onChange={(event) => updateManualAddress('country', event.target.value)}
                      />
                    </div>
                    <button className="save-address-btn" onClick={handleSaveManualAddress} disabled={savingAddress}>
                      {savingAddress ? 'Saving Address...' : 'Save Address'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedAddressId}
                    onChange={(event) => setSelectedAddressId(Number(event.target.value))}
                    className="payment-select"
                    aria-label="Select a saved delivery address"
                  >
                    {savedAddresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {mapAddressLabel(address)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {addressMode === 'manual' && (
              <div className="payment-form-grid">
                <input
                  type="text"
                  placeholder="Full name *"
                  value={manualAddress.full_name}
                  onChange={(event) => updateManualAddress('full_name', event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Phone number *"
                  value={manualAddress.phone}
                  onChange={(event) => updateManualAddress('phone', event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Address line 1 *"
                  value={manualAddress.line1}
                  onChange={(event) => updateManualAddress('line1', event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Address line 2"
                  value={manualAddress.line2 ?? ''}
                  onChange={(event) => updateManualAddress('line2', event.target.value)}
                />
                <input
                  type="text"
                  placeholder="City *"
                  value={manualAddress.city}
                  onChange={(event) => updateManualAddress('city', event.target.value)}
                />
                <input
                  type="text"
                  placeholder="State *"
                  value={manualAddress.state}
                  onChange={(event) => updateManualAddress('state', event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Pincode *"
                  value={manualAddress.postal_code}
                  onChange={(event) => updateManualAddress('postal_code', event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Country *"
                  value={manualAddress.country}
                  onChange={(event) => updateManualAddress('country', event.target.value)}
                />
              </div>
            )}

            <h2 className="payment-method-title">Payment Method</h2>
            <div className="payment-methods">
              {paymentMethodLabels.map((method) => (
                <div key={method.value} className={`payment-method-panel ${paymentMethod === method.value ? 'active' : ''}`}>
                  <label className="payment-method-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={() => setPaymentMethod(method.value)}
                    />
                    {method.label}
                  </label>

                  {paymentMethod === method.value && method.value === 'debit_card' && (
                    <div className="payment-subform">
                      <input
                        type="text"
                        placeholder="Debit Card Number *"
                        value={cardDetails.card_number}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, card_number: event.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Card Holder Name *"
                        value={cardDetails.cardholder_name}
                        onChange={(event) =>
                          setCardDetails((prev) => ({ ...prev, cardholder_name: event.target.value }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="Expiry Month (MM) *"
                        value={cardDetails.expiry_month}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, expiry_month: event.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Expiry Year (YY/YYYY) *"
                        value={cardDetails.expiry_year}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, expiry_year: event.target.value }))}
                      />
                      <input
                        type="password"
                        placeholder="CVV *"
                        value={cardDetails.cvv}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, cvv: event.target.value }))}
                      />
                    </div>
                  )}

                  {paymentMethod === method.value && method.value === 'credit_card' && (
                    <div className="payment-subform">
                      <input
                        type="text"
                        placeholder="Credit Card Number *"
                        value={cardDetails.card_number}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, card_number: event.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Card Holder Name *"
                        value={cardDetails.cardholder_name}
                        onChange={(event) =>
                          setCardDetails((prev) => ({ ...prev, cardholder_name: event.target.value }))
                        }
                      />
                      <input
                        type="text"
                        placeholder="Expiry Month (MM) *"
                        value={cardDetails.expiry_month}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, expiry_month: event.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Expiry Year (YY/YYYY) *"
                        value={cardDetails.expiry_year}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, expiry_year: event.target.value }))}
                      />
                      <input
                        type="password"
                        placeholder="CVV *"
                        value={cardDetails.cvv}
                        onChange={(event) => setCardDetails((prev) => ({ ...prev, cvv: event.target.value }))}
                      />
                    </div>
                  )}

                  {paymentMethod === method.value && method.value === 'upi' && (
                    <div className="payment-subform">
                      <select
                        className="payment-select"
                        value={upiDetails.provider}
                        onChange={(event) => setUpiDetails((prev) => ({ ...prev, provider: event.target.value }))}
                        aria-label="Select UPI app"
                      >
                        <option value="">Select UPI App *</option>
                        <option value="GPay">GPay</option>
                        <option value="PhonePe">PhonePe</option>
                        <option value="Paytm">Paytm</option>
                        <option value="BHIM">BHIM</option>
                        <option value="Amazon Pay">Amazon Pay</option>
                      </select>
                      <input
                        type="text"
                        placeholder="UPI ID (example@okicici) *"
                        value={upiDetails.upi_id}
                        onChange={(event) => setUpiDetails((prev) => ({ ...prev, upi_id: event.target.value }))}
                      />
                    </div>
                  )}

                  {paymentMethod === method.value && method.value === 'net_banking' && (
                    <div className="payment-subform">
                      <select
                        className="payment-select"
                        value={netBankingDetails.bank_name}
                        onChange={(event) =>
                          setNetBankingDetails((prev) => ({ ...prev, bank_name: event.target.value }))
                        }
                        aria-label="Select a bank for net banking"
                      >
                        <option value="">Select Bank *</option>
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="State Bank of India">State Bank of India</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Account Holder Name *"
                        value={netBankingDetails.account_holder}
                        onChange={(event) =>
                          setNetBankingDetails((prev) => ({ ...prev, account_holder: event.target.value }))
                        }
                      />
                    </div>
                  )}

                  {paymentMethod === method.value && method.value === 'cod' && (
                    <div className="payment-subform payment-cod-note">
                      <p>Cash on Delivery available. Keep exact amount ready at delivery.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="payment-card">
            <h2>Order Summary</h2>
            <div className="payment-items">
              {cartItems.map((item) => (
                <div key={item.id} className="payment-item">
                  <span>
                    {item.name} x {item.quantity}
                  </span>
                  <span>Rs {item.price * item.quantity}</span>
                </div>
              ))}
            </div>
            <div className="payment-total">
              <span>Total</span>
              <span>Rs {cartTotal}</span>
            </div>
            <button className="pay-btn" onClick={handlePlaceOrder} disabled={processing}>
              {processing ? 'Placing Order...' : 'Place Order'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};
