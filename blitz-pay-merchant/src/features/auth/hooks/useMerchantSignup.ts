import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSignupVerticals, MerchantRegistrationError, registerAndSignIn, type SignupVertical } from '../services/merchantRegistration';
import type { TranslationKeys } from '../../../lib/translations';

interface SignupFields {
  ownerName: string; merchantName: string; email: string; password: string;
  confirmPassword: string; businessType: string; operatingCountry: string;
}
export function useMerchantSignup(login: (email: string, password: string) => Promise<void>, t: (key: TranslationKeys) => string) {
  const [fields, setFields] = useState<SignupFields>({ownerName: '', merchantName: '', email: '', password: '',
    confirmPassword: '', businessType: '', operatingCountry: 'DE'});
  const [verticals, setVerticals] = useState<SignupVertical[]>([]);
  const [verticalsLoading, setVerticalsLoading] = useState(true);
  const [verticalsError, setVerticalsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const sequence = useRef(0);
  const submitting = useRef(false);
  const errorMessage = useCallback((failure: unknown) => failure instanceof MerchantRegistrationError
    ? failure.detail || t(failure.i18nKey) : t('registration_failed'), [t]);
  const retryVerticals = useCallback(async () => {
    const current = ++sequence.current;
    setVerticalsLoading(true); setVerticalsError('');
    try {
      const result = await fetchSignupVerticals();
      if (current !== sequence.current) return;
      setVerticals(result);
      setFields(previous => ({...previous, businessType: result.some(v => v.code === previous.businessType) ? previous.businessType : ''}));
    } catch (failure) {
      if (current !== sequence.current) return;
      setVerticals([]); setFields(previous => ({...previous, businessType: ''})); setVerticalsError(errorMessage(failure));
    } finally { if (current === sequence.current) setVerticalsLoading(false); }
  }, [errorMessage]);
  useEffect(() => { void retryVerticals(); return () => { sequence.current++; }; }, [retryVerticals]);
  function setField(field: keyof SignupFields, value: string) { setFields(previous => ({...previous, [field]: value})); }
  const canSubmit = !loading && !registrationComplete && !verticalsLoading && !verticalsError
    && !!fields.ownerName.trim() && !!fields.merchantName.trim()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())
    && /^[A-Za-z]{2}$/.test(fields.operatingCountry)
    && fields.password.length <= 128 && fields.password.length >= 8 && /[A-Z]/.test(fields.password) && /[0-9]/.test(fields.password)
    && fields.password === fields.confirmPassword && verticals.some(v => v.code === fields.businessType);
  async function handleRegister() {
    if (!canSubmit || submitting.current) return;
    submitting.current = true; setLoading(true); setError(''); setNotice('');
    try {
      const result = await registerAndSignIn(fields, login);
      setRegistrationComplete(true);
      setFields(previous => ({...previous, password: '', confirmPassword: ''}));
      if (result.outcome === 'login_required') setNotice(t('registration_created_sign_in'));
      if (result.outcome === 'verification_required') setNotice(t(result.registration.verificationEmailSent
        ? 'registration_verify_email' : 'registration_verify_email_not_sent'));
    } catch (failure) { setError(errorMessage(failure)); }
    finally { submitting.current = false; setLoading(false); }
  }
  return {fields, setField, verticals, verticalsLoading, verticalsError, retryVerticals,
    loading, error, notice, registrationComplete, canSubmit, handleRegister};
}
