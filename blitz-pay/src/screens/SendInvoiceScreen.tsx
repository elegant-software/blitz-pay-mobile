import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius } from '../lib/theme';
import { generateInvoicePdf } from '../services/invoiceService';
import type { RootStackNav } from '../types';
import type { InvoiceFormState, LineItem, TradeParty, BankAccount } from '../types/invoice';

type Step = 'recipients' | 'invoice-details' | 'items';

const CONTACTS = [
  { id: '1', name: 'Anna Schmidt', email: 'anna@example.com' },
  { id: '2', name: 'Luca Müller', email: 'luca@example.com' },
  { id: '3', name: 'Sophie Weber', email: 'sophie@example.com' },
  { id: '4', name: 'Team Berlin', email: 'team@berlin.example.com', isGroup: true, count: 5 },
];

const today = new Date().toISOString().split('T')[0];
const dueDefault = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const emptyParty = (): TradeParty => ({ name: '', street: '', zip: '', city: '', country: '', vatId: '' });
const emptyBank = (): BankAccount => ({ bankName: '', iban: '', bic: '' });
const newLineItem = (): LineItem => ({
  id: Date.now().toString(),
  description: '',
  quantity: '',
  unitPrice: '',
  vatPercent: '19',
});

export default function SendInvoiceScreen() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState<Step>('recipients');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<InvoiceFormState>({
    invoiceNumber: `INV-${new Date().getFullYear()}-001`,
    issueDate: today,
    dueDate: dueDefault,
    currency: 'EUR',
    seller: emptyParty(),
    buyer: emptyParty(),
    lineItems: [newLineItem()],
    bankAccount: emptyBank(),
    footerText: '',
  });

  // --- helpers ---
  const setParty = (party: 'seller' | 'buyer', field: keyof TradeParty, value: string) => {
    setForm((f) => ({ ...f, [party]: { ...f[party], [field]: value } }));
    setFieldErrors((e) => { const n = { ...e }; delete n[`${party}.${field}`]; return n; });
  };

  const setBank = (field: keyof BankAccount, value: string) => {
    setForm((f) => ({ ...f, bankAccount: { ...f.bankAccount, [field]: value } }));
    setFieldErrors((e) => { const n = { ...e }; delete n[`bank.${field}`]; return n; });
  };

  const setLineItem = (id: string, field: keyof LineItem, value: string) => {
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.map((li) => (li.id === id ? { ...li, [field]: value } : li)),
    }));
    setFieldErrors((e) => { const n = { ...e }; delete n[`item.${id}.${field}`]; return n; });
  };

  const addItem = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, newLineItem()] }));
  const removeItem = (id: string) =>
    setForm((f) => ({ ...f, lineItems: f.lineItems.filter((li) => li.id !== id) }));

  const total = form.lineItems.reduce(
    (sum, li) => sum + (parseFloat(li.quantity) || 0) * (parseFloat(li.unitPrice) || 0),
    0,
  );

  // --- validation ---
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

  const validateStep2 = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.invoiceNumber.trim()) errs['invoiceNumber'] = 'field_required';
    if (!isValidDate(form.issueDate)) errs['issueDate'] = 'invalid_date';
    if (!isValidDate(form.dueDate)) errs['dueDate'] = 'invalid_date';
    if (isValidDate(form.issueDate) && isValidDate(form.dueDate) && form.dueDate < form.issueDate)
      errs['dueDate'] = 'due_before_issue';
    const partyFields: (keyof TradeParty)[] = ['name', 'street', 'zip', 'city', 'country'];
    for (const p of ['seller', 'buyer'] as const) {
      for (const f of partyFields) {
        if (!form[p][f]?.trim()) errs[`${p}.${f}`] = 'field_required';
      }
    }
    const { bankName, iban, bic } = form.bankAccount;
    const bankFilled = [bankName, iban, bic].filter((x) => x.trim()).length;
    if (bankFilled > 0 && bankFilled < 3) errs['bank'] = 'bank_fields_incomplete';
    return errs;
  };

  const validateStep3 = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    form.lineItems.forEach((li) => {
      if (!li.description.trim()) errs[`item.${li.id}.description`] = 'field_required';
      const q = parseFloat(li.quantity);
      if (isNaN(q) || q <= 0) errs[`item.${li.id}.quantity`] = 'invalid_quantity';
      const p = parseFloat(li.unitPrice);
      if (isNaN(p) || p <= 0) errs[`item.${li.id}.unitPrice`] = 'invalid_price';
      const v = parseFloat(li.vatPercent);
      if (isNaN(v) || v < 0 || v > 100) errs[`item.${li.id}.vatPercent`] = 'invalid_vat';
    });
    return errs;
  };

  // --- submit ---
  const handleGenerate = async () => {
    const errs = validateStep3();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const pdf = await generateInvoicePdf(form, token ?? '');
      navigation.navigate('InvoicePdfPreview', {
        localUri: pdf.localUri,
        invoiceNumber: form.invoiceNumber,
      });
    } catch (err: unknown) {
      const key = err instanceof Error ? err.message : 'error_pdf_generation_failed';
      setError(t(key as Parameters<typeof t>[0]) ?? key);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setGenerating(false);
    }
  };

  // --- nav ---
  const toggleContact = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleBack = () => {
    if (step === 'items') setStep('invoice-details');
    else if (step === 'invoice-details') setStep('recipients');
    else navigation.goBack();
  };

  const handleContinueFromRecipients = () => {
    const selected = CONTACTS.find((c) => selectedIds.includes(c.id));
    if (selected) {
      setForm((f) => ({
        ...f,
        buyer: { ...f.buyer, name: f.buyer.name || selected.name },
      }));
    }
    setStep('invoice-details');
  };

  // --- field component ---
  const Field = ({
    label,
    value,
    onChangeText,
    placeholder,
    errorKey,
    keyboard,
    optional,
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    errorKey?: string;
    keyboard?: 'default' | 'decimal-pad';
    optional?: boolean;
  }) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional ? <Text style={styles.optional}> ({t('vat_id').split('(')[1]?.replace(')', '') ?? 'optional'})</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, errorKey ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.gray400}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize="sentences"
      />
      {errorKey ? (
        <Text style={styles.fieldErrorText}>{t(errorKey as Parameters<typeof t>[0]) ?? errorKey}</Text>
      ) : null}
    </View>
  );

  const PartySection = ({ party }: { party: 'seller' | 'buyer' }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{party === 'seller' ? t('seller_details') : t('buyer_details')}</Text>
      <Field label={t('name')} value={form[party].name} onChangeText={(v) => setParty(party, 'name', v)} errorKey={fieldErrors[`${party}.name`]} />
      <Field label={t('street')} value={form[party].street} onChangeText={(v) => setParty(party, 'street', v)} errorKey={fieldErrors[`${party}.street`]} />
      <View style={styles.row}>
        <View style={{ flex: 0.4 }}>
          <Field label={t('zip')} value={form[party].zip} onChangeText={(v) => setParty(party, 'zip', v)} errorKey={fieldErrors[`${party}.zip`]} />
        </View>
        <View style={{ flex: 0.6 }}>
          <Field label={t('city')} value={form[party].city} onChangeText={(v) => setParty(party, 'city', v)} errorKey={fieldErrors[`${party}.city`]} />
        </View>
      </View>
      <Field label={t('country')} value={form[party].country} onChangeText={(v) => setParty(party, 'country', v)} errorKey={fieldErrors[`${party}.country`]} placeholder="DE" />
      <Field label={t('vat_id')} value={form[party].vatId ?? ''} onChangeText={(v) => setParty(party, 'vatId', v)} optional />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('send_invoice')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {[0, 1, 2].map((i) => {
          const stepIdx = ['recipients', 'invoice-details', 'items'].indexOf(step);
          return (
            <React.Fragment key={i}>
              <View style={[styles.stepDot, i <= stepIdx && styles.stepDotActive]} />
              {i < 2 && <View style={[styles.stepLine, i < stepIdx && styles.stepLineActive]} />}
            </React.Fragment>
          );
        })}
      </View>

      {/* Error banner */}
      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={() => setError(null)}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.white} />
          <Text style={styles.errorBannerText}>{error}</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1: Recipients ── */}
        {step === 'recipients' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('select_recipients')}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('search_contacts')}
              placeholderTextColor={colors.gray500}
            />
            <Text style={styles.subLabel}>{t('contacts')}</Text>
            {CONTACTS.map((contact) => (
              <TouchableOpacity
                key={contact.id}
                style={[styles.contactRow, selectedIds.includes(contact.id) && styles.contactRowSelected]}
                onPress={() => toggleContact(contact.id)}
                activeOpacity={0.85}
              >
                <View style={styles.contactIcon}>
                  <Ionicons
                    name={contact.isGroup ? 'people-outline' : 'person-outline'}
                    size={18}
                    color={selectedIds.includes(contact.id) ? colors.primary : colors.gray600}
                  />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactEmail}>
                    {contact.isGroup ? `${contact.count} ${t('members')}` : contact.email}
                  </Text>
                </View>
                <View style={[styles.checkbox, selectedIds.includes(contact.id) && styles.checkboxSelected]}>
                  {selectedIds.includes(contact.id) && (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Step 2: Invoice Details ── */}
        {step === 'invoice-details' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('invoice_details')}</Text>

            <View style={styles.section}>
              <Field
                label={t('invoice_number')}
                value={form.invoiceNumber}
                onChangeText={(v) => { setForm((f) => ({ ...f, invoiceNumber: v })); setFieldErrors((e) => { const n = { ...e }; delete n['invoiceNumber']; return n; }); }}
                errorKey={fieldErrors['invoiceNumber']}
              />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('issue_date_label')}
                    value={form.issueDate}
                    onChangeText={(v) => { setForm((f) => ({ ...f, issueDate: v })); setFieldErrors((e) => { const n = { ...e }; delete n['issueDate']; return n; }); }}
                    placeholder="YYYY-MM-DD"
                    errorKey={fieldErrors['issueDate']}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('due_date_label')}
                    value={form.dueDate}
                    onChangeText={(v) => { setForm((f) => ({ ...f, dueDate: v })); setFieldErrors((e) => { const n = { ...e }; delete n['dueDate']; return n; }); }}
                    placeholder="YYYY-MM-DD"
                    errorKey={fieldErrors['dueDate']}
                  />
                </View>
              </View>
              <Field
                label={t('currency')}
                value={form.currency}
                onChangeText={(v) => setForm((f) => ({ ...f, currency: v.toUpperCase() }))}
                placeholder="EUR"
              />
            </View>

            <PartySection party="seller" />
            <PartySection party="buyer" />

            {/* Bank Account */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('bank_details')}</Text>
              {fieldErrors['bank'] && (
                <Text style={styles.fieldErrorText}>{t('bank_fields_incomplete')}</Text>
              )}
              <Field label={t('bank_name')} value={form.bankAccount.bankName} onChangeText={(v) => setBank('bankName', v)} optional />
              <Field label={t('iban')} value={form.bankAccount.iban} onChangeText={(v) => setBank('iban', v)} optional />
              <Field label={t('bic')} value={form.bankAccount.bic} onChangeText={(v) => setBank('bic', v)} optional />
            </View>

            {/* Footer */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('footer_text')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.footerText}
                onChangeText={(v) => setForm((f) => ({ ...f, footerText: v }))}
                placeholder={t('footer_text')}
                placeholderTextColor={colors.gray400}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {/* ── Step 3: Line Items ── */}
        {step === 'items' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>{t('invoice_items')}</Text>
            {form.lineItems.map((item, idx) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemLabel}>Item {idx + 1}</Text>
                  {form.lineItems.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.fieldWrap}>
                  <TextInput
                    style={[styles.input, fieldErrors[`item.${item.id}.description`] ? styles.inputError : null]}
                    placeholder={t('service_product')}
                    placeholderTextColor={colors.gray400}
                    value={item.description}
                    onChangeText={(v) => setLineItem(item.id, 'description', v)}
                  />
                  {fieldErrors[`item.${item.id}.description`] && (
                    <Text style={styles.fieldErrorText}>{t('field_required')}</Text>
                  )}
                </View>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={[styles.input, fieldErrors[`item.${item.id}.quantity`] ? styles.inputError : null]}
                        placeholder={t('quantity')}
                        placeholderTextColor={colors.gray400}
                        value={item.quantity}
                        onChangeText={(v) => setLineItem(item.id, 'quantity', v)}
                        keyboardType="decimal-pad"
                      />
                      {fieldErrors[`item.${item.id}.quantity`] && (
                        <Text style={styles.fieldErrorText}>{t('invalid_quantity')}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={[styles.input, fieldErrors[`item.${item.id}.unitPrice`] ? styles.inputError : null]}
                        placeholder={`${t('unit_price')} (€)`}
                        placeholderTextColor={colors.gray400}
                        value={item.unitPrice}
                        onChangeText={(v) => setLineItem(item.id, 'unitPrice', v)}
                        keyboardType="decimal-pad"
                      />
                      {fieldErrors[`item.${item.id}.unitPrice`] && (
                        <Text style={styles.fieldErrorText}>{t('invalid_price')}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flex: 0.8 }}>
                    <View style={styles.fieldWrap}>
                      <TextInput
                        style={[styles.input, fieldErrors[`item.${item.id}.vatPercent`] ? styles.inputError : null]}
                        placeholder={t('vat_percent')}
                        placeholderTextColor={colors.gray400}
                        value={item.vatPercent}
                        onChangeText={(v) => setLineItem(item.id, 'vatPercent', v)}
                        keyboardType="decimal-pad"
                      />
                      {fieldErrors[`item.${item.id}.vatPercent`] && (
                        <Text style={styles.fieldErrorText}>{t('invalid_vat')}</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addItemText}>{t('add_item')}</Text>
            </TouchableOpacity>

            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>{t('total_amount')}</Text>
              <Text style={styles.totalValue}>€{total.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {step === 'recipients' && (
          <TouchableOpacity
            style={[styles.ctaBtn, selectedIds.length === 0 && styles.ctaBtnDisabled]}
            onPress={handleContinueFromRecipients}
            disabled={selectedIds.length === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>{t('continue_with', { count: selectedIds.length })}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.black} />
          </TouchableOpacity>
        )}
        {step === 'invoice-details' && (
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => {
              const errs = validateStep2();
              if (Object.keys(errs).length > 0) {
                setFieldErrors(errs);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
                return;
              }
              setFieldErrors({});
              setStep('items');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>{t('continue')}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.black} />
          </TouchableOpacity>
        )}
        {step === 'items' && (
          <TouchableOpacity
            style={[styles.ctaBtn, generating && styles.ctaBtnDisabled]}
            onPress={handleGenerate}
            disabled={generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={16} color={colors.black} />
                <Text style={styles.ctaBtnText}>{t('generate_pdf')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gray300 },
  stepDotActive: { backgroundColor: colors.primary },
  stepLine: { width: 60, height: 2, backgroundColor: colors.gray200 },
  stepLineActive: { backgroundColor: colors.primary },
  stepContent: { padding: spacing.md },
  stepTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.md },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.gray600, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: spacing.sm },
  fieldWrap: { marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.gray600, marginBottom: 4 },
  optional: { fontWeight: '400', color: colors.gray400 },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  inputError: { borderColor: colors.error },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  fieldErrorText: { fontSize: 11, color: colors.error, marginTop: 2 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error,
    marginHorizontal: spacing.md,
    marginBottom: 4,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.white, lineHeight: 18 },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.onSurface,
    marginBottom: spacing.md,
  },
  subLabel: { fontSize: 13, fontWeight: '600', color: colors.gray600, marginBottom: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    marginBottom: 8,
  },
  contactRowSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}08` },
  contactIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  contactEmail: { fontSize: 12, color: colors.gray600, marginTop: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.gray300, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  itemCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemLabel: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: `${colors.primary}40`,
    borderStyle: 'dashed',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  addItemText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  totalCard: { backgroundColor: colors.onSurface, borderRadius: radius.xl, padding: spacing.md, alignItems: 'center' },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  totalValue: { fontSize: 32, fontWeight: '800', color: colors.white },
  bottomBar: { padding: spacing.md, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.gray200 },
  ctaBtn: { backgroundColor: colors.primary, borderRadius: radius.full, padding: spacing.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
});
