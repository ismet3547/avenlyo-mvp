# Okunabilirlik ve arayüz yenilemesi

Kullanıcının paylaştığı 7 sayfalık arayüz yeniden tasarım raporunun tamamı incelendi. Raporun tipografi, renk, boşluk, bileşen, dokunma hedefi ve responsive önerileri mevcut kaynak koduyla karşılaştırılarak uygulandı. PDF'deki depoya erişilmeden yapılmış varsayımlar yerine gerçek CSS kuralları esas alındı.

## Önce / sonra

| Alan                | Önce                                                      | Uygulanan değişiklik                                                               |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tipografi           | Bazı mobil etiketlerde 5,5–10px; birçok açıklamada 9–13px | Ana metin, girişler, düğmeler ve menüler 16px; yardımcı metinler en az 14px        |
| Başlıklar           | Ekran daraldıkça küçülen yoğun hiyerarşi                  | 20 / 24 / 32 / 40px ölçek; mobilde sütun sayısını azaltma                          |
| Renkler             | Mor, pembe ve düşük kontrastlı pastel tonlar              | Mavi `#205081`, lacivert `#0b1526`, beyaz ve koyu gri                              |
| Tema yönetimi       | Çok sayıda bağımsız renk, sonradan eklenen istisnalar     | Tek merkezde semantik renk ve tipografi değişkenleri                               |
| Kontroller          | 20–29px simge düğmeleri ve dar tıklama alanları           | Simge düğmeleri ve renk seçenekleri 44px; ana kontroller en az 48px yüksekliğinde  |
| Boşluk              | Birbirinden bağımsız küçük değerler                       | 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48px ölçeği                                       |
| Mobil sohbet        | Dar bir sütunda, adları görünmeyen geçmiş simgeleri       | Başlıkları okunabilen yerel seçim alanı ve yeni sohbet düğmesi                     |
| Klavye              | Küçük odak hedefleri, mobil menüde odak sınırı yok        | Belirgin odak halkası, içeriğe geç bağlantısı, mobil menüde odak döngüsü ve Escape |
| Kaydedilmiş ajanlar | Pembe / mor renk kimlikleri                               | Aynı veri kimlikleri yeni mavi/lacivert/gri palette gösterilir; veri göçü gerekmez |

## Tipografi ve yerleşim

DM Sans ve Manrope fontları yerel paketlerden sunulmaya devam eder. Metinler `rem` ile tanımlanır; tarayıcının font tercihi korunur. Genel satır yüksekliği 1,6'dır. Dar ekranlarda metinleri küçültmek yerine grid düzeni üç sütundan ikiye, sonra tek sütuna geçer. Formlar tek sütuna iner ve işlem düğmeleri gerektiğinde alt satıra geçer. Üst çubuk, metin büyüdüğünde yüksekliğini artırabilir.

Tüm ekranlar aynı tasarım sistemini kullanır: genel bakış, ajanlar, bilgi bankası, işletme profili, ayarlar, sohbet ve diyaloglar. İkonlar ile tıklanabilir hedefleri ayrı boyutlandırılır; örneğin 20px bir simgenin düğmesi 44px'tir.

## Ölçülen renk çiftleri

| Metin / zemin                                             | Kontrast |
| --------------------------------------------------------- | -------- |
| Ana metin `#111827` / beyaz                               | 17,74:1  |
| Yardımcı metin `#526174` / beyaz                          | 6,32:1   |
| Yardımcı metin `#526174` / sayfa zemini `#f4f5f7`         | 5,80:1   |
| Beyaz / ana mavi `#205081`                                | 8,31:1   |
| Yan menü açıklaması `#cbd5e1` / lacivert `#0b1526`        | 12,30:1  |
| Hero açıklaması `#e2e8f0` / en açık hero zemini `#205081` | 6,74:1   |
| Kontrol kenarlığı `#7b899b` / sayfa zemini                | 3,27:1   |

Durum göstergeleri renge ek olarak “Aktif”, “Duraklatıldı”, “Anahtar tanımlı” gibi metinler taşır. Ajan simgelerindeki yeşil ve kehribar, anlamlı durum / kategori ayrımları için koyu tonlarla korunur. Pembe veya mor bir görsel vurgu kullanılmaz.

## Rapordaki standart ifadelerine ilişkin notlar

- WCAG 1.4.3 normal metin için 4.5:1, büyük metin için 3:1 kontrast tanımlar. 16px gövde metni burada okunabilirlik için seçilen ürün tasarımı ölçüsüdür; WCAG'nin bütün metinler için tek bir zorunlu minimum font boyutu değildir.
- WCAG 2.5.8'de hedef ölçüsü **24×24 CSS piksel** olarak verilir; milimetre değildir. Bu uygulamada simge hedefleri 44px seçilmiştir.
- Raporda düşük kontrast örneği olarak geçen `#666666` / beyaz çifti yaklaşık 5,74:1'dir ve normal metin eşiğini geçer. Bu nedenle palet seçimleri varsayıma değil gerçek luminans hesabına dayanır.
- Renk ve CSS kontrollerinin geçmesi tek başına tam WCAG uygunluk sertifikası anlamına gelmez.

Birincil kaynaklar: [WCAG metin kontrastı](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [metin dışı kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [hedef boyutu](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

## Doğrulama ve sınırlar

`tests/readability.test.ts`, mobil medya sorguları dahil tüm font boyutu bildirimlerini tarar ve semantik palet çiftlerini luminans formülüyle doğrular. Mevcut API, SQLite, akış ve sunucu başlangıç testleri korunur. `npm run build` TypeScript kontrolü ve üretim derlemesini tamamlar.

Bu ortamda yönetilen önizleme servisi kullanılamadığı için gerçek tarayıcıda ekran görüntüsü, 320px reflow, %200 metin büyütme ve etkileşimli klavye QA doğrulanamadı. CSS düzenleri bu kullanımlara göre hazırlanmıştır; rapordaki görsel kalite kontrolü tamamlanmış olarak sunulmaz. Yerel kontrolde 320/375/768/1440px görünüm, %200 büyütme, Tab/Shift+Tab/Escape, uzun kaynak başlıkları, ajan formu ve mobil sohbet geçmişi denenmelidir.
