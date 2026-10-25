# My Laminate Talk (kişisel sürüm)

Laminate Talk'un yalnızca Kemal için olan kopyası. Ana uygulamadan (hilsst/laminate-talk) tek farkı **Claude ile serbest toplantı**: Claude bir meslektaş rolünde soru sorar, her cevaptan sonra söylediğinin doğal halini gösterir, dilbilgisi anlatmaz. Aynı bağlantı 4/3/2 sonrasındaki "Daha doğal nasıl söylenir?" yeniden yazımını ve sözlükte olmayan kelimeler için kelime kurtarmayı da açar.

- Adres (GitHub Pages açılınca): https://hilsst.github.io/my-laminate-talk/
- Claude API anahtarı tarayıcıda ya da bu repoda **yok**. Supabase Edge Function `claude-meeting` içinde secret olarak durur; fonksiyon yalnızca `ALLOWED_EMAILS` listesindeki giriş yapmış hesaba cevap verir.
- Hesap ve ilerleme ana uygulamayla aynı Supabase projesinde, yani ilerlemen iki uygulamada ortak.

Kurulum adımları: [SUPABASE-KURULUM.md](SUPABASE-KURULUM.md)

## Dosyalar

- `supabase/functions/claude-meeting/index.ts`: Claude'a giden istekleri ileten fonksiyon.
- `tools/personal_build.py`: ana uygulamanın `index.html`, `sw.js` ve `manifest.webmanifest` dosyalarından bu kişisel sürümü üretir (`python3 tools/personal_build.py ../laminate-talk`). Ana uygulama güncellenince bununla yeniden üretilir.
- Geri kalan her şey (sesler, ses motoru, içerik kaynakları) ana uygulamanın kopyasıdır.
