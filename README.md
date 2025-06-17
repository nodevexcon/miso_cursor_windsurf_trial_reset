# MISO_Cursor_WindSurf Trial Resetter

Bu uygulama, yazılımların deneme sürümlerini sıfırlamanıza yardımcı olmak için geliştirilmiştir. Sisteminizde bir uygulamaya ait geride kalmış dosyaları ve Windows Kayıt Defteri (Registry) girdilerini bularak ve bunları temizleyerek çalışır. Bu sayede, deneme süresi dolan yazılımları tekrar deneme süresiyle kullanmanıza olanak tanır.

## ✨ Özellikler

- **Uygulama Kalıntısı Temizleyici:** Bir uygulamanın `.exe` dosyasını sürükleyip bırakarak sisteminizdeki ilgili tüm dosyaları ve kayıt defteri anahtarlarını bulur.
- **Akıllı Filtreleme:** Alakasız sonuçları (örn. Windows sistem dosyaları) elemek için dosya yollarına ve kayıt defteri anahtarlarına göre yayımcıyı analiz eder, böylece yanlışlıkla önemli bir şeyi silmenizi önler.
- **Derin Tarama:** `Program Files`, `%APPDATA%`, `%LOCALAPPDATA%` gibi yaygın uygulama kurulum konumlarının yanı sıra Windows Kayıt Defteri'ni de derinlemesine tarar.
- **Kolay Kullanım:** Sezgisel arayüzü ile teknik bilgi gerektirmeden herkesin kullanabileceği şekilde tasarlanmıştır.

## 🚀 Deneme Sürümü Nasıl Sıfırlanır?

Bir yazılımın deneme sürümünü sıfırlamak için aşağıdaki adımları **sırasıyla ve eksiksiz olarak** uygulamanız kritik öneme sahiptir.

### Adım 1: Trial Resetter Ayarlarını Uygulayın

İlk olarak, uygulamanın kendi içerisindeki temel sıfırlama işlemlerini yapacağız.

1.  Uygulamayı çalıştırın ve sol menüden **Trial Resetter** görünümüne geçin.
2.  Bu ekrandaki **"Basic"** ve **"Advanced"** seçeneklerini kullanarak gerekli sıfırlama işlemlerini gerçekleştirin. Bu adımlar, bilinen deneme anahtarlarını ve ayarlarını temizler.

### Adım 2: Uygulama Kalıntılarını Derinlemesine Temizleyin

Şimdi, yazılımın bilgisayarınızda tuttuğu "beni hatırla" notlarını derinlemesine sileceğiz.

1.  Sol menüden **App Cleaner** görünümüne geçin.
2.  Deneme sürümünü sıfırlamak istediğiniz yazılımın ana yürütülebilir dosyasını (`.exe`) bulun (genellikle `C:\Program Files\...` altında bulunur).
3.  Bu `.exe` dosyasını uygulamadaki **"Drop .exe here"** alanına sürükleyip bırakın.
4.  Uygulama otomatik olarak taramayı başlatacak ve yazılımla ilişkili tüm dosya ve kayıt defteri girdilerini listeleyecektir.
5.  Tarama tamamlandığında, bulunan tüm öğelerin seçili olduğundan emin olun ve **"Delete Selected Items"** düğmesine tıklayarak silme işlemini onaylayın.

### Adım 3: IP Adresinizi Değiştirin (Önemli!)

Bazı yazılımlar, lisansı sadece bilgisayarınıza değil, aynı zamanda internet (IP) adresinize de bağlar. Bu nedenle, kalıntıları temizledikten sonra IP adresinizi değiştirmeniz gerekir.

- **VPN Kullanımı:** En kolay ve etkili yöntem bir VPN hizmeti kullanmaktır. VPN'i aktif edip farklı bir ülkeye veya şehre bağlanın.
- **Modem Resetleme:** Eğer dinamik bir IP adresiniz varsa, internet modeminizi kapatıp 30 saniye bekledikten sonra yeniden açmak genellikle yeni bir IP adresi almanızı sağlar.

### Adım 4: Keyfini Çıkarın!

Yukarıdaki tüm adımları tamamladıktan sonra, deneme sürümünü sıfırlamak istediğiniz yazılımı yeniden başlatabilirsiniz. Yazılım, daha önce hiç kurulmamış gibi davranacak ve deneme süreniz sıfırlanmış olacaktır.

## 🛠️ Geliştirme Ortamı Kurulumu

Projeyi yerel makinenizde çalıştırmak veya geliştirmek isterseniz:

```bash
# Projeyi klonlayın
git clone <proje_adresi>

# Dizine gidin
cd trial_resetter

# Gerekli paketleri yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen bir pull request açmaktan veya issue oluşturmaktan çekinmeyin. 