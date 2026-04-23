-- =========================================================================
-- PharmaFlow Supabase Initial Schema
-- =========================================================================

-- 1. Profiles Table (Extends Supabase Auth Auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'Clerk' CHECK (role IN ('Admin', 'Accountant', 'Clerk')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id TEXT DEFAULT 'DEFAULT_TENANT'
);

-- 2. Products / Medicines
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT,
    price NUMERIC DEFAULT 0,
    cost NUMERIC DEFAULT 0,
    stock INTEGER DEFAULT 0,
    category TEXT,
    branch_id TEXT DEFAULT 'MAIN-BRANCH',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3. Invoices (Sales & Purchases Base)
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    type TEXT CHECK (type IN ('sale', 'purchase', 'return')),
    status TEXT DEFAULT 'Posted',
    total_amount NUMERIC DEFAULT 0,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    branch_id TEXT DEFAULT 'MAIN-BRANCH',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Journal Entries (Accounting)
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id TEXT PRIMARY KEY,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT,
    source_id TEXT,
    partner_id TEXT,
    total_debit NUMERIC DEFAULT 0,
    total_credit NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Audit Log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id TEXT PRIMARY KEY,
    table_name TEXT,
    change_type TEXT,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security) - Basic Setup allowing authenticated users
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Allow authenticated users access)
CREATE POLICY "Allow authenticated full access to profiles" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to products" ON public.products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to invoices" ON public.invoices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to customers" ON public.customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to suppliers" ON public.suppliers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to journal_entries" ON public.journal_entries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to audit_log" ON public.audit_log FOR ALL USING (auth.role() = 'authenticated');

-- Auth Trigger to auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (new.id, new.email, split_part(new.email, '@', 1), 'Admin');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
