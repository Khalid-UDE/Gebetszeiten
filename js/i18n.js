// Texte und Gebetsnamen je Sprache. Reine Daten – wird auch vom Push-Worker genutzt.
// "std" = Standard: deutsche Oberfläche, Gebetsnamen in Umschrift (Fajr …) plus arabische Schrift.

export const ARABIC_NAMES = {
  fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء"
};

const TRANSLIT = { fajr: "Fajr", sunrise: "Shuruq", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

const DE_UI = {
  appTitle: "Gebetszeiten",
  today: "Heute",
  nextPrayer: "Nächstes Gebet",
  nextPrayerTomorrow: "Nächstes Gebet · morgen",
  inDuration: "in {d}",
  hours: "{h} h {m} min",
  minutes: "{m} min",
  settings: "Einstellungen",
  location: "Standort",
  locationAuto: "Standortzugriff erlaubt · aktualisiert sich automatisch",
  locationManual: "Manuell gewählt",
  locationDenied: "Standortzugriff nicht erlaubt",
  locationNone: "Noch kein Ort gewählt",
  live: "Live",
  useGps: "Standort verwenden",
  searchPlace: "Ort suchen",
  searchPlaceholder: "Stadt eingeben …",
  search: "Suchen",
  noResults: "Kein Ort gefunden",
  method: "Methode",
  language: "Sprache",
  notifications: "Benachrichtigungen",
  notifOn: "Aktiv – du wirst zu den Gebetszeiten erinnert",
  notifOff: "Aus",
  notifEnable: "Benachrichtigungen erlauben",
  notifBlocked: "Im Browser blockiert – in den Systemeinstellungen erlauben",
  notifUnsupported: "Dieses Gerät/dieser Browser unterstützt keine Push-Benachrichtigungen",
  notifNoServer: "Push-Server noch nicht eingerichtet",
  notifTest: "Test senden",
  iosHint: "iPhone: Benachrichtigungen funktionieren nur, wenn die App über Teilen → Zum Home-Bildschirm installiert ist.",
  bellOn: "Benachrichtigung an: {name}",
  bellOff: "Benachrichtigung aus: {name}",
  welcome: "Willkommen",
  welcomeText: "Damit die Gebetszeiten für deinen Ort stimmen und du rechtzeitig erinnert wirst, braucht die App zwei Erlaubnisse.",
  locationWhy: "Wird nur zur Berechnung der Zeiten genutzt und automatisch aktualisiert.",
  allowLocation: "Standort erlauben",
  manualInstead: "Ort lieber manuell suchen",
  notifWhy: "Erinnerung zu Fajr, Dhuhr, Asr, Maghrib und Isha – auch wenn die App geschlossen ist.",
  later: "Später",
  done: "Fertig",
  sourceOfficial: "Offizielle Diyanet-Zeiten · {place}",
  sourceApprox: "Diyanet-Näherung (offizielle Daten nicht verfügbar)",
  sourceCalc: "Berechnet: Fajr 18°, Isha 17°, Asr Standard",
  notifBody: "Es ist Zeit für {name}",
  notifBodySunrise: "Sonnenaufgang – die Zeit für Fajr ist vorbei",
  tomorrowShort: "morgen"
};

export const LANGS = {
  std: { label: "Standard", locale: "de-DE", dir: "ltr", arabic: true, names: TRANSLIT, ui: DE_UI },
  de: {
    label: "Deutsch", locale: "de-DE", dir: "ltr", arabic: false,
    names: { fajr: "Morgengebet", sunrise: "Sonnenaufgang", dhuhr: "Mittagsgebet", asr: "Nachmittagsgebet", maghrib: "Abendgebet", isha: "Nachtgebet" },
    ui: { ...DE_UI, notifBody: "Es ist Zeit für das {name}", notifWhy: "Erinnerung zu allen fünf Gebeten – auch wenn die App geschlossen ist." }
  },
  ar: {
    label: "العربية", locale: "ar", dir: "rtl", arabic: false,
    names: ARABIC_NAMES,
    ui: {
      appTitle: "مواقيت الصلاة", today: "اليوم", nextPrayer: "الصلاة القادمة", nextPrayerTomorrow: "الصلاة القادمة · غدًا", inDuration: "بعد {d}",
      hours: "{h} س {m} د", minutes: "{m} دقيقة", settings: "الإعدادات", location: "الموقع",
      locationAuto: "الوصول إلى الموقع مسموح · يتحدث تلقائيًا", locationManual: "تم اختياره يدويًا",
      locationDenied: "الوصول إلى الموقع غير مسموح", locationNone: "لم يتم اختيار مكان بعد", live: "مباشر",
      useGps: "استخدام الموقع", searchPlace: "البحث عن مكان", searchPlaceholder: "اكتب اسم المدينة …", search: "بحث",
      noResults: "لم يتم العثور على مكان", method: "طريقة الحساب", language: "اللغة", notifications: "الإشعارات",
      notifOn: "مفعّلة – سيتم تذكيرك بأوقات الصلاة", notifOff: "متوقفة", notifEnable: "السماح بالإشعارات",
      notifBlocked: "محظورة في المتصفح – اسمح بها من إعدادات النظام", notifUnsupported: "هذا الجهاز أو المتصفح لا يدعم الإشعارات",
      notifNoServer: "خادم الإشعارات غير مُعدّ بعد", notifTest: "إرسال تجربة",
      iosHint: "آيفون: تعمل الإشعارات فقط إذا تم تثبيت التطبيق عبر مشاركة ← إضافة إلى الشاشة الرئيسية.",
      bellOn: "الإشعار مفعّل: {name}", bellOff: "الإشعار متوقف: {name}", welcome: "أهلًا وسهلًا",
      welcomeText: "لكي تكون أوقات الصلاة صحيحة لمكانك ويتم تذكيرك في الوقت المناسب، يحتاج التطبيق إلى إذنين.",
      locationWhy: "يُستخدم فقط لحساب الأوقات ويتحدث تلقائيًا.", allowLocation: "السماح بالموقع",
      manualInstead: "البحث عن المكان يدويًا", notifWhy: "تذكير بالفجر والظهر والعصر والمغرب والعشاء – حتى عندما يكون التطبيق مغلقًا.",
      later: "لاحقًا", done: "تم", sourceOfficial: "أوقات ديانت الرسمية · {place}", sourceApprox: "تقريب ديانت (البيانات الرسمية غير متاحة)",
      sourceCalc: "محسوبة: الفجر 18°، العشاء 17°، العصر حسب الجمهور", notifBody: "حان الآن وقت صلاة {name}",
      notifBodySunrise: "الشروق – انتهى وقت الفجر", tomorrowShort: "غدًا"
    }
  },
  en: {
    label: "English", locale: "en-GB", dir: "ltr", arabic: true,
    names: { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" },
    ui: {
      appTitle: "Prayer Times", today: "Today", nextPrayer: "Next prayer", nextPrayerTomorrow: "Next prayer · tomorrow", inDuration: "in {d}",
      hours: "{h} h {m} min", minutes: "{m} min", settings: "Settings", location: "Location",
      locationAuto: "Location access allowed · updates automatically", locationManual: "Chosen manually",
      locationDenied: "Location access not allowed", locationNone: "No place chosen yet", live: "Live",
      useGps: "Use my location", searchPlace: "Search place", searchPlaceholder: "Enter a city …", search: "Search",
      noResults: "No place found", method: "Method", language: "Language", notifications: "Notifications",
      notifOn: "On – you will be reminded at prayer times", notifOff: "Off", notifEnable: "Allow notifications",
      notifBlocked: "Blocked in the browser – allow them in the system settings", notifUnsupported: "This device/browser does not support push notifications",
      notifNoServer: "Push server not set up yet", notifTest: "Send test",
      iosHint: "iPhone: notifications only work if the app is installed via Share → Add to Home Screen.",
      bellOn: "Notification on: {name}", bellOff: "Notification off: {name}", welcome: "Welcome",
      welcomeText: "To show the right prayer times for your location and remind you on time, the app needs two permissions.",
      locationWhy: "Only used to calculate the times and updated automatically.", allowLocation: "Allow location",
      manualInstead: "Search for a place instead", notifWhy: "Reminders for Fajr, Dhuhr, Asr, Maghrib and Isha – even when the app is closed.",
      later: "Later", done: "Done", sourceOfficial: "Official Diyanet times · {place}", sourceApprox: "Diyanet approximation (official data unavailable)",
      sourceCalc: "Calculated: Fajr 18°, Isha 17°, Asr standard", notifBody: "It is time for {name}",
      notifBodySunrise: "Sunrise – the time for Fajr has ended", tomorrowShort: "tomorrow"
    }
  },
  tr: {
    label: "Türkçe", locale: "tr-TR", dir: "ltr", arabic: false,
    names: { fajr: "Sabah", sunrise: "Güneş", dhuhr: "Öğle", asr: "İkindi", maghrib: "Akşam", isha: "Yatsı" },
    ui: {
      appTitle: "Namaz Vakitleri", today: "Bugün", nextPrayer: "Sıradaki namaz", nextPrayerTomorrow: "Sıradaki namaz · yarın", inDuration: "{d} sonra",
      hours: "{h} sa {m} dk", minutes: "{m} dk", settings: "Ayarlar", location: "Konum",
      locationAuto: "Konum izni verildi · otomatik güncellenir", locationManual: "Elle seçildi",
      locationDenied: "Konum izni verilmedi", locationNone: "Henüz yer seçilmedi", live: "Canlı",
      useGps: "Konumumu kullan", searchPlace: "Yer ara", searchPlaceholder: "Şehir girin …", search: "Ara",
      noResults: "Yer bulunamadı", method: "Hesaplama yöntemi", language: "Dil", notifications: "Bildirimler",
      notifOn: "Açık – namaz vakitlerinde hatırlatılacaksınız", notifOff: "Kapalı", notifEnable: "Bildirimlere izin ver",
      notifBlocked: "Tarayıcıda engellendi – sistem ayarlarından izin verin", notifUnsupported: "Bu cihaz/tarayıcı anlık bildirimleri desteklemiyor",
      notifNoServer: "Bildirim sunucusu henüz kurulmadı", notifTest: "Test gönder",
      iosHint: "iPhone: Bildirimler yalnızca uygulama Paylaş → Ana Ekrana Ekle ile yüklendiyse çalışır.",
      bellOn: "Bildirim açık: {name}", bellOff: "Bildirim kapalı: {name}", welcome: "Hoş geldiniz",
      welcomeText: "Namaz vakitlerinin bulunduğunuz yere göre doğru olması ve zamanında hatırlatılmanız için uygulamanın iki izne ihtiyacı var.",
      locationWhy: "Yalnızca vakitlerin hesaplanması için kullanılır ve otomatik güncellenir.", allowLocation: "Konuma izin ver",
      manualInstead: "Yeri elle ara", notifWhy: "Sabah, öğle, ikindi, akşam ve yatsı için hatırlatma – uygulama kapalıyken bile.",
      later: "Daha sonra", done: "Tamam", sourceOfficial: "Resmî Diyanet vakitleri · {place}", sourceApprox: "Diyanet yaklaşık değerleri (resmî veriler alınamadı)",
      sourceCalc: "Hesaplanan: İmsak 18°, Yatsı 17°, İkindi standart", notifBody: "{name} namazı vakti girdi",
      notifBodySunrise: "Güneş doğdu – sabah namazının vakti çıktı", tomorrowShort: "yarın"
    }
  },
  sq: {
    label: "Shqip", locale: "sq-AL", dir: "ltr", arabic: false,
    names: { fajr: "Sabahu", sunrise: "Lindja e diellit", dhuhr: "Dreka", asr: "Ikindia", maghrib: "Akshami", isha: "Jacia" },
    ui: {
      appTitle: "Kohët e namazit", today: "Sot", nextPrayer: "Namazi i radhës", nextPrayerTomorrow: "Namazi i radhës · nesër", inDuration: "pas {d}",
      hours: "{h} orë {m} min", minutes: "{m} min", settings: "Cilësimet", location: "Vendndodhja",
      locationAuto: "Qasja në vendndodhje u lejua · përditësohet automatikisht", locationManual: "Zgjedhur manualisht",
      locationDenied: "Qasja në vendndodhje nuk u lejua", locationNone: "Ende nuk është zgjedhur vend", live: "Live",
      useGps: "Përdor vendndodhjen", searchPlace: "Kërko vendin", searchPlaceholder: "Shkruaj qytetin …", search: "Kërko",
      noResults: "Nuk u gjet asnjë vend", method: "Metoda", language: "Gjuha", notifications: "Njoftimet",
      notifOn: "Aktive – do të kujtoheni në kohët e namazit", notifOff: "Joaktive", notifEnable: "Lejo njoftimet",
      notifBlocked: "Të bllokuara në shfletues – lejoji te cilësimet e sistemit", notifUnsupported: "Kjo pajisje/ky shfletues nuk mbështet njoftime push",
      notifNoServer: "Serveri i njoftimeve ende nuk është konfiguruar", notifTest: "Dërgo provë",
      iosHint: "iPhone: Njoftimet funksionojnë vetëm nëse aplikacioni instalohet përmes Ndaj → Shto në ekranin bazë.",
      bellOn: "Njoftimi aktiv: {name}", bellOff: "Njoftimi joaktiv: {name}", welcome: "Mirë se vini",
      welcomeText: "Që kohët e namazit të jenë të sakta për vendin tuaj dhe të kujtoheni me kohë, aplikacioni ka nevojë për dy leje.",
      locationWhy: "Përdoret vetëm për llogaritjen e kohëve dhe përditësohet automatikisht.", allowLocation: "Lejo vendndodhjen",
      manualInstead: "Kërko vendin manualisht", notifWhy: "Kujtesë për sabahun, drekën, ikindinë, akshamin dhe jacinë – edhe kur aplikacioni është i mbyllur.",
      later: "Më vonë", done: "Gati", sourceOfficial: "Kohët zyrtare të Diyanet · {place}", sourceApprox: "Përafrim i Diyanet (të dhënat zyrtare nuk janë të disponueshme)",
      sourceCalc: "Llogaritur: Sabahu 18°, Jacia 17°, Ikindia standard", notifBody: "Erdhi koha e namazit: {name}",
      notifBodySunrise: "Lindja e diellit – koha e sabahut ka kaluar", tomorrowShort: "nesër"
    }
  },
  bs: {
    label: "Bosanski", locale: "bs-BA", dir: "ltr", arabic: false,
    names: { fajr: "Sabah", sunrise: "Izlazak sunca", dhuhr: "Podne", asr: "Ikindija", maghrib: "Akšam", isha: "Jacija" },
    ui: {
      appTitle: "Namaska vremena", today: "Danas", nextPrayer: "Sljedeći namaz", nextPrayerTomorrow: "Sljedeći namaz · sutra", inDuration: "za {d}",
      hours: "{h} h {m} min", minutes: "{m} min", settings: "Postavke", location: "Lokacija",
      locationAuto: "Pristup lokaciji dozvoljen · ažurira se automatski", locationManual: "Ručno odabrano",
      locationDenied: "Pristup lokaciji nije dozvoljen", locationNone: "Mjesto još nije odabrano", live: "Uživo",
      useGps: "Koristi moju lokaciju", searchPlace: "Traži mjesto", searchPlaceholder: "Unesi grad …", search: "Traži",
      noResults: "Mjesto nije pronađeno", method: "Metoda", language: "Jezik", notifications: "Obavještenja",
      notifOn: "Uključeno – bit ćeš podsjećen u vrijeme namaza", notifOff: "Isključeno", notifEnable: "Dozvoli obavještenja",
      notifBlocked: "Blokirano u pregledniku – dozvoli u postavkama sistema", notifUnsupported: "Ovaj uređaj/preglednik ne podržava push obavještenja",
      notifNoServer: "Server za obavještenja još nije postavljen", notifTest: "Pošalji test",
      iosHint: "iPhone: Obavještenja rade samo ako je aplikacija instalirana putem Dijeli → Dodaj na početni ekran.",
      bellOn: "Obavještenje uključeno: {name}", bellOff: "Obavještenje isključeno: {name}", welcome: "Dobro došli",
      welcomeText: "Da bi vremena namaza bila tačna za tvoje mjesto i da te aplikacija na vrijeme podsjeti, potrebne su dvije dozvole.",
      locationWhy: "Koristi se samo za računanje vremena i ažurira se automatski.", allowLocation: "Dozvoli lokaciju",
      manualInstead: "Radije ručno traži mjesto", notifWhy: "Podsjetnik za sabah, podne, ikindiju, akšam i jaciju – i kada je aplikacija zatvorena.",
      later: "Kasnije", done: "Gotovo", sourceOfficial: "Zvanična Diyanet vremena · {place}", sourceApprox: "Diyanet približno (zvanični podaci nisu dostupni)",
      sourceCalc: "Izračunato: Sabah 18°, Jacija 17°, Ikindija standard", notifBody: "Nastupilo je vrijeme namaza: {name}",
      notifBodySunrise: "Izlazak sunca – vrijeme sabaha je isteklo", tomorrowShort: "sutra"
    }
  }
};

export const LANG_ORDER = ["std", "de", "ar", "en", "tr", "sq", "bs"];

export const METHOD_LABELS = { mwl: "Muslim World League", diyanet: "Diyanet" };

export function fmt(str, vars = {}) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

export function getLang(code) {
  return LANGS[code] || LANGS.std;
}

// Text der Push-Benachrichtigung für ein Gebet.
export function notificationText(langCode, key, timeStr) {
  const L = getLang(langCode);
  const name = L.names[key];
  const title = (L.arabic ? `${name} · ${ARABIC_NAMES[key]}` : name) + ` · ${timeStr}`;
  const body = key === "sunrise" ? L.ui.notifBodySunrise : fmt(L.ui.notifBody, { name });
  return { title, body };
}

// Vorschlag für die Sprache anhand der Gerätesprache.
export function detectLang(navLangs = []) {
  for (const l of navLangs) {
    const c = String(l).toLowerCase().slice(0, 2);
    if (c === "de") return "std";
    if (c === "ar") return "ar";
    if (c === "tr") return "tr";
    if (c === "sq") return "sq";
    if (c === "bs" || c === "hr" || c === "sr") return "bs";
    if (c === "en") return "en";
  }
  return "std";
}
