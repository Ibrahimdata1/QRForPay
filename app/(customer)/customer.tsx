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

type ScreenState = 'loading' | 'error' | 'menu' | 'cart' | 'confirm' | 'paying';

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
  const [qrPayload, setQrPayload] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed' | 'expired'>('pending');

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

  // ── place order ────────────────────────────────────────────────────────────
  const placeOrder = useCallback(async () => {
    if (cart.length === 0) return;
    setScreen('paying');

    try {
      const taxRate = 0.07;
      const subtotal = cartTotal;
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
      const orderItems = cart.map((e) => ({
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

      // 5. Subscribe to payment and order status updates
      subscribeToOrder(orderRow.id);

    } catch (err: any) {
      webAlert('เกิดข้อผิดพลาด', err?.message ?? 'สั่งอาหารไม่ได้ กรุณาลองใหม่');
      setScreen('confirm');
    }
  }, [cart, cartTotal, shopId, tableNumber, promptpayId]);

  // ── paying screen back button ─────────────────────────────────────────────
  // Go back to cart — keep cart intact so the customer can see their order.
  // If an order was already placed, the restaurant has it; the customer
  // returns to cart view only to review (not to re-order).
  const goBackFromPaying = useCallback(() => {
    orderChannelRef.current?.unsubscribe();
    paymentChannelRef.current?.unsubscribe();
    setQrPayload('');
    setPaymentStatus('pending');
    setScreen('cart');
  }, []);

  // ── realtime subscriptions ─────────────────────────────────────────────────
  const subscribeToOrder = (oid: string) => {
    // Subscribe to payment status changes
    paymentChannelRef.current = supabaseCustomer
      .channel(`customer-payment:${oid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `order_id=eq.${oid}`,
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

    // Subscribe to order status changes (kitchen workflow) — no-op after removing status screen
    orderChannelRef.current = supabaseCustomer
      .channel(`customer-order:${oid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${oid}`,
        },
        (_payload: any) => {
          // Order status updates are no longer displayed on a separate screen.
          // The channel is kept open so Supabase doesn't close the connection
          // and to allow future enhancements.
        }
      )
      .subscribe();
  };

  useEffect(() => {
    return () => {
      orderChannelRef.current?.unsubscribe();
      paymentChannelRef.current?.unsubscribe();
    };
  }, []);

  // When payment goes through, reset everything and go back to menu
  useEffect(() => {
    if (paymentStatus === 'success' && screen === 'paying') {
      setCart([]);
      setOrderId(null);
      setOrderNumber(null);
      setQrPayload('');
      setPaymentStatus('pending');
      orderChannelRef.current?.unsubscribe();
      paymentChannelRef.current?.unsubscribe();
      setScreen('menu');
      // webAlert runs synchronously on web (window.alert) — call after setScreen
      // so the menu is visible behind the dialog before the user dismisses it.
      webAlert('สั่งอาหารสำเร็จ!', 'ขอบคุณที่ใช้บริการ ออเดอร์ของคุณถูกส่งครัวแล้ว');
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
      {screen === 'menu' && cartCount > 0 ? (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => setScreen('cart')}
        >
          <Text style={styles.cartButtonText}>ตะกร้า ({cartCount})</Text>
          <Text style={styles.cartButtonPrice}>{formatPrice(cartTotal)}</Text>
        </TouchableOpacity>
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
        {cartCount > 0 ? (
          <TouchableOpacity
            style={styles.cartBar}
            onPress={() => setScreen('cart')}
            activeOpacity={0.85}
          >
            <View style={styles.cartBarBadge}>
              <Text style={styles.cartBarBadgeText}>{cartCount} รายการ</Text>
            </View>
            <Text style={styles.cartBarText}>ดูตะกร้า</Text>
            <Text style={styles.cartBarPrice}>{formatPrice(cartTotal)}</Text>
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
          {cart.length > 0 ? (
            <TouchableOpacity onPress={handleClearCart} style={styles.clearCartBtn}>
              <Text style={styles.clearCartText}>ล้างตะกร้า</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cartContent}>
          {cart.length === 0 ? (
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
                  <Text style={styles.cartItemSubtotal}>
                    {formatPrice(entry.item.price * entry.qty)}
                  </Text>
                </View>
              ))}

              {/* Order summary */}
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>รวม</Text>
                  <Text style={styles.summaryValue}>{formatPrice(cartTotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>VAT 7% (รวมในราคา)</Text>
                  <Text style={styles.summaryValue}>
                    {formatPrice(cartTotal * (0.07 / 1.07))}
                  </Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>ยอดชำระ</Text>
                  <Text style={styles.summaryTotalValue}>
                    {formatPrice(cartTotal)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {cart.length > 0 ? (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setScreen('confirm')}
            >
              <Text style={styles.primaryButtonText}>
                ยืนยันคำสั่ง — {formatPrice(cartTotal)}
              </Text>
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

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              หลังยืนยัน คุณจะชำระเงินด้วย QR PromptPay{'\n'}
              สแกนง่าย ปลอดภัย ผ่านแอปธนาคารทุกแอป
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <Text style={[styles.noticeText, { color: '#B45309' }]}>
              หลังสั่งแล้ว ไม่สามารถยกเลิกได้ด้วยตัวเอง{'\n'}
              หากต้องการยกเลิก กรุณาแจ้งพนักงาน
            </Text>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={placeOrder}
          >
            <Text style={styles.primaryButtonText}>
              สั่งและชำระเงิน {formatPrice(cartTotal)}
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
            <Text style={styles.backPayText}>← กลับ</Text>
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

          <Text style={styles.payingAmount}>{formatPrice(cartTotal)}</Text>
          <Text style={styles.payingShop}>{shopName}</Text>

          {paymentStatus === 'failed' || paymentStatus === 'expired' ? (
            <View style={styles.payErrorBox}>
              <Text style={styles.payErrorText}>
                {paymentStatus === 'expired'
                  ? 'QR หมดอายุ กรุณาแจ้งพนักงาน'
                  : 'การชำระเงินไม่สำเร็จ กรุณาลองใหม่'}
              </Text>
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
