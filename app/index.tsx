import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

const BRANSLAR = [
  'Türkçe', 'Matematik', 'Fen Bilimleri', 'Sosyal Bilgiler',
  'T.C. İnkılap Tarihi ve Atatürkçülük', 'Din Kültürü ve Ahlak Bilgisi',
  'İngilizce', 'Almanca', 'Fransızca', 'Beden Eğitimi ve Spor',
  'Görsel Sanatlar', 'Müzik', 'Teknoloji ve Tasarım',
  'Bilişim Teknolojileri', 'Drama', 'Rehberlik', 'Özel Eğitim',
];
const HARFLER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

type Okul = { id: number; okul_adi: string };
type Sinif = { id: number; sinif_adi: string };

export default function GirisEkrani() {
  const [adim, setAdim] = useState('rol_sec');
  const [iller, setIller] = useState<string[]>([]);
  const [ilceler, setIlceler] = useState<string[]>([]);
  const [okullar, setOkullar] = useState<Okul[]>([]);
  const [secilenIl, setSecilenIl] = useState('');
  const [secilenIlce, setSecilenIlce] = useState('');
  const [secilenOkulId, setSecilenOkulId] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [davetKodu, setDavetKodu] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifre2, setSifre2] = useState('');
  const [kademe, setKademe] = useState('');
  const [secilenBranslar, setSecilenBranslar] = useState<string[]>([]);
  const [sinifNo, setSinifNo] = useState('');
  const [sinifHarf, setSinifHarf] = useState('');
  const [secilenSiniflar, setSecilenSiniflar] = useState<string[]>([]);
  const [veliOkulNo, setVeliOkulNo] = useState('');
  const [veliSiniflar, setVeliSiniflar] = useState<Sinif[]>([]);
  const [secilenVeliSinifId, setSecilenVeliSinifId] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const sinifAdi = sinifNo && sinifHarf ? `${sinifNo}-${sinifHarf}` : '';
  const sinifNoListesi = kademe === 'ilkokul' ? [1, 2, 3, 4] : kademe === 'ortaokul' ? [5, 6, 7, 8] : [];

  useEffect(() => {
    supabase.from('okullar').select('il_adi').order('il_adi').then(({ data }) => {
      if (data) setIller([...new Set(data.map((i: any) => i.il_adi as string))]);
    });
  }, []);

  useEffect(() => {
    if (!secilenIl) return;
    setSecilenIlce(''); setSecilenOkulId(''); setOkullar([]);
    supabase.from('okullar').select('ilce_adi').eq('il_adi', secilenIl).then(({ data }) => {
      if (data) setIlceler([...new Set(data.map((i: any) => i.ilce_adi as string))]);
    });
  }, [secilenIl]);

  useEffect(() => {
    if (!secilenIlce) return;
    setSecilenOkulId('');
    supabase.from('okullar').select('id, okul_adi').eq('il_adi', secilenIl).eq('ilce_adi', secilenIlce).order('okul_adi').then(({ data }) => {
      if (data) setOkullar(data);
    });
  }, [secilenIlce]);

  useEffect(() => {
    if (!secilenOkulId || adim !== 'veli_sinif_sec') return;
    supabase.from('siniflar').select('*').eq('okul_id', Number(secilenOkulId)).order('sinif_adi').then(({ data }) => {
      if (data) setVeliSiniflar(data);
    });
  }, [secilenOkulId, adim]);

  const handleBransToggle = (brans: string) => {
    setSecilenBranslar(prev =>
      prev.includes(brans) ? prev.filter(b => b !== brans) : [...prev, brans]
    );
  };

  const handleDavetKoduDogrula = async () => {
    setHata('');
    if (!davetKodu.trim()) { setHata('Davet kodu giriniz.'); return; }
    setYukleniyor(true);
    const { data } = await supabase.from('davet_kodlari').select('*').eq('kod', davetKodu.trim()).eq('kullanildi', false).single();
    setYukleniyor(false);
    if (!data) { setHata('❌ Geçersiz veya kullanılmış davet kodu.'); return; }
    setAdim('kayit_okul_sec');
  };

  const handleOgretmenKayit = async () => {
    setHata('');
    if (!adSoyad.trim()) { setHata('Ad soyad giriniz.'); return; }
    if (sifre.length < 4) { setHata('Şifre en az 4 karakter olmalı.'); return; }
    if (sifre !== sifre2) { setHata('Şifreler eşleşmiyor.'); return; }
    if (!kademe) { setHata('Kademe seçiniz.'); return; }
    if (kademe === 'ortaokul' && secilenBranslar.length === 0) { setHata('En az bir branş seçiniz.'); return; }
    if (kademe === 'ilkokul' && (!sinifNo || !sinifHarf)) { setHata('Sınıf seçiniz.'); return; }
    if (kademe === 'ortaokul' && secilenSiniflar.length === 0) { setHata('En az bir sınıf ekleyiniz.'); return; }

    setYukleniyor(true);
    let ilkSinifId: number;

    if (kademe === 'ilkokul') {
      const { data: ms } = await supabase.from('siniflar').select('*').eq('okul_id', Number(secilenOkulId)).eq('sinif_adi', sinifAdi).single();
      if (ms) {
        ilkSinifId = ms.id;
      } else {
        const { data: ns } = await supabase.from('siniflar').insert([{ okul_id: Number(secilenOkulId), sinif_adi: sinifAdi, kademe: 'ilkokul' }]).select().single();
        ilkSinifId = ns.id;
      }
    } else {
      const ilkSinif = secilenSiniflar[0];
      const { data: ms } = await supabase.from('siniflar').select('*').eq('okul_id', Number(secilenOkulId)).eq('sinif_adi', ilkSinif).single();
      if (ms) {
        ilkSinifId = ms.id;
      } else {
        const { data: ns } = await supabase.from('siniflar').insert([{ okul_id: Number(secilenOkulId), sinif_adi: ilkSinif, kademe: 'ortaokul' }]).select().single();
        ilkSinifId = ns.id;
      }
    }

    const { data: ogretmen, error: ogretmenHata } = await supabase.from('ogretmenler').insert([{
      okul_id: Number(secilenOkulId),
      sinif_id: ilkSinifId!,
      ad_soyad: adSoyad.trim(),
      sifre,
      kademe,
      branslar: kademe === 'ilkokul' ? [] : secilenBranslar,
    }]).select().single();

    if (ogretmenHata) { setHata('Kayıt hatası: ' + ogretmenHata.message); setYukleniyor(false); return; }

    if (kademe === 'ortaokul') {
      for (const sAdi of secilenSiniflar) {
        let sinifIdTemp: number;
        const { data: ms } = await supabase.from('siniflar').select('*').eq('okul_id', Number(secilenOkulId)).eq('sinif_adi', sAdi).single();
        if (ms) { sinifIdTemp = ms.id; }
        else {
          const { data: ns } = await supabase.from('siniflar').insert([{ okul_id: Number(secilenOkulId), sinif_adi: sAdi, kademe: 'ortaokul' }]).select().single();
          sinifIdTemp = ns.id;
        }
        await supabase.from('ogretmen_siniflar').insert([{ ogretmen_id: ogretmen.id, sinif_id: sinifIdTemp! }]);
      }
    }

    await supabase.from('davet_kodlari').update({ kullanildi: true, kullanan_ogretmen_id: ogretmen.id }).eq('kod', davetKodu.trim());
    setYukleniyor(false);
    router.replace({ pathname: '/portal', params: { rol: 'ogretmen', ogretmenId: String(ogretmen.id), adSoyad: ogretmen.ad_soyad, kademe: ogretmen.kademe, branslar: JSON.stringify(ogretmen.branslar ?? []), okulId: String(ogretmen.okul_id), sinifId: String(ogretmen.sinif_id) } });
  };

  const handleOgretmenGiris = async () => {
    setHata('');
    if (!adSoyad.trim()) { setHata('Ad soyad giriniz.'); return; }
    setYukleniyor(true);
    const { data, error } = await supabase.from('ogretmenler')
      .select('*').eq('okul_id', Number(secilenOkulId)).eq('ad_soyad', adSoyad.trim()).eq('sifre', sifre).single();
    setYukleniyor(false);
    if (error || !data) { setHata('❌ Bilgiler hatalı veya kayıt bulunamadı.'); return; }
    router.replace({ pathname: '/portal', params: { rol: 'ogretmen', ogretmenId: String(data.id), adSoyad: data.ad_soyad, kademe: data.kademe, branslar: JSON.stringify(data.branslar ?? []), okulId: String(data.okul_id), sinifId: String(data.sinif_id) } });
  };

  const handleVeliGiris = async () => {
    setHata('');
    if (!veliOkulNo.trim()) { setHata('Okul numarası giriniz.'); return; }
    setYukleniyor(true);
    const { data, error } = await supabase.from('ogrenciler')
      .select('*, siniflar(*, okullar(*))')
      .eq('sinif_id', secilenVeliSinifId)
      .eq('okul_no', veliOkulNo.trim())
      .eq('veli_sifresi', sifre)
      .single();
    setYukleniyor(false);
    if (error || !data) { setHata('❌ Bilgiler hatalı, öğrenci bulunamadı.'); return; }
    router.replace({ pathname: '/portal', params: { rol: 'veli', ogrenciId: String(data.id), ogrenciIsim: data.isim, sinifId: String(data.sinif_id) } });
  };

  const geri = (hedef: string, sifirla?: () => void) => {
    setHata('');
    sifirla?.();
    setAdim(hedef);
  };

  const OkulSecimFormu = ({ onIleri, onGeri }: { onIleri: () => void; onGeri: () => void }) => (
    <View className="gap-3">
      <Text className="text-slate-500 text-xs text-center">Okulunuzu seçin</Text>

      <View className="border-2 border-slate-200 rounded-xl overflow-hidden">
        <Picker selectedValue={secilenIl} onValueChange={v => setSecilenIl(v)}>
          <Picker.Item label="-- İl Seçiniz --" value="" />
          {iller.map(il => <Picker.Item key={il} label={il} value={il} />)}
        </Picker>
      </View>

      <View className="border-2 border-slate-200 rounded-xl overflow-hidden">
        <Picker selectedValue={secilenIlce} onValueChange={v => setSecilenIlce(v)} enabled={!!secilenIl}>
          <Picker.Item label="-- İlçe Seçiniz --" value="" />
          {ilceler.map(ilce => <Picker.Item key={ilce} label={ilce} value={ilce} />)}
        </Picker>
      </View>

      <View className="border-2 border-slate-200 rounded-xl overflow-hidden">
        <Picker selectedValue={secilenOkulId} onValueChange={v => setSecilenOkulId(v)} enabled={!!secilenIlce}>
          <Picker.Item label="-- Okul Seçiniz --" value="" />
          {okullar.map(o => <Picker.Item key={o.id} label={o.okul_adi} value={String(o.id)} />)}
        </Picker>
      </View>

      {hata ? <Text className="text-red-500 text-xs text-center font-bold">{hata}</Text> : null}

      <Pressable onPress={() => { if (secilenOkulId) { setHata(''); onIleri(); } else setHata('Okul seçiniz.'); }}
        className="bg-indigo-600 py-3 rounded-xl">
        <Text className="text-white font-bold text-center text-sm">Devam Et →</Text>
      </Pressable>
      <Pressable onPress={onGeri} className="bg-slate-100 py-2 rounded-xl">
        <Text className="text-slate-600 font-bold text-center text-xs">← Geri</Text>
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-indigo-600">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerClassName="flex-grow justify-center p-4" keyboardShouldPersistTaps="handled">
          <View className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full self-center gap-5">

            <View className="items-center gap-1">
              <Text className="text-5xl">🏫</Text>
              <Text className="text-xl font-black text-slate-800">e-Derslik</Text>
            </View>

            {/* ROL SEÇİMİ */}
            {adim === 'rol_sec' && (
              <View className="gap-3">
                <Text className="text-slate-500 text-sm text-center">Nasıl devam etmek istersiniz?</Text>
                <Pressable onPress={() => setAdim('ogretmen_sec')}
                  className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                  <Text className="text-center font-black text-red-800 text-sm">👩‍🏫 Öğretmenim</Text>
                </Pressable>
                <Pressable onPress={() => setAdim('veli_okul_sec')}
                  className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4">
                  <Text className="text-center font-black text-indigo-800 text-sm">👨‍👩‍👦 Veliyim</Text>
                </Pressable>
              </View>
            )}

            {/* ÖĞRETMEN SEÇENEKLER */}
            {adim === 'ogretmen_sec' && (
              <View className="gap-3">
                <Text className="text-slate-500 text-sm text-center">Ne yapmak istiyorsunuz?</Text>
                <Pressable onPress={() => setAdim('giris_okul_sec')} className="bg-slate-800 rounded-2xl p-4">
                  <Text className="text-center font-black text-white text-sm">🔑 Giriş Yap</Text>
                </Pressable>
                <Pressable onPress={() => setAdim('davet_kodu')}
                  className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
                  <Text className="text-center font-black text-emerald-800 text-sm">✨ Kayıt Ol</Text>
                </Pressable>
                <Pressable onPress={() => geri('rol_sec')} className="bg-slate-100 py-2 rounded-xl">
                  <Text className="text-slate-600 font-bold text-center text-xs">← Geri</Text>
                </Pressable>
              </View>
            )}

            {/* DAVET KODU */}
            {adim === 'davet_kodu' && (
              <View className="gap-3">
                <Text className="text-slate-500 text-xs text-center">Davet kodunuzu girin</Text>
                <TextInput
                  className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Davet Kodu"
                  value={davetKodu}
                  onChangeText={t => setDavetKodu(t.toUpperCase())}
                  autoCapitalize="characters"
                />
                {hata ? <Text className="text-red-500 text-xs text-center font-bold">{hata}</Text> : null}
                <Pressable onPress={handleDavetKoduDogrula} disabled={yukleniyor}
                  className="bg-indigo-600 py-3 rounded-xl">
                  {yukleniyor
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-bold text-center text-sm">Devam Et →</Text>}
                </Pressable>
                <Pressable onPress={() => geri('ogretmen_sec', () => { setDavetKodu(''); })}
                  className="bg-slate-100 py-2 rounded-xl">
                  <Text className="text-slate-600 font-bold text-center text-xs">← Geri</Text>
                </Pressable>
              </View>
            )}

            {/* KAYIT OKUL SEÇİMİ */}
            {adim === 'kayit_okul_sec' && (
              <OkulSecimFormu
                onIleri={() => setAdim('kayit_bilgiler')}
                onGeri={() => geri('davet_kodu')}
              />
            )}

            {/* KAYIT BİLGİLERİ */}
            {adim === 'kayit_bilgiler' && (
              <View className="gap-3">
                <Text className="text-slate-500 text-xs text-center">Bilgilerinizi girin</Text>
                <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Ad Soyad" value={adSoyad} onChangeText={setAdSoyad} />
                <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Şifre" value={sifre} onChangeText={setSifre} secureTextEntry />
                <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Şifre Tekrar" value={sifre2} onChangeText={setSifre2} secureTextEntry />

                <View className="gap-1">
                  <Text className="text-xs font-bold text-slate-600">Kademe:</Text>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => { setKademe('ilkokul'); setSinifNo(''); setSinifHarf(''); setSecilenSiniflar([]); }}
                      className={`flex-1 py-2 rounded-xl border-2 ${kademe === 'ilkokul' ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
                      <Text className={`text-center font-bold text-xs ${kademe === 'ilkokul' ? 'text-white' : 'text-slate-600'}`}>1-4. Sınıflar</Text>
                    </Pressable>
                    <Pressable onPress={() => { setKademe('ortaokul'); setSinifNo(''); setSinifHarf(''); setSecilenSiniflar([]); }}
                      className={`flex-1 py-2 rounded-xl border-2 ${kademe === 'ortaokul' ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
                      <Text className={`text-center font-bold text-xs ${kademe === 'ortaokul' ? 'text-white' : 'text-slate-600'}`}>5-8. Sınıflar</Text>
                    </Pressable>
                  </View>
                </View>

                {kademe === 'ortaokul' && (
                  <View className="gap-1">
                    <Text className="text-xs font-bold text-slate-600">Branşlarınız:</Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {BRANSLAR.map(brans => (
                        <Pressable key={brans} onPress={() => handleBransToggle(brans)}
                          className={`py-1.5 px-2 rounded-lg border-2 ${secilenBranslar.includes(brans) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
                          <Text className={`font-bold text-xs ${secilenBranslar.includes(brans) ? 'text-white' : 'text-slate-600'}`}>
                            {secilenBranslar.includes(brans) ? '✓ ' : ''}{brans}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {kademe && (
                  <View className="gap-1">
                    <Text className="text-xs font-bold text-slate-600">
                      {kademe === 'ortaokul' ? 'Sınıflarınız:' : 'Sınıfınız:'}
                    </Text>
                    <View className="flex-row gap-2">
                      <View className="flex-1 border-2 border-slate-200 rounded-xl overflow-hidden">
                        <Picker selectedValue={sinifNo} onValueChange={v => setSinifNo(v)}>
                          <Picker.Item label="Sınıf No" value="" />
                          {sinifNoListesi.map(n => <Picker.Item key={n} label={`${n}. Sınıf`} value={String(n)} />)}
                        </Picker>
                      </View>
                      <View className="flex-1 border-2 border-slate-200 rounded-xl overflow-hidden">
                        <Picker selectedValue={sinifHarf} onValueChange={v => setSinifHarf(v)}>
                          <Picker.Item label="Şube" value="" />
                          {HARFLER.map(h => <Picker.Item key={h} label={h} value={h} />)}
                        </Picker>
                      </View>
                    </View>

                    {sinifAdi && kademe === 'ortaokul' && (
                      <Pressable onPress={() => {
                        if (sinifAdi && !secilenSiniflar.includes(sinifAdi)) {
                          setSecilenSiniflar([...secilenSiniflar, sinifAdi]);
                          setSinifNo(''); setSinifHarf('');
                        }
                      }} className="bg-indigo-100 py-1.5 rounded-xl">
                        <Text className="text-indigo-700 font-bold text-center text-xs">+ {sinifAdi} Ekle</Text>
                      </Pressable>
                    )}

                    {kademe === 'ortaokul' && secilenSiniflar.length > 0 && (
                      <View className="flex-row flex-wrap gap-1.5 mt-1">
                        {secilenSiniflar.map(s => (
                          <View key={s} className="bg-indigo-600 rounded-lg px-2 py-1 flex-row items-center gap-1">
                            <Text className="text-white text-xs font-bold">{s}</Text>
                            <Pressable onPress={() => setSecilenSiniflar(secilenSiniflar.filter(x => x !== s))}>
                              <Text className="text-white text-xs">✕</Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                    {sinifAdi && kademe === 'ilkokul' && (
                      <Text className="text-xs text-indigo-600 font-bold text-center">Seçilen sınıf: {sinifAdi}</Text>
                    )}
                  </View>
                )}

                {hata ? <Text className="text-red-500 text-xs text-center font-bold">{hata}</Text> : null}
                <Pressable onPress={handleOgretmenKayit} disabled={yukleniyor} className="bg-indigo-600 py-3 rounded-xl">
                  {yukleniyor
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-bold text-center text-sm">Kayıt Ol ✅</Text>}
                </Pressable>
                <Pressable onPress={() => geri('kayit_okul_sec')} className="bg-slate-100 py-2 rounded-xl">
                  <Text className="text-slate-600 font-bold text-center text-xs">← Geri</Text>
                </Pressable>
              </View>
            )}

            {/* GİRİŞ OKUL SEÇİMİ */}
            {adim === 'giris_okul_sec' && (
              <OkulSecimFormu
                onIleri={() => setAdim('giris_bilgiler')}
                onGeri={() => geri('ogretmen_sec')}
              />
            )}

            {/* GİRİŞ BİLGİLERİ */}
            {adim === 'giris_bilgiler' && (
              <View className="gap-3">
                <Text className="text-slate-500 text-xs text-center">Bilgilerinizi girin</Text>
                <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Ad Soyad" value={adSoyad} onChangeText={setAdSoyad} />
                <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Şifreniz" value={sifre} onChangeText={setSifre} secureTextEntry />
                {hata ? <Text className="text-red-500 text-xs text-center font-bold">{hata}</Text> : null}
                <Pressable onPress={handleOgretmenGiris} disabled={yukleniyor} className="bg-indigo-600 py-3 rounded-xl">
                  {yukleniyor
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-bold text-center text-sm">Giriş Yap 👩‍🏫</Text>}
                </Pressable>
                <Pressable onPress={() => geri('giris_okul_sec', () => setSifre(''))}
                  className="bg-slate-100 py-2 rounded-xl">
                  <Text className="text-slate-600 font-bold text-center text-xs">← Geri</Text>
                </Pressable>
              </View>
            )}

            {/* VELİ OKUL SEÇİMİ */}
            {adim === 'veli_okul_sec' && (
              <OkulSecimFormu
                onIleri={() => setAdim('veli_sinif_sec')}
                onGeri={() => geri('rol_sec')}
              />
            )}

            {/* VELİ SINIF SEÇİMİ */}
            {adim === 'veli_sinif_sec' && (
              <View className="gap-3">
                <Text className="text-slate-500 text-xs text-center">Sınıfınızı seçin</Text>
                {veliSiniflar.length === 0
                  ? <Text className="text-xs text-slate-400 italic text-center">Bu okulda henüz sınıf yok.</Text>
                  : (
                    <View className="flex-row flex-wrap gap-2">
                      {veliSiniflar.map(s => (
                        <Pressable key={s.id} onPress={() => { setSecilenVeliSinifId(String(s.id)); setAdim('veli_sifre'); }}
                          className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 items-center min-w-[30%]">
                          <Text className="font-black text-indigo-800 text-sm">{s.sinif_adi}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                {hata ? <Text className="text-red-500 text-xs text-center font-bold">{hata}</Text> : null}
                <Pressable onPress={() => geri('veli_okul_sec')} className="bg-slate-100 py-2 rounded-xl">
                  <Text className="text-slate-600 font-bold text-center text-xs">← Geri</Text>
                </Pressable>
              </View>
            )}

            {/* VELİ ŞİFRE */}
            {adim === 'veli_sifre' && (
              <View className="gap-3">
                <Text className="text-slate-500 text-xs text-center">Okul numaranızı ve şifrenizi girin</Text>
                <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Okul Numarası" value={veliOkulNo} onChangeText={setVeliOkulNo} keyboardType="numeric" />
                <TextInput className="border-2 border-slate-200 rounded-xl p-3 text-sm"
                  placeholder="Şifreniz" value={sifre} onChangeText={setSifre} secureTextEntry />
                {hata ? <Text className="text-red-500 text-xs text-center font-bold">{hata}</Text> : null}
                <Pressable onPress={handleVeliGiris} disabled={yukleniyor} className="bg-indigo-600 py-3 rounded-xl">
                  {yukleniyor
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-bold text-center text-sm">Sınıfıma Git 🚀</Text>}
                </Pressable>
                <Pressable onPress={() => geri('veli_sinif_sec')} className="bg-slate-100 py-2 rounded-xl">
                  <Text className="text-slate-600 font-bold text-center text-xs">← Geri</Text>
                </Pressable>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
