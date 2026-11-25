import React, { useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useData } from '../context/DataContext';
import { Invoice, InvoiceLineItem } from '../types/visibyl';
import { formatDate, formatNaira, todayISO } from '../utils/formatters';

export const InvoicesView: React.FC<{ initialSelectedId?: string | null }> = ({ initialSelectedId }) => {
  const { customers, projects, projectFinancials, invoices, settings, createInvoice } = useData();

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(() =>
    initialSelectedId ? invoices.find((i) => i.id === initialSelectedId) || null : invoices[0] || null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const invoiceSheetRef = useRef<HTMLDivElement>(null);

  const [customerId, setCustomerId] = useState('');
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

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    const project = projects.find((p) => p.id === projectId);
    setSaving(true);
    try {
      const created = await createInvoice({
        customer,
        project,
        issueDate,
        dueDate,
        items: items.filter((i) => i.description.trim() && i.total >= 0),
        amountPaid: Number(amountPaid || 0),
        notes,
      });
      setSelectedInvoice(created);
      setShowCreateModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceSheetRef.current || !selectedInvoice) return;
    setDownloadingPdf(true);
    try {
      const dataUrl = await toPng(invoiceSheetRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const props = pdf.getImageProperties(dataUrl);
      const imgHeight = (props.height * pageWidth) / props.width;
      pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, imgHeight);
      pdf.save(`${selectedInvoice.invoiceNumber}.pdf`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const shareWhatsApp = (inv: Invoice) => {
    const text = encodeURIComponent(
      `OFFICIAL INVOICE — VISIBYL TECHNOLOGIES\n` +
        `Invoice No: ${inv.invoiceNumber}\n` +
        `Client: ${inv.customerBusinessName || inv.customerName}\n` +
        `Total Charged: ${formatNaira(inv.totalAmount)}\n` +
        `Amount Paid: ${formatNaira(inv.amountPaid)}\n` +
        `Outstanding Balance: ${formatNaira(inv.outstandingBalance)}\n` +
        `Payment Due: ${formatDate(inv.dueDate)}\n\n` +
        `PAYMENT INFORMATION:\n` +
        `Account Name: ${settings.bankAccountName}\n` +
        `Bank: ${settings.bankName}\n` +
        `Account Number: ${settings.bankAccountNumber}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
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
            setCustomerId(customers[0]?.id || '');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Generate Invoice</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Invoice List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
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
        <div className="lg:col-span-8 space-y-4">
          {!selectedInvoice ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <p className="text-sm font-semibold text-slate-700">Select or generate an invoice to preview</p>
            </div>
          ) : (
            <>
              {/* Action Toolbar */}
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 no-print">
                <span className="text-xs font-mono-tabular font-bold text-slate-700">
                  {selectedInvoice.invoiceNumber}
                </span>
                <div className="flex flex-wrap items-center gap-2">
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
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
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

              {/* Official A4 Corporate Invoice Sheet */}
              <div
                ref={invoiceSheetRef}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm print-only-sheet"
              >
                {/* Top Corporate Royal Blue Header */}
                <div className="bg-[#0144D8] px-8 py-7 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <BrandLogo variant="full" className="h-14 sm:h-16 w-auto" />
                  <div className="sm:text-right">
                    <p className="text-xs uppercase tracking-widest text-blue-200 font-semibold">Official Invoice</p>
                    <p className="text-xl font-bold font-mono-tabular mt-0.5">{selectedInvoice.invoiceNumber}</p>
                    <p className="text-xs text-blue-100 mt-1">Status: {selectedInvoice.status}</p>
                  </div>
                </div>

                <div className="p-8 space-y-8">
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
                      <p className="text-xs text-slate-600 mt-1">{selectedInvoice.customerEmail}</p>
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
                      <p className="text-slate-600">{settings.companyEmail} · {settings.companyPhone}</p>
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
                    <table className="w-full text-left border-collapse">
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
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
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
              <h3 className="text-base font-bold text-slate-900">Generate Corporate Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateInvoice} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer *</label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName} ({c.customerCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Linked Project (Optional)</label>
                  <select
                    value={projectId}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">None</option>
                    {projects
                      .filter((p) => !customerId || p.customerId === customerId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.projectCode} — {p.title}
                        </option>
                      ))}
                  </select>
                </div>
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
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  {saving ? 'Issuing Invoice...' : 'Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
