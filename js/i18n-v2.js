/* ============================================================
   MEEZAN — ميزان  |  js/i18n-v2.js   (classic script, load AFTER i18n.js)
   Makes the v1 language system work on every v2 page:
   - adds the new v2 words to the v1 dictionary (20 languages)
   - translates any text on the page whose English matches a known
     word/phrase, and keeps translating what the page draws later
   - RTL for Arabic, Urdu, Persian
   Anything not in the dictionary simply stays English.
   ============================================================ */
(function() {
    'use strict';

    var ORDER = ['en', 'ar', 'hi', 'ur', 'te', 'ta', 'ml', 'bn', 'fr', 'de', 'es', 'it', 'ja', 'zh', 'el', 'tr', 'id', 'ms', 'fa', 'ru', 'pt'];

    var ROWS = {
        cash: 'Cash|نقد|नकद|نقد|నగదు|பணம்|പണം|নগদ|Espèces|Bargeld|Efectivo|Contanti|現金|现金|Μετρητά|Nakit|Tunai|Tunai|نقد|Наличные|Dinheiro',
        bank: 'Bank|بنك|बैंक|بینک|బ్యాంకు|வங்கி|ബാങ്ക്|ব্যাংক|Banque|Bank|Banco|Banca|銀行|银行|Τράπεζα|Banka|Bank|Bank|بانک|Банк|Banco',
        cashSavings: 'Cash Savings|مدخرات نقدية|नकद बचत|نقد بچت|నగదు పొదుపు|பண சேமிப்பு|പണ സമ്പാദ്യം|নগদ সঞ্চয়|Épargne en espèces|Bargeld-Ersparnisse|Ahorros en efectivo|Risparmi in contanti|現金貯蓄|现金储蓄|Αποταμιεύσεις μετρητών|Nakit tasarruf|Tabungan tunai|Simpanan tunai|پس‌انداز نقدی|Наличные сбережения|Poupança em dinheiro',
        onlineSavings: 'Online Savings|مدخرات إلكترونية|ऑनलाइन बचत|آن لائن بچت|ఆన్‌లైన్ పొదుపు|ஆன்லைன் சேமிப்பு|ഓൺലൈൻ സമ്പാദ്യം|অনলাইন সঞ্চয়|Épargne en ligne|Online-Ersparnisse|Ahorros en línea|Risparmi online|オンライン貯蓄|线上储蓄|Online αποταμιεύσεις|Çevrimiçi tasarruf|Tabungan online|Simpanan dalam talian|پس‌انداز آنلاین|Онлайн-сбережения|Poupança online',
        assetsK: 'Assets|الأصول|संपत्ति|اثاثے|ఆస్తులు|சொத்துகள்|ആസ്തികൾ|সম্পদ|Actifs|Vermögen|Activos|Beni|資産|资产|Περιουσιακά στοιχεία|Varlıklar|Aset|Aset|دارایی‌ها|Активы|Ativos',
        totalNetWorth: 'Total net worth|إجمالي صافي الثروة|कुल निवल संपत्ति|کل خالص دولت|మొత్తం నికర విలువ|மொத்த நிகர மதிப்பு|ആകെ അറ്റ ആസ്തി|মোট নিট সম্পদ|Valeur nette totale|Gesamtvermögen|Patrimonio neto total|Patrimonio netto totale|純資産合計|总净资产|Συνολική καθαρή αξία|Toplam net değer|Total kekayaan bersih|Jumlah nilai bersih|کل خالص دارایی|Общий капитал|Patrimônio líquido total',
        accountsAssets: 'Accounts & Assets|الحسابات والأصول|खाते और संपत्ति|اکاؤنٹس اور اثاثے|ఖాతాలు & ఆస్తులు|கணக்குகள் & சொத்துகள்|അക്കൗണ്ടുകളും ആസ്തികളും|অ্যাকাউন্ট ও সম্পদ|Comptes et actifs|Konten & Vermögen|Cuentas y activos|Conti e beni|口座と資産|账户与资产|Λογαριασμοί & περιουσία|Hesaplar ve varlıklar|Akun & Aset|Akaun & Aset|حساب‌ها و دارایی‌ها|Счета и активы|Contas e ativos',
        friendsLoans: 'Friends & Loans|الأصدقاء والقروض|दोस्त और उधार|دوست اور قرض|స్నేహితులు & అప్పులు|நண்பர்கள் & கடன்|സുഹൃത്തുക്കളും കടവും|বন্ধু ও ধার|Amis et prêts|Freunde & Leihgaben|Amigos y préstamos|Amici e prestiti|友人と貸し借り|朋友与借款|Φίλοι & δάνεια|Arkadaşlar ve borçlar|Teman & Pinjaman|Rakan & Pinjaman|دوستان و وام|Друзья и долги|Amigos e empréstimos',
        zakatSadaqah: 'Zakat & Sadaqah|الزكاة والصدقة|ज़कात और सदक़ा|زکوٰۃ اور صدقہ|జకాత్ & సదఖా|ஜகாத் & சதகா|സകാത്തും സദഖയും|যাকাত ও সদকা|Zakat et Sadaqa|Zakat & Sadaqa|Zakat y Sadaqa|Zakat e Sadaqa|ザカートとサダカ|天课与自愿施舍|Ζακάτ & Σαντάκα|Zekât ve Sadaka|Zakat & Sedekah|Zakat & Sedekah|زکات و صدقه|Закят и Садака|Zakat e Sadaqa',
        eidRamadan: 'Eid & Ramadan|العيد ورمضان|ईद और रमज़ान|عید اور رمضان|ఈద్ & రంజాన్|பெருநாள் & ரமலான்|പെരുന്നാളും റമദാനും|ঈদ ও রমজান|Aïd et Ramadan|Eid & Ramadan|Eid y Ramadán|Eid e Ramadan|イードとラマダン|开斋节与斋月|Ειντ & Ραμαζάνι|Bayram ve Ramazan|Idulfitri & Ramadan|Hari Raya & Ramadan|عید و رمضان|Ид и Рамадан|Eid e Ramadã',
        importK: 'Import|استيراد|आयात|درآمد کریں|దిగుమతి|இறக்குமதி|ഇറക്കുമതി|ইম্পোর্ট|Importer|Importieren|Importar|Importa|インポート|导入|Εισαγωγή|İçe aktar|Impor|Import|وارد کردن|Импорт|Importar',
        exportK: 'Export|تصدير|निर्यात|برآمد کریں|ఎగుమతి|ஏற்றுமதி|എക്സ്പോർട്ട്|এক্সপোর্ট|Exporter|Exportieren|Exportar|Esporta|エクスポート|导出|Εξαγωγή|Dışa aktar|Ekspor|Eksport|خروجی گرفتن|Экспорт|Exportar',
        familyGroups: 'Family & Groups|العائلة والمجموعات|परिवार और समूह|خاندان اور گروپس|కుటుంబం & సమూహాలు|குடும்பம் & குழுக்கள்|കുടുംബവും ഗ്രൂപ്പുകളും|পরিবার ও গ্রুপ|Famille et groupes|Familie & Gruppen|Familia y grupos|Famiglia e gruppi|家族とグループ|家庭与群组|Οικογένεια & ομάδες|Aile ve gruplar|Keluarga & Grup|Keluarga & Kumpulan|خانواده و گروه‌ها|Семья и группы|Família e grupos',
        settingsProfile: 'Settings & Profile|الإعدادات والملف الشخصي|सेटिंग्स और प्रोफ़ाइल|ترتیبات اور پروفائل|సెట్టింగ్‌లు & ప్రొఫైల్|அமைப்புகள் & சுயவிவரம்|ക്രമീകരണങ്ങളും പ്രൊഫൈലും|সেটিংস ও প্রোফাইল|Réglages et profil|Einstellungen & Profil|Ajustes y perfil|Impostazioni e profilo|設定とプロフィール|设置与个人资料|Ρυθμίσεις & προφίλ|Ayarlar ve profil|Pengaturan & Profil|Tetapan & Profil|تنظیمات و نمایه|Настройки и профиль|Configurações e perfil',
        secMain: 'Main|الرئيسية|मुख्य|مرکزی|ప్రధాన|முதன்மை|പ്രധാനം|মূল|Principal|Haupt|Principal|Principale|メイン|主要|Κύρια|Ana|Utama|Utama|اصلی|Главное|Principal',
        secIslamic: 'Islamic|إسلامي|इस्लामी|اسلامی|ఇస్లామిక్|இஸ்லாமிய|ഇസ്ലാമിക്|ইসলামিক|Islamique|Islamisch|Islámico|Islamico|イスラム|伊斯兰|Ισλαμικά|İslami|Islami|Islam|اسلامی|Исламское|Islâmico',
        secInsights: 'Insights|رؤى|विश्लेषण|بصیرت|అంతర్దృష్టులు|நுண்ணறிவு|ഉൾക്കാഴ്ചകൾ|অন্তর্দৃষ্টি|Analyses|Einblicke|Análisis|Approfondimenti|インサイト|洞察|Αναλύσεις|Analizler|Wawasan|Wawasan|بینش‌ها|Аналитика|Análises',
        secSocial: 'Social|اجتماعي|सामाजिक|سماجی|సామాజిక|சமூக|സാമൂഹികം|সামাজিক|Social|Soziales|Social|Sociale|ソーシャル|社交|Κοινωνικά|Sosyal|Sosial|Sosial|اجتماعی|Общение|Social',
        secYou: 'You|أنت|आप|آپ|మీరు|நீங்கள்|നിങ്ങൾ|আপনি|Vous|Du|Tú|Tu|あなた|我的|Εσείς|Siz|Anda|Anda|شما|Вы|Você',
        home: 'Home|الرئيسية|होम|ہوم|హోమ్|முகப்பு|ഹോം|হোম|Accueil|Start|Inicio|Home|ホーム|首页|Αρχική|Ana sayfa|Beranda|Utama|خانه|Главная|Início',
        spend: 'Spend|إنفاق|खर्च|خرچ|ఖర్చు|செலவு|ചെലവ്|খরচ|Dépenses|Ausgaben|Gastos|Spese|支出|支出|Έξοδα|Harcama|Belanja|Belanja|هزینه|Траты|Gastos',
        friends: 'Friends|أصدقاء|दोस्त|دوست|స్నేహితులు|நண்பர்கள்|സുഹൃത്തുക്കൾ|বন্ধু|Amis|Freunde|Amigos|Amici|友人|朋友|Φίλοι|Arkadaş|Teman|Rakan|دوستان|Друзья|Amigos',
        eid: 'Eid|العيد|ईद|عید|ఈద్|பெருநாள்|പെരുന്നാൾ|ঈদ|Aïd|Eid|Eid|Eid|イード|节日|Ειντ|Bayram|Idulfitri|Raya|عید|Ид|Eid',
        reportsK: 'Reports|التقارير|रिपोर्ट|رپورٹس|నివేదికలు|அறிக்கைகள்|റിപ്പോർട്ടുകൾ|রিপোর্ট|Rapports|Berichte|Informes|Report|レポート|报告|Αναφορές|Raporlar|Laporan|Laporan|گزارش‌ها|Отчёты|Relatórios',
        zakatK: 'Zakat|زكاة|ज़कात|زکوٰۃ|జకాత్|ஜகாத்|സകാത്ത്|যাকাত|Zakat|Zakat|Zakat|Zakat|ザカート|天课|Ζακάτ|Zekât|Zakat|Zakat|زکات|Закят|Zakat',
        familyK: 'Family|العائلة|परिवार|خاندان|కుటుంబం|குடும்பம்|കുടുംബം|পরিবার|Famille|Familie|Familia|Famiglia|家族|家庭|Οικογένεια|Aile|Keluarga|Keluarga|خانواده|Семья|Família',
        holding: 'Holding|يحتفظ|जमा|امانت|ఉంచినది|வைத்திருப்பது|കൈവശം|জমা|Détenu|Verwahrt|En custodia|In custodia|預かり|保管中|Φύλαξη|Emanet|Dititipkan|Amanah|امانت|На хранении|Em custódia',
        lentOut: 'Lent out|مُقرَض|उधार दिया|ادھار دیا|అప్పుగా ఇచ్చినది|கடன் கொடுத்தது|കടം നൽകി|ধার দেওয়া|Prêté|Verliehen|Prestado|Prestato|貸し出し|借出|Δανεισμένα|Borç verilen|Dipinjamkan|Dipinjamkan|قرض داده|Одолжено|Emprestado',
        openK: 'Open|مفتوح|खुला|کھلا|తెరిచినవి|திறந்தவை|തുറന്നത്|খোলা|Ouvert|Offen|Abierto|Aperto|未完了|未完成|Ανοιχτό|Açık|Terbuka|Terbuka|باز|Открыто|Aberto',
        completedK: 'Completed|مكتمل|पूर्ण|مکمل|పూర్తయినవి|முடிந்தவை|പൂർത്തിയായി|সম্পন্ন|Terminé|Abgeschlossen|Completado|Completato|完了|已完成|Ολοκληρώθηκε|Tamamlandı|Selesai|Selesai|کامل شده|Завершено|Concluído',
        markComplete: 'Mark complete|وضع علامة مكتمل|पूर्ण चिह्नित करें|مکمل نشان کریں|పూర్తి అని గుర్తించు|முடிந்தது எனக் குறி|പൂർത്തിയായി എന്ന് അടയാളപ്പെടുത്തുക|সম্পন্ন চিহ্নিত করুন|Marquer terminé|Als erledigt markieren|Marcar completado|Segna completato|完了にする|标记完成|Σήμανση ως ολοκληρωμένο|Tamamlandı işaretle|Tandai selesai|Tanda selesai|علامت‌گذاری کامل|Отметить выполненным|Marcar concluído',
        charityGoal: 'Charity goal|هدف الصدقة|दान लक्ष्य|خیرات کا ہدف|దాన లక్ష్యం|தர்ம இலக்கு|ദാന ലക്ഷ്യം|দানের লক্ষ্য|Objectif de charité|Spendenziel|Meta de caridad|Obiettivo di beneficenza|寄付の目標|慈善目标|Στόχος φιλανθρωπίας|Bağış hedefi|Target amal|Sasaran amal|هدف صدقه|Цель благотворительности|Meta de caridade',
        profile: 'Profile|الملف الشخصي|प्रोफ़ाइल|پروفائل|ప్రొఫైల్|சுயவிவரம்|പ്രൊഫൈൽ|প্রোফাইল|Profil|Profil|Perfil|Profilo|プロフィール|个人资料|Προφίλ|Profil|Profil|Profil|نمایه|Профиль|Perfil',
        preferences: 'Preferences|التفضيلات|पसंद|ترجیحات|ప్రాధాన్యతలు|விருப்பங்கள்|മുൻഗണനകൾ|পছন্দ|Préférences|Einstellungen|Preferencias|Preferenze|環境設定|偏好设置|Προτιμήσεις|Tercihler|Preferensi|Keutamaan|ترجیحات|Предпочтения|Preferências',
        giving: 'Giving|العطاء|दान|عطیات|దానం|கொடை|ദാനം|দান|Dons|Spenden|Donaciones|Donazioni|寄付|捐赠|Προσφορές|Bağışlar|Memberi|Pemberian|بخشش|Пожертвования|Doações',
        about: 'About|حول|परिचय|تعارف|గురించి|பற்றி|കുറിച്ച്|সম্পর্কে|À propos|Über|Acerca de|Informazioni|概要|关于|Σχετικά|Hakkında|Tentang|Tentang|درباره|О приложении|Sobre',
        theme: 'Theme|المظهر|थीम|تھیم|థీమ్|தீம்|തീം|থিম|Thème|Design|Tema|Tema|テーマ|主题|Θέμα|Tema|Tema|Tema|زمینه|Тема|Tema',
        calendarK: 'Calendar|التقويم|कैलेंडर|کیلنڈر|క్యాలెండర్|நாட்காட்டி|കലണ്ടർ|ক্যালেন্ডার|Calendrier|Kalender|Calendario|Calendario|カレンダー|日历|Ημερολόγιο|Takvim|Kalender|Kalendar|تقویم|Календарь|Calendário',
        history: 'History|السجل|इतिहास|تاریخ|చరిత్ర|வரலாறு|ചരിത്രം|ইতিহাস|Historique|Verlauf|Historial|Cronologia|履歴|历史|Ιστορικό|Geçmiş|Riwayat|Sejarah|تاریخچه|История|Histórico',
        members: 'Members|الأعضاء|सदस्य|ارکان|సభ్యులు|உறுப்பினர்கள்|അംഗങ്ങൾ|সদস্য|Membres|Mitglieder|Miembros|Membri|メンバー|成员|Μέλη|Üyeler|Anggota|Ahli|اعضا|Участники|Membros',
        balances: 'Balances|الأرصدة|शेष राशि|بیلنس|బ్యాలెన్స్‌లు|இருப்புகள்|ബാലൻസുകൾ|ব্যালেন্স|Soldes|Salden|Saldos|Saldi|残高|余额|Υπόλοιπα|Bakiyeler|Saldo|Baki|موجودی‌ها|Балансы|Saldos',
        whoPays: 'Who pays whom|من يدفع لمن|कौन किसे देगा|کون کس کو دے گا|ఎవరు ఎవరికి చెల్లించాలి|யார் யாருக்கு செலுத்த வேண்டும்|ആർ ആർക്ക് നൽകണം|কে কাকে দেবে|Qui paie qui|Wer zahlt wem|Quién paga a quién|Chi paga chi|誰が誰に支払うか|谁付给谁|Ποιος πληρώνει ποιον|Kim kime ödeyecek|Siapa bayar siapa|Siapa bayar siapa|چه کسی به چه کسی می‌پردازد|Кто кому платит|Quem paga a quem',
        lastSix: 'Last 6 months|آخر 6 أشهر|पिछले 6 महीने|پچھلے 6 ماہ|గత 6 నెలలు|கடந்த 6 மாதங்கள்|കഴിഞ്ഞ 6 മാസം|গত ৬ মাস|6 derniers mois|Letzte 6 Monate|Últimos 6 meses|Ultimi 6 mesi|過去6か月|近6个月|Τελευταίοι 6 μήνες|Son 6 ay|6 bulan terakhir|6 bulan lepas|۶ ماه اخیر|Последние 6 месяцев|Últimos 6 meses',
        biggest: 'Biggest expenses|أكبر المصروفات|सबसे बड़े खर्च|سب سے بڑے اخراجات|అతిపెద్ద ఖర్చులు|மிகப்பெரிய செலவுகள்|ഏറ്റവും വലിയ ചെലവുകൾ|বড় খরচসমূহ|Plus grosses dépenses|Größte Ausgaben|Mayores gastos|Spese maggiori|大きな支出|最大支出|Μεγαλύτερα έξοδα|En büyük harcamalar|Pengeluaran terbesar|Perbelanjaan terbesar|بزرگ‌ترین هزینه‌ها|Крупнейшие расходы|Maiores despesas',
        incomeByCat: 'Income by category|الدخل حسب الفئة|श्रेणी अनुसार आय|زمرے کے لحاظ سے آمدنی|వర్గం వారీ ఆదాయం|வகை வாரி வருமானம்|വിഭാഗം തിരിച്ച വരുമാനം|বিভাগ অনুযায়ী আয়|Revenus par catégorie|Einnahmen nach Kategorie|Ingresos por categoría|Entrate per categoria|カテゴリ別収入|按类别收入|Έσοδα ανά κατηγορία|Kategoriye göre gelir|Pendapatan per kategori|Pendapatan mengikut kategori|درآمد بر اساس دسته|Доходы по категориям|Receitas por categoria',
        transfer: 'Transfer|تحويل|ट्रांसफ़र|منتقلی|బదిలీ|பரிமாற்றம்|കൈമാറ്റം|ট্রান্সফার|Virement|Überweisung|Transferir|Trasferisci|振替|转账|Μεταφορά|Transfer|Transfer|Pindah|انتقال|Перевод|Transferir'
    };

    var D = window.MEEZAN_TRANSLATIONS = window.MEEZAN_TRANSLATIONS || {};
    var EN_TO_KEY = {};

    var LEAD = /^(?:[\p{Extended_Pictographic}\uFE0F\u200D]|[^\p{L}\p{N}])+/u;
    function strip(s) { return String(s).replace(LEAD, '').replace(/[\s:…\.]+$/u, '').trim(); }
    function prefixOf(s) { var m = String(s).match(LEAD); return m ? m[0] : ''; }

    Object.keys(ROWS).forEach(function(key) {
        var parts = ROWS[key].split('|');
        ORDER.forEach(function(code, i) {
            if (!parts[i]) { return; }
            D[code] = D[code] || {};
            D[code][key] = parts[i];
        });
    });

    /* English words → key, from the v1 dictionary AND the v2 words */
    function buildReverse() {
        EN_TO_KEY = {};
        var en = D.en || {};
        Object.keys(en).forEach(function(k) {
            if (typeof en[k] !== 'string' || k === 'appName' || k === 'bismillah') { return; }
            var n = strip(en[k]).toLowerCase();
            if (n && !EN_TO_KEY[n]) { EN_TO_KEY[n] = k; }
        });
    }
    buildReverse();

    /* a few English phrases used by v2 that differ slightly from the keys above */
    var ALIASES = {
        'net worth': 'netWorth', 'total net worth': 'totalNetWorth', 'accounts & assets': 'accountsAssets', 'wealth & assets': 'assets',
        'dashboard': 'dashboard', 'income': 'income', 'expenses': 'expenses', 'sign out': 'signOut', 'sign in': 'signIn',
        'zakat & sadaqah': 'zakatSadaqah', 'family & groups': 'familyGroups', 'settings & profile': 'settingsProfile',
        'add income': 'addIncome', 'add expense': 'addExpense', 'spending by category': 'spendingByCategory',
        'this month': 'thisMonth', 'all time': 'allTime', 'zakat due': 'zakatDue', 'nisab met': 'nisabMet',
        'calculator': 'calculator', 'language': 'language', 'save': 'save', 'cancel': 'cancel', 'delete': 'delete', 'edit': 'edit',
        'main': 'secMain', 'islamic': 'secIslamic', 'insights': 'secInsights', 'social': 'secSocial', 'you': 'secYou',
        'assets': 'assetsK', 'reports': 'reportsK', 'zakat': 'zakatK', 'family': 'familyK', 'settings': 'settings',
        'income by category': 'incomeByCat', 'open': 'openK', 'completed': 'completedK', 'calendar': 'calendarK'
    };
    Object.keys(ALIASES).forEach(function(k) { EN_TO_KEY[k] = ALIASES[k]; });
    /* v2 words win over v1 phrases that happen to share an English text */
    Object.keys(ROWS).forEach(function(key) { EN_TO_KEY[strip(ROWS[key].split('|')[0]).toLowerCase()] = key; });
    ['assets', 'reports', 'zakat', 'family', 'open', 'completed', 'calendar', 'income by category', 'main', 'islamic', 'insights', 'social', 'you'].forEach(function(k) { EN_TO_KEY[k] = ALIASES[k]; });

    var current = 'en';
    var original = new WeakMap(); /* text node → { orig, tr } */
    var observer = null;
    var pending = false;
    var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1 };

    function translateText(node) {
        var rec = original.get(node);
        var val = node.nodeValue;
        if (rec && val === rec.tr) { val = rec.orig; } /* we translated it before: start from the English */
        var core = strip(val);
        if (!core) { return; }
        var key = EN_TO_KEY[core.toLowerCase()];
        var dict = D[current] || {};
        var tr = key && dict[key] ? strip(dict[key]) : '';
        if (current === 'en' || !tr) {
            if (rec && node.nodeValue === rec.tr) { node.nodeValue = rec.orig; }
            if (rec) { original.delete(node); }
            return;
        }
        var pre = prefixOf(val);
        var m = val.match(/^(\s*)/);
        var out = (m ? m[1] : '') + (pre.trim() ? pre.replace(/^\s+/, '') : '') + tr;
        if (out === node.nodeValue) { return; }
        original.set(node, { orig: val, tr: out });
        node.nodeValue = out;
    }

    function walk(root) {
        if (!root) { return; }
        if (root.nodeType === 3) {
            if (root.parentNode && !SKIP[root.parentNode.nodeName]) { translateText(root); }
            return;
        }
        if (root.nodeType !== 1 || SKIP[root.nodeName]) { return; }
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var n;
        var list = [];
        while ((n = w.nextNode())) { if (n.parentNode && !SKIP[n.parentNode.nodeName]) { list.push(n); } }
        list.forEach(translateText);
    }

    function schedule() {
        if (pending) { return; }
        pending = true;
        (window.requestAnimationFrame || setTimeout)(function() { pending = false; walk(document.body); });
    }

    function startObserver() {
        if (observer || !window.MutationObserver || !document.body) { return; }
        observer = new MutationObserver(function(muts) {
            if (current === 'en') { return; }
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type === 'characterData') {
                    var rec = original.get(m.target);
                    if (!rec || m.target.nodeValue !== rec.tr) { schedule(); return; }
                } else if (m.addedNodes && m.addedNodes.length) { schedule(); return; }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    var originalApply = window.applyLanguage;
    window.applyLanguage = function(code) {
        current = code || 'en';
        if (!D[current]) { current = 'en'; }
        if (typeof originalApply === 'function') { originalApply(code); }
        if (document.body) {
            walk(document.body);
            startObserver();
        } else {
            document.addEventListener('DOMContentLoaded', function() { walk(document.body); startObserver(); });
        }
    };

    window.MEEZAN_LANGS = [
        { code: 'en', native: 'English', english: 'English', rtl: false, flag: '🇬🇧' },
        { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true, flag: '🇸🇦' },
        { code: 'ur', native: 'اردو', english: 'Urdu', rtl: true, flag: '🇵🇰' },
        { code: 'fa', native: 'فارسی', english: 'Persian', rtl: true, flag: '🇮🇷' },
        { code: 'hi', native: 'हिन्दी', english: 'Hindi', rtl: false, flag: '🇮🇳' },
        { code: 'te', native: 'తెలుగు', english: 'Telugu', rtl: false, flag: '🇮🇳' },
        { code: 'ta', native: 'தமிழ்', english: 'Tamil', rtl: false, flag: '🇮🇳' },
        { code: 'ml', native: 'മലയാളം', english: 'Malayalam', rtl: false, flag: '🇮🇳' },
        { code: 'bn', native: 'বাংলা', english: 'Bengali', rtl: false, flag: '🇧🇩' },
        { code: 'ms', native: 'Melayu', english: 'Malay', rtl: false, flag: '🇲🇾' },
        { code: 'id', native: 'Bahasa', english: 'Indonesian', rtl: false, flag: '🇮🇩' },
        { code: 'tr', native: 'Türkçe', english: 'Turkish', rtl: false, flag: '🇹🇷' },
        { code: 'fr', native: 'Français', english: 'French', rtl: false, flag: '🇫🇷' },
        { code: 'de', native: 'Deutsch', english: 'German', rtl: false, flag: '🇩🇪' },
        { code: 'es', native: 'Español', english: 'Spanish', rtl: false, flag: '🇪🇸' },
        { code: 'it', native: 'Italiano', english: 'Italian', rtl: false, flag: '🇮🇹' },
        { code: 'pt', native: 'Português', english: 'Portuguese', rtl: false, flag: '🇵🇹' },
        { code: 'ru', native: 'Русский', english: 'Russian', rtl: false, flag: '🇷🇺' },
        { code: 'ja', native: '日本語', english: 'Japanese', rtl: false, flag: '🇯🇵' },
        { code: 'zh', native: '中文', english: 'Chinese', rtl: false, flag: '🇨🇳' },
        { code: 'el', native: 'Ελληνικά', english: 'Greek', rtl: false, flag: '🇬🇷' }
    ];

    /* i18n.js already scheduled applyLanguage(saved) for load; make sure OUR version runs */
    var saved = 'en';
    try { saved = localStorage.getItem('meezan-lang') || 'en'; } catch (e) { saved = 'en'; }
    if (saved !== 'en') {
        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function() { window.applyLanguage(saved); }); } else { window.applyLanguage(saved); }
    }
})();
