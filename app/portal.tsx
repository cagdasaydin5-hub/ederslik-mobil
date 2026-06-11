import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert,
  ActivityIndicator, Modal, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Ogrenci = { id: number; isim: string; okul_no: string; veli_sifresi: string; dogum_gunu?: string };
type Odev = { id: number; icerik: string; bitis_tarihi: string; ogretmen_id: number; ogretmen_adi?: string; created_at: string };
type Duyuru = { id: number; icerik: string; ogretmen_id: number; ogretmen_adi?: string; created_at: string };
type Yildiz = { id: number; ogrenci_id: number; ogrenci_isim?: string; kategori: string; created_at: string };
type Yoklama = { id: number; ogrenci_id: number; ogrenci_isim?: string; tarih: string; ders_saati: number; veli_cevap?: string; ogretmen_id: number };
type Anket = { id: number; soru: string; secenekler: string[]; ogretmen_id: number; created_at: string };
type AnketCevap = { id: number; anket_id: number; ogrenci_id: number; secenek_index: number };
type OdevTam = { odev_id: number; ogrenci_id: number };
type Sinif = { id: number; sinif_adi: string };

const YILDIZ_KATEGORILERI = [
  '🏆 Haftanın Başarılısı', '📚 En Çok Kitap Okuyan', '✏️ En Düzenli Defter',
  '🤝 En Yardımsever', '🌟 En Çok Çaba Gösteren', '🎨 En Yaratıcı',
  '💬 En Güzel Sunum', '🏃 En Aktif Öğrenci', '😊 Haftanın Güler Yüzü',
  '🧹 En Düzenli Sınıf Sorumlusu',
];

const bugun = () => new Date().toISOString().split('T')[0];
const fmt = (t?: string) => {
  if (!t) return '';
  const d = t.split('T')[0];
  const [y, m, g] = d.split('-');
  return `${g}.${m}.${y}`;
};
const kalanGun = (b: string) => Math.ceil((new Date(b).getTime() - Date.now()) / 86400000);

