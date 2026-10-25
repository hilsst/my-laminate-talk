# Supabase kurulum tarifi: Claude ile toplantı

Toplam 15-20 dakika. Hepsi tarayıcıdan yapılır, komut satırı gerekmez. API anahtarını hiçbir yere (sohbet, repo, kod) yapıştırma; sadece 2. adımdaki Supabase secret kutusuna.

## 1. Claude API anahtarı ve harcama sınırı

1. https://console.anthropic.com adresine gir, **Settings > API Keys > Create Key** ile bir anahtar oluştur (adı örneğin `my-laminate-talk`). Anahtar bir kez gösterilir, kopyala.
2. Aynı yerde **Settings > Limits** bölümünden aylık harcama sınırı koy (örneğin 10 $). Böylece bir hata olsa bile fatura bu sınırı geçmez.

## 2. Secret'ları ekle

Supabase'de Laminate Talk projesini aç (ana uygulamanın kullandığı proje, `dkpdkzkmgazqlxscqvpq`).

**Edge Functions > Secrets** (bazı ekranlarda **Project Settings > Edge Functions**) bölümüne şu kayıtları ekle:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | 1. adımda kopyaladığın anahtar |
| `ALLOWED_EMAILS` | Laminate Talk'a giriş yaptığın e-posta. Birden fazlaysa virgülle ayır. |
| `CLAUDE_MODEL` | İsteğe bağlı. Boş bırakırsan `claude-opus-5-5` kullanılır. Çok daha ucuzu için `claude-haiku-5-5` yaz. |

`ALLOWED_EMAILS` boşsa fonksiyon kimseye cevap vermez; bu bilerek böyle.

## 3. Fonksiyonu oluştur

1. **Edge Functions > Deploy a new function > Via Editor** seç.
2. Fonksiyon adını tam olarak `claude-meeting` yaz.
3. Editördeki örnek kodu tamamen sil, yerine şu dosyanın içeriğini yapıştır:
   https://github.com/hilsst/my-laminate-talk/blob/main/supabase/functions/claude-meeting/index.ts
   (GitHub'da dosyayı açıp sağ üstteki **Copy raw file** düğmesiyle kopyalayabilirsin.)
4. **Deploy function** düğmesine bas.

## 4. JWT doğrulamasını kapat

Fonksiyon, giriş yapan hesabı kendisi kontrol ediyor. Supabase'in kapıdaki eski tip kontrolü yeni anahtarlarla girişleri reddedebildiği için kapatılmalı:

**Edge Functions > claude-meeting > Details** (ya da **Settings**) içinde **Verify JWT with legacy secret** / **Enforce JWT Verification** seçeneğini kapat ve kaydet.

## 5. Uygulamayı yayına aç

1. GitHub'da https://github.com/hilsst/my-laminate-talk/settings/pages adresine git.
2. **Source: Deploy from a branch**, **Branch: main**, klasör **/ (root)** seç, **Save**.
3. Birkaç dakika sonra uygulama https://hilsst.github.io/my-laminate-talk/ adresinde açılır.

Supabase'de **Authentication > URL Configuration > Redirect URLs** listesine `https://hilsst.github.io/my-laminate-talk/` ekle (şifre yenileme e-postası bu sürüme dönsün diye).

## 6. Dene

1. https://hilsst.github.io/my-laminate-talk/ adresini aç, ana uygulamadaki hesabınla giriş yap. Üstte mor **KİŞİSEL** etiketi görünür.
2. Bir konu seç, **Toplantı simülasyonu > Claude ile serbest** düğmesine bas.
3. Bir cevap yaz ya da **Konuş** ile söyle, **Gönder**. Birkaç saniye içinde Claude'un cevabı ve söylediğinin "Daha doğal hali" gelir.

## Bir şey ters giderse

Uygulama hatayı Türkçe yazar:

| Mesaj | Ne yapmalı |
|---|---|
| "önce giriş yap" | Misafir modundasın. Üstten **Giriş yap**. |
| "bu hesap yetkili değil" | `ALLOWED_EMAILS` içindeki e-posta giriş yaptığın e-postayla aynı değil. |
| "fonksiyonu bulunamadı" | 3. adımdaki ad tam olarak `claude-meeting` olmalı. |
| "Oturum süresi dolmuş" | Önce 4. adımı kontrol et; sonra çıkış yapıp tekrar giriş yap. |
| "API anahtarı tanımlı değil" / "geçersiz" | 2. adımdaki `ANTHROPIC_API_KEY` eksik ya da yanlış. Yeni anahtarla değiştir. |

Ayrıntı için **Edge Functions > claude-meeting > Logs** bölümüne bak.

## Maliyet (tahmini)

Ücret her mesajda Claude'a giden ve gelen metne göre hesaplanır. `claude-opus-5-5` ile bir toplantı mesajı yaklaşık 1-2 sent, 10 mesajlık bir toplantı yaklaşık 15-25 sent tutar. `claude-haiku-5-5` ile aynı toplantı 1 sentin altındadır ama cevaplar daha basit olur. Gerçek harcamayı https://console.anthropic.com > **Usage** bölümünde görürsün.

## Anahtarı değiştirmek ya da kapatmak

- Anahtarı değiştirmek: Supabase'de `ANTHROPIC_API_KEY` secret'ını yeni değerle güncelle.
- Tamamen kapatmak: Anthropic Console'da anahtarı sil ya da Supabase'de `claude-meeting` fonksiyonunu sil. Uygulamanın geri kalanı (senaryolu toplantı, diyaloglar, 4/3/2) aynen çalışmaya devam eder.

## Komut satırıyla (isteğe bağlı)

Supabase CLI kullanmak istersen: `supabase login`, `supabase link --project-ref dkpdkzkmgazqlxscqvpq`, sonra `supabase functions deploy claude-meeting`. `supabase/config.toml` JWT kontrolünü zaten kapatır. Secret'ları yine panelden ekle ki anahtar komut geçmişine düşmesin.
