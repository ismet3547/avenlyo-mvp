# Avenlyo

İşletmenizin bilgileriyle çalışan Türkçe müşteri destek ajanları oluşturun.

**React + TypeScript · Node.js + Express · SQLite · OpenAI Responses API**

## A1 · Kapalı test sürümü

Node.js 24 veya 26 ile proje klasöründe çalıştırın.

```bash
npm ci
npm run dev
```

Tarayıcıda **http://127.0.0.1:3000** adresini açın.

1. **Demoyu dene** ile örnek müşteri sohbetini açabilir veya **Ajanını oluştur** ile bir test hesabı açabilirsiniz. Şifre kurtarma kodunu güvenli bir yere kaydedin.
2. İşletme ve ajan bilgilerini girin. Bir **Soru-cevap** kaynağı ekleyip ajan için onaylayın.
3. **Test** adımında kaydettiğiniz soruyu sorun. Kaynaklı bir yanıt aldığınızda **Yayın** adımına geçin.
4. **Ajanı yayınla** düğmesi yerel bir sohbet bağlantısı ve iframe kodu oluşturur. Bağlantıyı ayrı bir tarayıcı sekmesinde açın. Bilinen bir soru sorun veya **Ekibe ulaş** üzerinden örnek bir talep bırakın.
5. Panelde **Gelen kutusu** adımından sohbeti açın ve talebi çözüldü olarak işaretleyin.

- Sunucu yalnızca loopback adresinde dinler. Sohbet bağlantısı ve gömme kodu kapalı test sunucusuna aittir.
- A1, her hesap için ayrı SQLite dosyası kullanır. Varsayılan konum `data/a1/` altında. Oturum ve kurtarma kodları veritabanında özetleriyle saklanır.
- Yayındaki ajan son onaylı kaynak kopyasıyla çalışır. Taslak değişiklikleri test edilip yeniden yayınlanınca aynı sohbet adresine yansır.
- Demo ve birebir eşleşen soru-cevaplar API anahtarı olmadan çalışır. Diğer sorulara onaylı metinlerden yanıt verebilmek için test sunucusunda `OPENAI_API_KEY` tanımlayın. Model yalnızca ilgili parçalar arasından seçim yapar. Müşteri talebinin iletişim e-postası işletmenin gelen kutusunda saklanır.
- Şifre sıfırlamak için **Şifremi unuttum** ekranına e-posta adresinizi ve kurtarma kodunuzu girin. İşlem önceki oturumları ve kodu geçersiz kılar.

Test ve derleme için `npm test` ve `npm run build` komutlarını çalıştırın. Derlenmiş kapalı test sürümü `npm start` ile açılır.

## Önceki tek kullanıcılı çalışma alanı

`npm run dev:local` ile önceki yerel çalışma alanını ve mevcut `data/avenlyo.sqlite` verilerinizi açabilirsiniz. Aşağıdaki bölümler bu modu açıklar.

### Hızlı başlangıç

Önerilen ve `.nvmrc` ile seçilen sürüm **Node.js 26 LTS**'dir. Node.js 24 desteği de korunur; otomatik kontroller Windows ve Linux üzerinde her iki sürümde çalışır. npm dışında veritabanı için ayrıca bir servis kurmanız gerekmez.

```bash
git clone https://github.com/ismet3547/avenlyo-mvp.git
cd avenlyo-mvp
npm ci
npm run dev:local
```

Tarayıcıda **http://localhost:3000** adresini açın.

1. **İşletmem** sayfasından işletme profilinizi doldurun.
2. **Bilgi bankası** sayfasına metin yazın veya `.txt` / `.md` dosyaları ekleyin.
3. **Ajanlarım** sayfasında hazır ajanları düzenleyin ya da kendi ajanınızı oluşturun. Kullanacağı kaynakları seçin.
4. **Ayarlar** sayfasına OpenAI API anahtarınızı ekleyin. Model kimliğini belirleyip bağlantıyı test edin.
5. **Sohbet alanı** sayfasından ajanınızla konuşun.

Varsayılan model `gpt-4.1-mini`dir. Hesabınızın erişebildiği farklı bir OpenAI Responses modeli kullanabilirsiniz. Anahtar olmadan paneli kullanabilir ve verilerinizi hazırlayabilirsiniz; sohbet için geçerli bir anahtar, internet ve kullanılabilir API bakiyesi gerekir.

### Anahtarı ortam değişkeniyle kullanma

Arayüzden anahtar kaydetmek yerine `.env.example` dosyasını `.env` adıyla kopyalayabilirsiniz:

```dotenv
OPENAI_API_KEY=buraya_anahtarinizi_yazin
OPENAI_MODEL=gpt-4.1-mini
PORT=3000
HOST=127.0.0.1
```

`OPENAI_API_KEY` tanımlıysa arayüzden kaydedilmiş anahtara göre önceliklidir. Değiştirince sunucuyu yeniden başlatın. API anahtarınızı Git'e eklemeyin. `.env`, `.env.local` ve `data/` Git tarafından yok sayılır.

## Özellikler

