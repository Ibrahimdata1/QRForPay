import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../src/lib/supabase';
import { Product, Category } from '../src/types';
import { Colors } from '../constants/colors';

// Ensure 'product-images' bucket exists in Supabase Storage (public)

interface ProductFormModalProps {
  visible: boolean;
  product: Product | null; // null = add new
  categories: Category[];
  shopId: string;
  onSave: (data: Partial<Product> & { name: string; price: number }) => Promise<void>;
  onClose: () => void;
}

export function ProductFormModal({ visible, product, categories, shopId, onSave, onClose }: ProductFormModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(product?.name ?? '');
      setPrice(product ? String(product.price) : '');
      setStock(product ? String(product.stock) : '0');
      setCategoryId(product?.category_id ?? null);
      setImageUrl(product?.image_url ?? '');
    }
  }, [visible, product]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('ต้องการสิทธิ์เข้าถึงคลังรูปภาพ');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const path = `${shopId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);

      setImageUrl(urlData.publicUrl);
    } catch (e: any) {
      Alert.alert('อัปโหลดรูปไม่สำเร็จ', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('กรุณากรอกชื่อสินค้า'); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) { Alert.alert('กรุณากรอกราคาที่ถูกต้อง'); return; }
    setSaving(true);
    try {
      await onSave({
        ...(product?.id ? { id: product.id } : {}),
        name: name.trim(),
        price: priceNum,
        stock: parseInt(stock) || 0,
        category_id: categoryId ?? undefined,
        image_url: imageUrl || undefined,
      });
      onClose();
    } catch (e: any) {
      Alert.alert('เกิดข้อผิดพลาด', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Image Picker */}
            <View style={styles.imagePickerWrapper}>
              <TouchableOpacity
                style={imageUrl ? styles.imagePreviewBox : styles.imagePlaceholderBox}
                onPress={handlePickImage}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading ? (
                  <ActivityIndicator color={Colors.primary} size="large" />
                ) : imageUrl ? (
                  <>
                    <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                    <View style={styles.imageEditOverlay}>
                      <Ionicons name="pencil" size={14} color="#FFFFFF" />
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
                    <Text style={styles.imagePlaceholderText}>เพิ่มรูป</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={styles.label}>ชื่อสินค้า *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="เช่น ข้าวผัดกระเพรา"
              placeholderTextColor="#9CA3AF"
            />

            {/* Price + Stock row */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>ราคา (฿) *</Text>
                <TextInput
                  style={styles.input}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>สต็อก</Text>
                <TextInput
                  style={styles.input}
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Category */}
            <Text style={styles.label}>หมวดหมู่</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              <TouchableOpacity
                style={[styles.catPill, categoryId === null && styles.catPillActive]}
                onPress={() => setCategoryId(null)}
              >
                <Text style={[styles.catPillText, categoryId === null && styles.catPillTextActive]}>ไม่ระบุ</Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPill, categoryId === cat.id && styles.catPillActive]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text style={[styles.catPillText, categoryId === cat.id && styles.catPillTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ height: 16 }} />
          </ScrollView>
          </KeyboardAvoidingView>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>{product ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#134E4A' },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#134E4A',
    backgroundColor: '#F0FDF9',
  },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  catScroll: { marginTop: 4 },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  catPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catPillText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catPillTextActive: { color: '#FFFFFF' },
  saveBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  imagePickerWrapper: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  imagePlaceholderBox: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8ECF0',
    borderStyle: 'dashed',
    backgroundColor: '#F4F6F8',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  imagePlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 2,
  },
  imagePreviewBox: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  imageEditOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
