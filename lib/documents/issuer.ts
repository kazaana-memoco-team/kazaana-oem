/**
 * Issuer (発行元) configuration shown on every document.
 * Edit here when company info changes.
 */
export const ISSUER = {
  company: "株式会社KAZAANA",
  brandTagline: "Beautiful Crafts Online Store",
  representative: "代表取締役 樫村健太郎",
  postalCode: "〒104-0031",
  address: "東京都中央区京橋1-1-5 セントラルビル2階",

  /** Bank info shown on invoices */
  bank: {
    name: "",
    branch: "",
    accountType: "",
    accountNumber: "",
    accountHolder: "",
  },

  /** Adequate-invoice (qualified invoice) registration number */
  invoiceRegistrationNumber: "",
};

export const TAX_RATE = 0.1; // 10% 消費税
