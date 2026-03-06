// Customer Self-Ordering Interface
// State machine: menu → cart → confirm → paying
//
// Accessed via QR code URL:
//   /customer?shop=<shopId>&table=<tableNumber>
//
// Uses the anon Supabase client — no authentication required.
// RLS policies allow anon to read menu and insert customer orders.

import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseCustomer } from '../../src/lib/supabase-customer';
import { generatePromptPayPayload, generateQRReference } from '../../src/lib/qr';
import { Colors } from '../../constants/colors';
import QRCode from 'react-native-qrcode-svg';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
  category_id: string | null;
  is_active: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

interface CartEntry {
  item: MenuItem;
  qty: number;
}

type ScreenState = 'loading' | 'error' | 'menu' | 'cart' | 'confirm' | 'paying' | 'success';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return '฿' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerOrderScreen() {
  const params = useLocalSearchParams<{ shop?: string; table?: string }>();
  const shopId = params.shop ?? '';
  const tableNumber = params.table ?? '';

  const { width } = useWindowDimensions();
  const isWide = width > 600;

  // ── state machine ──
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [error, setError] = useState('');

  // ── data ──
  const [shopName, setShopName] = useState('');
  const [promptpayId, setPromptpayId] = useState('');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── order tracking ──
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  // confirmedItems = items already sent to kitchen (read-only display until payment success)
  const [confirmedItems, setConfirmedItems] = useState<CartEntry[]>([]);
  const [qrPayload, setQrPayload] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | 'expired'>('pending');
  const [qrTimeLeft, setQrTimeLeft] = useState(300); // 5-minute QR countdown
  const [orderStatus, setOrderStatus] = useState<string>('pending'); // kitchen status feedback

  // ── simple confirm / alert helpers ──────────────────────────────────────
  // On web, use native browser dialog (always works, no render blocking).
  // On native, use Alert.alert (React Native standard).
  function webConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm(`${title}\n\n${message}`));
      } else {
        Alert.alert(title, message, [
          { text: 'ยกเลิก', style: 'cancel', onPress: () => resolve(false) },
          { text: 'ยืนยัน', style: 'destructive', onPress: () => resolve(true) },
        ]);
      }
    });
  }

  function webAlert(title: string, message: string): void {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'รับทราบ' }]);
    }
  }

  // customer session stored in memory (no localStorage in RN, but fine for single-page session)
  const customerSessionRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  );

  // realtime unsubscribe refs
  const orderChannelRef = useRef<any>(null);
  const paymentChannelRef = useRef<any>(null);

  // ── anti-table-switching guard (web only) ──────────────────────────────────
  // On web, sessionStorage persists across refreshes in the same browser tab.
  // If the customer is on table X and somehow opens table Y's URL in the same
  // tab, we warn them before loading a new menu session.
  useEffect(() => {
    if (typeof window === 'undefined' || !shopId || !tableNumber) return;
    const SS_KEY = 'qrforpay_table_session';
    try {
      const stored = sessionStorage.getItem(SS_KEY);
      if (stored) {
        const { s, t } = JSON.parse(stored) as { s: string; t: string };
        // Different table in the same session → warn
        if (s === shopId && t !== tableNumber) {
          webConfirm(
            'เปลี่ยนโต๊ะ',
            `คุณกำลังเปิดหน้าสั่งอาหารของโต๊ะ ${tableNumber} แต่ก่อนหน้านี้คุณอยู่โต๊ะ ${t}\nต้องการเปลี่ยนโต๊ะใหม่?`
          ).then((ok) => {
            if (ok) {
              sessionStorage.setItem(SS_KEY, JSON.stringify({ s: shopId, t: tableNumber }));
            }
          });
        }
      } else {
        sessionStorage.setItem(SS_KEY, JSON.stringify({ s: shopId, t: tableNumber }));
      }
    } catch {
      // sessionStorage unavailable (e.g. private browsing restrictions) — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, tableNumber]);

  // ── load menu ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!shopId) {
      setError('ไม่พบข้อมูลร้าน กรุณาสแกน QR ใหม่');
      setScreen('error');
      return;
    }
    loadMenu();
  }, [shopId]);

  const loadMenu = useCallback(async () => {
    setScreen('loading');
    try {
      // Fetch shop info
      const { data: shopRow, error: shopErr } = await supabaseCustomer
        .from('shops')
        .select('name, promptpay_id')
        .eq('id', shopId)
        .single();

      if (shopErr || !shopRow) {
        setError('ไม่พบร้านนี้ในระบบ');
        setScreen('error');
        return;
      }
      setShopName(shopRow.name);
      setPromptpayId(shopRow.promptpay_id ?? '');

      // Fetch categories
      const { data: cats } = await supabaseCustomer
        .from('categories')
        .select('id, name, sort_order')
        .eq('shop_id', shopId)
        .order('sort_order', { ascending: true });

      setCategories(cats ?? []);

      // Fetch active products
      const { data: products } = await supabaseCustomer
        .from('products')
        .select('id, name, price, image_url, category_id, is_active')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      setMenuItems(products ?? []);

      // Check if this table already has an active order (prevents duplicate bills)
      if (tableNumber) {
        try {
          const { data: activeRows } = await supabaseCustomer
            .rpc('get_active_table_order', { p_shop_id: shopId, p_table_number: tableNumber });
          if (activeRows && activeRows.length > 0) {
            const activeOrder = activeRows[0];
            setOrderId(activeOrder.id);
            setOrderNumber(activeOrder.order_number);
            if (activeOrder.status) setOrderStatus(activeOrder.status);

            // Privacy (#20): only restore item details if same customer session
            // Different session = new customer at same table → they see order exists but not item details
            const isSameSession = !activeOrder.customer_session_id
              || activeOrder.customer_session_id === customerSessionRef.current;

            if (isSameSession) {
              try {
                const { data: existingItems } = await supabaseCustomer
                  .rpc('get_order_items_for_customer', { p_order_id: activeOrder.id });
                if (existingItems && existingItems.length > 0) {
                  const restored: CartEntry[] = existingItems.map((row: any) => ({
                    item: {
                      id: row.product_id,
                      name: row.product_name,
                      price: Number(row.unit_price),
                      image_url: row.image_url,
                      category_id: row.category_id,
                      is_active: row.is_active,
                    },
                    qty: row.quantity,
                  }));
                  setConfirmedItems(restored);
                }
              } catch {
                // Non-fatal: items RPC unavailable → confirmed section stays empty
              }
            }
          }
        } catch {
          // Non-fatal: RPC unavailable → fall through (new order will be created)
        }
      }

      setScreen('menu');
    } catch (err: any) {
      setError(err?.message ?? 'โหลดเมนูไม่ได้ กรุณาลองใหม่');
      setScreen('error');
    }
  }, [shopId]);

  // ── cart helpers ───────────────────────────────────────────────────────────
  const cartTotal = useMemo(
    () => cart.reduce((sum, e) => sum + e.item.price * e.qty, 0),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, e) => sum + e.qty, 0),
    [cart]
  );

  // total of items already confirmed/sent to kitchen
  const confirmedTotal = useMemo(
    () => confirmedItems.reduce((sum, e) => sum + e.item.price * e.qty, 0),
    [confirmedItems]
  );

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((e) => e.item.id === item.id);
      if (existing) {
        return prev.map((e) =>
          e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e
        );
      }
      return [...prev, { item, qty: 1 }];
    });
  };

  const removeFromCart = async (itemId: string) => {
    const existing = cart.find((e) => e.item.id === itemId);
    if (!existing) return;

    if (existing.qty <= 1) {
      // Confirm before removing the last unit
      const ok = await webConfirm('ลบสินค้า', `ลบ "${existing.item.name}" ออกจากตะกร้า?`);
      if (ok) {
        setCart((prev) => prev.filter((e) => e.item.id !== itemId));
      }
      return;
    }

    setCart((prev) =>
      prev.map((e) =>
        e.item.id === itemId ? { ...e, qty: e.qty - 1 } : e
      )
    );
  };

  const getQty = (itemId: string): number =>
    cart.find((e) => e.item.id === itemId)?.qty ?? 0;

  // ── add items to an existing order (same table, same bill) ────────────────
  const addToExistingOrder = useCallback(async (existingOrderId: string, cartSnapshot: CartEntry[]) => {
    const items = cartSnapshot.map((e) => ({
      product_id: e.item.id,
      quantity: e.qty,
      unit_price: e.item.price,
      subtotal: e.item.price * e.qty,
    }));
    const additionalAmount = cartSnapshot.reduce((s, e) => s + e.item.price * e.qty, 0);

    // Optimistic: show added items immediately, restore on failure
    setConfirmedItems((prev) => [...prev, ...cartSnapshot]);
    setCart([]);
    setScreen('cart');

    try {
      // Pass items as array directly (NOT JSON.stringify) so PostgREST sends as jsonb
      const { error } = await supabaseCustomer.rpc('customer_add_items', {
        p_order_id: existingOrderId,
        p_items: items,
        p_additional_amount: additionalAmount,
      });
      if (error) throw error;
      webAlert('เพิ่มรายการสำเร็จ!', 'พนักงานได้รับรายการของคุณแล้ว');
    } catch (err: any) {
      // Revert: move failed items back to cart
      setConfirmedItems((prev) => prev.slice(0, prev.length - cartSnapshot.length));
      setCart(cartSnapshot);
      webAlert('เกิดข้อผิดพลาด', err?.message ?? 'เพิ่มรายการไม่ได้ กรุณาแจ้งพนักงาน');
    }
  }, []);

  // ── place order ────────────────────────────────────────────────────────────
  const placeOrder = useCallback(async () => {
    if (cart.length === 0) return;

    const cartSnapshot = [...cart];
    const totalSnapshot = cartTotal;

    // ── Case A: table already has an active order → add items to it (no new bill) ──
    if (orderId) {
      await addToExistingOrder(orderId, cartSnapshot);
      return;
    }

    // ── Case B: no active order → create new order + QR payment ──
    // Optimistically move cart → confirmedItems so paying screen can display them
    setConfirmedItems(cartSnapshot);
    setCart([]);
    setScreen('paying');

    try {
      const taxRate = 0.07;
      const subtotal = totalSnapshot;
      const taxAmount = subtotal * (taxRate / (1 + taxRate));
      const totalAmount = subtotal;

      // 1. Insert order
      const { data: orderRow, error: orderErr } = await supabaseCustomer
        .from('orders')
        .insert({
          shop_id: shopId,
          cashier_id: null,
          subtotal,
          discount_amount: 0,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_method: 'qr',
          status: 'pending',
          table_number: tableNumber || null,
          order_source: 'customer',
          customer_session_id: customerSessionRef.current,
        })
        .select()
        .single();

      if (orderErr || !orderRow) throw orderErr ?? new Error('สร้างออเดอร์ไม่ได้');

      setOrderId(orderRow.id);
      setOrderNumber(orderRow.order_number);

      // 2. Insert order items
      const orderItems = cartSnapshot.map((e) => ({
        order_id: orderRow.id,
        product_id: e.item.id,
        quantity: e.qty,
        unit_price: e.item.price,
        subtotal: e.item.price * e.qty,
      }));

      const { error: itemsErr } = await supabaseCustomer
        .from('order_items')
        .insert(orderItems);

      if (itemsErr) throw itemsErr;

      // 3. Generate PromptPay QR payload
      let payload = '';
      if (promptpayId && totalAmount > 0) {
        try {
          payload = generatePromptPayPayload(promptpayId, totalAmount);
        } catch {
          // Non-fatal: show QR with empty payload fallback
        }
      }
      setQrPayload(payload);

      // 4. Insert payment record
      const { error: payErr } = await supabaseCustomer
        .from('payments')
        .insert({
          order_id: orderRow.id,
          method: 'qr',
          amount: totalAmount,
          qr_payload: payload || null,
          transaction_ref: generateQRReference(),
          status: 'pending',
        });

      if (payErr) throw payErr;

      // 5. Realtime subscriptions start automatically via useEffect when orderId is set

    } catch (err: any) {
      // Restore cart from confirmedItems so user can retry
      setCart(cartSnapshot);
      setConfirmedItems([]);
      webAlert('เกิดข้อผิดพลาด', err?.message ?? 'สั่งอาหารไม่ได้ กรุณาลองใหม่');
      setScreen('confirm');
    }
  }, [cart, cartTotal, orderId, shopId, tableNumber, promptpayId, addToExistingOrder]);

  // ── show payment screen (from cart, when customer wants to pay) ──────────
  const showPayment = useCallback(() => {
    if (!orderId || confirmedTotal <= 0) return;
    // Generate QR payload if not already set
    if (!qrPayload && promptpayId && confirmedTotal > 0) {
      try {
        const payload = generatePromptPayPayload(promptpayId, confirmedTotal);
        setQrPayload(payload);
      } catch {
        // Non-fatal
      }
    }
    // Realtime subscriptions are always-on via useEffect (no manual re-subscribe needed)
    setPaymentStatus('pending');
    setScreen('paying');
  }, [orderId, confirmedTotal, qrPayload, promptpayId]);

  // ── paying screen back button ─────────────────────────────────────────────
  // Go back to cart so customer can review what they ordered.
  // confirmedItems still holds the ordered items (read-only).
  // orderId remains set so any new items will be added to the same bill.
  const goBackFromPaying = useCallback(() => {
    // Don't unsubscribe — keep realtime active so cart updates if shop cancels items
    setQrPayload('');
    setPaymentStatus('pending');
    setScreen('cart');
  }, []);

  // ── realtime subscriptions (always-on when orderId is set) ─────────────────
  // Use ref for promptpayId so subscription doesn't re-create when it changes
  const promptpayIdRef = useRef(promptpayId);
  promptpayIdRef.current = promptpayId;

  useEffect(() => {
    if (!orderId) return;

    // Payment status subscription
    const payChannel = supabaseCustomer
      .channel(`customer-payment:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `order_id=eq.${orderId}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status as string;
          if (newStatus === 'success') {
            setPaymentStatus('success');
          } else if (newStatus === 'failed' || newStatus === 'expired') {
            setPaymentStatus(newStatus as any);
          }
        }
      )
      .subscribe();

    // Order changes subscription — item cancellation + full cancel by shop
    const orderChannel = supabaseCustomer
      .channel(`customer-order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload: any) => {
          const newStatus = payload.new?.status as string | undefined;
          const newTotal = payload.new?.total_amount;

          // ── Track kitchen status for feedback ──
          if (newStatus) setOrderStatus(newStatus);

          // ── Order cancelled by shop ──
          if (newStatus === 'cancelled') {
            setConfirmedItems([]);
            setCart([]);
            setOrderId(null);
            setOrderNumber(null);
            setQrPayload('');
            setPaymentStatus('pending');
            setScreen('menu');
            webAlert('ออเดอร์ถูกยกเลิก', 'ออเดอร์ของคุณถูกยกเลิกโดยร้านค้า กรุณาสั่งใหม่');
            return;
          }

          // ── Total changed (item cancelled by shop) → refresh items + QR ──
          if (newTotal !== undefined && newTotal !== null) {
            // Refetch active items from DB
            try {
              const { data: freshItems } = await supabaseCustomer
                .rpc('get_order_items_for_customer', { p_order_id: orderId });
              if (freshItems) {
                const restored: CartEntry[] = freshItems.map((row: any) => ({
                  item: {
                    id: row.product_id,
                    name: row.product_name,
                    price: Number(row.unit_price),
                    image_url: row.image_url,
                    category_id: row.category_id,
                    is_active: row.is_active,
                  },
                  qty: row.quantity,
                }));
                setConfirmedItems(restored);
              }
            } catch {
              // Non-fatal: RPC unavailable
            }

            // Regenerate QR payload with new total
            const totalNum = Number(newTotal);
            if (totalNum > 0 && promptpayIdRef.current) {
              try {
                setQrPayload(generatePromptPayPayload(promptpayIdRef.current, totalNum));
              } catch {
                // Non-fatal
              }
            }
          }
        }
      )
      .subscribe();

    // Store refs for potential manual cleanup
    paymentChannelRef.current = payChannel;
    orderChannelRef.current = orderChannel;

    return () => {
      payChannel.unsubscribe();
      orderChannel.unsubscribe();
    };
  }, [orderId]);

  // QR countdown timer (#14) — 5 minutes, resets when entering paying screen
  useEffect(() => {
    if (screen !== 'paying' || paymentStatus !== 'pending') return;
    setQrTimeLeft(300);
    const interval = setInterval(() => {
      setQrTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, paymentStatus]);

  // When payment goes through, show thank-you screen (#17)
  useEffect(() => {
    if (paymentStatus === 'success' && screen === 'paying') {
      setScreen('success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, screen]);

  // ── filtered menu ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return menuItems;
    return menuItems.filter((m) => m.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.appHeader}>
      <View>
        <Text style={styles.appHeaderShop}>{shopName || 'เมนู'}</Text>
        {tableNumber ? (
          <Text style={styles.appHeaderTable}>โต๊ะ {tableNumber}</Text>
        ) : null}
      </View>
      {/* Order number badge (only when there's an active order) */}
      {orderNumber ? (
        <View style={styles.orderBadge}>
          <Text style={styles.orderBadgeText}>#{orderNumber}</Text>
        </View>
      ) : null}
    </View>
  );

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.bodyText, { marginTop: 12 }]}>กำลังโหลดเมนู...</Text>
      </View>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────
  if (screen === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>😕</Text>
        <Text style={styles.errorTitle}>เกิดข้อผิดพลาด</Text>
        <Text style={styles.bodyText}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={loadMenu}>
          <Text style={styles.primaryButtonText}>ลองใหม่</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── MENU ───────────────────────────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <View style={styles.container}>
        <View style={styles.innerContainer}>
        {renderHeader()}

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.catPill,
              selectedCategory === null && styles.catPillActive,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text
              style={[
                styles.catPillText,
                selectedCategory === null && styles.catPillTextActive,
              ]}
            >
              ทั้งหมด
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catPill,
                selectedCategory === cat.id && styles.catPillActive,
              ]}
              onPress={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? null : cat.id
                )
              }
            >
              <Text
                style={[
                  styles.catPillText,
                  selectedCategory === cat.id && styles.catPillTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Menu grid */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.menuGrid,
            isWide && styles.menuGridWide,
          ]}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyMenu}>
              <Text style={styles.bodyText}>ไม่มีสินค้าในหมวดนี้</Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const qty = getQty(item.id);
              return (
                <View
                  key={item.id}
                  style={[styles.menuCard, isWide && styles.menuCardWide]}
                >
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.menuImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.menuImagePlaceholder}>
                      <Text style={styles.menuImagePlaceholderText}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.menuCardBody}>
                    <Text style={styles.menuItemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.menuItemPrice}>
                      {formatPrice(item.price)}
                    </Text>
                  </View>
                  <View style={styles.menuCardActions}>
                    {qty === 0 ? (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => addToCart(item)}
                      >
                        <Text style={styles.addButtonText}>+ เพิ่ม</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.qtyRow}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => removeFromCart(item.id)}
                        >
                          <Text style={styles.qtyButtonText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity
                          style={[styles.qtyButton, styles.qtyButtonAdd]}
                          onPress={() => addToCart(item)}
                        >
                          <Text
                            style={[
                              styles.qtyButtonText,
                              styles.qtyButtonAddText,
                            ]}
                          >
                            +
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Bottom sticky cart bar */}
        {(cartCount > 0 || confirmedItems.length > 0) ? (
          <TouchableOpacity
            style={styles.cartBar}
            onPress={() => setScreen('cart')}
            activeOpacity={0.85}
          >
            <View style={styles.cartBarBadge}>
              <Text style={styles.cartBarBadgeText}>
                {cartCount > 0 ? `${cartCount} รายการ` : `ออเดอร์ #${orderNumber}`}
              </Text>
            </View>
            <Text style={styles.cartBarText}>{cartCount > 0 ? 'ดูตะกร้า' : 'ดูรายการ / ชำระเงิน'}</Text>
            <Text style={styles.cartBarPrice}>{formatPrice(cartCount > 0 ? cartTotal : confirmedTotal)}</Text>
          </TouchableOpacity>
        ) : null}
        </View>
      </View>
    );
  }

  // ── CART ───────────────────────────────────────────────────────────────────
  if (screen === 'cart') {
    const handleClearCart = async () => {
      const ok = await webConfirm('ล้างตะกร้า', 'ล้างสินค้าทั้งหมดออกจากตะกร้า?');
      if (ok) {
        setCart([]);
        setScreen('menu');
      }
    };

    return (
      <View style={styles.container}>
        <View style={styles.innerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('menu')}>
            <Text style={styles.backButton}>← กลับเมนู</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ตะกร้าสินค้า</Text>
          {cart.length > 0 && orderId === null ? (
            <TouchableOpacity onPress={handleClearCart} style={styles.clearCartBtn}>
              <Text style={styles.clearCartText}>ล้างตะกร้า</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cartContent}>
          {confirmedItems.length === 0 && cart.length === 0 ? (
            <View style={styles.emptyMenu}>
              <Text style={styles.bodyText}>ตะกร้าว่างเปล่า</Text>
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 16 }]}
                onPress={() => setScreen('menu')}
              >
                <Text style={styles.primaryButtonText}>กลับเลือกเมนู</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── Confirmed items (read-only) ── */}
              {confirmedItems.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionHeaderText}>
                      {orderStatus === 'preparing' ? '🍳 กำลังปรุง...'
                        : orderStatus === 'completed' ? '✅ เสร็จแล้ว'
                        : '✓ สั่งแล้ว — รออาหาร'}
                    </Text>
                  </View>
                  {/* Kitchen status banner (MEDIUM) */}
                  {orderStatus === 'preparing' && (
                    <View style={styles.kitchenBanner}>
                      <Text style={styles.kitchenBannerText}>ครัวกำลังเตรียมอาหารของคุณ</Text>
                    </View>
                  )}
                  {confirmedItems.map((entry, idx) => (
                    <View key={`confirmed-${entry.item.id}-${idx}`} style={[styles.cartRow, styles.confirmedRow]}>
                      <View style={styles.confirmedCheck}>
                        <Text style={styles.confirmedCheckText}>✓</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartItemName}>{entry.item.name}</Text>
                        <Text style={styles.cartItemPrice}>
                          {formatPrice(entry.item.price)} / ชิ้น
                        </Text>
                      </View>
                      <Text style={[styles.qtyValue, { marginHorizontal: 16 }]}>×{entry.qty}</Text>
                      <Text style={styles.cartItemSubtotal}>
                        {formatPrice(entry.item.price * entry.qty)}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {/* ── New items (editable) ── */}
              {cart.length > 0 && (
                <>
                  {confirmedItems.length > 0 && (
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionHeaderText}>รายการใหม่</Text>
                    </View>
                  )}
                  {cart.map((entry) => (
                    <View key={entry.item.id} style={styles.cartRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartItemName}>{entry.item.name}</Text>
                        <Text style={styles.cartItemPrice}>
                          {formatPrice(entry.item.price)} / ชิ้น
                        </Text>
                      </View>
                      <View style={styles.qtyRow}>
                        <TouchableOpacity
                          style={styles.qtyButton}
                          onPress={() => removeFromCart(entry.item.id)}
                        >
                          <Text style={styles.qtyButtonText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{entry.qty}</Text>
                        <TouchableOpacity
                          style={[styles.qtyButton, styles.qtyButtonAdd]}
                          onPress={() => addToCart(entry.item)}
                        >
                          <Text style={[styles.qtyButtonText, styles.qtyButtonAddText]}>+</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cartItemSubtotal}>
                        {formatPrice(entry.item.price * entry.qty)}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {/* ── Summary ── */}
              <View style={styles.summaryBox}>
                {confirmedItems.length > 0 && cart.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>สั่งแล้ว</Text>
                    <Text style={styles.summaryValue}>{formatPrice(confirmedTotal)}</Text>
                  </View>
                )}
                {cart.length > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{confirmedItems.length > 0 ? 'รายการใหม่' : 'รวม'}</Text>
                    <Text style={styles.summaryValue}>{formatPrice(cartTotal)}</Text>
                  </View>
                )}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>VAT 7% (รวมในราคา)</Text>
                  <Text style={styles.summaryValue}>
                    {formatPrice((confirmedTotal + cartTotal) * (0.07 / 1.07))}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>ยอดรวมทั้งหมด</Text>
                  <Text style={styles.summaryTotalValue}>
                    {formatPrice(confirmedTotal + cartTotal)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {cart.length > 0 && orderId ? (
          /* Has existing order + new items → show "เพิ่มรายการ" in orange (#10) */
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.addItemsButton]}
              onPress={() => setScreen('confirm')}
            >
              <Text style={styles.primaryButtonText}>+ เพิ่มรายการ — {formatPrice(cartTotal)}</Text>
            </TouchableOpacity>
          </View>
        ) : cart.length > 0 ? (
          /* New order → "สั่งอาหาร" in primary blue */
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setScreen('confirm')}
            >
              <Text style={styles.primaryButtonText}>สั่งอาหาร — {formatPrice(cartTotal)}</Text>
            </TouchableOpacity>
          </View>
        ) : confirmedItems.length > 0 && orderId ? (
          /* No new items, has confirmed → "ชำระเงิน" in green */
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.payButton]}
              onPress={showPayment}
            >
              <Text style={styles.primaryButtonText}>ชำระเงิน — {formatPrice(confirmedTotal)}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        </View>
      </View>
    );
  }

  // ── CONFIRM ────────────────────────────────────────────────────────────────
  if (screen === 'confirm') {
    return (
      <View style={styles.container}>
        <View style={styles.innerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('cart')}>
            <Text style={styles.backButton}>← แก้ไข</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ยืนยันคำสั่งซื้อ</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cartContent}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>รายการที่สั่ง</Text>
            {cart.map((entry) => (
              <View key={entry.item.id} style={styles.confirmRow}>
                <Text style={styles.confirmItemName}>
                  {entry.item.name} × {entry.qty}
                </Text>
                <Text style={styles.confirmItemPrice}>
                  {formatPrice(entry.item.price * entry.qty)}
                </Text>
              </View>
            ))}
            <View style={styles.confirmDivider} />
            <View style={styles.confirmRow}>
              <Text style={styles.confirmTotalLabel}>ยอดรวม</Text>
              <Text style={styles.confirmTotalValue}>
                {formatPrice(cartTotal)}
              </Text>
            </View>
            {tableNumber ? (
              <View style={[styles.confirmRow, { marginTop: 8 }]}>
                <Text style={styles.summaryLabel}>โต๊ะ</Text>
                <Text style={styles.summaryValue}>{tableNumber}</Text>
              </View>
            ) : null}
          </View>

          {orderId ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                รายการนี้จะถูกเพิ่มในบิลโต๊ะ {tableNumber} เดิม{'\n'}
                การชำระเงินจะทำพร้อมกันเมื่อปิดโต๊ะ
              </Text>
            </View>
          ) : (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                หลังยืนยัน คุณจะชำระเงินด้วย QR PromptPay{'\n'}
                สแกนง่าย ปลอดภัย ผ่านแอปธนาคารทุกแอป
              </Text>
            </View>
          )}

          <View style={styles.noticeBox}>
            <Text style={[styles.noticeText, { color: '#B45309' }]}>
              หลังสั่งแล้ว ไม่สามารถยกเลิกได้ด้วยตัวเอง{'\n'}
              หากต้องการยกเลิก กรุณาแจ้งพนักงาน
            </Text>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.primaryButton, orderId ? styles.addItemsButton : undefined]}
            onPress={placeOrder}
          >
            <Text style={styles.primaryButtonText}>
              {orderId
                ? `ยืนยันเพิ่มรายการ — ${formatPrice(cartTotal)}`
                : `ยืนยัน & ชำระเงิน — ${formatPrice(cartTotal)}`}
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </View>
    );
  }

  // ── PAYING ─────────────────────────────────────────────────────────────────
  if (screen === 'paying') {
    return (
      <View style={styles.container}>
        <View style={styles.innerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBackFromPaying} style={styles.backPayBtn}>
            <Text style={styles.backPayText}>← ดูรายการ</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ชำระเงิน</Text>
          <View style={{ width: 80 }} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.payingContent}
        >
          <Text style={styles.payingTitle}>สแกน QR ชำระเงิน</Text>
          <Text style={styles.payingSubtitle}>
            เปิดแอปธนาคารแล้วสแกน QR ด้านล่าง
          </Text>

          {/* QR Code */}
          <View style={styles.qrBox}>
            {qrPayload ? (
              <QRCode
                value={qrPayload}
                size={220}
                backgroundColor="#FFFFFF"
                color="#111827"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator color={Colors.primary} size="large" />
                <Text style={[styles.bodyText, { marginTop: 8 }]}>
                  กำลังสร้าง QR...
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.payingAmount}>{formatPrice(confirmedTotal)}</Text>
          <Text style={styles.payingShop}>{shopName}</Text>

          {/* Timer display (#14) */}
          {paymentStatus === 'pending' && qrTimeLeft > 0 && (
            <Text style={[styles.timerText, qrTimeLeft <= 60 && styles.timerTextUrgent]}>
              เหลือเวลา {Math.floor(qrTimeLeft / 60)}:{String(qrTimeLeft % 60).padStart(2, '0')} นาที
            </Text>
          )}

          {paymentStatus === 'failed' || paymentStatus === 'expired' || qrTimeLeft === 0 ? (
            <View style={styles.payErrorBox}>
              <Text style={styles.payErrorText}>
                {paymentStatus === 'failed'
                  ? 'การชำระเงินไม่สำเร็จ'
                  : 'QR หมดอายุ'}
              </Text>
              {/* Regenerate QR button (#15) */}
              <TouchableOpacity
                style={styles.regenerateButton}
                onPress={() => {
                  if (promptpayId && confirmedTotal > 0) {
                    try {
                      setQrPayload(generatePromptPayPayload(promptpayId, confirmedTotal));
                      setPaymentStatus('pending');
                      setQrTimeLeft(300);
                    } catch {
                      webAlert('เกิดข้อผิดพลาด', 'ไม่สามารถสร้าง QR ใหม่ได้');
                    }
                  }
                }}
              >
                <Text style={styles.regenerateButtonText}>สร้าง QR ใหม่</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.payWaitBox}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.payWaitText}>
                รอการยืนยันจากธนาคาร...
              </Text>
            </View>
          )}

          <View style={styles.orderNumBox}>
            <Text style={styles.orderNumLabel}>เลขออเดอร์</Text>
            <Text style={styles.orderNumValue}>#{orderNumber}</Text>
          </View>
        </ScrollView>
        </View>
      </View>
    );
  }

  // ── SUCCESS / THANK YOU (#17) ─────────────────────────────────────────────
  if (screen === 'success') {
    const handleBackToMenu = () => {
      setCart([]);
      setConfirmedItems([]);
      setOrderId(null);
      setOrderNumber(null);
      setQrPayload('');
      setPaymentStatus('pending');
      setOrderStatus('pending');
      setScreen('menu');
    };

    return (
      <View style={styles.container}>
        <View style={[styles.innerContainer, styles.successContainer]}>
          <View style={styles.successCircle}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>ชำระเงินสำเร็จ!</Text>
          <Text style={styles.successSubtitle}>ขอบคุณที่ใช้บริการ</Text>
          <Text style={styles.successShop}>{shopName}</Text>
          {orderNumber && (
            <View style={styles.successOrderBox}>
              <Text style={styles.successOrderLabel}>เลขออเดอร์</Text>
              <Text style={styles.successOrderNum}>#{orderNumber}</Text>
            </View>
          )}
          <Text style={styles.successNote}>ออเดอร์ของคุณถูกส่งครัวแล้ว</Text>
          <TouchableOpacity style={styles.successButton} onPress={handleBackToMenu}>
            <Text style={styles.successButtonText}>กลับหน้าเมนู</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MAX_WIDTH = 480;

const styles = StyleSheet.create({
  // ── root wrapper: centers content on wide screens ──
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  // Most screens need a full-width inner frame
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  // ── main app header (colored, fixed top) ──
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
  },
  appHeaderShop: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  appHeaderTable: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // ── secondary header (white, for cart/confirm/paying screens) ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backButton: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    minWidth: 80,
  },
  backPayBtn: {
    minWidth: 80,
    minHeight: 36,
    justifyContent: 'center',
  },
  backPayText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  clearCartBtn: {
    minWidth: 80,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  clearCartText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  cartButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cartButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cartButtonPrice: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  // category pills
  catScroll: {
    flexGrow: 0,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  // menu grid
  menuGrid: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuGridWide: {
    paddingHorizontal: 24,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    width: '47%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuCardWide: {
    width: '22%',
  },
  menuImage: {
    width: '100%',
    height: 110,
    backgroundColor: Colors.background,
  },
  menuImagePlaceholder: {
    width: '100%',
    height: 110,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuImagePlaceholderText: {
    fontSize: 36,
  },
  menuCardBody: {
    padding: 10,
    gap: 4,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 20,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  menuCardActions: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  qtyButtonAdd: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  qtyButtonAddText: {
    color: '#FFFFFF',
  },
  qtyValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    minWidth: 24,
    textAlign: 'center',
  },
  emptyMenu: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
  },
  // floating bottom cart bar
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 58,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cartBarBadge: {
    backgroundColor: '#FFFFFF33',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cartBarBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cartBarText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cartBarPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // cart
  cartContent: {
    padding: 16,
    paddingBottom: 32,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  cartItemPrice: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  cartItemSubtotal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    minWidth: 64,
    textAlign: 'right',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    marginTop: 4,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // confirm
  confirmCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmItemName: {
    fontSize: 14,
    color: Colors.text.primary,
    flex: 1,
  },
  confirmItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 6,
  },
  confirmTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  confirmTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  noticeBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  noticeText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  // paying
  payingContent: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  payingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  payingSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 28,
    textAlign: 'center',
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payingAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  payingShop: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 24,
  },
  payWaitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
  },
  payWaitText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  payErrorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
  },
  payErrorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'center',
  },
  orderNumBox: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 160,
  },
  orderNumLabel: {
    fontSize: 12,
    color: Colors.text.light,
    marginBottom: 4,
  },
  orderNumValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  // order badge in header
  orderBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  orderBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // confirmed items — green border + checkmark (#6)
  confirmedRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  confirmedCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmedCheckText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // kitchen status banner (MEDIUM)
  kitchenBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  kitchenBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  // button variants (#10)
  addItemsButton: {
    backgroundColor: '#F59E0B',
  },
  payButton: {
    backgroundColor: '#059669',
  },
  // QR timer (#14)
  timerText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
    marginBottom: 12,
  },
  timerTextUrgent: {
    color: '#EF4444',
    fontWeight: '700',
  },
  // regenerate QR button (#15)
  regenerateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 12,
    alignSelf: 'center',
  },
  regenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // success / thank you screen (#17)
  successContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  successIcon: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  successShop: {
    fontSize: 15,
    color: Colors.text.light,
    marginBottom: 24,
  },
  successOrderBox: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 180,
    marginBottom: 20,
  },
  successOrderLabel: {
    fontSize: 12,
    color: Colors.text.light,
    marginBottom: 4,
  },
  successOrderNum: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  successNote: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  successButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // status
  statusContent: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 40,
  },
  statusCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: Colors.surface,
  },
  statusCircleIcon: {
    fontSize: 44,
  },
  statusLabel: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 28,
  },
  // progress steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingHorizontal: 8,
    position: 'relative',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    zIndex: 1,
  },
  stepDotActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  stepDotCheck: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 10,
    color: Colors.text.light,
    textAlign: 'center',
    lineHeight: 14,
  },
  stepLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  stepLine: {
    position: 'absolute',
    top: 14,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: Colors.border,
    zIndex: 0,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  doneBox: {
    alignItems: 'center',
    marginTop: 12,
  },
  doneText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
  },
  waitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  waitText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  // generic
  bodyText: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
});
