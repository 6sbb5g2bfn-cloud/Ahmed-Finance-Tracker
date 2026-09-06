import {
  Landmark, Banknote, CreditCard, Wallet, PiggyBank, Coins, Building2, TrendingUp, Gem,
  Utensils, ShoppingCart, ShoppingBag, Fuel, Car, Coffee, Film, Heart, Zap, Gift,
  Briefcase, Laptop, CircleDollarSign, Home, Repeat, User, MoreHorizontal, Tag,
} from "lucide-react";

/* =========================================================================
   THEME TOKENS — "Ledger" design system.
   Ink (deep forest-black) + Paper (warm ivory) with three functional
   accents: green = money in, brick = money out, brass = savings/goals.
   ========================================================================= */
export const LIGHT = {
  bg: "#F6F3EC", bgAlt: "#EFEAE0", card: "#FCFAF5", ink: "#182722",
  hero: "#182722", heroText: "#F6F3EC", text: "#1C2B25", textSoft: "#5B6961",
  textFaint: "#8B968E", line: "#DAD4C4", lineStrong: "#C4BCA6",
  green: "#2C6B49", greenSoft: "#E4EEE6", red: "#A24334", redSoft: "#F3E4DF",
  gold: "#A87A2E", goldSoft: "#F0E6D2", blue: "#3A5A78", blueSoft: "#E4EAF0",
  plum: "#75577F", teal: "#3D7A76",
};
export const DARK = {
  bg: "#101B16", bgAlt: "#16221C", card: "#18251F", ink: "#0C1512",
  hero: "#E9E4D6", heroText: "#152018", text: "#EDE9DD", textSoft: "#A6AFA5",
  textFaint: "#71796F", line: "#2A362F", lineStrong: "#3A473F",
  green: "#5FA47D", greenSoft: "#1C2E24", red: "#D68870", redSoft: "#332019",
  gold: "#D9B571", goldSoft: "#332A16", blue: "#8BA9C4", blueSoft: "#1B2731",
  plum: "#A98FB3", teal: "#6FADA8",
};

export const FONT_DISPLAY = "'Fraunces', Georgia, serif";
export const FONT_UI = "'IBM Plex Sans', -apple-system, sans-serif";

export const CURRENCIES = ["SAR", "USD", "EUR", "GBP", "AED", "EGP", "KWD"];

export const FREQUENCIES = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
];


export const ACCOUNT_TYPES = [
  { id: "bank", label: "Bank", icon: Landmark },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "credit", label: "Credit Card", icon: CreditCard },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "savings", label: "Savings", icon: PiggyBank },
];

export const ASSET_TYPES = [
  { id: "gold", label: "Gold", icon: Coins },
  { id: "property", label: "Property", icon: Building2 },
  { id: "stocks", label: "Stocks", icon: TrendingUp },
  { id: "other", label: "Other", icon: Gem },
];

export const COMMITMENT_TYPES = [
  { id: "subscription", label: "Subscription" },
  { id: "bill", label: "Bill" },
  { id: "fixed", label: "Fixed commitment" },
  { id: "other", label: "Other" },
];

export const ICONS = {
  Utensils, ShoppingCart, ShoppingBag, Fuel, Car, Coffee, Film, Heart, Zap, Gift, Briefcase, Laptop,
  PiggyBank, CircleDollarSign, Home, Repeat, User, MoreHorizontal, Tag, Wallet, CreditCard,
};

// Default categories seeded into a brand-new account on first sign-in.
// (No id here — Postgres assigns a real uuid on insert.)
export const DEFAULT_CATEGORIES = [
  { name: "Food", type: "expense", icon: "Utensils", core: true },
  { name: "Groceries", type: "expense", icon: "ShoppingCart", core: true },
  { name: "Restaurants", type: "expense", icon: "Utensils", core: true },
  { name: "Fuel", type: "expense", icon: "Fuel", core: true },
  { name: "Coffee", type: "expense", icon: "Coffee", core: true },
  { name: "Transportation", type: "expense", icon: "Car", core: true },
  { name: "Shopping", type: "expense", icon: "ShoppingBag", core: true },
  { name: "Bills", type: "expense", icon: "Zap", core: true },
  { name: "Healthcare", type: "expense", icon: "Heart", core: true },
  { name: "Entertainment", type: "expense", icon: "Film", core: true },
  { name: "Personal", type: "expense", icon: "User", core: true },
  { name: "Housing", type: "expense", icon: "Home", core: true },
  { name: "Subscriptions", type: "expense", icon: "Repeat", core: true },
  { name: "Savings", type: "expense", icon: "PiggyBank", core: true },
  { name: "Debt Payment", type: "expense", icon: "CircleDollarSign", core: true },
  { name: "Other", type: "expense", icon: "MoreHorizontal", core: true },
  { name: "Salary", type: "income", icon: "Briefcase", core: true },
  { name: "Freelance", type: "income", icon: "Laptop", core: true },
  { name: "Gifts", type: "income", icon: "Gift", core: true },
  { name: "Other Income", type: "income", icon: "MoreHorizontal", core: true },
];

export const STORAGE_KEY = "finance-app-state-v1"; // unused now, kept only for import-file backward-compat checks
