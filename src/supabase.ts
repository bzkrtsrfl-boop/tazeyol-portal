import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://apmvqvqkbvhhbdycsxnn.supabase.co';
const supabaseKey = 'sb_publishable_YcNXpz5sLyW1lgzL52uxuA_ZnBIweD7';

export const supabase = createClient(supabaseUrl, supabaseKey);