// ─────────────────────────────────────────
// ÖDEVLER
// ─────────────────────────────────────────
function OdevlerSection({ odevler, ogrenciler, odevTam, sinifId, ogretmenId, ogrenciId, rol, kademe, onRefresh }: any) {
  const [modal, setModal] = useState(false);
  const [icerik, setIcerik] = useState('');
  const [bitis, setBitis] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [arsiv, setArsiv] = useState(false);

  const gun = bugun();
  const aktif = odevler.filter((o: Odev) => o.bitis_tarihi >= gun);
  const gecmis = odevler.filter((o: Odev) => o.bitis_tarihi < gun);
  const liste = arsiv ? gecmis : aktif;

  const onRefreshLocal = useCallback(async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }, [onRefresh]);

  const handleEkle = async () => {
    if (!icerik.trim()) { Alert.alert('Hata', 'İçerik girin.'); return; }
    if (!bitis.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Hata', 'Tarih: YYYY-AA-GG'); return; }
    setYukleniyor(true);
    await supabase.from('odevler').insert([{ sinif_id: sinifId, ogretmen_id: ogretmenId, icerik: icerik.trim(), bitis_tarihi: bitis }]);
    setYukleniyor(false); setModal(false); setIcerik(''); setBitis(''); onRefresh();
  };

  const handleSil = (id: number) => Alert.alert('Ödevi Sil', 'Emin misin?', [
    { text: 'İptal', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => {
      await supabase.from('odev_tamamlama').delete().eq('odev_id', id);
      await supabase.from('odevler').delete().eq('id', id);
      onRefresh();
    }},
  ]);

  const handleTamamla = async (odevId: number) => {
    if (!ogrenciId) return;
    const var_ = odevTam.some((t: OdevTam) => t.odev_id === odevId && t.ogrenci_id === ogrenciId);
    if (var_) await supabase.from('odev_tamamlama').delete().eq('odev_id', odevId).eq('ogrenci_id', ogrenciId);
    else await supabase.from('odev_tamamlama').insert([{ odev_id: odevId, ogrenci_id: ogrenciId }]);
    onRefresh();
  };

  return (
    <View className="flex-1">
      <View className="flex-row bg-white border-b border-slate-200">
        {[{ label: `Aktif (${aktif.length})`, val: false }, { label: `Arşiv (${gecmis.length})`, val: true }].map(({ label, val }) => (
          <Pressable key={String(val)} onPress={() => setArsiv(val)}
            className={`flex-1 py-3 items-center ${arsiv === val ? 'border-b-2 border-indigo-600' : ''}`}>
            <Text className={`font-bold text-sm ${arsiv === val ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-20" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshLocal} />}>
        {liste.length === 0 && <Text className="text-slate-400 text-center mt-10 italic">Ödev yok.</Text>}
        {liste.map((o: Odev) => {
          const kalan = kalanGun(o.bitis_tarihi);
          const tamamlandi = ogrenciId ? odevTam.some((t: OdevTam) => t.odev_id === o.id && t.ogrenci_id === ogrenciId) : false;
          const tamamSayisi = odevTam.filter((t: OdevTam) => t.odev_id === o.id).length;
          return (
            <View key={o.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
              {kademe === 'ortaokul' && o.ogretmen_adi && (
                <Text className="text-indigo-500 text-xs font-bold mb-1">{o.ogretmen_adi}</Text>
              )}
              <Text className="text-slate-800 font-semibold text-sm mb-2">{o.icerik}</Text>
              <View className="flex-row items-center justify-between">
                <Text className={`text-xs font-bold ${kalan < 0 ? 'text-slate-400' : kalan === 0 ? 'text-red-500' : kalan <= 2 ? 'text-orange-500' : 'text-green-600'}`}>
                  {kalan < 0 ? `${fmt(o.bitis_tarihi)} (geçti)` : kalan === 0 ? 'Bugün son!' : `${kalan} gün · ${fmt(o.bitis_tarihi)}`}
                </Text>
                <View className="flex-row items-center gap-2">
                  {rol === 'ogretmen' && <Text className="text-slate-400 text-xs">✓ {tamamSayisi}/{ogrenciler.length}</Text>}
                  {rol === 'veli' && (
                    <Pressable onPress={() => handleTamamla(o.id)}
                      className={`px-3 py-1 rounded-xl ${tamamlandi ? 'bg-green-100' : 'bg-slate-100'}`}>
                      <Text className={`text-xs font-bold ${tamamlandi ? 'text-green-700' : 'text-slate-500'}`}>
                        {tamamlandi ? '✅ Tamam' : 'Tamamla'}
                      </Text>
                    </Pressable>
                  )}
                  {rol === 'ogretmen' && ogretmenId === o.ogretmen_id && (
                    <Pressable onPress={() => handleSil(o.id)} className="bg-red-50 p-1.5 rounded-lg">
                      <Text className="text-red-400 text-xs">🗑️</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {rol === 'ogretmen' && !arsiv && (
        <Pressable onPress={() => setModal(true)}
          className="absolute bottom-4 right-4 bg-indigo-600 rounded-full w-14 h-14 items-center justify-center shadow-lg">
          <Text className="text-white text-3xl font-light">+</Text>
        </Pressable>
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white p-6">
          <Text className="text-xl font-black text-slate-800 mb-6">📚 Ödev Ekle</Text>
          <Text className="text-xs font-bold text-slate-600 mb-1">İçerik</Text>
          <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm mb-4 min-h-[100px]"
            placeholder="Ödev açıklaması..." value={icerik} onChangeText={setIcerik} multiline textAlignVertical="top" />
          <Text className="text-xs font-bold text-slate-600 mb-1">Bitiş Tarihi (YYYY-AA-GG)</Text>
          <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm mb-6"
            placeholder={bugun()} value={bitis} onChangeText={setBitis} keyboardType="numeric" />
          <Pressable onPress={handleEkle} disabled={yukleniyor} className="bg-indigo-600 py-4 rounded-xl mb-3">
            {yukleniyor ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-center">Ekle ✅</Text>}
          </Pressable>
          <Pressable onPress={() => { setModal(false); setIcerik(''); setBitis(''); }} className="bg-slate-100 py-3 rounded-xl">
            <Text className="text-slate-600 font-bold text-center">İptal</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// DUYURULAR
// ─────────────────────────────────────────
function DuyurularSection({ duyurular, sinifId, ogretmenId, rol, onRefresh }: any) {
  const [modal, setModal] = useState(false);
  const [icerik, setIcerik] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshLocal = useCallback(async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }, [onRefresh]);

  const handleEkle = async () => {
    if (!icerik.trim()) { Alert.alert('Hata', 'İçerik girin.'); return; }
    setYukleniyor(true);
    await supabase.from('duyurular').insert([{ sinif_id: sinifId, ogretmen_id: ogretmenId, icerik: icerik.trim() }]);
    setYukleniyor(false); setModal(false); setIcerik(''); onRefresh();
  };

  const handleSil = (id: number) => Alert.alert('Duyuruyu Sil', 'Emin misin?', [
    { text: 'İptal', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { await supabase.from('duyurular').delete().eq('id', id); onRefresh(); }},
  ]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-20" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshLocal} />}>
        {duyurular.length === 0 && <Text className="text-slate-400 text-center mt-10 italic">Duyuru yok.</Text>}
        {duyurular.map((d: Duyuru) => (
          <View key={d.id} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-3">
            {d.ogretmen_adi && <Text className="text-rose-400 text-xs font-bold mb-1">{d.ogretmen_adi}</Text>}
            <Text className="text-slate-800 font-semibold text-sm mb-2">{d.icerik}</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-400 text-xs">{fmt(d.created_at)}</Text>
              {rol === 'ogretmen' && ogretmenId === d.ogretmen_id && (
                <Pressable onPress={() => handleSil(d.id)} className="bg-red-100 p-1.5 rounded-lg">
                  <Text className="text-red-500 text-xs">🗑️</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {rol === 'ogretmen' && (
        <Pressable onPress={() => setModal(true)}
          className="absolute bottom-4 right-4 bg-rose-500 rounded-full w-14 h-14 items-center justify-center shadow-lg">
          <Text className="text-white text-3xl font-light">+</Text>
        </Pressable>
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white p-6">
          <Text className="text-xl font-black text-slate-800 mb-6">📢 Duyuru Ekle</Text>
          <Text className="text-xs font-bold text-slate-600 mb-1">İçerik</Text>
          <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm mb-6 min-h-[120px]"
            placeholder="Duyuru metni..." value={icerik} onChangeText={setIcerik} multiline textAlignVertical="top" />
          <Pressable onPress={handleEkle} disabled={yukleniyor} className="bg-rose-500 py-4 rounded-xl mb-3">
            {yukleniyor ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-center">Yayınla 📢</Text>}
          </Pressable>
          <Pressable onPress={() => { setModal(false); setIcerik(''); }} className="bg-slate-100 py-3 rounded-xl">
            <Text className="text-slate-600 font-bold text-center">İptal</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// ÖĞRENCİLER
// ─────────────────────────────────────────
function OgrencilerSection({ ogrenciler, sinifId, onRefresh }: any) {
  const [modal, setModal] = useState(false);
  const [isim, setIsim] = useState('');
  const [okulNo, setOkulNo] = useState('');
  const [veliSif, setVeliSif] = useState('');
  const [dogum, setDogum] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshLocal = useCallback(async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }, [onRefresh]);

  const handleEkle = async () => {
    if (!isim.trim() || !okulNo.trim() || !veliSif.trim()) { Alert.alert('Hata', 'İsim, okul no ve veli şifresi zorunlu.'); return; }
    setYukleniyor(true);
    await supabase.from('ogrenciler').insert([{ sinif_id: sinifId, isim: isim.trim(), okul_no: okulNo.trim(), veli_sifresi: veliSif.trim(), dogum_gunu: dogum || null }]);
    setYukleniyor(false); setModal(false); setIsim(''); setOkulNo(''); setVeliSif(''); setDogum(''); onRefresh();
  };

  const handleSil = (id: number, ad: string) => Alert.alert('Öğrenciyi Sil', `${ad} silinecek.`, [
    { text: 'İptal', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { await supabase.from('ogrenciler').delete().eq('id', id); onRefresh(); }},
  ]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-20" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshLocal} />}>
        <Text className="text-slate-400 text-xs mb-3 font-bold">{ogrenciler.length} öğrenci</Text>
        {ogrenciler.map((o: Ogrenci) => (
          <View key={o.id} className="bg-white rounded-2xl p-4 mb-2 flex-row items-center justify-between shadow-sm">
            <View className="flex-row items-center gap-3">
              <View className="bg-indigo-100 rounded-full w-10 h-10 items-center justify-center">
                <Text className="text-indigo-700 font-black text-xs">{o.okul_no}</Text>
              </View>
              <View>
                <Text className="text-slate-800 font-bold text-sm">{o.isim}</Text>
                {o.dogum_gunu && <Text className="text-slate-400 text-xs">🎂 {fmt(o.dogum_gunu)}</Text>}
              </View>
            </View>
            <Pressable onPress={() => handleSil(o.id, o.isim)} className="bg-red-50 p-2 rounded-lg">
              <Text className="text-red-400 text-xs">🗑️</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Pressable onPress={() => setModal(true)}
        className="absolute bottom-4 right-4 bg-indigo-600 rounded-full w-14 h-14 items-center justify-center shadow-lg">
        <Text className="text-white text-3xl font-light">+</Text>
      </Pressable>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView className="flex-1 bg-white p-6">
          <Text className="text-xl font-black text-slate-800 mb-6">👤 Öğrenci Ekle</Text>
          {[
            { label: 'Okul No', val: okulNo, set: setOkulNo, ph: '101', kb: 'numeric' as const },
            { label: 'Ad Soyad', val: isim, set: setIsim, ph: 'Ahmet Yılmaz', kb: 'default' as const },
            { label: 'Veli Şifresi', val: veliSif, set: setVeliSif, ph: '1234', kb: 'numeric' as const },
            { label: 'Doğum Günü · opsiyonel (YYYY-AA-GG)', val: dogum, set: setDogum, ph: '2015-06-15', kb: 'numeric' as const },
          ].map(({ label, val, set, ph, kb }) => (
            <View key={label} className="mb-4">
              <Text className="text-xs font-bold text-slate-600 mb-1">{label}</Text>
              <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                placeholder={ph} value={val} onChangeText={set} keyboardType={kb} />
            </View>
          ))}
          <Pressable onPress={handleEkle} disabled={yukleniyor} className="bg-indigo-600 py-4 rounded-xl mb-3 mt-2">
            {yukleniyor ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-center">Ekle ✅</Text>}
          </Pressable>
          <Pressable onPress={() => setModal(false)} className="bg-slate-100 py-3 rounded-xl">
            <Text className="text-slate-600 font-bold text-center">İptal</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// YILDIZLAR
// ─────────────────────────────────────────
function YildizlarSection({ yildizlar, ogrenciler, sinifId, ogretmenId, ogrenciId, rol, onRefresh }: any) {
  const [modal, setModal] = useState(false);
  const [secOgrId, setSecOgrId] = useState('');
  const [secKat, setSecKat] = useState(YILDIZ_KATEGORILERI[0]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const liste = rol === 'veli' && ogrenciId ? yildizlar.filter((y: Yildiz) => y.ogrenci_id === ogrenciId) : yildizlar;
  const onRefreshLocal = useCallback(async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }, [onRefresh]);

  const handleEkle = async () => {
    if (!secOgrId) { Alert.alert('Hata', 'Öğrenci seçin.'); return; }
    setYukleniyor(true);
    await supabase.from('yildizlar').insert([{ sinif_id: sinifId, ogrenci_id: Number(secOgrId), kategori: secKat }]);
    setYukleniyor(false); setModal(false); onRefresh();
  };

  const handleSil = (id: number) => Alert.alert('Yıldızı Sil', 'Emin misin?', [
    { text: 'İptal', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { await supabase.from('yildizlar').delete().eq('id', id); onRefresh(); }},
  ]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-20" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshLocal} />}>
        {liste.length === 0 && <Text className="text-slate-400 text-center mt-10 italic">Yıldız yok.</Text>}
        {liste.map((y: Yildiz) => (
          <View key={y.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-2 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-amber-800 font-black text-sm">👑 {y.kategori}</Text>
              <Text className="text-slate-700 font-semibold text-sm mt-0.5">{y.ogrenci_isim}</Text>
              <Text className="text-slate-400 text-xs">{fmt(y.created_at)}</Text>
            </View>
            {rol === 'ogretmen' && (
              <Pressable onPress={() => handleSil(y.id)} className="bg-red-50 p-2 rounded-lg ml-2">
                <Text className="text-red-400 text-xs">🗑️</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      {rol === 'ogretmen' && (
        <Pressable onPress={() => setModal(true)}
          className="absolute bottom-4 right-4 bg-amber-500 rounded-full w-14 h-14 items-center justify-center shadow-lg">
          <Text className="text-white text-3xl font-light">+</Text>
        </Pressable>
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView className="flex-1 bg-white p-6">
          <Text className="text-xl font-black text-slate-800 mb-6">⭐ Yıldız Ver</Text>
          <Text className="text-xs font-bold text-slate-600 mb-1">Kategori</Text>
          <View className="border-2 border-slate-200 rounded-xl overflow-hidden mb-4">
            <Picker selectedValue={secKat} onValueChange={setSecKat}>
              {YILDIZ_KATEGORILERI.map(k => <Picker.Item key={k} label={k} value={k} />)}
            </Picker>
          </View>
          <Text className="text-xs font-bold text-slate-600 mb-1">Öğrenci</Text>
          <View className="border-2 border-slate-200 rounded-xl overflow-hidden mb-6">
            <Picker selectedValue={secOgrId} onValueChange={setSecOgrId}>
              <Picker.Item label="-- Seçin --" value="" />
              {ogrenciler.map((o: Ogrenci) => <Picker.Item key={o.id} label={`${o.okul_no} · ${o.isim}`} value={String(o.id)} />)}
            </Picker>
          </View>
          <Pressable onPress={handleEkle} disabled={yukleniyor} className="bg-amber-500 py-4 rounded-xl mb-3">
            {yukleniyor ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-center">Yıldız Ver ⭐</Text>}
          </Pressable>
          <Pressable onPress={() => setModal(false)} className="bg-slate-100 py-3 rounded-xl">
            <Text className="text-slate-600 font-bold text-center">İptal</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// YOKLAMA
// ─────────────────────────────────────────
function YoklamaSection({ yoklamalar, ogrenciler, sinifId, ogretmenId, ogrenciId, rol, onRefresh }: any) {
  const [modal, setModal] = useState(false);
  const [secOgrId, setSecOgrId] = useState('');
  const [tarih, setTarih] = useState(bugun());
  const [ders, setDers] = useState('1');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const liste = rol === 'veli' && ogrenciId ? yoklamalar.filter((y: Yoklama) => y.ogrenci_id === ogrenciId) : yoklamalar;
  const onRefreshLocal = useCallback(async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }, [onRefresh]);

  const handleEkle = async () => {
    if (!secOgrId) { Alert.alert('Hata', 'Öğrenci seçin.'); return; }
    if (!tarih.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Hata', 'Tarih: YYYY-AA-GG'); return; }
    setYukleniyor(true);
    await supabase.from('yoklamalar').insert([{ sinif_id: sinifId, ogretmen_id: ogretmenId, ogrenci_id: Number(secOgrId), tarih, ders_saati: Number(ders) }]);
    setYukleniyor(false); setModal(false); onRefresh();
  };

  const handleCevap = async (id: number, cevap: string) => {
    await supabase.from('yoklamalar').update({ veli_cevap: cevap }).eq('id', id);
    onRefresh();
  };

  const handleSil = (id: number) => Alert.alert('Yoklamayı Sil', 'Emin misin?', [
    { text: 'İptal', style: 'cancel' },
    { text: 'Sil', style: 'destructive', onPress: async () => { await supabase.from('yoklamalar').delete().eq('id', id); onRefresh(); }},
  ]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-20" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshLocal} />}>
        {liste.length === 0 && <Text className="text-slate-400 text-center mt-10 italic">Yoklama kaydı yok.</Text>}
        {liste.map((y: Yoklama) => (
          <View key={y.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-slate-800 font-bold text-sm">{y.ogrenci_isim}</Text>
              <Text className="text-slate-500 text-xs">{fmt(y.tarih)} · {y.ders_saati}. ders</Text>
            </View>
            {rol === 'ogretmen' ? (
              <View className="flex-row items-center justify-between">
                <View className={`px-3 py-1 rounded-full ${y.veli_cevap === 'var' ? 'bg-green-100' : y.veli_cevap === 'yok' ? 'bg-red-100' : 'bg-slate-100'}`}>
                  <Text className={`text-xs font-bold ${y.veli_cevap === 'var' ? 'text-green-700' : y.veli_cevap === 'yok' ? 'text-red-700' : 'text-slate-500'}`}>
                    {y.veli_cevap === 'var' ? '✅ Haberdar' : y.veli_cevap === 'yok' ? '❌ Habersiz' : '⏳ Bekliyor'}
                  </Text>
                </View>
                <Pressable onPress={() => handleSil(y.id)} className="bg-red-50 p-1.5 rounded-lg">
                  <Text className="text-red-400 text-xs">🗑️</Text>
                </Pressable>
              </View>
            ) : !y.veli_cevap ? (
              <View className="flex-row gap-2">
                <Pressable onPress={() => handleCevap(y.id, 'var')} className="flex-1 bg-green-100 py-2 rounded-xl">
                  <Text className="text-green-700 font-bold text-center text-xs">✅ Haberim Var</Text>
                </Pressable>
                <Pressable onPress={() => handleCevap(y.id, 'yok')} className="flex-1 bg-red-100 py-2 rounded-xl">
                  <Text className="text-red-700 font-bold text-center text-xs">❌ Haberim Yoktu</Text>
                </Pressable>
              </View>
            ) : (
              <View className={`px-3 py-1 rounded-full self-start ${y.veli_cevap === 'var' ? 'bg-green-100' : 'bg-red-100'}`}>
                <Text className={`text-xs font-bold ${y.veli_cevap === 'var' ? 'text-green-700' : 'text-red-700'}`}>
                  {y.veli_cevap === 'var' ? '✅ Haberim Vardı' : '❌ Haberim Yoktu'}
                </Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {rol === 'ogretmen' && (
        <Pressable onPress={() => setModal(true)}
          className="absolute bottom-4 right-4 bg-slate-800 rounded-full w-14 h-14 items-center justify-center shadow-lg">
          <Text className="text-white text-3xl font-light">+</Text>
        </Pressable>
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView className="flex-1 bg-white p-6">
          <Text className="text-xl font-black text-slate-800 mb-6">✓ Yoklama Ekle</Text>
          <Text className="text-xs font-bold text-slate-600 mb-1">Öğrenci</Text>
          <View className="border-2 border-slate-200 rounded-xl overflow-hidden mb-4">
            <Picker selectedValue={secOgrId} onValueChange={setSecOgrId}>
              <Picker.Item label="-- Seçin --" value="" />
              {ogrenciler.map((o: Ogrenci) => <Picker.Item key={o.id} label={`${o.okul_no} · ${o.isim}`} value={String(o.id)} />)}
            </Picker>
          </View>
          <Text className="text-xs font-bold text-slate-600 mb-1">Tarih (YYYY-AA-GG)</Text>
          <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm mb-4"
            value={tarih} onChangeText={setTarih} keyboardType="numeric" />
          <Text className="text-xs font-bold text-slate-600 mb-1">Ders Saati</Text>
          <View className="border-2 border-slate-200 rounded-xl overflow-hidden mb-6">
            <Picker selectedValue={ders} onValueChange={setDers}>
              {[1,2,3,4,5,6,7,8].map(n => <Picker.Item key={n} label={`${n}. Ders`} value={String(n)} />)}
            </Picker>
          </View>
          <Pressable onPress={handleEkle} disabled={yukleniyor} className="bg-slate-800 py-4 rounded-xl mb-3">
            {yukleniyor ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-center">Kaydet ✓</Text>}
          </Pressable>
          <Pressable onPress={() => setModal(false)} className="bg-slate-100 py-3 rounded-xl">
            <Text className="text-slate-600 font-bold text-center">İptal</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────
// ANKETLER (Veli)
// ─────────────────────────────────────────
function AnketlerSection({ anketler, anketCevaplar, ogrenciId, onRefresh }: any) {
  const [secim, setSecim] = useState<{ [id: number]: number }>({});
  const [gonderiyor, setGonderiyor] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshLocal = useCallback(async () => { setRefreshing(true); await onRefresh(); setRefreshing(false); }, [onRefresh]);

  const handleCevapla = async (anketId: number) => {
    if (secim[anketId] === undefined) { Alert.alert('Hata', 'Seçenek seçin.'); return; }
    setGonderiyor(anketId);
    await supabase.from('anket_cevaplar').insert([{ anket_id: anketId, ogrenci_id: ogrenciId, secenek_index: secim[anketId] }]);
    setGonderiyor(null); onRefresh();
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-6" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshLocal} />}>
      {anketler.length === 0 && <Text className="text-slate-400 text-center mt-10 italic">Anket yok.</Text>}
      {anketler.map((a: Anket) => {
        const cevap = anketCevaplar.find((c: AnketCevap) => c.anket_id === a.id && c.ogrenci_id === ogrenciId);
        return (
          <View key={a.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <Text className="text-slate-800 font-black text-sm mb-3">{a.soru}</Text>
            {cevap ? (
              <View className="bg-green-50 p-3 rounded-xl">
                <Text className="text-green-700 font-bold text-sm">✅ {a.secenekler[cevap.secenek_index]}</Text>
              </View>
            ) : (
              <>
                {a.secenekler.map((s: string, i: number) => (
                  <Pressable key={i} onPress={() => setSecim(p => ({ ...p, [a.id]: i }))}
                    className={`p-3 rounded-xl mb-2 border-2 ${secim[a.id] === i ? 'bg-indigo-100 border-indigo-400' : 'bg-slate-50 border-slate-200'}`}>
                    <Text className={`font-bold text-sm ${secim[a.id] === i ? 'text-indigo-700' : 'text-slate-600'}`}>{s}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => handleCevapla(a.id)} disabled={gonderiyor === a.id}
                  className="bg-indigo-600 py-3 rounded-xl mt-1">
                  {gonderiyor === a.id ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-center">Gönder 📊</Text>}
                </Pressable>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
const OGRETMEN_TABS = [
  { key: 'odevler', emoji: '📚', title: 'Ödevler' },
  { key: 'duyurular', emoji: '📢', title: 'Duyurular' },
  { key: 'ogrenciler', emoji: '👥', title: 'Öğrenciler' },
  { key: 'yildizlar', emoji: '⭐', title: 'Yıldızlar' },
  { key: 'yoklama', emoji: '✓', title: 'Yoklama' },
];
const VELI_TABS = [
  { key: 'odevler', emoji: '📚', title: 'Ödevler' },
  { key: 'duyurular', emoji: '📢', title: 'Duyurular' },
  { key: 'yildizlar', emoji: '⭐', title: 'Yıldızlar' },
  { key: 'yoklama', emoji: '✓', title: 'Yoklama' },
  { key: 'anketler', emoji: '📊', title: 'Anketler' },
];

export default function Portal() {
  const params = useLocalSearchParams<{
    rol: string; ogretmenId?: string; adSoyad?: string; kademe?: string;
    branslar?: string; okulId?: string; sinifId?: string;
    ogrenciId?: string; ogrenciIsim?: string;
  }>();

  const rol = params.rol;
  const ogretmenId = params.ogretmenId ? Number(params.ogretmenId) : null;
  const ogrenciId = params.ogrenciId ? Number(params.ogrenciId) : null;
  const kademe = params.kademe ?? '';
  const insets = useSafeAreaInsets();

  const [aktifTab, setAktifTab] = useState('odevler');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [siniflar, setSiniflar] = useState<Sinif[]>([]);
  const [secilenSinifId, setSecilenSinifId] = useState<number | null>(params.sinifId ? Number(params.sinifId) : null);

  const [ogrenciler, setOgrenciler] = useState<Ogrenci[]>([]);
  const [odevler, setOdevler] = useState<Odev[]>([]);
  const [duyurular, setDuyurular] = useState<Duyuru[]>([]);
  const [yildizlar, setYildizlar] = useState<Yildiz[]>([]);
  const [yoklamalar, setYoklamalar] = useState<Yoklama[]>([]);
  const [anketler, setAnketler] = useState<Anket[]>([]);
  const [odevTam, setOdevTam] = useState<OdevTam[]>([]);
  const [anketCevaplar, setAnketCevaplar] = useState<AnketCevap[]>([]);

  useEffect(() => {
    if (rol !== 'ogretmen' || kademe !== 'ortaokul' || !ogretmenId) return;
    supabase.from('ogretmen_siniflar').select('siniflar(id, sinif_adi)').eq('ogretmen_id', ogretmenId)
      .then(({ data }) => {
        if (data) setSiniflar(data.map((d: any) => d.siniflar).filter(Boolean));
      });
  }, []);

  const fetchAll = useCallback(async () => {
    if (!secilenSinifId) return;
    setYukleniyor(true);
    const sid = secilenSinifId;
    const [{ data: ogr }, { data: odev }, { data: duy }, { data: yil }, { data: yok }, { data: ank }] = await Promise.all([
      supabase.from('ogrenciler').select('*').eq('sinif_id', sid).order('okul_no'),
      supabase.from('odevler').select('*, ogretmenler(ad_soyad)').eq('sinif_id', sid).order('created_at', { ascending: false }),
      supabase.from('duyurular').select('*, ogretmenler(ad_soyad)').eq('sinif_id', sid).order('created_at', { ascending: false }),
      supabase.from('yildizlar').select('*, ogrenciler(isim)').eq('sinif_id', sid).order('created_at', { ascending: false }),
      supabase.from('yoklamalar').select('*, ogrenciler(isim)').eq('sinif_id', sid).order('created_at', { ascending: false }),
      supabase.from('anketler').select('*').eq('sinif_id', sid).order('created_at', { ascending: false }),
    ]);

    if (ogr) setOgrenciler(ogr);
    if (duy) setDuyurular(duy.map((d: any) => ({ ...d, ogretmen_adi: d.ogretmenler?.ad_soyad })));
    if (yil) setYildizlar(yil.map((y: any) => ({ ...y, ogrenci_isim: y.ogrenciler?.isim })));
    if (yok) setYoklamalar(yok.map((y: any) => ({ ...y, ogrenci_isim: y.ogrenciler?.isim })));

    if (odev) {
      setOdevler(odev.map((o: any) => ({ ...o, ogretmen_adi: o.ogretmenler?.ad_soyad })));
      if (odev.length > 0) {
        const { data: tam } = await supabase.from('odev_tamamlama').select('*').in('odev_id', odev.map((o: any) => o.id));
        if (tam) setOdevTam(tam);
      }
    }
    if (ank) {
      setAnketler(ank);
      if (ank.length > 0) {
        const { data: cev } = await supabase.from('anket_cevaplar').select('*').in('anket_id', ank.map((a: any) => a.id));
        if (cev) setAnketCevaplar(cev);
      }
    }
    setYukleniyor(false);
  }, [secilenSinifId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tabs = rol === 'ogretmen' ? OGRETMEN_TABS : VELI_TABS;
  const baslik = rol === 'ogretmen' ? params.adSoyad : params.ogrenciIsim;

  return (
    <View className="flex-1 bg-slate-50">
      <Stack.Screen options={{ gestureEnabled: false }} />
      <View className="bg-indigo-600 pb-3 px-4 flex-row items-center justify-between" style={{ paddingTop: insets.top + 8 }}>
        <View>
          <Text className="text-white font-black text-lg">{baslik}</Text>
          <Text className="text-indigo-200 text-xs">
            {rol === 'ogretmen' ? `👩‍🏫 ${kademe === 'ilkokul' ? 'İlkokul' : 'Ortaokul'} Öğretmeni` : '👨‍👩‍👦 Veli'}
          </Text>
        </View>
        <Pressable onPress={() => router.replace('/')} className="bg-white/20 px-3 py-1.5 rounded-xl">
          <Text className="text-white text-xs font-bold">Çıkış</Text>
        </Pressable>
      </View>

      {rol === 'ogretmen' && kademe === 'ortaokul' && siniflar.length > 0 && (
        <View className="bg-indigo-50 border-b border-indigo-100 px-4 py-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {siniflar.map(s => (
              <Pressable key={s.id} onPress={() => setSecilenSinifId(s.id)}
                className={`px-4 py-1.5 rounded-full mr-2 ${secilenSinifId === s.id ? 'bg-indigo-600' : 'bg-white border border-indigo-200'}`}>
                <Text className={`font-bold text-sm ${secilenSinifId === s.id ? 'text-white' : 'text-indigo-700'}`}>{s.sinif_adi}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View className="flex-1">
        {yukleniyor ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="text-slate-400 text-sm mt-3">Yükleniyor...</Text>
          </View>
        ) : (
          <>
            {aktifTab === 'odevler' && <OdevlerSection odevler={odevler} ogrenciler={ogrenciler} odevTam={odevTam} sinifId={secilenSinifId!} ogretmenId={ogretmenId} ogrenciId={ogrenciId} rol={rol} kademe={kademe} onRefresh={fetchAll} />}
            {aktifTab === 'duyurular' && <DuyurularSection duyurular={duyurular} sinifId={secilenSinifId!} ogretmenId={ogretmenId} rol={rol} onRefresh={fetchAll} />}
            {aktifTab === 'ogrenciler' && rol === 'ogretmen' && <OgrencilerSection ogrenciler={ogrenciler} sinifId={secilenSinifId!} onRefresh={fetchAll} />}
            {aktifTab === 'yildizlar' && <YildizlarSection yildizlar={yildizlar} ogrenciler={ogrenciler} sinifId={secilenSinifId!} ogretmenId={ogretmenId} ogrenciId={ogrenciId} rol={rol} onRefresh={fetchAll} />}
            {aktifTab === 'yoklama' && <YoklamaSection yoklamalar={yoklamalar} ogrenciler={ogrenciler} sinifId={secilenSinifId!} ogretmenId={ogretmenId} ogrenciId={ogrenciId} rol={rol} onRefresh={fetchAll} />}
            {aktifTab === 'anketler' && rol === 'veli' && <AnketlerSection anketler={anketler} anketCevaplar={anketCevaplar} ogrenciId={ogrenciId} onRefresh={fetchAll} />}
          </>
        )}
      </View>

      <View className="bg-white border-t border-slate-200 flex-row" style={{ paddingBottom: insets.bottom }}>
        {tabs.map(tab => (
          <Pressable key={tab.key} onPress={() => setAktifTab(tab.key)}
            className={`flex-1 pt-2 pb-1 items-center border-t-2 ${aktifTab === tab.key ? 'border-indigo-600' : 'border-transparent'}`}>
            <Text className="text-xl">{tab.emoji}</Text>
            <Text className={`text-xs font-bold mt-0.5 ${aktifTab === tab.key ? 'text-indigo-600' : 'text-slate-400'}`}>{tab.title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
