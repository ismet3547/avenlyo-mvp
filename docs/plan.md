# MVP planı

Amaç: İşletme sahibinin yerel bir uygulamada işletmesini tanıtabilmesi, özel yapay zekâ ajanları oluşturabilmesi ve kendi OpenAI anahtarıyla bu ajanları deneyebilmesi.

## Uygulanan kapsam

- [x] Türkçe, sade ve responsive çalışma alanı.
- [x] Genel bakış ve gerçek kayıtlardan hesaplanan sayaçlar.
- [x] Ajan oluşturma / düzenleme / duraklatma / silme.
- [x] İşletme profili ve marka dili.
- [x] Metin / Markdown bilgi bankası, dosya yükleme ve ajanlara kaynak atama.
- [x] Sunucu tarafında OpenAI Responses bağlantısı ve model seçimi.
- [x] Akış halinde sohbet, iptal ve kalıcı geçmiş.
- [x] JSON dışa aktarımı; sırların dışarı verilmemesi.
- [x] SQLite kalıcılığı, API doğrulaması ve hata yönetimi.
- [x] Kurulum ve mimari belgeleri.

## Doğrulama

`npm test`, gerçek OpenAI çağrısı yapmayan üç kapsamlı testle şu sınırları kontrol eder:

- HTTP istekleri → sunucu doğrulaması → SQLite kayıtları.
- Anahtar yokken sohbetin engellenmesi.
- Yabancı Origin ve Host başlıklarının reddedilmesi.
- Silinen / olmayan kaynak atamalarının kontrolü.
- Yalnızca atanmış kaynakların modele aktarılması.
- Sohbet geçmişinin sonraki isteğe eklenmesi.
- Tamamlanan turların kalıcılığı, hatalı turların kaydedilmemesi.
- Yanıt iptali ve aynı konuşmada eşzamanlı üretim / silme engeli.
- Kaynak / ajan silme sonrası ilişkilerin temizlenmesi.
- Yeni veritabanı bağlantısıyla kayıtların korunması.
- Anahtarın uygulama durumundan ve dışa aktarımdan çıkarılması.
- Gerçek OpenAI SDK'sıyla SSE olaylarının okunması ve sağlayıcı hatalarının gizlenmesi.

`npm run build`, tüm TypeScript dosyalarını kontrol eder ve üretim arayüzünü derler.

Bu çalışma ortamında yönetilen tarayıcı önizleme servisi kullanılamadığı için tarayıcıda görsel ve etkileşimli QA doğrulanamadı. Gerçek bir API anahtarı verilmediği için canlı model yanıtı da test edilmedi. Kullanıcı yerelde OpenAI bağlantı testini çalıştırıp ilk sohbeti başlatmalıdır.

## Bilerek sonraya bırakılanlar

Çok kullanıcılı hesaplar, uzak dağıtım, harici uygulama araçları, otonom arka plan görevleri, PDF/Word, vektör arama ve JSON içe aktarma.
