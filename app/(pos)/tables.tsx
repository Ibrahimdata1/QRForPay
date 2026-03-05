// Table QR Code Generator
// Staff generates QR codes per table. Customer scans → opens self-ordering web interface.
// URL format: <app-base-url>/customer?shop=<shopId>&table=<tableNumber>
//
// The base URL must be set via EXPO_PUBLIC_APP_BASE_URL env var.
// For local testing use the Expo web dev server URL (e.g. http://192.168.x.x:8081).

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../constants/colors';

// Number of quick-select table buttons shown
const QUICK_TABLES = Array.from({ length: 20 }, (_, i) => String(i + 1));

// Base URL for the customer ordering web interface — always points to Vercel.
// QR codes must work from any network (customer's phone data, not just WiFi).
const APP_BASE_URL =
  process.env.EXPO_PUBLIC_APP_BASE_URL ?? 'https://dist-two-rose-32.vercel.app';

function buildCustomerUrl(shopId: string, table: string): string {
  // Expo Router: customer group index is at /customer?shop=...&table=...
  return `${APP_BASE_URL}/customer?shop=${encodeURIComponent(shopId)}&table=${encodeURIComponent(table)}`;
}

export default function TablesScreen() {
  const shop = useAuthStore((s) => s.shop);
  const [tableNumber, setTableNumber] = useState('1');
  const [customTable, setCustomTable] = useState('');
  const [showQR, setShowQR] = useState(false);

  const activeTable = customTable.trim() || tableNumber;
  const shopId = shop?.id ?? '';
  const customerUrl = buildCustomerUrl(shopId, activeTable);

  const handleGenerate = useCallback(() => {
    if (!shopId) {
      Alert.alert('ข้อผิดพลาด', 'ไม่พบข้อมูลร้าน กรุณา login ใหม่');
      return;
    }
    if (!activeTable) {
      Alert.alert('กรุณาระบุหมายเลขโต๊ะ');
      return;
    }
    setShowQR(true);
  }, [shopId, activeTable]);

  const handleShare = useCallback(() => {
    Share.share({
      message: `สั่งอาหารโต๊ะ ${activeTable} — ${shop?.name ?? ''}\n${customerUrl}`,
      url: customerUrl, // iOS only
    }).catch(() => {});
  }, [customerUrl, activeTable, shop?.name]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>QR สั่งอาหารต่อโต๊ะ</Text>
      <Text style={styles.subtitle}>
        ลูกค้าสแกน QR เพื่อดูเมนูและสั่งอาหารเองผ่านโทรศัพท์
      </Text>

      {/* Quick select */}
      <Text style={styles.sectionLabel}>เลือกโต๊ะ</Text>
      <View style={styles.tableGrid}>
        {QUICK_TABLES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tableButton,
              activeTable === t && !customTable && styles.tableButtonActive,
            ]}
            onPress={() => {
              setCustomTable('');
              setTableNumber(t);
              setShowQR(false);
            }}
          >
            <Text
              style={[
                styles.tableButtonText,
                activeTable === t && !customTable && styles.tableButtonTextActive,
              ]}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom table number */}
      <Text style={styles.sectionLabel}>หรือพิมพ์หมายเลขโต๊ะเอง</Text>
      <TextInput
        style={styles.input}
        placeholder="เช่น VIP, A1, 21..."
        placeholderTextColor={Colors.text.light}
        value={customTable}
        onChangeText={(v) => {
          setCustomTable(v);
          setShowQR(false);
        }}
      />

      {/* Generate button */}
      <TouchableOpacity style={styles.generateButton} onPress={handleGenerate}>
        <Text style={styles.generateButtonText}>
          สร้าง QR โต๊ะ {activeTable}
        </Text>
      </TouchableOpacity>

      {/* QR display */}
      {showQR && (
        <View style={styles.qrSection}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>{shop?.name ?? 'ร้านของฉัน'}</Text>
            <Text style={styles.qrTableLabel}>โต๊ะ {activeTable}</Text>

            <View style={styles.qrBox}>
              <QRCode
                value={customerUrl}
                size={240}
                backgroundColor="#FFFFFF"
                color="#111827"
              />
            </View>

            <Text style={styles.qrInstruction}>
              ลูกค้าสแกน QR นี้เพื่อสั่งอาหาร
            </Text>
            <Text style={styles.qrUrl} numberOfLines={2}>
              {customerUrl}
            </Text>
          </View>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>แชร์ลิงก์</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* URL info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>วิธีใช้งาน</Text>
        <Text style={styles.infoText}>
          1. เลือกหมายเลขโต๊ะ แล้วกด "สร้าง QR"{'\n'}
          2. พิมพ์ QR และวางบนโต๊ะ หรือแสดงบนจอ{'\n'}
          3. ลูกค้าสแกน QR ด้วยกล้องโทรศัพท์{'\n'}
          4. ลูกค้าดูเมนู เพิ่มสินค้า และชำระเงินด้วย QR PromptPay{'\n'}
          5. ออเดอร์ปรากฏใน "ออเดอร์" ทันที
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>URL สั่งอาหารของร้าน</Text>
        <Text style={styles.infoText}>
          ลูกค้าใช้เน็ตไหนก็สแกนได้ ไม่ต้องอยู่ WiFi เดียวกัน{'\n'}
          ปัจจุบัน: {APP_BASE_URL}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 10,
  },
  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tableButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tableButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tableButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 16,
  },
  generateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 24,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    width: '100%',
    marginBottom: 16,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  qrTableLabel: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: 20,
  },
  qrBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrInstruction: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  qrUrl: {
    fontSize: 11,
    color: Colors.text.light,
    textAlign: 'center',
  },
  shareButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
});
