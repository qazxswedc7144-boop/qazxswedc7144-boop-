import { supabase } from "@/lib/supabase";

export interface InvoiceItem {
  product_id: string;
    quantity: number;
      unit_price: number;
      }

      /**
       * محرك الفواتير المطور لربط PharmaFlow بـ Supabase
        */
        export const invoiceService = {
          async createInvoice(customerId: string, items: InvoiceItem[], total: number) {
              try {
                    // 1. إدخال الفاتورة الأساسية
                          const { data: sale, error: saleError } = await supabase
                                  .from('sales')
                                          .insert([{ 
                                                    customer_id: customerId, 
                                                              total_amount: total,
                                                                        status: 'completed' 
                                                                                }])
                                                                                        .select()
                                                                                                .single();

                                                                                                      if (saleError) throw saleError;

                                                                                                            // 2. إدخال تفاصيل المنتجات (Items) وربطها برقم الفاتورة
                                                                                                                  const saleItems = items.map(item => ({
                                                                                                                          sale_id: sale.id,
                                                                                                                                  product_id: item.product_id,
                                                                                                                                          quantity: item.quantity,
                                                                                                                                                  unit_price: item.unit_price
                                                                                                                                                        }));

                                                                                                                                                              const { error: itemsError } = await supabase
                                                                                                                                                                      .from('sale_items')
                                                                                                                                                                              .insert(saleItems);

                                                                                                                                                                                    if (itemsError) throw itemsError;

                                                                                                                                                                                          return { success: true, saleId: sale.id };
                                                                                                                                                                                              } catch (error: any) {
                                                                                                                                                                                                    console.error("Database Error:", error.message);
                                                                                                                                                                                                          return { success: false, error: error.message };
                                                                                                                                                                                                              }
                                                                                                                                                                                                                }
                                                                                                                                                                                                                };
                                                                                                                                                                                                                