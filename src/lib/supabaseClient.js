import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey || url.includes("YOUR-PROJECT-REF")) {
  // Fails loudly at startup instead of a confusing runtime error later —
  // see README.md for how to create these values.
  // eslint-disable-next-line no-console
  console.error(
    "Missing Supabase credentials. Copy .env.example to .env.local and fill in " +
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings."
  );
}

export const supabase = createClient(url, anonKey);
