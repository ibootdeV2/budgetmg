// ============================================================================
// lib/export.js
// Phase 6 : Fonctionnalités SaaS avancées — export PDF / Excel
// ============================================================================
// Tout se passe côté client (pas d'appel serveur), donc ça fonctionne aussi
// hors-ligne : cohérent avec l'esprit offline-first de l'application.
// ============================================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatMGA } from "@/lib/budgetCategories";

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

/** Exporte une liste de transactions en PDF (tableau + total). */
export function exportTransactionsToPDF(transactions, { title = "Transactions" } = {}) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 24);

  const rows = transactions.map((t) => [
    formatDate(t.date),
    t.description,
    t.category,
    t.type,
    `${t.type === "Revenu" ? "+" : "-"}${formatMGA(t.amount)}`,
  ]);

  const total = transactions.reduce((s, t) => s + (t.type === "Revenu" ? t.amount : -t.amount), 0);

  autoTable(doc, {
    startY: 30,
    head: [["Date", "Description", "Catégorie", "Type", "Montant"]],
    body: rows,
    foot: [["", "", "", "Solde", formatMGA(total)]],
    headStyles: { fillColor: [30, 41, 59] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    styles: { fontSize: 9 },
  });

  doc.save(`transactions-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Exporte une liste de transactions en fichier Excel (.xlsx). */
export function exportTransactionsToExcel(transactions, { sheetName = "Transactions" } = {}) {
  const rows = transactions.map((t) => ({
    Date: formatDate(t.date),
    Description: t.description,
    Catégorie: t.category,
    Type: t.type,
    "Montant (MGA)": t.type === "Revenu" ? t.amount : -t.amount,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 16 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