- Genel bakış paneli ve gerçek verilerden hesaplanan sayaçlar.
- Üç düzenlenebilir başlangıç ajanı: Müşteri Destek, İçerik Editörü, Satış Danışmanı.
- Ajan oluşturma, düzenleme, duraklatma, silme; simge, renk, talimat ve model seçimi.
- Ortak işletme profili: sektör, ürünler, hedef kitle, marka dili ve web sitesi referansı.
- Metin/Markdown kaynaklarını ekleme, güncelleme, arama ve ajan bazında atama.
- Akış halinde sohbet yanıtları, yanıtı durdurma, Markdown gösterimi ve kopyalama.
- SQLite üzerinde kalıcı sohbet geçmişi ve konuşma silme.
- Hata durumunda tamamlanmamış sohbet turunu kaydetmeme; yeniden deneme için mesajı koruma.
- Anahtar içermeyen JSON dışa aktarımı.
- Masaüstü ve mobil düzenler, klavyeyle kullanılabilen formlar ve diyaloglar.
- Fontlar dahil yerel paketlenmiş arayüz; üçüncü taraf CDN bağımlılığı yok.

## Üretim modunda yerel çalıştırma

```bash
npm run build
npm run start:local
```

Bu mod geliştirme sunucusu yerine derlenmiş arayüzü sunar. Yine `http://localhost:3000` adresinden erişilir.

### Geliştirme sunucusu sürekli yeniden başlıyorsa

Dosya değiştirmediğiniz halde tekrar tekrar `Restarting 'server/index.ts'` görmeniz normal değildir. İlk sürümde Vite'ın geçici yapılandırma dosyası Node.js izleyicisini tetikliyordu; bu döngü giderildi. Güncel sürümü alın:

```bash
git pull --ff-only
npm run dev:local
```

Terminali açık tutun ve tarayıcıdan `http://localhost:3000` adresini ziyaret edin. `Ctrl+C` sunucuyu durdurur. `ExperimentalWarning: SQLite is an experimental feature` mesajı, kullandığınız Node.js sürümünün SQLite desteğine ilişkin bir uyarıdır; tek başına uygulama hatası anlamına gelmez.

## Komutlar

| Komut                 | İşlev                                                  |
| --------------------- | ------------------------------------------------------ |
| `npm run dev:local`   | Tek portta API ve Vite geliştirme sunucusu             |
| `npm run build`       | TypeScript kontrolü ve arayüzün üretim derlemesi       |
| `npm run start:local` | Derlenmiş arayüzle yerel sunucu                        |
| `npm run check`       | TypeScript kontrolü                                    |
| `npm test`            | A1 hesap izolasyonu, yerel API ve OpenAI akış testleri |

Testler geçici SQLite veritabanı ve yerel model yanıtları kullanır. Gerçek OpenAI çağrısı veya API harcaması yapmaz.

## Veriler ve gizlilik

Uygulama **tek kullanıcılı ve yerel kullanım** için tasarlanmıştır. Varsayılan dinleme adresi `127.0.0.1`dir; internetten erişime açmayın. Kullanıcı hesabı, çoklu kiracı izolasyonu veya uzak erişim kimlik doğrulaması içermez.

- `data/avenlyo.sqlite`: işletme profili, ajanlar, kaynaklar ve sohbetler.
- `data/settings.json`: arayüzden kaydedilen API anahtarı ve model. Bu dosya yerel diskte **düz metin** olarak, sahibi için okuma/yazma izniyle saklanır; şifreli bir kasa değildir. Ortam değişkenini tercih edebilirsiniz.
- API anahtarı istemci durumuna veya dışa aktarıma dahil edilmez. OpenAI SDK yalnızca sunucuda yüklenir.
- Yanıt üretiminde işletme profili, **yalnızca o ajana atanmış kaynaklar** ve mevcut sohbetin son mesajları OpenAI'a gönderilir. API kullanımı kendi OpenAI hesabınıza ücretlendirilir. `store: false` kullanılır; bu ayar sağlayıcının tüm veri saklama politikalarını ortadan kaldırmaz.
- İşletme web sitesi yalnızca profil bilgisidir; otomatik tarama yapılmaz.
- Başarısız veya durdurulmuş turda kullanıcı mesajı ve yarım yanıt veritabanına yazılmaz. Tamamlanan turlar birlikte kaydedilir.

Yedekleme için Ayarlar → **Dışa aktar** seçeneğini kullanabilirsiniz. JSON içe aktarma arayüzü bu sürümde yoktur. Tam geri yüklenebilir yerel yedek için uygulamayı durdurun ve `data/` klasörünü güvenli bir yere kopyalayın; bu klasörde anahtarınızın da bulunabileceğini unutmayın.

## Sınırlar

Bu MVP'deki ajanlar, kendi talimatları ve atanmış bilgileriyle çalışan sohbet asistanlarıdır. Harici uygulamalarda işlem yapmaz, e-posta göndermez veya arka planda zamanlanmış görev yürütmez.

Kaynak başına 30.000 karakter, dosya başına 100 KB sınırı vardır. PDF/Word ayrıştırma ve vektör arama yoktur; seçili kaynaklar doğrudan bağlama eklenir. İşletme profili ve seçili kaynakların JSON toplamı 120.000 karakterle sınırlıdır. Sohbet bağlamında en fazla 20 geçmiş mesaj ve yaklaşık 40.000 karakter kullanılır; eski mesajlar veritabanında korunur. Yanıtlar 2.500 çıktı tokenıyla sınırlandırılmıştır.

## Mimari ve geliştirme planı

[Mimari notları](docs/architecture.md) · [MVP planı ve doğrulama](docs/plan.md) · [Arayüz yenilemesi ve okunabilirlik](docs/ui-redesign.md)

OpenAI entegrasyonu [resmî Responses API akış belgesindeki](https://developers.openai.com/api/docs/guides/streaming-responses) sözleşmeyi kullanır.
