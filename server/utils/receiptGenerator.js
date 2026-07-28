/**
 * utils/receiptGenerator.js — Generates a PDF receipt for a payment
 * Requires: npm install pdfkit
 */
const PDFDocument = require('pdfkit');

/**
 * Generates a receipt PDF and returns it as a Buffer.
 * @param {Object} payment - Payment document (populated with plan, amount, etc.)
 * @param {Object} player - Player document (username, email)
 * @returns {Promise<Buffer>}
 */
function generateReceiptPDF(payment, player) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const amountRupees = (payment.amount / 100).toFixed(2);

      // ── Header ─────────────────────────────────────────────────────────────────
      doc.fontSize(22).fillColor('#16a34a').font('Helvetica-Bold')
        .text('DEAD OR ALIVE', 50, 50);
      doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
        .text('LOGIC ESCAPE', 50, 78);

      doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold')
        .text('PAYMENT RECEIPT', 50, 120);

      // ── Receipt meta box ─────────────────────────────────────────────────────────
      doc.rect(50, 150, 495, 85).stroke('#e5e7eb');
      doc.fontSize(9).fillColor('#6b7280').font('Helvetica');
      doc.text('Receipt Number', 65, 165);
      doc.text('Date', 300, 165);
      doc.fontSize(11).fillColor('#111827').font('Helvetica-Bold');
      doc.text(payment.receiptNumber || 'N/A', 65, 178);
      doc.text(new Date(payment.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }), 300, 178);

      doc.fontSize(9).fillColor('#6b7280').font('Helvetica');
      doc.text('Payment ID', 65, 200);
      doc.fontSize(10).fillColor('#111827').font('Helvetica');
      doc.text(payment.razorpayPaymentId || 'N/A', 65, 212);

      // ── Bill to ──────────────────────────────────────────────────────────────────
      doc.fontSize(9).fillColor('#6b7280').font('Helvetica').text('BILLED TO', 50, 245);
      doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text(player.username, 50, 260);
      doc.fontSize(10).fillColor('#6b7280').font('Helvetica').text(player.email, 50, 277);

      // ── Line item table ──────────────────────────────────────────────────────────
      const tableTop = 320;
      doc.rect(50, tableTop, 495, 25).fill('#f3f4f6');
      doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold');
      doc.text('DESCRIPTION', 65, tableTop + 8);
      doc.text('DURATION', 320, tableTop + 8);
      doc.text('AMOUNT', 460, tableTop + 8);

      const rowY = tableTop + 35;
      doc.fillColor('#111827').fontSize(10).font('Helvetica');
      doc.text(`${payment.plan.toUpperCase()} Subscription`, 65, rowY);
      doc.text(`${payment.durationDays} days`, 320, rowY);
      doc.text(`Rs. ${amountRupees}`, 460, rowY);

      doc.moveTo(50, rowY + 25).lineTo(545, rowY + 25).stroke('#e5e7eb');

      // ── Total ────────────────────────────────────────────────────────────────────
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827');
      doc.text('Total Paid', 350, rowY + 40);
      doc.fontSize(16).fillColor('#16a34a');
      doc.text(`Rs. ${amountRupees}`, 460, rowY + 38);

      // ── Subscription period ──────────────────────────────────────────────────────
      if (payment.subscriptionStart && payment.subscriptionEnd) {
        doc.fontSize(9).fillColor('#6b7280').font('Helvetica');
        doc.text(
          `Subscription active: ${new Date(payment.subscriptionStart).toLocaleDateString('en-IN')} — ${new Date(payment.subscriptionEnd).toLocaleDateString('en-IN')}`,
          50, rowY + 75
        );
      }

      // ── Status badge ─────────────────────────────────────────────────────────────
      const statusColor = payment.status === 'paid' ? '#16a34a' : payment.status === 'refunded' ? '#dc2626' : '#6b7280';
      doc.fontSize(9).fillColor(statusColor).font('Helvetica-Bold');
      doc.text(`STATUS: ${payment.status.toUpperCase()}`, 50, rowY + 95);

      // ── Footer ───────────────────────────────────────────────────────────────────
      doc.fontSize(8).fillColor('#9ca3af').font('Helvetica');
      doc.text(
        'This is a computer-generated receipt and does not require a signature.\nFor support, contact support@dead-or-alive.io',
        50, 700, { width: 495, align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateReceiptPDF };
