import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import {
  Download,
  FileSpreadsheet,
  Landmark,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useData } from '../context/DataContext';
import { Invoice, InvoiceLineItem } from '../types/visibyl';
import { formatDate, formatNaira, todayISO } from '../utils/formatters';

export const InvoicesView: React.FC<{ initialSelectedId?: string | null }> = ({ initialSelectedId }) => {
  const { customers, projects, projectFinancials, invoices, leads, payments, settings, createInvoice, updateInvoice, deleteInvoice } = useData();
  const { isSuperAdmin } = useAuth();

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(() =>
    initialSelectedId ? invoices.find((i) => i.id === initialSelectedId) || null : null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const invoiceSheetRef = useRef<HTMLDivElement>(null);

  const [customerSource, setCustomerSource] = useState<'customer' | 'lead' | 'manual'>('customer');
  const [customerId, setCustomerId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [manualCustomer, setManualCustomer] = useState({ fullName: '', businessName: '', phone: '', email: '', businessAddress: '' });
  const [projectId, setProjectId] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [amountPaid, setAmountPaid] = useState('0');
  const [notes, setNotes] = useState('Thank you for choosing VISIBYL Technologies. Kindly include your Invoice Number as transfer narration.');
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { description: settings.services[0] || 'Website development', quantity: 1, unitPrice: 250000, total: 250000 },
  ]);

  const updateItem = (idx: number, patch: Partial<InvoiceLineItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.total = Number(next.quantity || 0) * Number(next.unitPrice || 0);
        return next;
      })
    );
  };

  const handleProjectSelect = (pid: string) => {
    setProjectId(pid);
    const pr = projects.find((p) => p.id === pid);
    if (pr) {
      const fin = projectFinancials.get(pr.id);
      if (fin) {
        setItems([
          {
            description: `${pr.title} (${pr.serviceType})`,
            quantity: 1,
            unitPrice: fin.agreedPrice,
            total: fin.agreedPrice,
          },
        ]);
        setAmountPaid(String(fin.totalPaid));
      }
    }
  };

  const openEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice); setCustomerSource('manual');
    setManualCustomer({ fullName: invoice.customerName, businessName: invoice.customerBusinessName || '', phone: invoice.customerPhone || '', email: invoice.customerEmail || '', businessAddress: invoice.customerAddress || '' });
    setCustomerId(''); setLeadId(''); setProjectId(''); setIssueDate(invoice.issueDate); setDueDate(invoice.dueDate);
    setAmountPaid(String(invoice.amountPaid)); setNotes(invoice.notes || ''); setItems(invoice.items.map((item) => ({ ...item })));
    setFormError(''); setShowCreateModal(true);
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice || !isSuperAdmin) return;
    if (payments.some((payment) => payment.invoiceId === selectedInvoice.id)) { setFormError('This invoice has linked payment records and cannot be deleted. Keep it for the financial audit trail.'); return; }
    if (!window.confirm(`Delete invoice ${selectedInvoice.invoiceNumber}? This cannot be undone.`)) return;
    setDeletingInvoice(true);
    try { await deleteInvoice(selectedInvoice.id); setSelectedInvoice(null); setFormError(''); }
    catch (error) { setFormError(error instanceof Error ? error.message : 'Unable to delete this invoice.'); }
    finally { setDeletingInvoice(false); }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingInvoice && !isSuperAdmin) { setFormError('Only the Super Admin can edit invoices.'); return; }
    const savedCustomer = customerSource === 'customer' ? customers.find((c) => c.id === customerId) : undefined;
    const selectedLead = customerSource === 'lead' ? leads.find((l) => l.id === leadId) : undefined;
    const invoiceCustomer = savedCustomer
      ? { id: savedCustomer.id, customerCode: savedCustomer.customerCode, fullName: savedCustomer.fullName, businessName: savedCustomer.businessName, phone: savedCustomer.phone, email: savedCustomer.email, businessAddress: savedCustomer.businessAddress, salesRepUid: savedCustomer.salesRepUid }
      : selectedLead
        ? { id: '', fullName: selectedLead.fullName, businessName: selectedLead.businessName, phone: selectedLead.phone, email: selectedLead.email, businessAddress: '', salesRepUid: selectedLead.submittedByUid }
        : customerSource === 'manual'
          ? { id: '', ...manualCustomer, salesRepUid: '' }
          : undefined;
    if (!invoiceCustomer?.fullName.trim() || !invoiceCustomer.phone.trim()) {
      setFormError('Please provide the customer name and phone number before issuing this invoice.');
      return;
    }
    const validItems = items.filter((i) => i.description.trim() && Number(i.quantity) > 0 && Number(i.unitPrice) >= 0);
    if (validItems.length === 0) {
      setFormError('Please add at least one valid invoice line item.');
      return;
    }
    const project = customerSource === 'customer' ? projects.find((p) => p.id === projectId) : undefined;
    setFormError('');
    setSaving(true);
    try {
      if (editingInvoice) {
        const updated = await updateInvoice(editingInvoice.id, { customer: invoiceCustomer, issueDate, dueDate, items: validItems, notes });
        setSelectedInvoice(updated);
      } else {
        const created = await createInvoice({ customer: invoiceCustomer, project, issueDate, dueDate, items: validItems, amountPaid: Number(amountPaid || 0), notes });
        if (!created?.id) throw new Error('The invoice could not be confirmed as saved. Please check Issued Invoices before trying again.');
        setSelectedInvoice(created);
      }
      setEditingInvoice(null); setShowCreateModal(false);
    } catch (error) {
      let message = error instanceof Error ? error.message : String(error);
      try {
        const parsed = JSON.parse(message);
        message = parsed.error || parsed.message || message;
      } catch {
        // Keep the original readable error when it is not JSON.
      }
      setFormError(`Invoice was not issued: ${message}. Please check your connection and try again.`);
    } finally {
      setSaving(false);
    }
  };

  const createInvoicePdf = async (invoice: Invoice) => {
    if (!invoiceSheetRef.current) throw new Error('Invoice preview is not ready.');
    const dataUrl = await toPng(invoiceSheetRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#FFFFFF' });
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const props = pdf.getImageProperties(dataUrl);
    const imageHeight = (props.height * pageWidth) / props.width;
    const pageCount = Math.max(1, Math.ceil(imageHeight / pageHeight));
    // Continue the complete invoice image onto additional A4 pages instead of cropping it.
    for (let page = 0; page < pageCount; page += 1) {
      if (page > 0) pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', 0, -(page * pageHeight), pageWidth, imageHeight);
    }
    return pdf;
  };

  const handleDownloadPdf = async () => {
    if (!selectedInvoice) return;
    setDownloadingPdf(true);
    setShareFeedback('');
    try {
      const pdf = await createInvoicePdf(selectedInvoice);
      pdf.save(`${selectedInvoice.invoiceNumber}.pdf`);
    } catch (error) {
      setShareFeedback(error instanceof Error ? error.message : 'Unable to create the invoice PDF.');
    } finally { setDownloadingPdf(false); }
  };

  const shareWhatsApp = async (invoice: Invoice) => {
    setSharingWhatsApp(true);
    setShareFeedback('');
    try {
      const pdf = await createInvoicePdf(invoice);
      const blob = pdf.output('blob');
      const file = new File([blob], `${invoice.invoiceNumber}.pdf`, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Invoice ${invoice.invoiceNumber} — VISIBYL Technologies`, text: `Please find attached invoice ${invoice.invoiceNumber} from VISIBYL Technologies.`, files: [file] });
      } else {
        pdf.save(`${invoice.invoiceNumber}.pdf`);
        setShareFeedback('The invoice PDF has been downloaded. Open WhatsApp, attach this PDF file, and send it to your customer.');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setShareFeedback(error.message || 'Unable to share the invoice PDF. Download it and attach it in WhatsApp.');
    } finally { setSharingWhatsApp(false); }
  };
  const shareEmail = (inv: Invoice) => {
    const subject = encodeURIComponent(`Invoice ${inv.invoiceNumber} — VISIBYL Technologies`);
    const body = encodeURIComponent(
      `Dear ${inv.customerName},\n\n` +
        `Please find your invoice details from VISIBYL Technologies:\n\n` +
        `Invoice Number: ${inv.invoiceNumber}\n` +
        `Issue Date: ${formatDate(inv.issueDate)}\n` +
        `Payment Deadline: ${formatDate(inv.dueDate)}\n` +
        `Total Amount: ${formatNaira(inv.totalAmount)}\n` +
        `Amount Already Paid: ${formatNaira(inv.amountPaid)}\n` +
        `Outstanding Balance: ${formatNaira(inv.outstandingBalance)}\n\n` +
        `Payment Information:\n` +
        `Account Name: ${settings.bankAccountName}\n` +
        `Bank: ${settings.bankName}\n` +
        `Account Number: ${settings.bankAccountNumber}\n\n` +
        `Best regards,\nVISIBYL Technologies\n"From unseen to unforgettable."`
    );
    window.location.href = `mailto:${inv.customerEmail}?subject=${subject}&body=${body}`;
  };

  const draftTotal = items.reduce((s, it) => s + Number(it.total || 0), 0);
  const draftBalance = Math.max(0, draftTotal - Number(amountPaid || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Corporate Invoices</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate official VISIBYL invoices with automatic balance math, PDF export, and WhatsApp/Email sharing.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingInvoice(null);
            setFormError('');
            setCustomerSource(customers.length ? 'customer' : leads.length ? 'lead' : 'manual');
            setCustomerId(customers[0]?.id || '');
            setLeadId('');
            setProjectId('');
            setManualCustomer({ fullName: '', businessName: '', phone: '', email: '', businessAddress: '' });
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Invoice</span>
        </button>
      </div>

      {formError && !showCreateModal && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 no-print">{formError}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
        {/* Invoice List */}
        <div className={`lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden no-print ${selectedInvoice ? 'hidden lg:block' : 'block'}`}>
          <div className="px-4 py-3.5 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800">Issued Invoices ({invoices.length})</h3>
          </div>
          {invoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No invoices created yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[720px] overflow-y-auto">
              {invoices.map((inv) => {
                const active = selectedInvoice?.id === inv.id;
                return (
                  <button
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    className={`w-full text-left p-4 transition-colors ${
                      active ? 'bg-[#F0F5FF]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-tabular font-bold text-[#0144D8]">{inv.invoiceNumber}</span>
                      <span
                        className={`font-semibold ${
                          inv.status === 'Paid'
                            ? 'text-emerald-700'
                            : inv.status === 'Overdue'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1 truncate">
                      {inv.customerBusinessName || inv.customerName}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-xs font-mono-tabular text-slate-600">
                      <span>Total: {formatNaira(inv.totalAmount)}</span>
                      <span>Bal: {formatNaira(inv.outstandingBalance)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Official Corporate Invoice Preview & Actions */}
        <div className={`lg:col-span-8 space-y-4 ${selectedInvoice ? 'block' : 'hidden lg:block'}`}>
          {!selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <p className="text-sm font-semibold text-slate-700">Select or generate an invoice to preview</p>
            </div>
          ) : (
            <>
              {/* Action Toolbar */}
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 no-print">
                <button onClick={() => setSelectedInvoice(null)} className="lg:hidden text-xs font-semibold text-[#0144D8]">← All invoices</button>
                <span className="text-xs font-mono-tabular font-bold text-slate-700">
                  {selectedInvoice.invoiceNumber}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {isSuperAdmin && <>
                    <button onClick={() => openEditInvoice(selectedInvoice)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"><Pencil className="w-3.5 h-3.5" /><span>Edit</span></button>
                    <button onClick={handleDeleteInvoice} disabled={deletingInvoice} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-semibold disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /><span>{deletingInvoice ? 'Deleting...' : 'Delete'}</span></button>
                  </>}
                  <button
                    onClick={handleDownloadPdf}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadingPdf ? 'Rendering PDF...' : 'Download PDF'}</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => shareWhatsApp(selectedInvoice)}
                    disabled={sharingWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{sharingWhatsApp ? 'Preparing PDF...' : 'WhatsApp PDF'}</span>
                  </button>
                  <button
                    onClick={() => shareEmail(selectedInvoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email</span>
                  </button>
                </div>
              </div>

              {shareFeedback && <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 no-print">{shareFeedback}</div>}

              {/* Official A4 Corporate Invoice Sheet */}
              <div
                ref={invoiceSheetRef}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm print-only-sheet w-full min-w-0"
              >
                {/* Top Corporate Royal Blue Header */}
                <div className="bg-[#0144D8] px-6 sm:px-8 py-5 sm:py-6 text-white flex flex-row items-center justify-between gap-4">
                  <BrandLogo variant="full" className="h-7 sm:h-8 w-auto max-w-[112px] sm:max-w-[140px] shrink min-w-0" />
                  <div className="sm:text-right">
                    <p className="text-xs uppercase tracking-widest text-blue-200 font-semibold">Official Invoice</p>
                    <p className="text-xl font-bold font-mono-tabular mt-0.5">{selectedInvoice.invoiceNumber}</p>
                    <p className="text-xs text-blue-100 mt-1">Status: {selectedInvoice.status}</p>
                  </div>
                </div>

                <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 min-w-0">
                  {/* Company & Client Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pb-6 border-b border-slate-200">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-bold text-[#0144D8] mb-2">Billed To</p>
                      <p className="text-base font-bold text-slate-900">
                        {selectedInvoice.customerBusinessName || selectedInvoice.customerName}
                      </p>
                      <p className="text-xs text-slate-700 mt-1">Attn: {selectedInvoice.customerName}</p>
                      {selectedInvoice.customerCode && (
                        <p className="text-xs font-mono-tabular text-slate-500 mt-0.5">
                          Client ID: {selectedInvoice.customerCode}
                        </p>
                      )}
                      <p className="text-xs text-slate-600 mt-1 break-all">{selectedInvoice.customerEmail}</p>
                      {selectedInvoice.customerPhone && (
                        <p className="text-xs text-slate-600">{selectedInvoice.customerPhone}</p>
                      )}
                      {selectedInvoice.customerAddress && (
                        <p className="text-xs text-slate-500 mt-1">{selectedInvoice.customerAddress}</p>
                      )}
                    </div>

                    <div className="sm:text-right space-y-2 text-xs">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-[#0144D8]">Issued By</p>
                      <p className="text-sm font-bold text-slate-900">{settings.companyName}</p>
                      <p className="text-slate-600">{settings.companyAddress}</p>
                      <p className="text-slate-600 break-all">{settings.companyEmail} · {settings.companyPhone}</p>
                      <div className="pt-3 space-y-1 font-mono-tabular">
                        <p className="text-slate-600">
                          Issue Date: <span className="font-semibold text-slate-900">{formatDate(selectedInvoice.issueDate)}</span>
                        </p>
                        <p className="text-slate-600">
                          Payment Deadline: <span className="font-semibold text-slate-900">{formatDate(selectedInvoice.dueDate)}</span>
                        </p>
                        {selectedInvoice.projectCode && (
                          <p className="text-slate-600">
                            Project Ref: <span className="font-semibold text-[#0144D8]">{selectedInvoice.projectCode}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div>
                    <table className="hidden md:table w-full table-fixed text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 border-[#0144D8] text-[11px] uppercase tracking-wider font-bold text-[#0144D8]">
                          <th className="py-3 pr-4">Service / Description</th>
                          <th className="py-3 px-4 text-right">Qty</th>
                          <th className="py-3 px-4 text-right">Unit Price</th>
                          <th className="py-3 pl-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs">
                        {selectedInvoice.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-3.5 pr-4 font-medium text-slate-900">{item.description}</td>
                            <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-700">{item.quantity}</td>
                            <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-700">
                              {formatNaira(item.unitPrice, true)}
                            </td>
                            <td className="py-3.5 pl-4 text-right font-mono-tabular font-bold text-slate-900">
                              {formatNaira(item.total, true)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="md:hidden space-y-3">
                      {selectedInvoice.items.map((item, idx) => <div key={idx} className="rounded-lg border border-slate-200 p-3 text-xs space-y-2">
                        <p className="font-semibold text-slate-900 break-words">{item.description}</p>
                        <div className="grid grid-cols-3 gap-2 text-slate-600">
                          <div><span className="block text-[10px] text-slate-400">Qty</span><span className="font-mono-tabular">{item.quantity}</span></div>
                          <div><span className="block text-[10px] text-slate-400">Unit Price</span><span className="font-mono-tabular break-all">{formatNaira(item.unitPrice, true)}</span></div>
                          <div><span className="block text-[10px] text-slate-400">Amount</span><span className="font-mono-tabular font-bold text-slate-900 break-all">{formatNaira(item.total, true)}</span></div>
                        </div>
                      </div>)}
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="flex justify-end">
                    <div className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Amount Charged</span>
                        <span className="font-mono-tabular font-bold text-slate-900">
                          {formatNaira(selectedInvoice.totalAmount, true)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Amount Already Paid</span>
                        <span className="font-mono-tabular font-semibold text-emerald-700">
                          {formatNaira(selectedInvoice.amountPaid, true)}
                        </span>
                      </div>
                      <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-sm font-bold text-[#0144D8]">Outstanding Balance</span>
                        <span className="text-lg font-bold font-mono-tabular text-[#0144D8]">
                          {formatNaira(selectedInvoice.outstandingBalance, true)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedInvoice.notes && (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="font-bold text-slate-800 mb-1">Notes & Terms</p>
                      <p>{selectedInvoice.notes}</p>
                    </div>
                  )}

                  {/* Permanent Payment Information Section */}
                  <div className="rounded-xl border border-[#0144D8]/25 bg-[#F0F5FF] p-5">
                    <div className="flex items-center gap-2 text-[#0144D8] mb-3">
                      <Landmark className="w-4 h-4" />
                      <h4 className="text-xs uppercase tracking-wider font-bold">Payment Information</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-blue-100 rounded-lg p-3.5">
                      <div>
                        <p className="text-[11px] text-slate-500">Account Name</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{settings.bankAccountName}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Bank</p>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">{settings.bankName}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Account Number</p>
                        <p className="text-sm font-bold font-mono-tabular text-[#0144D8] mt-0.5">
                          {settings.bankAccountNumber}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Footer */}
                <div className="px-4 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 break-words">
                  <span>{settings.companyName} · "{settings.tagline}"</span>
                  <span>{settings.companyEmail} · Official Corporate Invoice</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">{editingInvoice ? 'Edit Corporate Invoice' : 'Generate Corporate Invoice'}</h3>
              <button onClick={() => { setShowCreateModal(false); setEditingInvoice(null); }} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateInvoice} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {editingInvoice ? <div className="sm:col-span-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Editing {editingInvoice.invoiceNumber}. Amount already paid is locked to protect payment records.</div> : <>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Details Source *</label>
                  <select
                    value={customerSource}
                    onChange={(e) => { setCustomerSource(e.target.value as 'customer' | 'lead' | 'manual'); setProjectId(''); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="customer">Choose Existing Customer</option>
                    <option value="lead">Get Details from Leads</option>
                    <option value="manual">Enter Customer Details Manually</option>
                  </select>
                </div>
                {customerSource === 'customer' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Customer *</label>
                    <select required value={customerId} onChange={(e) => { setCustomerId(e.target.value); setProjectId(''); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                      <option value="">Select customer...</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.businessName || c.fullName} ({c.customerCode})</option>)}
                    </select>
                  </div>
                )}
                {customerSource === 'lead' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Lead *</label>
                    <select required value={leadId} onChange={(e) => setLeadId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                      <option value="">Choose a lead...</option>
                      {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName}{lead.businessName ? ' — ' + lead.businessName : ''} · {lead.phone}</option>)}
                    </select>
                    {leads.length === 0 && <p className="mt-1 text-xs text-amber-700">No leads are available to select.</p>}
                    {leads.find((lead) => lead.id === leadId) && <p className="mt-1 text-xs text-slate-500">Contact details will be copied from the selected lead into this invoice.</p>}
                  </div>
                )}
                {!editingInvoice && customerSource === 'manual' && (
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label className="text-xs font-semibold text-slate-700">Contact Name *<input required value={manualCustomer.fullName} onChange={(e) => setManualCustomer((v) => ({ ...v, fullName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold text-slate-700">Business Name<input value={manualCustomer.businessName} onChange={(e) => setManualCustomer((v) => ({ ...v, businessName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold text-slate-700">Phone / WhatsApp *<input required value={manualCustomer.phone} onChange={(e) => setManualCustomer((v) => ({ ...v, phone: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold text-slate-700">Email<input type="email" value={manualCustomer.email} onChange={(e) => setManualCustomer((v) => ({ ...v, email: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                    <label className="sm:col-span-2 text-xs font-semibold text-slate-700">Business Address<input value={manualCustomer.businessAddress} onChange={(e) => setManualCustomer((v) => ({ ...v, businessAddress: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                  </div>
                )}
                </>}
                {editingInvoice && <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="text-xs font-semibold text-slate-700">Contact Name *<input required value={manualCustomer.fullName} onChange={(e) => setManualCustomer((x) => ({ ...x, fullName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-semibold text-slate-700">Business Name<input value={manualCustomer.businessName} onChange={(e) => setManualCustomer((x) => ({ ...x, businessName: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-semibold text-slate-700">Phone / WhatsApp *<input required value={manualCustomer.phone} onChange={(e) => setManualCustomer((x) => ({ ...x, phone: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                  <label className="text-xs font-semibold text-slate-700">Email<input type="email" value={manualCustomer.email} onChange={(e) => setManualCustomer((x) => ({ ...x, email: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                  <label className="sm:col-span-2 text-xs font-semibold text-slate-700">Business Address<input value={manualCustomer.businessAddress} onChange={(e) => setManualCustomer((x) => ({ ...x, businessAddress: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" /></label>
                </div>}
                {customerSource === 'customer' && !editingInvoice && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Linked Project (Optional)</label>
                    <select value={projectId} onChange={(e) => handleProjectSelect(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                      <option value="">None</option>
                      {projects.filter((p) => !customerId || p.customerId === customerId).map((p) => <option key={p.id} value={p.id}>{p.projectCode} — {p.title}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date *</label>
                  <input
                    required
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Deadline *</label>
                  <input
                    required
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Line Items</label>
                  <button
                    type="button"
                    onClick={() =>
                      setItems([...items, { description: '', quantity: 1, unitPrice: 0, total: 0 }])
                    }
                    className="text-xs font-semibold text-[#0144D8] hover:underline"
                  >
                    + Add Line Item
                  </button>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      required
                      placeholder="Service or item description"
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      className="col-span-6 rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                    />
                    <input
                      required
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                      className="col-span-2 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono-tabular"
                    />
                    <input
                      required
                      type="number"
                      min={0}
                      placeholder="Unit Price ₦"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                      className="col-span-3 rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono-tabular"
                    />
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="col-span-1 p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Already Paid (₦)</label>
                  <input
                    type="number"
                    min={0}
                    value={amountPaid}
                    disabled={Boolean(editingInvoice)}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular disabled:bg-slate-100"
                  />
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col justify-center">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Total Charged:</span>
                    <span className="font-mono-tabular font-bold text-slate-900">{formatNaira(draftTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#0144D8] font-bold mt-1">
                    <span>Outstanding Balance:</span>
                    <span className="font-mono-tabular">{formatNaira(draftBalance)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setEditingInvoice(null); }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (editingInvoice ? 'Saving Changes...' : 'Issuing Invoice...') : (editingInvoice ? 'Save Changes' : 'Issue Invoice')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
