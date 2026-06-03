import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uxwwirucwwusztmewrkd.supabase.co';
const supabaseAnonKey = 'sb_publishable_4rXs1zmwe3fCkb8Dm7pYjA_L3A6ZLN6';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
