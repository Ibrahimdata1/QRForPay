import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Config } from '../constants/config';

type PaymentStatus = 'waiting' | 'confirmed' | 'expired';

interface QRPaymentModalProps {
  amount: number;
  promptPayId?: string;
  qrPayload?: string;
  paymentStatus?: string;
  onConfirmed?: () => void;
  onCancel?: () => void;
  onExpired?: () => void;
  onManualConfirm?: () => void;
  cashierName?: string;
}

function generatePromptPayQRData(promptPayId: string, amount: number): string {
  // Simplified PromptPay QR payload format
  // In production, use a proper EMVCo QR code generator
  return `promptpay://${promptPayId}?amount=${amount.toFixed(2)}&currency=${Config.qr.currency}`;
}

export function QRPaymentModal({
  amount,
  promptPayId = Config.promptpay.id,
  qrPayload,
  paymentStatus,
  onConfirmed,
  onCancel,
  onExpired,
  onManualConfirm,
  cashierName,
}: QRPaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('waiting');
  const [timeLeft, setTimeLeft] = useState(Config.qr.timeout);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isConfirming = useRef(false);

  // React to external payment status changes (realtime subscription)
  useEffect(() => {
    if (paymentStatus === 'success' && status === 'waiting') {
      setStatus('confirmed');
    }
  }, [paymentStatus, status]);

  useEffect(() => {
    if (status !== 'waiting') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('expired');
          onExpired?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, onExpired]);

  useEffect(() => {
    if (status !== 'waiting') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [status, pulseAnim]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const qrData = qrPayload || generatePromptPayQRData(promptPayId, amount);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ชำระเงินด้วย QR Code</Text>
        <Text style={styles.subtitle}>สแกนจ่ายด้วย PromptPay</Text>
      </View>

      <Animated.View style={[styles.qrContainer, { transform: [{ scale: pulseAnim }] }]}>
        {status === 'waiting' && (
          <QRCode
            value={qrData}
            size={220}
            color={Colors.qr.foreground}
            backgroundColor={Colors.qr.background}
          />
        )}
        {status === 'confirmed' && (
          <View style={styles.statusIcon}>
            <Ionicons name="checkmark-circle" size={100} color={Colors.secondary} />
          </View>
        )}
        {status === 'expired' && (
          <View style={styles.statusIcon}>
            <Ionicons name="time" size={100} color={Colors.danger} />
          </View>
        )}
      </Animated.View>

      <View style={styles.amountContainer}>
        <Text style={styles.amountLabel}>ยอดชำระ</Text>
        <Text style={styles.amountValue}>฿{amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</Text>
      </View>

      <View style={styles.statusContainer}>
        {status === 'waiting' && (
          <>
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={18} color={Colors.text.secondary} />
              <Text style={styles.timerText}>หมดเวลาใน {formatTime(timeLeft)}</Text>
            </View>
            <View style={styles.waitingRow}>
              <Ionicons name="hourglass-outline" size={16} color={Colors.warning} />
              <Text style={styles.waitingText}>รอการชำระเงิน...</Text>
            </View>
          </>
        )}
        {status === 'confirmed' && (
          <View style={styles.confirmedRow}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.secondary} />
            <Text style={styles.confirmedText}>ชำระเงินสำเร็จ</Text>
          </View>
        )}
        {status === 'expired' && (
          <View style={styles.expiredRow}>
            <Ionicons name="close-circle" size={20} color={Colors.danger} />
            <Text style={styles.expiredText}>หมดเวลา</Text>
          </View>
        )}
      </View>

      {status === 'waiting' && onManualConfirm && (
        <TouchableOpacity
          style={styles.manualConfirmButton}
          onPress={() => setShowConfirmModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={Colors.surface} />
          <Text style={styles.manualConfirmText}>ยืนยันรับเงินแล้ว</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.actionButton,
          status === 'confirmed' && styles.actionButtonSuccess,
          status === 'expired' && styles.actionButtonDanger,
        ]}
        onPress={() => {
          if (status === 'confirmed') {
            onConfirmed?.();
          } else {
            onCancel?.();
          }
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.actionButtonText}>
          {status === 'confirmed' ? 'เสร็จสิ้น' : 'ยกเลิก'}
        </Text>
      </TouchableOpacity>

      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color="#059669" />
            </View>
            <Text style={styles.confirmTitle}>ยืนยันรับเงิน?</Text>
            <Text style={styles.confirmSub}>
              {cashierName ? `${cashierName} ยืนยันว่าได้รับเงินแล้ว` : 'ยืนยันว่าได้รับเงินจากลูกค้าแล้ว'}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOkBtn}
                onPress={() => {
                  if (isConfirming.current) return;
                  isConfirming.current = true;
                  setShowConfirmModal(false);
                  onManualConfirm?.();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmOkText}>ยืนยัน</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  qrContainer: {
    width: 260,
    height: 260,
    backgroundColor: Colors.qr.background,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  statusIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 4,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 15,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waitingText: {
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmedText: {
    fontSize: 16,
    color: Colors.secondary,
    fontWeight: '700',
  },
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expiredText: {
    fontSize: 16,
    color: Colors.danger,
    fontWeight: '700',
  },
  manualConfirmButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  manualConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
  actionButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.text.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonSuccess: {
    backgroundColor: Colors.secondary,
  },
  actionButtonDanger: {
    backgroundColor: Colors.danger,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  confirmIconWrap: {
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#134E4A',
    marginBottom: 8,
  },
  confirmSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmOkBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmOkText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
