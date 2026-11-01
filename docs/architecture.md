# Mimari

## Kararlar

**Tek süreç, tek port.** React/Vite arayüzü ve Express API geliştirmede aynı HTTP sunucusunu kullanır. Üretim modunda aynı sunucu `dist/` dosyalarını sunar. Ayrı servis, Docker veya uzak veritabanı gerekmez.

**Yerel SQLite.** Node.js 24'ün `node:sqlite` modülü ek bir native veritabanı paketi gerektirmeden kalıcılık sağlar. `Store`, veri erişimini HTTP katmanından ayırır. Mesajlar konuşmaya dış anahtarla bağlıdır; konuşma silindiğinde mesajları da silinir. Kaynak silindiğinde ajan atamaları temizlenir. Başlangıç ajanları yalnızca ilk kurulumda eklenir.

**Sunucuda OpenAI.** Anahtar hiçbir React bileşenine verilmez. `Config`, ortam anahtarını veya özel yerel ayar dosyasını okur. Dışa aktarma yalnızca izin verilen veri alanlarını içerir. Model istemcisi, sağlayıcı hatalarını kullanıcıya uygun ve anahtar içermeyen mesajlara çevirir.

**Kontrollü bağlam.** İşletme profili her isteğe eklenir. Kaynaklar ajan kimliğine göre sunucuda seçilir; istemci kaynak içeriğini veya sohbet geçmişini model isteğine doğrudan gönderemez. Kaynaklar talimat değil veri olarak sınırlandırılır. Bu bir RAG/embedding sistemi değildir. Prompt injection riskini azaltan ayrım kesin bir güvenlik garantisi değildir; ajanların harici işlem araçları yoktur.

**Akış ve atomiklik.** Sunucu, OpenAI Responses olaylarını uygulamaya ait NDJSON akışına çevirir: `conversation`, `delta`, `done`, `error`. Tamamlanan kullanıcı/ajan mesaj çifti tek SQLite transaction ile yazılır. Hata veya iptalde yarım tur yazılmaz. Bağlantı kapanırsa upstream istek iptal edilir. Her konuşma için aynı anda bir üretim çalışabilir.

**Yerel erişim sınırı.** Dinleme varsayılanı loopback adresidir. API, Host başlığını ve Origin / Sec-Fetch-Site kontrollerini uygular. CORS açılmaz. `AVENLYO_ALLOWED_HOSTS` yalnızca geliştiricinin bilerek belirlediği ek hostlar için kullanılabilir; uzaktan erişim kimlik doğrulaması sağlamaz.

## Dosyalar

| Konum                       | Sorumluluk                                               |
| --------------------------- | -------------------------------------------------------- |
| `shared.ts`                 | İstemci ve sunucu veri tipleri                           |
| `src/App.tsx`               | Çalışma alanı, yönetim ekranları ve uygulama durumu      |
| `src/components/forms.tsx`  | Ajan ve kaynak formları                                  |
| `src/components/Chat.tsx`   | Sohbet, geçmiş, akış ve iptal; gerektiğinde yüklenir     |
| `src/components/ui.tsx`     | Diyalog, simgeler ve ortak görünüm parçaları             |
| `src/style.css`             | Görsel sistem, responsive düzenler ve hareket tercihleri |
| `server/app.ts`             | API uçları, erişim kontrolleri ve sohbet koordinasyonu   |
| `server/store.ts`           | SQLite veri erişimi                                      |
| `server/config.ts`          | Anahtar/model ayarları                                   |
| `server/provider.ts`        | OpenAI SDK, prompt bağlamı ve sağlayıcı hata eşlemesi    |
| `server/validation.ts`      | Sunucu tarafı veri sınırları ve doğrulama                |
| `server/index.ts`           | Ortam yükleme ve geliştirme/üretim sunucusu              |
| `tests/integration.test.ts` | HTTP, veri, bağlam ve SDK sözleşmesi kontrolleri         |

## Sonraki sürüme uygun genişletmeler

PDF/Word ayrıştırma ve semantik arama; model kullanım ve maliyet ölçümü; güvenli araç çağrıları; dışa aktarımdan geri yükleme; kimlik doğrulaması ve çoklu çalışma alanları. Bunlar mevcut sürümde uygulanmış özellikler değildir.
