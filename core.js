/********************************************************************
 * MEKTEB-İ DERGAH - CORE.JS
 * (Tam Kaynak Kod Koruma Kalkanı, PWA Mobil/Tablet Kurulum Motoru,
 *  Firebase Auth & Firestore, Kategori Yönetimi, Admin Paneli,
 *  Orijinal PDF & EPUB Font/CSS Koruyucu Ayrıştırıcı,
 *  Klasik/Test/Boşluk/DY Soru Düzenleyici, dersler/ ve sorular.json Motoru)
 ********************************************************************/

// 0. ÇOK KATMANLI KAYNAK KOD VE İÇERİK KORUMA KALKANI
(function initStrictSourceCodeProtection() {
  // 1. Klavye kısayollarını engelle (F12, Ctrl+U, Ctrl+S, Ctrl+P, Ctrl+Shift+I/J/C/K, Ctrl+C/X arayüzde)
  window.addEventListener(
    "keydown",
    (e) => {
      const key = (e.key || "").toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      const isBlockedShortcut =
        e.key === "F12" ||
        (ctrlOrMeta && e.shiftKey && ["i", "j", "c", "k", "s", "u"].includes(key)) ||
        (ctrlOrMeta && ["u", "s", "p"].includes(key));

      if (isBlockedShortcut) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Okuma alanı ve inputlar dışında Ctrl+C / Ctrl+A / Ctrl+X engelle
      if (ctrlOrMeta && ["c", "x", "a"].includes(key)) {
        const activeEl = document.activeElement;
        const readerEl = document.getElementById("studyReaderContent");
        const isAllowedTarget =
          (activeEl && ["INPUT", "TEXTAREA"].includes(activeEl.tagName)) ||
          (readerEl && readerEl.contains(e.target));

        if (!isAllowedTarget) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    },
    true
  );

  // 2. Sağ tıklamayı okuma alanı dışında tamamen kapat
  window.addEventListener(
    "contextmenu",
    (e) => {
      const readerEl = document.getElementById("studyReaderContent");
      if (readerEl && readerEl.contains(e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      return false;
    },
    true
  );

  // 3. Kopyalama ve kesme olaylarını arayüz genelinde engelle
  ["copy", "cut", "dragstart", "drop"].forEach((evtName) => {
    window.addEventListener(
      evtName,
      (e) => {
        const readerEl = document.getElementById("studyReaderContent");
        const isInput = e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName);
        if (isInput || (readerEl && readerEl.contains(e.target) && evtName === "copy")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      },
      true
    );
  });

  // 4. Geliştirici Araçları (DevTools) Algılayıcı ve Güvenlik Kilit Ekranı
  function checkDevToolsStatus() {
    const lockOverlay = document.getElementById("securityLockOverlay");
    if (!lockOverlay) return;

    const widthThreshold = window.outerWidth - window.innerWidth > 170;
    const heightThreshold = window.outerHeight - window.innerHeight > 170;
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobileDevice && (widthThreshold || heightThreshold)) {
      lockOverlay.classList.remove("hidden");
    } else {
      lockOverlay.classList.add("hidden");
    }
  }

  window.addEventListener("resize", checkDevToolsStatus);
  setInterval(checkDevToolsStatus, 1200);
})();

/********************************************************************
 * TELEFON VE TABLETLERE UYGULAMA OLARAK YÜKLEME (PWA MOTORU)
 ********************************************************************/
let deferredPwaPrompt = null;

function initPwaSupport() {
  // Dinamik Web App Manifest oluştur (Telefon ve tabletlerde ana ekrana tam ekran uygulama olarak eklenir)
  try {
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1);
    const manifestObj = {
      name: "Mekteb-i Dergah",
      short_name: "Mekteb-i Dergah",
      description: "Mekteb-i Dergah Ders, Kitap, Özet ve Sınav Uygulaması",
      start_url: baseUrl + "index.html",
      scope: baseUrl,
      display: "standalone",
      orientation: "any",
      background_color: "#ffffff",
      theme_color: "#8c5a3c",
      icons: [
        {
          src: baseUrl + "logo.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: baseUrl + "logo.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ]
    };

    const blob = new Blob([JSON.stringify(manifestObj)], { type: "application/manifest+json" });
    const manifestUrl = URL.createObjectURL(blob);
    const linkEl = document.getElementById("dynamicManifestLink");
    if (linkEl) linkEl.setAttribute("href", manifestUrl);
  } catch (e) {}

  // Android / Chrome / Edge doğrudan kurulum istemini yakala
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    const directSec = document.getElementById("pwaDirectInstallSection");
    if (directSec) directSec.classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferredPwaPrompt = null;
    closePwaInstallModal();
    showToast("Mekteb-i Dergah cihazınıza uygulama olarak yüklendi!");
  });
}

function openPwaInstallModal() {
  const menu = document.getElementById("userDropdownMenu");
  if (menu) menu.classList.add("hidden");

  const directSec = document.getElementById("pwaDirectInstallSection");
  if (directSec) {
    directSec.classList.toggle("hidden", !deferredPwaPrompt);
  }

  const modal = document.getElementById("pwaInstallModal");
  if (modal) modal.classList.remove("hidden");
}

function closePwaInstallModal() {
  const modal = document.getElementById("pwaInstallModal");
  if (modal) modal.classList.add("hidden");
}

async function triggerNativePwaInstall() {
  if (!deferredPwaPrompt) {
    showToast("Lütfen aşağıdaki adımları izleyerek tarayıcı menüsünden 'Ana Ekrana Ekle' seçeneğini kullanın.");
    return;
  }
  deferredPwaPrompt.prompt();
  const { outcome } = await deferredPwaPrompt.userChoice;
  if (outcome === "accepted") {
    deferredPwaPrompt = null;
    closePwaInstallModal();
  }
}

// 1. GOOGLE FIREBASE YAPILANDIRMASI
const firebaseConfig = {
  apiKey: "AIzaSyB6G-7YSOqzKXuVuZ238PullnnzfGQBBTo",
  authDomain: "mektebidergah.firebaseapp.com",
  projectId: "mektebidergah",
  storageBucket: "mektebidergah.firebasestorage.app",
  messagingSenderId: "451458323516",
  appId: "1:451458323516:web:9d812939a69f71cc805f39",
  measurementId: "G-NZV7TRR5JL"
};

let fbApp = null;
let fbAnalytics = null;
let fbAuth = null;
let fbDb = null;

// PDF.js Worker Ayarı
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

let projectDirectoryHandle = null;
let editingMetaTarget = { courseId: null, sourceId: null };
let editingTocTarget = { courseId: null, sourceId: null };
let editingQuestionTarget = { courseId: null, questionId: null };

// UYGULAMA GENEL DURUMU (STATE)
let appState = {
  currentUser: null,
  categories: [],
  courses: [],
  activeCourseId: null,
  activeSourceId: null,
  adminSelectedCourseId: null,
  lastSelectedAdminPdfSourceId: null,
  expandedSidebarCourses: {},
  expandedSidebarSources: {},
  expandedSidebarSourceInfo: {},
  activePageIndex: 0,
  blueLightEnabled: false,
  lastGeneratedSummary: "",
  activeQuiz: null,
  activeInstructionalQuiz: null,
  activeTeacherQuiz: null,
  userData: {
    pageEdits: {},
    notes: [],
    examHistory: []
  }
};

function initFirebaseConnection() {
  try {
    if (typeof firebase !== "undefined" && firebaseConfig.apiKey) {
      fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
      if (typeof firebase.analytics === "function") {
        try {
          fbAnalytics = firebase.analytics(fbApp);
        } catch (e) {}
      }
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
    }
  } catch (err) {
    console.error("Firebase bağlantı hatası:", err);
  }
}

function cleanFirestoreData(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/********************************************************************
 * SANAL "dersler/" VE "sorular.json" ÖNBELLEĞİ
 ********************************************************************/
function openDerslerCacheDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("MektebiDergah_DerslerFolderCache", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheDerslerFile(pathKey, dataVal) {
  try {
    const db = await openDerslerCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(dataVal, pathKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

async function getCachedDerslerFile(pathKey) {
  try {
    const db = await openDerslerCacheDB();
    return new Promise((resolve) => {
      const tx = db.transaction("files", "readonly");
      const req = tx.objectStore("files").get(pathKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function removeCachedDerslerFolder(prefix) {
  try {
    const db = await openDerslerCacheDB();
    const tx = db.transaction("files", "readwrite");
    const store = tx.objectStore("files");
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      (keysReq.result || []).forEach((k) => {
        if (String(k).startsWith(prefix)) {
          store.delete(k);
        }
      });
    };
  } catch (e) {}
}

/********************************************************************
 * BAŞLANGIÇ: KESİN 1 SANİYELİK SPLASH EKRANI
 ********************************************************************/
window.addEventListener("DOMContentLoaded", () => {
  initPwaSupport();
  initFirebaseConnection();
  if (typeof initSpeechSynthesisEngine === "function") {
    initSpeechSynthesisEngine();
  }

  const savedTheme = localStorage.getItem("md_theme") || "light";
  setTheme(savedTheme);

  const savedBlueLight = localStorage.getItem("md_blue_light") === "true";
  setBlueLightFilter(savedBlueLight);

  loadSavedReaderScreenColor();
  populateSavedLoginCredentials();
  bootstrapFirebaseSession();

  setTimeout(() => {
    const splash = document.getElementById("splashScreen");
    if (splash) {
      splash.style.opacity = "0";
      setTimeout(() => splash.classList.add("hidden"), 200);
    }

    const appContainer = document.getElementById("appContainer");
    const authScreen = document.getElementById("authScreen");
    if (appContainer && appContainer.classList.contains("hidden")) {
      authScreen.classList.remove("hidden");
    }
  }, 1000);

  if (typeof setupStudyReaderContextMenuAndInteractions === "function") {
    setupStudyReaderContextMenuAndInteractions();
  }
  setupDropdownCloseListener();
});

/********************************************************************
 * YEREL KLASÖR ("dersler/" VE "sorular.json") BAĞLANTISI VE KAYIT MOTORU
 ********************************************************************/
async function connectLocalDerslerDirectory() {
  if (!("showDirectoryPicker" in window)) {
    showToast("Tarayıcınız doğrudan klasör seçmeyi desteklemiyor.");
    return false;
  }
  try {
    projectDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    await projectDirectoryHandle.getDirectoryHandle("dersler", { create: true });

    await saveQuestionsToSorularJson();

    const statusEl = document.getElementById("fsConnectionStatus");
    if (statusEl) {
      statusEl.innerHTML = `<strong style="color:var(--success);"><i class="fa-solid fa-circle-check"></i> Klasör Bağlandı:</strong> Kaynaklar <code>dersler/</code> klasörüne, sorular ise <code>sorular.json</code> dosyasına doğrudan kaydediliyor.`;
    }
    showToast("Uygulama klasörü (dersler/ ve sorular.json) başarıyla bağlandı!");
    return true;
  } catch (err) {
    console.warn("Klasör seçimi iptal edildi:", err);
    return false;
  }
}

function buildSorularJsonPayload() {
  const allQuestions = [];
  (appState.courses || []).forEach((course) => {
    (course.questions || []).forEach((q) => {
      allQuestions.push({
        id: q.id,
        courseId: course.id,
        courseName: course.name,
        sourceId: q.sourceId || "",
        sourceName: q.sourceName || "",
        topicTitle: q.topicTitle || "",
        pageNo: Number(q.pageNo) || 1,
        question: q.question,
        options: q.options || [],
        correctIndex: Number(q.correctIndex) || 0,
        questionType: q.questionType || "mcq",
        correctText: q.correctText || "",
        groupName: q.groupName || "Genel Sorular"
      });
    });
  });
  return {
    updatedAt: new Date().toISOString(),
    questions: allQuestions
  };
}

async function saveQuestionsToSorularJson() {
  const payload = buildSorularJsonPayload();
  const jsonString = JSON.stringify(payload, null, 2);

  await cacheDerslerFile("sorular.json", payload);
  try {
    localStorage.setItem("md_sorular_json_backup", jsonString);
  } catch (e) {}

  if (projectDirectoryHandle) {
    try {
      const fHandle = await projectDirectoryHandle.getFileHandle("sorular.json", { create: true });
      const writable = await fHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      return true;
    } catch (err) {
      console.warn("sorular.json diske yazma uyarısı:", err);
    }
  }
  return false;
}

function exportSorularJsonFile() {
  const payload = buildSorularJsonPayload();
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sorular.json";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("sorular.json dosyası indirildi. index.html ile aynı klasöre koyabilirsiniz.");
}

async function loadQuestionsFromSorularJson() {
  let loadedData = null;

  if (projectDirectoryHandle) {
    try {
      const fHandle = await projectDirectoryHandle.getFileHandle("sorular.json", { create: false });
      const file = await fHandle.getFile();
      loadedData = JSON.parse(await file.text());
    } catch (e) {}
  }

  if (!loadedData) {
    try {
      const res = await fetch("./sorular.json", { cache: "no-store" });
      if (res.ok) {
        loadedData = await res.json();
      }
    } catch (e) {}
  }

  if (!loadedData) {
    loadedData = await getCachedDerslerFile("sorular.json");
  }

  if (!loadedData) {
    try {
      const raw = localStorage.getItem("md_sorular_json_backup");
      if (raw) loadedData = JSON.parse(raw);
    } catch (e) {}
  }

  const qList = Array.isArray(loadedData)
    ? loadedData
    : Array.isArray(loadedData?.questions)
    ? loadedData.questions
    : [];

  if (!qList.length) return;

  qList.forEach((q) => {
    const course =
      appState.courses.find((c) => c.id === q.courseId) ||
      appState.courses.find((c) => c.name === q.courseName);
    if (course) {
      course.questions = course.questions || [];
      const existingIdx = course.questions.findIndex((existing) => existing.id === q.id);
      const qObj = {
        id: q.id || "q_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        courseId: course.id,
        courseName: course.name,
        sourceId: q.sourceId || "",
        sourceName: q.sourceName || "",
        topicTitle: q.topicTitle || "",
        pageNo: Number(q.pageNo) || 1,
        question: q.question,
        options: q.options || [],
        correctIndex: Number(q.correctIndex) || 0,
        questionType: q.questionType || "mcq",
        correctText: q.correctText || "",
        groupName: q.groupName || "Genel Sorular"
      };
      if (existingIdx === -1) {
        course.questions.push(qObj);
      } else {
        course.questions[existingIdx] = qObj;
      }
    }
  });
}

/********************************************************************
 * KAYNAK SAYFALARINI "dersler/" KLASÖRÜNE YAZMA VE OKUMA
 ********************************************************************/
async function saveSourceFilesToDerslerFolder(courseId, sourceObj, progressCallback = null) {
  const folderPath = `dersler/${courseId}/${sourceObj.id}`;
  sourceObj.folderPath = folderPath;
  const pages = sourceObj.pages || [];

  const manifestData = {
    id: sourceObj.id,
    courseId,
    name: sourceObj.name,
    metadata: sourceObj.metadata || {},
    customCss: sourceObj.customCss || "",
    footnotes: sourceObj.footnotes || {},
    toc: sourceObj.toc || [],
    pagesIndex: pages.map((p) => ({
      pageNo: p.pageNo,
      title: p.title,
      fileName: `sayfa_${p.pageNo}.html`
    }))
  };

  await cacheDerslerFile(`${folderPath}/manifest.json`, manifestData);
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const fileName = `sayfa_${p.pageNo}.html`;
    p.filePath = `${folderPath}/${fileName}`;
    await cacheDerslerFile(p.filePath, p.htmlContent || "");
    if (progressCallback) progressCallback(i + 1, pages.length);
  }

  if (projectDirectoryHandle) {
    try {
      const derslerDir = await projectDirectoryHandle.getDirectoryHandle("dersler", { create: true });
      const courseDir = await derslerDir.getDirectoryHandle(courseId, { create: true });
      const sourceDir = await courseDir.getDirectoryHandle(sourceObj.id, { create: true });

      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const fileName = `sayfa_${p.pageNo}.html`;
        const fHandle = await sourceDir.getFileHandle(fileName, { create: true });
        const writable = await fHandle.createWritable();
        await writable.write(p.htmlContent || "");
        await writable.close();
      }

      const mHandle = await sourceDir.getFileHandle("manifest.json", { create: true });
      const mWritable = await mHandle.createWritable();
      await mWritable.write(JSON.stringify(manifestData, null, 2));
      await mWritable.close();
      return true;
    } catch (err) {
      console.warn("Disk dersler/ klasörüne yazma uyarısı:", err);
    }
  }
  return true;
}

async function ensureSourcePagesLoadedFromDerslerFolder(courseId, sourceObj) {
  if (!sourceObj) return;
  if (sourceObj.pagesLoaded && Array.isArray(sourceObj.pages) && sourceObj.pages.length > 0) {
    return;
  }

  const folderPath = sourceObj.folderPath || `dersler/${courseId}/${sourceObj.id}`;

  const cachedManifest = await getCachedDerslerFile(`${folderPath}/manifest.json`);
  if (cachedManifest && Array.isArray(cachedManifest.pagesIndex)) {
    sourceObj.customCss = cachedManifest.customCss || sourceObj.customCss || "";
    sourceObj.footnotes = cachedManifest.footnotes || sourceObj.footnotes || {};
    if (cachedManifest.metadata) sourceObj.metadata = cachedManifest.metadata;

    const loadedPages = [];
    for (const pInfo of cachedManifest.pagesIndex) {
      const fileKey = `${folderPath}/${pInfo.fileName}`;
      const htmlContent = await getCachedDerslerFile(fileKey);
      if (htmlContent !== null) {
        loadedPages.push({
          pageNo: Number(pInfo.pageNo),
          title: pInfo.title || `Konu ${pInfo.pageNo}`,
          filePath: fileKey,
          htmlContent
        });
      }
    }
    if (loadedPages.length > 0) {
      sourceObj.pages = loadedPages;
      sourceObj.pageCount = loadedPages.length;
      sourceObj.pagesLoaded = true;
      return;
    }
  }

  if (projectDirectoryHandle) {
    try {
      const derslerDir = await projectDirectoryHandle.getDirectoryHandle("dersler", { create: false });
      const courseDir = await derslerDir.getDirectoryHandle(courseId, { create: false });
      const sourceDir = await courseDir.getDirectoryHandle(sourceObj.id, { create: false });

      try {
        const mHandle = await sourceDir.getFileHandle("manifest.json", { create: false });
        const mFile = await mHandle.getFile();
        const manifest = JSON.parse(await mFile.text());
        sourceObj.customCss = manifest.customCss || sourceObj.customCss || "";
        sourceObj.footnotes = manifest.footnotes || sourceObj.footnotes || {};
        if (manifest.metadata) sourceObj.metadata = manifest.metadata;
      } catch (e) {}

      const total = sourceObj.pageCount || (sourceObj.toc || []).length || 1;
      const loadedPages = [];

      for (let pNo = 1; pNo <= total; pNo++) {
        try {
          const fHandle = await sourceDir.getFileHandle(`sayfa_${pNo}.html`, { create: false });
          const file = await fHandle.getFile();
          const htmlContent = await file.text();
          const matchedToc = (sourceObj.toc || []).find((t) => Number(t.pageNo) === pNo);
          loadedPages.push({
            pageNo: pNo,
            title: matchedToc ? matchedToc.title : `Konu ${pNo}`,
            filePath: `${folderPath}/sayfa_${pNo}.html`,
            htmlContent
          });
        } catch (e) {}
      }

      if (loadedPages.length > 0) {
        sourceObj.pages = loadedPages;
        sourceObj.pageCount = loadedPages.length;
        sourceObj.pagesLoaded = true;
        return;
      }
    } catch (e) {}
  }

  try {
    const manifestRes = await fetch(`./${folderPath}/manifest.json`, { cache: "no-store" });
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      sourceObj.customCss = manifest.customCss || "";
      sourceObj.footnotes = manifest.footnotes || {};
      if (manifest.metadata) sourceObj.metadata = manifest.metadata;

      const pagesList = manifest.pagesIndex || [];
      const loadedPages = [];
      for (const pInfo of pagesList) {
        const pRes = await fetch(`./${folderPath}/${pInfo.fileName}`, { cache: "no-store" });
        if (pRes.ok) {
          const htmlContent = await pRes.text();
          loadedPages.push({
            pageNo: Number(pInfo.pageNo),
            title: pInfo.title || `Konu ${pInfo.pageNo}`,
            filePath: `${folderPath}/${pInfo.fileName}`,
            htmlContent
          });
        }
      }
      if (loadedPages.length > 0) {
        sourceObj.pages = loadedPages;
        sourceObj.pageCount = loadedPages.length;
        sourceObj.pagesLoaded = true;
      }
    }
  } catch (e) {}
}

async function deleteSourceFolderFromDersler(courseId, sourceId) {
  await removeCachedDerslerFolder(`dersler/${courseId}/${sourceId}`);
  if (!projectDirectoryHandle) return;
  try {
    const derslerDir = await projectDirectoryHandle.getDirectoryHandle("dersler", { create: false });
    const courseDir = await derslerDir.getDirectoryHandle(courseId, { create: false });
    await courseDir.removeEntry(sourceId, { recursive: true });
  } catch (e) {}
}

/********************************************************************
 * E-POSTA VE ŞİFREYİ KAYDETME / OTOMATİK DOLDURMA
 ********************************************************************/
function saveLoginCredentialsToStorage(email, password, remember) {
  if (remember) {
    const payload = {
      email,
      passwordBase64: btoa(unescape(encodeURIComponent(password)))
    };
    localStorage.setItem("md_saved_credentials", JSON.stringify(payload));
  } else {
    localStorage.removeItem("md_saved_credentials");
  }
}

function populateSavedLoginCredentials() {
  try {
    const raw = localStorage.getItem("md_saved_credentials");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.email) {
      document.getElementById("loginEmail").value = parsed.email;
    }
    if (parsed.passwordBase64) {
      document.getElementById("loginPassword").value = decodeURIComponent(
        escape(atob(parsed.passwordBase64))
      );
    }
    document.getElementById("rememberMeCheckbox").checked = true;
  } catch (e) {}
}

/********************************************************************
 * ÜYELİK VE FIREBASE OTURUM YÖNETİMİ
 ********************************************************************/
function bootstrapFirebaseSession() {
  if (!fbAuth) return;

  fbAuth.onAuthStateChanged(async (firebaseUser) => {
    try {
      if (firebaseUser) {
        let userObj = await loadUserProfileFromFirebase(firebaseUser.uid);

        if (!userObj) {
          userObj = {
            uid: firebaseUser.uid,
            firstName: (firebaseUser.email || "Öğrenci").split("@")[0],
            lastName: "",
            email: firebaseUser.email || "",
            isAdmin: false,
            enrolledCourses: [],
            enrolledSources: [],
            createdAt: new Date().toISOString()
          };
          await saveUserProfileToFirebase(userObj);
        }

        await loadCategoriesAndCoursesFromFirebase();
        await loadQuestionsFromSorularJson();
        await loginUserSuccess(userObj, false);
      } else {
        document.getElementById("appContainer").classList.add("hidden");
        document.getElementById("authScreen").classList.remove("hidden");
        populateSavedLoginCredentials();
      }
    } catch (err) {
      console.error("Oturum başlatma hatası:", err);
      document.getElementById("authScreen").classList.remove("hidden");
    }
  });
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  const isRegister = tab === "register";
  const isForgot = tab === "forgot";

  document.getElementById("authTabsBar").classList.toggle("hidden", isForgot);
  document.getElementById("tabLoginBtn").classList.toggle("active", isLogin);
  document.getElementById("tabRegisterBtn").classList.toggle("active", isRegister);

  document.getElementById("loginForm").classList.toggle("hidden", !isLogin);
  document.getElementById("registerForm").classList.toggle("hidden", !isRegister);
  document.getElementById("forgotPasswordForm").classList.toggle("hidden", !isForgot);

  if (isForgot) {
    const currentEmail = document.getElementById("loginEmail").value.trim();
    if (currentEmail) document.getElementById("forgotEmailInput").value = currentEmail;
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById("forgotEmailInput").value.trim().toLowerCase();
  if (!email) return;

  try {
    await fbAuth.sendPasswordResetEmail(email);
    showToast(`Şifre sıfırlama bağlantısı "${email}" adresine gönderildi!`);
    switchAuthTab("login");
  } catch (err) {
    showToast("Şifre sıfırlama e-postası gönderilemedi: " + (err.message || err));
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const firstName = document.getElementById("regFirstName").value.trim();
  const lastName = document.getElementById("regLastName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const pass1 = document.getElementById("regPassword1").value;
  const pass2 = document.getElementById("regPassword2").value;

  if (pass1 !== pass2) {
    showToast("Girdiğiniz iki şifre birbiriyle eşleşmiyor! Lütfen kontrol edin.");
    return;
  }

  try {
    const cred = await fbAuth.createUserWithEmailAndPassword(email, pass1);
    const uid = cred.user.uid;

    await loadCategoriesAndCoursesFromFirebase();
    const allSourceIds = [];
    appState.courses.forEach((c) => (c.sources || []).forEach((s) => allSourceIds.push(s.id)));

    const newUser = {
      uid,
      firstName,
      lastName,
      email,
      isAdmin: false,
      enrolledCourses: appState.courses.map((c) => c.id),
      enrolledSources: allSourceIds,
      createdAt: new Date().toISOString()
    };

    await saveUserProfileToFirebase(newUser);
    saveLoginCredentialsToStorage(email, pass1, true);
    showToast("Üyeliğiniz oluşturuldu ve giriş yapıldı.");
  } catch (err) {
    showToast("Kayıt hatası: " + (err.message || err));
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const pass = document.getElementById("loginPassword").value;
  const rememberMe = document.getElementById("rememberMeCheckbox").checked;

  try {
    const persistence = rememberMe
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    await fbAuth.setPersistence(persistence);
    await fbAuth.signInWithEmailAndPassword(email, pass);
    saveLoginCredentialsToStorage(email, pass, rememberMe);
  } catch (err) {
    showToast("Giriş yapılamadı: " + (err.message || err));
  }
}

async function loginUserSuccess(userObj, showWelcome) {
  const hasAdminRight = userObj.isAdmin === true;
  userObj.isAdmin = hasAdminRight;

  appState.currentUser = userObj;

  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appContainer").classList.remove("hidden");
  document.getElementById("headerUserName").textContent = `${userObj.firstName} ${userObj.lastName}`.trim();

  document.getElementById("navAdminBtn").classList.toggle("hidden", !hasAdminRight);

  await loadUserPersonalDataFromFirebase(userObj.uid);

  populateProfileForm();
  renderCategorySelectDropdowns();
  renderEnrolledSidebarCourses();
  renderAdminCoursesList();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  if (typeof renderExamHistoryList === "function") {
    renderExamHistoryList();
  }

  if (showWelcome) {
    showToast(`Hoş geldiniz, ${userObj.firstName} ${userObj.lastName}`);
  }
}

async function handleLogout() {
  if (typeof stopTtsAudio === "function") stopTtsAudio();
  if (fbAuth) {
    await fbAuth.signOut();
  }
  appState.currentUser = null;
  appState.activeCourseId = null;
  appState.activeSourceId = null;

  document.getElementById("userDropdownMenu").classList.add("hidden");
  document.getElementById("appContainer").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");

  populateSavedLoginCredentials();
}

/********************************************************************
 * FIRESTORE KULLANICI PROFİLİ VE KİŞİSEL VERİ KAYITLARI
 ********************************************************************/
async function saveUserProfileToFirebase(userObj) {
  if (!fbDb || !userObj?.uid) return;
  delete userObj.role;
  const cleaned = cleanFirestoreData(userObj);
  await fbDb.collection("users").doc(userObj.uid).set(cleaned, { merge: true });
}

async function loadUserProfileFromFirebase(uid) {
  if (!fbDb || !uid) return null;
  try {
    const doc = await fbDb.collection("users").doc(uid).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

async function saveUserPersonalDataToFirebase() {
  if (!fbDb || !appState.currentUser) return;
  const uid = appState.currentUser.uid;
  try {
    await fbDb.collection("userPersonalData").doc(uid).set(
      cleanFirestoreData({
        notes: appState.userData.notes || [],
        examHistory: appState.userData.examHistory || []
      }),
      { merge: true }
    );
  } catch (e) {
    console.warn("Kullanıcı verisi kayıt hatası:", e);
  }
}

async function saveSinglePageEditToFirebase(editKey, htmlContent) {
  if (!fbDb || !appState.currentUser) return;
  const uid = appState.currentUser.uid;
  try {
    if (htmlContent === null || htmlContent === undefined) {
      await fbDb
        .collection("userPersonalData")
        .doc(uid)
        .collection("pageEdits")
        .doc(editKey)
        .delete();
    } else {
      await fbDb
        .collection("userPersonalData")
        .doc(uid)
        .collection("pageEdits")
        .doc(editKey)
        .set({
          htmlContent,
          updatedAt: new Date().toISOString()
        });
    }
  } catch (e) {
    try {
      await fbDb.collection("userPersonalData").doc(uid).set(
        { pageEdits: appState.userData.pageEdits || {} },
        { merge: true }
      );
    } catch (err2) {}
  }
}

async function loadUserPersonalDataFromFirebase(uid) {
  if (!fbDb || !uid) return;
  try {
    const doc = await fbDb.collection("userPersonalData").doc(uid).get();
    const baseData = doc.exists ? doc.data() : {};
    const pageEdits = baseData.pageEdits || {};

    try {
      const editsSnap = await fbDb
        .collection("userPersonalData")
        .doc(uid)
        .collection("pageEdits")
        .get();
      editsSnap.forEach((d) => {
        pageEdits[d.id] = d.data().htmlContent;
      });
    } catch (subErr) {}

    appState.userData = {
      pageEdits,
      notes: baseData.notes || [],
      examHistory: baseData.examHistory || []
    };
  } catch (e) {
    appState.userData = { pageEdits: {}, notes: [], examHistory: [] };
  }
}

/********************************************************************
 * FIRESTORE KATEGORİLER VE DERS ÜST VERİLERİ
 ********************************************************************/
const CATEGORIES_DOC_ID = "__categories_meta__";

async function saveCategoriesToFirebase() {
  localStorage.setItem("md_categories_backup", JSON.stringify(appState.categories || []));
  if (!fbDb) return;
  try {
    await fbDb
      .collection("courses")
      .doc(CATEGORIES_DOC_ID)
      .set(cleanFirestoreData({ isMetaDoc: true, list: appState.categories || [] }));
  } catch (e) {
    console.warn("Kategori Firebase kayıt uyarısı:", e);
  }
}

async function loadCategoriesAndCoursesFromFirebase() {
  try {
    const localCats = JSON.parse(localStorage.getItem("md_categories_backup") || "[]");
    if (Array.isArray(localCats)) appState.categories = localCats;
  } catch (e) {}

  if (!fbDb) return;

  try {
    const coursesSnap = await fbDb.collection("courses").get();
    const loadedCourses = [];
    let foundRemoteCategories = null;

    for (const cDoc of coursesSnap.docs) {
      if (cDoc.id === CATEGORIES_DOC_ID) {
        const metaData = cDoc.data();
        if (Array.isArray(metaData.list)) {
          foundRemoteCategories = metaData.list;
        }
        continue;
      }

      const cData = cDoc.data();
      if (cData.isMetaDoc) continue;

      const courseId = cData.id || cDoc.id;
      const existingCourse = appState.courses.find((x) => x.id === courseId);

      const sources = (cData.sources || []).map((s) => {
        const existingSrc = existingCourse?.sources?.find((es) => es.id === s.id);
        return {
          id: s.id,
          name: s.name || "Kaynak",
          folderPath: s.folderPath || `dersler/${courseId}/${s.id}`,
          metadata: s.metadata || {
            workTitle: "",
            author: "",
            publisher: "",
            pubYear: "",
            extra: ""
          },
          toc: s.toc || [],
          pageCount: Number(s.pageCount) || 0,
          customCss: existingSrc?.customCss || "",
          footnotes: existingSrc?.footnotes || {},
          pages: existingSrc?.pages || [],
          pagesLoaded: existingSrc?.pagesLoaded || false
        };
      });

      loadedCourses.push({
        id: courseId,
        name: cData.name || "İsimsiz Ders",
        categoryId: cData.categoryId || "",
        questions: cData.questions || [],
        sources
      });
    }

    if (foundRemoteCategories !== null) {
      appState.categories = foundRemoteCategories;
      localStorage.setItem("md_categories_backup", JSON.stringify(foundRemoteCategories));
    }

    appState.courses = loadedCourses;
    localStorage.setItem("md_courses_meta_backup", JSON.stringify(loadedCourses));
  } catch (e) {
    try {
      const backupCourses = JSON.parse(localStorage.getItem("md_courses_meta_backup") || "[]");
      if (Array.isArray(backupCourses) && backupCourses.length) {
        appState.courses = backupCourses;
      }
    } catch (err2) {}
  }
}

async function saveCourseMetaToFirebase(course) {
  if (!course) return;

  const lightSources = (course.sources || []).map((s) => ({
    id: s.id || "src_" + Date.now(),
    name: s.name || "Kaynak",
    folderPath: s.folderPath || `dersler/${course.id}/${s.id}`,
    metadata: {
      workTitle: s.metadata?.workTitle || "",
      author: s.metadata?.author || "",
      publisher: s.metadata?.publisher || "",
      pubYear: s.metadata?.pubYear || "",
      extra: s.metadata?.extra || ""
    },
    toc: (s.toc || []).map((t) => ({
      title: String(t.title || `Konu ${t.pageNo || 1}`),
      pageNo: Number(t.pageNo) || 1,
      level: Number(t.level) || 1,
      anchor: String(t.anchor || "")
    })),
    pageCount: Number(s.pageCount) || (s.pages || []).length || 0
  }));

  const payload = cleanFirestoreData({
    id: course.id,
    name: course.name || "Ders",
    categoryId: course.categoryId || "",
    sources: lightSources,
    questions: course.questions || [],
    updatedAt: new Date().toISOString()
  });

  try {
    localStorage.setItem("md_courses_meta_backup", JSON.stringify(appState.courses));
  } catch (e) {}

  if (!fbDb) return;
  try {
    await fbDb.collection("courses").doc(course.id).set(payload, { merge: true });
  } catch (err) {
    console.error("Firebase ders kayıt hatası:", err);
  }
}

/********************************************************************
 * KATEGORİ YÖNETİMİ
 ********************************************************************/
function getCategoryNameById(categoryId) {
  if (!categoryId) return "Kategorisiz";
  const found = (appState.categories || []).find((cat) => cat.id === categoryId);
  return found ? found.name : "Kategorisiz";
}

function openCategoryManagerModal() {
  document.getElementById("modalCategoryNameInput").value = "";
  renderCategoryManagerList();
  document.getElementById("categoryManagerModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("modalCategoryNameInput").focus(), 50);
}

function closeCategoryManagerModal() {
  document.getElementById("categoryManagerModal").classList.add("hidden");
}

function renderCategoryManagerList() {
  const listEl = document.getElementById("categoryManagerList");
  if (!listEl) return;

  if (!appState.categories || !appState.categories.length) {
    listEl.innerHTML = `<p class="hint-text">Henüz kategori eklenmemiş.</p>`;
    return;
  }

  listEl.innerHTML = appState.categories
    .map(
      (cat) => `
      <div class="course-check-row">
        <strong><i class="fa-solid fa-tag"></i> ${escapeHtml(cat.name)}</strong>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn-secondary btn-sm" onclick="renameCategoryItem('${cat.id}')">
            <i class="fa-solid fa-pen"></i> Adlandır
          </button>
          <button type="button" class="btn-danger-sm" onclick="deleteCategoryItem('${cat.id}')">
            <i class="fa-solid fa-trash"></i> Sil
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

async function handleConfirmAddCategory(e) {
  e.preventDefault();
  const input = document.getElementById("modalCategoryNameInput");
  const name = input.value.trim();
  if (!name) return;

  appState.categories = appState.categories || [];
  const newCat = { id: "cat_" + Date.now(), name };
  appState.categories.push(newCat);

  await saveCategoriesToFirebase();

  input.value = "";
  renderCategoryManagerList();
  renderCategorySelectDropdowns(newCat.id);
  renderAdminCoursesList();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  showToast(`"${name}" kategorisi kaydedildi.`);
}

async function renameCategoryItem(categoryId) {
  const cat = (appState.categories || []).find((c) => c.id === categoryId);
  if (!cat) return;

  const newName = prompt("Kategori için yeni isim girin:", cat.name);
  if (!newName || !newName.trim()) return;

  cat.name = newName.trim();
  await saveCategoriesToFirebase();

  renderCategoryManagerList();
  renderCategorySelectDropdowns();
  renderAdminCoursesList();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  showToast("Kategori ismi güncellendi.");
}

async function deleteCategoryItem(categoryId) {
  appState.categories = (appState.categories || []).filter((c) => c.id !== categoryId);

  for (const crs of appState.courses) {
    if (crs.categoryId === categoryId) {
      crs.categoryId = "";
      await saveCourseMetaToFirebase(crs);
    }
  }

  await saveCategoriesToFirebase();

  renderCategoryManagerList();
  renderCategorySelectDropdowns();
  renderAdminCoursesList();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  showToast("Kategori silindi.");
}

async function assignCourseCategory(courseId, newCategoryId) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) return;
  course.categoryId = newCategoryId;
  await saveCourseMetaToFirebase(course);
  renderEnrolledSidebarCourses();
  renderAdminCoursesList();
  renderProfileCoursesAndSourcesCheckboxes();
  showToast(`"${course.name}" dersinin kategorisi güncellendi.`);
}

function renderCategorySelectDropdowns(selectedId = null) {
  const adminCatSelect = document.getElementById("adminCourseCategorySelect");
  if (!adminCatSelect) return;

  const prev = selectedId !== null ? selectedId : adminCatSelect.value;
  adminCatSelect.innerHTML =
    `<option value="">Kategorisiz</option>` +
    (appState.categories || [])
      .map((cat) => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`)
      .join("");

  if (prev && (appState.categories || []).some((c) => c.id === prev)) {
    adminCatSelect.value = prev;
  } else {
    adminCatSelect.value = "";
  }
}

/********************************************************************
 * PROFİL BİLGİLERİ, GEÇMİŞ SINAV NOTLARINI SIFIRLAMA & DERS SEÇİMİ
 ********************************************************************/
function populateProfileForm() {
  const u = appState.currentUser;
  if (!u) return;
  document.getElementById("profFirstName").value = u.firstName || "";
  document.getElementById("profLastName").value = u.lastName || "";
  document.getElementById("profEmail").value = u.email || "";
  document.getElementById("profPass1").value = "";
  document.getElementById("profPass2").value = "";

  const historyCount = (appState.userData.examHistory || []).length;
  const infoEl = document.getElementById("profileExamHistoryInfo");
  if (infoEl) {
    infoEl.textContent = `Hesabınızda kayıtlı toplam ${historyCount} sınav sonucu bulunuyor.`;
  }

  renderProfileCoursesAndSourcesCheckboxes();
}

async function handleResetExamHistory() {
  const historyCount = (appState.userData.examHistory || []).length;
  if (historyCount === 0) {
    showToast("Sıfırlanacak geçmiş sınav notunuz bulunmuyor.");
    return;
  }

  appState.userData.examHistory = [];
  await saveUserPersonalDataToFirebase();
  if (typeof renderExamHistoryList === "function") {
    renderExamHistoryList();
  }
  populateProfileForm();
  showToast("Geçmiş sınav notlarınız tamamen sıfırlandı.");
}

function getProfileSortedCourses() {
  const enrolledIds = appState.currentUser?.enrolledCourses || [];
  const enrolledCourses = [];
  enrolledIds.forEach((id) => {
    const found = appState.courses.find((c) => c.id === id);
    if (found) enrolledCourses.push(found);
  });
  const remainingCourses = appState.courses.filter((c) => !enrolledIds.includes(c.id));
  return [...enrolledCourses, ...remainingCourses];
}

async function moveProfileCourseOrder(courseId, direction) {
  const u = appState.currentUser;
  if (!u) return;

  const allRows = Array.from(
    document.querySelectorAll(".profile-course-card .profile-course-main-row .profile-course-checkbox")
  );
  const currentOrderIds = allRows.map((cb) => cb.value);
  const idx = currentOrderIds.indexOf(courseId);
  if (idx === -1) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= currentOrderIds.length) return;

  const temp = currentOrderIds[idx];
  currentOrderIds[idx] = currentOrderIds[targetIdx];
  currentOrderIds[targetIdx] = temp;

  const checkedSet = new Set(
    allRows.filter((cb) => cb.checked).map((cb) => cb.value)
  );
  checkedSet.add(courseId);

  u.enrolledCourses = currentOrderIds.filter((id) => checkedSet.has(id));

  appState.courses.sort(
    (a, b) => currentOrderIds.indexOf(a.id) - currentOrderIds.indexOf(b.id)
  );

  renderProfileCoursesAndSourcesCheckboxes();
  renderEnrolledSidebarCourses();
  await saveUserProfileToFirebase(u);
}

function renderProfileCoursesAndSourcesCheckboxes() {
  const container = document.getElementById("profileCoursesSelectionList");
  if (!container) return;
  if (!appState.courses.length) {
    container.innerHTML = `<p class="hint-text">Sistemde henüz ders bulunmuyor.</p>`;
    return;
  }

  const enrolledCourses = appState.currentUser?.enrolledCourses || [];
  const enrolledSources = appState.currentUser?.enrolledSources || [];
  const sortedCourses = getProfileSortedCourses();

  container.innerHTML = sortedCourses
    .map((c, idx) => {
      const courseChecked = enrolledCourses.includes(c.id) ? "checked" : "";
      const sourcesList = c.sources || [];
      const catName = getCategoryNameById(c.categoryId);
      const isFirst = idx === 0;
      const isLast = idx === sortedCourses.length - 1;

      const sourcesHtml = sourcesList.length
        ? `<div class="profile-sources-sublist">
            <div class="hint-text" style="font-weight:700;color:var(--accent);">Kaynak Seç:</div>
            ${sourcesList
              .map((s) => {
                const srcChecked =
                  !enrolledSources.length || enrolledSources.includes(s.id) ? "checked" : "";
                const authorInfo = s.metadata?.author ? ` — ${s.metadata.author}` : "";
                return `
                  <label class="profile-source-check-item">
                    <span><i class="fa-solid fa-book"></i> ${escapeHtml(s.name)}${escapeHtml(authorInfo)}</span>
                    <input type="checkbox" class="profile-source-checkbox" data-course-id="${c.id}" value="${s.id}" ${srcChecked} />
                  </label>
                `;
              })
              .join("")}
          </div>`
        : `<div class="hint-text mt-12">Bu derse henüz kaynak eklenmemiş.</div>`;

      return `
        <div class="profile-course-card">
          <div class="profile-course-main-row">
            <label class="profile-course-check-label">
              <input type="checkbox" class="profile-course-checkbox" value="${c.id}" ${courseChecked} onchange="toggleCourseSourcesCheckboxes('${c.id}', this.checked)" />
              <span>${escapeHtml(c.name)} <span class="badge">${escapeHtml(catName)}</span></span>
            </label>
            <div class="course-order-controls">
              <button type="button" class="order-arrow-btn" ${isFirst ? "disabled" : ""} onclick="moveProfileCourseOrder('${c.id}', -1)" title="Dersi Yukarı Taşı">
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <button type="button" class="order-arrow-btn" ${isLast ? "disabled" : ""} onclick="moveProfileCourseOrder('${c.id}', 1)" title="Dersi Aşağı Taşı">
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>
          </div>
          ${sourcesHtml}
        </div>
      `;
    })
    .join("");
}

function toggleCourseSourcesCheckboxes(courseId, isChecked) {
  document
    .querySelectorAll(`.profile-source-checkbox[data-course-id="${courseId}"]`)
    .forEach((cb) => {
      cb.checked = isChecked;
    });
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const u = appState.currentUser;
  if (!u) return;

  const firstName = document.getElementById("profFirstName").value.trim();
  const lastName = document.getElementById("profLastName").value.trim();
  const email = document.getElementById("profEmail").value.trim().toLowerCase();
  const pass1 = document.getElementById("profPass1").value;
  const pass2 = document.getElementById("profPass2").value;

  if (pass1 || pass2) {
    if (pass1 !== pass2) {
      showToast("Yeni şifreler birbiriyle eşleşmiyor!");
      return;
    }
    if (fbAuth.currentUser) {
      await fbAuth.currentUser.updatePassword(pass1);
    }
  }

  u.firstName = firstName;
  u.lastName = lastName;
  u.email = email;

  await saveUserProfileToFirebase(u);
  document.getElementById("headerUserName").textContent = `${u.firstName} ${u.lastName}`.trim();
  showToast("Profil bilgileriniz güncellendi.");
}

async function saveStudentCourseSelection() {
  const u = appState.currentUser;
  if (!u) return;

  const selectedIds = Array.from(
    document.querySelectorAll(".profile-course-card .profile-course-main-row .profile-course-checkbox:checked")
  ).map((cb) => cb.value);

  u.enrolledCourses = selectedIds;

  const sourceCheckboxes = document.querySelectorAll(".profile-sources-sublist .profile-source-checkbox:checked");
  u.enrolledSources = Array.from(sourceCheckboxes).map((cb) => cb.value);

  await saveUserProfileToFirebase(u);
  renderEnrolledSidebarCourses();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  if (appState.activeCourseId && typeof selectCourseForStudy === "function") {
    await selectCourseForStudy(appState.activeCourseId);
  }
  showToast("Seçilen dersler, sıralama ve kaynaklar kaydedildi.");
}

/********************************************************************
 * ADMİN PANELİ: DERS YÖNETİMİ, KAYNAK SIRALAMA, İÇİNDEKİLER & KÜNYE,
 * EPUB, ORİJİNAL GÖRÜNÜMLÜ KONU PDF VE SORU (sorular.json) EKLEME
 ********************************************************************/
async function handleAdminCreateCourse(e) {
  e.preventDefault();
  const name = document.getElementById("adminCourseName").value.trim();
  const categoryId = document.getElementById("adminCourseCategorySelect").value || "";
  if (!name) return;

  const newCourse = {
    id: "crs_" + Date.now(),
    name,
    categoryId,
    sources: [],
    questions: []
  };

  appState.courses.push(newCourse);
  appState.adminSelectedCourseId = newCourse.id;

  await saveCourseMetaToFirebase(newCourse);

  if (appState.currentUser) {
    appState.currentUser.enrolledCourses = appState.currentUser.enrolledCourses || [];
    if (!appState.currentUser.enrolledCourses.includes(newCourse.id)) {
      appState.currentUser.enrolledCourses.push(newCourse.id);
      await saveUserProfileToFirebase(appState.currentUser);
    }
  }

  document.getElementById("adminCourseName").value = "";
  renderAdminCoursesList();
  renderCategorySelectDropdowns(categoryId);
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  showToast(`"${name}" dersi oluşturuldu.`);
}

function selectAdminTargetCourse(courseId) {
  appState.adminSelectedCourseId = courseId;
  renderAdminCoursesList();
}

function renderAdminCoursesList() {
  const listEl = document.getElementById("adminCoursesList");
  if (!listEl) return;

  if (!appState.courses.length) {
    appState.adminSelectedCourseId = null;
    listEl.innerHTML = `<p class="hint-text">Henüz ders eklenmedi.</p>`;
    document.getElementById("adminSelectedCourseBadge").textContent = "Ders Seçilmedi";
    document.getElementById("adminCourseSourcesList").innerHTML = "";
    return;
  }

  if (
    !appState.adminSelectedCourseId ||
    !appState.courses.some((c) => c.id === appState.adminSelectedCourseId)
  ) {
    appState.adminSelectedCourseId = appState.courses[0].id;
  }

  listEl.innerHTML = appState.courses
    .map((c) => {
      const isSelected = c.id === appState.adminSelectedCourseId;
      const catOptions =
        `<option value="">Kategorisiz</option>` +
        (appState.categories || [])
          .map(
            (cat) =>
              `<option value="${cat.id}" ${c.categoryId === cat.id ? "selected" : ""}>${escapeHtml(cat.name)}</option>`
          )
          .join("");

      return `
        <div class="course-check-row admin-selectable-course ${isSelected ? "selected-admin-course" : ""}" onclick="selectAdminTargetCourse('${c.id}')">
          <div>
            <strong>${escapeHtml(c.name)}</strong>
            <div class="hint-text">${(c.sources || []).length} Kaynak/Kitap • ${(c.questions || []).length} Soru</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;" onclick="event.stopPropagation()">
            <select class="form-input" style="padding:5px 8px;font-size:0.78rem;width:auto;" onchange="assignCourseCategory('${c.id}', this.value)" title="Ders Kategorisini Değiştir">
              ${catOptions}
            </select>
            <button type="button" class="btn-danger-sm" onclick="deleteAdminCourse('${c.id}')" title="Dersi Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  renderAdminSelectedCourseDetails();
}

async function deleteAdminCourse(courseId) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) return;

  for (const s of course.sources || []) {
    await deleteSourceFolderFromDersler(courseId, s.id);
  }

  if (fbDb) {
    try {
      await fbDb.collection("courses").doc(courseId).delete();
    } catch (e) {}
  }

  appState.courses = appState.courses.filter((c) => c.id !== courseId);
  localStorage.setItem("md_courses_meta_backup", JSON.stringify(appState.courses));
  await saveQuestionsToSorularJson();

  if (appState.activeCourseId === courseId) {
    appState.activeCourseId = null;
    appState.activeSourceId = null;
  }
  if (appState.adminSelectedCourseId === courseId) {
    appState.adminSelectedCourseId = appState.courses[0]?.id || null;
  }
  renderAdminCoursesList();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  showToast("Ders silindi.");
}

async function moveAdminSourceOrder(courseId, sourceId, direction) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course || !Array.isArray(course.sources)) return;

  const idx = course.sources.findIndex((s) => s.id === sourceId);
  if (idx === -1) return;

  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= course.sources.length) return;

  const temp = course.sources[idx];
  course.sources[idx] = course.sources[targetIdx];
  course.sources[targetIdx] = temp;

  await saveCourseMetaToFirebase(course);
  renderAdminSelectedCourseDetails();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
}

function renderAdminSelectedCourseDetails() {
  const courseId = appState.adminSelectedCourseId;
  const badgeEl = document.getElementById("adminSelectedCourseBadge");
  const sourcesListEl = document.getElementById("adminCourseSourcesList");
  const manualSourceSel = document.getElementById("adminManualTargetSourceSelect");
  const pdfSourceSel = document.getElementById("adminPdfTargetSourceSelect");
  const qSourceSel = document.getElementById("adminQSourceSelect");
  const summaryEl = document.getElementById("adminCourseContentSummary");

  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    badgeEl.textContent = "Ders Seçilmedi";
    sourcesListEl.innerHTML = "";
    summaryEl.textContent = "";
    return;
  }

  badgeEl.textContent = `Seçili Ders: ${course.name}`;
  const sources = course.sources || [];

  if (!sources.length) {
    sourcesListEl.innerHTML = `<p class="hint-text">Bu derse henüz kaynak eklenmemiş.</p>`;
  } else {
    sourcesListEl.innerHTML = sources
      .map((s, idx) => {
        const meta = s.metadata || {};
        const metaLine = [meta.workTitle, meta.author, meta.publisher, meta.pubYear]
          .filter(Boolean)
          .join(" • ");
        const isFirst = idx === 0;
        const isLast = idx === sources.length - 1;

        return `
        <div class="course-check-row">
          <div>
            <strong><i class="fa-solid fa-book"></i> ${escapeHtml(s.name)}</strong>
            ${metaLine ? `<div class="hint-text" style="color:var(--accent);">${escapeHtml(metaLine)}</div>` : ""}
            <div class="hint-text">
              ${(s.toc || []).length} İçindekiler Konu Başlığı
            </div>
          </div>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
            <div class="course-order-controls">
              <button type="button" class="order-arrow-btn" ${isFirst ? "disabled" : ""} onclick="moveAdminSourceOrder('${course.id}', '${s.id}', -1)" title="Kaynağı Yukarı Taşı">
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <button type="button" class="order-arrow-btn" ${isLast ? "disabled" : ""} onclick="moveAdminSourceOrder('${course.id}', '${s.id}', 1)" title="Kaynağı Aşağı Taşı">
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>
            <button type="button" class="btn-secondary btn-sm" onclick="openTocEditorModal('${course.id}', '${s.id}')" title="İçindekiler Sayfasını Düzenle">
              <i class="fa-solid fa-list-check"></i> İçindekiler
            </button>
            <button type="button" class="btn-secondary btn-sm" onclick="openSourceMetaEditorModal('${course.id}', '${s.id}')" title="Kitap Künye / Bilgilendirme Bilgilerini Gir">
              <i class="fa-solid fa-circle-info"></i> Künye
            </button>
            <button type="button" class="btn-danger-sm" onclick="deleteAdminBookSource('${course.id}', '${s.id}')" title="Kaynağı Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  const targetSourceOptions =
    (sources.length
      ? sources.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (Mevcut Kaynağa Konu Ekle)</option>`).join("")
      : "") +
    `<option value="__new__">+ Yeni Kaynak Olarak Oluştur</option>`;

  if (manualSourceSel) {
    const prevManual = manualSourceSel.value;
    manualSourceSel.innerHTML = targetSourceOptions;
    if (prevManual && sources.some((s) => s.id === prevManual)) {
      manualSourceSel.value = prevManual;
    }
  }

  if (pdfSourceSel) {
    const prevPdf = appState.lastSelectedAdminPdfSourceId || pdfSourceSel.value;
    pdfSourceSel.innerHTML = targetSourceOptions;
    if (prevPdf && sources.some((s) => s.id === prevPdf)) {
      pdfSourceSel.value = prevPdf;
    } else if (sources.length) {
      pdfSourceSel.value = sources[sources.length - 1].id;
    } else {
      pdfSourceSel.value = "__new__";
    }
  }

  if (qSourceSel) {
    qSourceSel.innerHTML = sources.length
      ? sources.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")
      : `<option value="">Önce Derse Kaynak Ekleyin</option>`;
  }

  populateAdminQuestionTopicSelect();
  if (typeof renderAdminTeacherSetsList === "function") {
    renderAdminTeacherSetsList();
  }

  const totalTopics = sources.reduce((acc, s) => acc + (s.toc || []).length, 0);
  summaryEl.innerHTML = `
    <strong>${escapeHtml(course.name)}:</strong> Toplam ${sources.length} kaynak, ${totalTopics} konu başlığı ve ${(course.questions || []).length} hoca sorusu (<code>sorular.json</code>) kayıtlı.
  `;
}

function populateAdminQuestionTopicSelect() {
  const course = appState.courses.find((c) => c.id === appState.adminSelectedCourseId);
  const sourceId = document.getElementById("adminQSourceSelect")?.value;
  const topicSel = document.getElementById("adminQTopicSelect");
  if (!topicSel) return;

  const source = course?.sources?.find((s) => s.id === sourceId) || course?.sources?.[0];
  if (!source) {
    topicSel.innerHTML = `<option value="Genel">Genel Konu</option>`;
    return;
  }

  const tocList =
    source.toc && source.toc.length
      ? source.toc
      : (source.pages || []).map((p) => ({
          title: p.title || `Konu ${p.pageNo}`,
          pageNo: p.pageNo,
          level: 1
        }));

  if (!tocList.length) {
    topicSel.innerHTML = `<option value="${escapeHtml(source.name)}">${escapeHtml(source.name)}</option>`;
    return;
  }

  topicSel.innerHTML = tocList
    .map((t) => {
      const indent = "— ".repeat(Math.max(0, (t.level || 1) - 1));
      return `<option value="${escapeHtml(t.title)}" data-page-no="${t.pageNo}">${indent}${escapeHtml(t.title)}</option>`;
    })
    .join("");
}

function openSourceMetaEditorModal(courseId, sourceId) {
  const course = appState.courses.find((c) => c.id === courseId);
  const src = course?.sources.find((s) => s.id === sourceId);
  if (!src) return;

  editingMetaTarget = { courseId, sourceId };
  const meta = src.metadata || {};

  document.getElementById("editSourceDisplayName").value = src.name || "";
  document.getElementById("editMetaWorkTitle").value = meta.workTitle || "";
  document.getElementById("editMetaAuthor").value = meta.author || "";
  document.getElementById("editMetaPublisher").value = meta.publisher || "";
  document.getElementById("editMetaPubYear").value = meta.pubYear || "";
  document.getElementById("editMetaExtra").value = meta.extra || "";

  document.getElementById("sourceMetaEditorModal").classList.remove("hidden");
}

function closeSourceMetaEditorModal() {
  document.getElementById("sourceMetaEditorModal").classList.add("hidden");
}

async function handleSaveSourceMetadata(e) {
  e.preventDefault();
  const { courseId, sourceId } = editingMetaTarget;
  const course = appState.courses.find((c) => c.id === courseId);
  const src = course?.sources.find((s) => s.id === sourceId);
  if (!course || !src) return;

  src.name = document.getElementById("editSourceDisplayName").value.trim() || src.name;
  src.metadata = {
    workTitle: document.getElementById("editMetaWorkTitle").value.trim(),
    author: document.getElementById("editMetaAuthor").value.trim(),
    publisher: document.getElementById("editMetaPublisher").value.trim(),
    pubYear: document.getElementById("editMetaPubYear").value.trim(),
    extra: document.getElementById("editMetaExtra").value.trim()
  };

  await saveCourseMetaToFirebase(course);
  if (src.pagesLoaded) {
    await saveSourceFilesToDerslerFolder(course.id, src);
  }

  closeSourceMetaEditorModal();
  renderAdminSelectedCourseDetails();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  showToast("Kaynak ve kitap künye bilgileri kaydedildi.");
}

async function deleteAdminBookSource(courseId, sourceId) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) return;
  const targetSrc = (course.sources || []).find((s) => s.id === sourceId);
  if (!targetSrc) return;

  await deleteSourceFolderFromDersler(courseId, sourceId);

  course.sources = (course.sources || []).filter((s) => s.id !== sourceId);
  course.questions = (course.questions || []).filter((q) => q.sourceId !== sourceId);
  await saveCourseMetaToFirebase(course);
  await saveQuestionsToSorularJson();

  renderAdminSelectedCourseDetails();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  showToast(`"${targetSrc.name}" kaynağı silindi.`);
}

/**
 * EPUB (.epub) DOSYA YÜKLEME İŞLEYİCİSİ (ADMİN PANELİNDE KALIR)
 */
async function handleAdminFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const courseId = appState.adminSelectedCourseId;
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    showToast("Lütfen önce sol taraftaki listeden bir ders seçin!");
    e.target.value = "";
    return;
  }

  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "epub") {
    showToast("Buradan sadece EPUB (.epub) yükleyebilirsiniz.");
    e.target.value = "";
    return;
  }

  const customSourceTitle = document.getElementById("adminSourceTitleInput").value.trim();
  const defaultSourceTitle = file.name.replace(/\.[^/.]+$/, "");
  const sourceName = customSourceTitle || defaultSourceTitle;

  const newSource = {
    id: "src_" + Date.now(),
    name: sourceName,
    folderPath: "",
    metadata: {
      workTitle: sourceName,
      author: "",
      publisher: "",
      pubYear: "",
      extra: ""
    },
    customCss: "",
    footnotes: {},
    pages: [],
    pageCount: 0,
    pagesLoaded: true,
    toc: []
  };
  newSource.folderPath = `dersler/${course.id}/${newSource.id}`;

  const progressEl = document.getElementById("adminUploadProgress");
  progressEl.classList.remove("hidden");
  progressEl.textContent = `"${sourceName}" EPUB paketi ayrıştırılıyor...`;

  try {
    await unpackFullEpubIntoSource(file, course, newSource);
    newSource.pageCount = newSource.pages.length;

    progressEl.textContent = `"${sourceName}" dersler/ klasörüne kaydediliyor...`;
    await saveSourceFilesToDerslerFolder(course.id, newSource, (done, total) => {
      progressEl.textContent = `Kaydediliyor: ${done} / ${total} Bölüm`;
    });

    course.sources = course.sources || [];
    course.sources.push(newSource);

    await saveCourseMetaToFirebase(course);

    if (appState.currentUser) {
      appState.currentUser.enrolledSources = appState.currentUser.enrolledSources || [];
      if (!appState.currentUser.enrolledSources.includes(newSource.id)) {
        appState.currentUser.enrolledSources.push(newSource.id);
      }
      await saveUserProfileToFirebase(appState.currentUser);
    }

    document.getElementById("adminSourceTitleInput").value = "";
    renderAdminCoursesList();
    renderEnrolledSidebarCourses();
    renderProfileCoursesAndSourcesCheckboxes();
    if (typeof populateExamCourseAndSourceSelectors === "function") {
      populateExamCourseAndSourceSelectors();
    }
    showToast(`"${sourceName}" kaynağı başarıyla eklendi!`);
  } catch (err) {
    console.error(err);
    showToast("EPUB işleme hatası: " + (err.message || err));
  } finally {
    progressEl.classList.add("hidden");
    e.target.value = "";
  }
}

/********************************************************************
 * ORİJİNAL GÖRÜNÜMLÜ + ŞEFFAF VURGU/NOT KATMANLI KONU PDF YÜKLEYİCİ
 ********************************************************************/
async function renderPdfPageToInteractiveHtml(page) {
  const renderScale = 1.65;
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;
  const imgDataUrl = canvas.toDataURL("image/jpeg", 0.86);

  const textContent = await page.getTextContent();
  const spansHtml = [];

  textContent.items.forEach((item) => {
    const rawStr = item.str || "";
    if (!rawStr.trim()) return;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const leftPct = (tx[4] / viewport.width) * 100;
    const topPct = ((tx[5] - fontHeight * 0.88) / viewport.height) * 100;
    const widthPct = Math.max(
      1,
      (((item.width || rawStr.length * (fontHeight * 0.5)) * renderScale) / viewport.width) * 100
    );
    const heightPct = Math.max(1.1, ((fontHeight * 1.15) / viewport.height) * 100);
    const fontSizePx = Math.max(10, Math.round((fontHeight / viewport.width) * 760));

    spansHtml.push(
      `<span class="pdf-text-item" style="left:${leftPct.toFixed(2)}%;top:${topPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%;height:${heightPct.toFixed(2)}%;font-size:${fontSizePx}px;">${escapeHtml(rawStr)} </span>`
    );
  });

  return `
    <div class="pdf-original-page">
      <img src="${imgDataUrl}" class="pdf-page-bg" alt="PDF Sayfası" draggable="false" />
      <div class="pdf-text-layer">${spansHtml.join("")}</div>
    </div>
  `;
}

async function handleAdminTopicPdfUpload(e) {
  e.preventDefault();
  const courseId = appState.adminSelectedCourseId;
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    showToast("Lütfen önce sol taraftaki listeden bir ders seçin!");
    return;
  }

  const fileInput = document.getElementById("adminTopicPdfInput");
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    showToast("Lütfen eklenecek konu PDF dosyasını seçin.");
    return;
  }

  const targetSourceVal = document.getElementById("adminPdfTargetSourceSelect")?.value || "__new__";
  const customTopicTitle = document.getElementById("adminPdfTopicTitle").value.trim();
  const firstPdfDefaultName = files[0].name.replace(/\.[^/.]+$/, "");
  const effectiveDisplayName = customTopicTitle || firstPdfDefaultName;

  let targetSource =
    targetSourceVal !== "__new__"
      ? (course.sources || []).find((s) => s.id === targetSourceVal)
      : null;

  if (!targetSource) {
    targetSource = {
      id: "src_" + Date.now(),
      name: effectiveDisplayName,
      folderPath: "",
      metadata: {
        workTitle: effectiveDisplayName,
        author: "",
        publisher: "",
        pubYear: "",
        extra: ""
      },
      customCss: "",
      footnotes: {},
      pages: [],
      pageCount: 0,
      pagesLoaded: true,
      toc: []
    };
    targetSource.folderPath = `dersler/${course.id}/${targetSource.id}`;
    course.sources = course.sources || [];
    course.sources.push(targetSource);

    if (appState.currentUser) {
      appState.currentUser.enrolledSources = appState.currentUser.enrolledSources || [];
      if (!appState.currentUser.enrolledSources.includes(targetSource.id)) {
        appState.currentUser.enrolledSources.push(targetSource.id);
      }
      await saveUserProfileToFirebase(appState.currentUser);
    }
  } else {
    if (!targetSource.pagesLoaded) {
      await ensureSourcePagesLoadedFromDerslerFolder(course.id, targetSource);
    }
  }

  appState.lastSelectedAdminPdfSourceId = targetSource.id;

  const tocLevel = Number(document.getElementById("adminPdfTocLevel").value) || 1;
  const progressEl = document.getElementById("adminPdfUploadProgress");
  progressEl.classList.remove("hidden");

  try {
    let nextPageNo =
      targetSource.pages.length > 0
        ? Math.max(...targetSource.pages.map((p) => Number(p.pageNo) || 0)) + 1
        : 1;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const pdfFile = files[fIdx];
      const defaultTopicName = pdfFile.name.replace(/\.[^/.]+$/, "");
      const topicTitle =
        files.length === 1 && customTopicTitle
          ? customTopicTitle
          : customTopicTitle
          ? `${customTopicTitle} — ${defaultTopicName}`
          : defaultTopicName;

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const renderedPagesHtml = [];
      for (let pNo = 1; pNo <= pdf.numPages; pNo++) {
        progressEl.textContent = `"${topicTitle}" orijinal PDF sayfası hazırlanıyor (${pNo}/${pdf.numPages})...`;
        const page = await pdf.getPage(pNo);
        const pageHtml = await renderPdfPageToInteractiveHtml(page);
        renderedPagesHtml.push(pageHtml);
      }

      targetSource.pages.push({
        pageNo: nextPageNo,
        title: topicTitle,
        filePath: `dersler/${course.id}/${targetSource.id}/sayfa_${nextPageNo}.html`,
        htmlContent: renderedPagesHtml.join("\n")
      });

      targetSource.toc.push({
        title: topicTitle,
        pageNo: nextPageNo,
        level: tocLevel,
        anchor: ""
      });

      nextPageNo++;
    }

    targetSource.pageCount = targetSource.pages.length;

    progressEl.textContent = `"${targetSource.name}" dersler/ klasörüne kaydediliyor...`;
    await saveSourceFilesToDerslerFolder(course.id, targetSource);
    await saveCourseMetaToFirebase(course);

    document.getElementById("adminPdfTopicTitle").value = "";
    fileInput.value = "";
    renderAdminCoursesList();
    renderEnrolledSidebarCourses();
    renderProfileCoursesAndSourcesCheckboxes();
    if (typeof populateExamCourseAndSourceSelectors === "function") {
      populateExamCourseAndSourceSelectors();
    }

    showToast(`Orijinal görünümlü Konu PDF'i "${targetSource.name}" kaynağına eklendi!`);
  } catch (err) {
    console.error("Konu PDF yükleme hatası:", err);
    showToast("PDF işleme hatası: " + (err.message || err));
  } finally {
    progressEl.classList.add("hidden");
  }
}

/********************************************************************
 * EPUB AYRIŞTIRICI + GÖMÜLÜ FONT/CSS KORUMA, YER İMİ VE DİPNOT MOTORU
 ********************************************************************/
async function unpackFullEpubIntoSource(file, course, sourceObj) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  let opfPath = "";
  const containerFile = zip.file("META-INF/container.xml");
  if (containerFile) {
    const containerXml = await containerFile.async("text");
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXml, "application/xml");
    const rootfile = doc.querySelector("rootfile");
    if (rootfile) opfPath = rootfile.getAttribute("full-path") || "";
  }

  if (!opfPath) {
    const opfCandidate = Object.keys(zip.files).find((k) => k.endsWith(".opf"));
    if (opfCandidate) opfPath = opfCandidate;
  }

  const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";
  const opfText = await zip.file(opfPath).async("text");
  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfText, "application/xml");

  const dcTitle = opfDoc.querySelector("metadata title, dc\\:title")?.textContent?.trim() || "";
  const dcCreator = opfDoc.querySelector("metadata creator, dc\\:creator")?.textContent?.trim() || "";
  const dcPublisher = opfDoc.querySelector("metadata publisher, dc\\:publisher")?.textContent?.trim() || "";
  const dcDate = opfDoc.querySelector("metadata date, dc\\:date")?.textContent?.trim() || "";

  sourceObj.metadata = sourceObj.metadata || {};
  if (!sourceObj.metadata.workTitle && dcTitle) sourceObj.metadata.workTitle = dcTitle;
  if (!sourceObj.metadata.author && dcCreator) sourceObj.metadata.author = dcCreator;
  if (!sourceObj.metadata.publisher && dcPublisher) sourceObj.metadata.publisher = dcPublisher;
  if (!sourceObj.metadata.pubYear && dcDate) sourceObj.metadata.pubYear = dcDate.substring(0, 4);

  const assetMap = {};
  const allZipKeys = Object.keys(zip.files);

  for (const key of allZipKeys) {
    if (/\.(png|jpe?g|gif|svg|webp|ttf|otf|woff2?)$/i.test(key)) {
      const base64 = await zip.file(key).async("base64");
      const ext = key.split(".").pop().toLowerCase();
      let mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
      if (ext === "svg") mime = "image/svg+xml";
      else if (ext === "ttf") mime = "font/ttf";
      else if (ext === "otf") mime = "font/otf";
      else if (ext === "woff") mime = "font/woff";
      else if (ext === "woff2") mime = "font/woff2";

      const dataUri = `data:${mime};base64,${base64}`;
      assetMap[key] = dataUri;
      assetMap[key.replace(opfDir, "")] = dataUri;
      assetMap[key.split("/").pop()] = dataUri;
    }
  }

  let combinedCss = "";
  for (const key of allZipKeys) {
    if (key.endsWith(".css")) {
      let cssText = await zip.file(key).async("text");
      cssText = cssText.replace(/url\(['"]?([^'")]+)['"]?\)/gi, (match, relUrl) => {
        const cleanRel = relUrl.split("#")[0].split("?")[0].replace(/^(\.\.\/)+/, "");
        const fileNameOnly = cleanRel.split("/").pop();
        const foundUri = assetMap[cleanRel] || assetMap[fileNameOnly];
        return foundUri ? `url("${foundUri}")` : match;
      });
      cssText = cssText.replace(/\bbody\b/g, ".epub-book-scope");
      combinedCss += "\n" + cssText;
    }
  }
  sourceObj.customCss = combinedCss;
  sourceObj.footnotes = sourceObj.footnotes || {};

  const manifestMap = {};
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    manifestMap[item.getAttribute("id")] = {
      href: item.getAttribute("href"),
      mediaType: item.getAttribute("media-type") || "",
      properties: item.getAttribute("properties") || ""
    };
  });

  const tocEntries = [];
  const ncxItem = Object.values(manifestMap).find(
    (m) => m.mediaType.includes("ncx") || (m.href && m.href.endsWith(".ncx"))
  );
  const navItem = Object.values(manifestMap).find((m) => m.properties.includes("nav"));

  if (ncxItem) {
    const ncxFullPath = resolveZipPath(opfDir, ncxItem.href);
    if (zip.file(ncxFullPath)) {
      const ncxText = await zip.file(ncxFullPath).async("text");
      const ncxDoc = parser.parseFromString(ncxText, "application/xml");
      const navMap = ncxDoc.querySelector("navMap");

      function traverseNavPoints(parentEl, level) {
        if (!parentEl) return;
        Array.from(parentEl.children).forEach((child) => {
          if (child.tagName && child.tagName.toLowerCase().endsWith("navpoint")) {
            const label = child.querySelector(":scope > navLabel > text")?.textContent?.trim();
            const src = child.querySelector(":scope > content")?.getAttribute("src");
            if (label && src) {
              const [filePart, hashPart] = src.split("#");
              tocEntries.push({ title: label, href: filePart, anchor: hashPart || "", level });
            }
            traverseNavPoints(child, level + 1);
          }
        });
      }
      traverseNavPoints(navMap, 1);
    }
  } else if (navItem) {
    const navFullPath = resolveZipPath(opfDir, navItem.href);
    if (zip.file(navFullPath)) {
      const navText = await zip.file(navFullPath).async("text");
      const navDoc = parser.parseFromString(navText, "text/html");
      const rootOl = navDoc.querySelector("nav ol");

      function traverseNavOl(olEl, level) {
        if (!olEl) return;
        Array.from(olEl.children).forEach((li) => {
          const a = li.querySelector(":scope > a");
          if (a) {
            const label = a.textContent.trim();
            const href = a.getAttribute("href");
            if (label && href) {
              const [filePart, hashPart] = href.split("#");
              tocEntries.push({ title: label, href: filePart, anchor: hashPart || "", level });
            }
          }
          const subOl = li.querySelector(":scope > ol");
          if (subOl) traverseNavOl(subOl, level + 1);
        });
      }
      if (rootOl) traverseNavOl(rootOl, 1);
    }
  }

  const spineRefs = Array.from(opfDoc.querySelectorAll("spine > itemref")).map((ref) =>
    ref.getAttribute("idref")
  );

  let nextPageNo = 1;
  const hrefToPageMap = {};

  for (const idref of spineRefs) {
    const item = manifestMap[idref];
    if (!item || !item.href) continue;

    const fullPath = resolveZipPath(opfDir, item.href);
    const zipEntry = zip.file(fullPath) || zip.file(decodeURIComponent(fullPath));
    if (!zipEntry) continue;

    const rawHtml = await zipEntry.async("text");
    const htmlDoc = parser.parseFromString(rawHtml, "text/html");

    htmlDoc.querySelectorAll("style").forEach((st) => {
      if (st.textContent) {
        sourceObj.customCss += "\n" + st.textContent.replace(/\bbody\b/g, ".epub-book-scope");
      }
    });

    htmlDoc.querySelectorAll("img, image").forEach((imgEl) => {
      const srcAttr = imgEl.getAttribute("src") || imgEl.getAttribute("xlink:href") || "";
      if (srcAttr) {
        const cleanSrc = srcAttr.replace(/^(\.\.\/)+/, "");
        const resolvedImg = resolveZipPath(
          fullPath.includes("/") ? fullPath.substring(0, fullPath.lastIndexOf("/") + 1) : "",
          srcAttr
        );
        const dataUri =
          assetMap[resolvedImg] ||
          assetMap[cleanSrc] ||
          assetMap[srcAttr] ||
          assetMap[cleanSrc.split("/").pop()];
        if (dataUri) {
          if (imgEl.tagName.toLowerCase() === "image") {
            imgEl.setAttribute("xlink:href", dataUri);
          } else {
            imgEl.setAttribute("src", dataUri);
          }
        }
      }
    });

    htmlDoc.querySelectorAll("[id], [name]").forEach((el) => {
      const idVal = el.getAttribute("id") || el.getAttribute("name");
      if (!idVal) return;
      const epubType = el.getAttribute("epub:type") || "";
      const roleAttr = el.getAttribute("role") || "";
      const clsAttr = (el.className || "").toString().toLowerCase();
      const isFootnoteTarget =
        epubType.includes("footnote") ||
        epubType.includes("rearnote") ||
        epubType.includes("endnote") ||
        roleAttr.includes("footnote") ||
        roleAttr.includes("endnote") ||
        /footnote|dipnot|endnote|^fn|note[-_]?/i.test(idVal) ||
        /footnote|dipnot|endnote|fn/i.test(clsAttr);

      if (isFootnoteTarget) {
        const cleanFnText = el.innerHTML.trim();
        if (cleanFnText) {
          sourceObj.footnotes[idVal] = cleanFnText;
        }
      }
    });

    const bodyClass = htmlDoc.body?.getAttribute("class") || "";
    const bodyStyle = htmlDoc.body?.getAttribute("style") || "";
    const bodyHtml = htmlDoc.body ? htmlDoc.body.innerHTML.trim() : rawHtml;
    const plainText = (htmlDoc.body ? htmlDoc.body.innerText : "").trim();
    if (!plainText && !bodyHtml.includes("<img")) continue;

    const cleanHref = item.href.split("#")[0];
    const fileNameOnly = cleanHref.split("/").pop();
    hrefToPageMap[cleanHref] = nextPageNo;
    hrefToPageMap[fileNameOnly] = nextPageNo;

    const matchedTocItems = tocEntries.filter(
      (t) => t.href === cleanHref || t.href.endsWith(cleanHref) || cleanHref.endsWith(t.href)
    );
    const headingEl = htmlDoc.querySelector("h1, h2, h3, title");
    const sectionTitle =
      matchedTocItems[0]?.title ||
      (headingEl && headingEl.textContent.trim()) ||
      `Konu ${nextPageNo}`;

    sourceObj.pages.push({
      pageNo: nextPageNo,
      title: sectionTitle,
      sourceHref: cleanHref,
      filePath: `dersler/${course.id}/${sourceObj.id}/sayfa_${nextPageNo}.html`,
      htmlContent: `<div class="epub-book-scope ${escapeHtml(bodyClass)}" style="${escapeHtml(bodyStyle)}">${bodyHtml}</div>`
    });

    if (matchedTocItems.length) {
      matchedTocItems.forEach((m) => {
        sourceObj.toc.push({
          title: m.title,
          pageNo: nextPageNo,
          level: m.level || 1,
          anchor: m.anchor || ""
        });
      });
    } else {
      const inferredLevel = headingEl
        ? headingEl.tagName === "H2"
          ? 2
          : headingEl.tagName === "H3"
          ? 3
          : 1
        : 1;
      sourceObj.toc.push({
        title: sectionTitle,
        pageNo: nextPageNo,
        level: inferredLevel,
        anchor: ""
      });
    }

    nextPageNo++;
  }

  sourceObj.pages.forEach((p) => {
    const doc = parser.parseFromString(p.htmlContent, "text/html");
    doc.querySelectorAll("a[href]").forEach((a) => {
      const rawHref = a.getAttribute("href") || "";
      if (rawHref.startsWith("http://") || rawHref.startsWith("https://") || rawHref.startsWith("mailto:")) {
        return;
      }
      const [filePart, hashPart] = rawHref.split("#");
      const fileNameOnly = filePart ? filePart.split("/").pop() : "";
      const targetPage = filePart
        ? hrefToPageMap[filePart] || hrefToPageMap[fileNameOnly] || p.pageNo
        : p.pageNo;

      a.setAttribute("data-target-page", String(targetPage));
      if (hashPart) a.setAttribute("data-target-anchor", hashPart);
    });
    p.htmlContent = doc.body.innerHTML;
  });
}

function resolveZipPath(baseDir, relativePath) {
  if (!relativePath) return "";
  const stack = baseDir ? baseDir.split("/").filter(Boolean) : [];
  const parts = relativePath.split("/");
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/**
 * MANUEL KONU / SAYFA EKLEME
 */
async function handleAdminManualPageAdd(e) {
  e.preventDefault();
  const courseId = appState.adminSelectedCourseId;
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    showToast("Lütfen önce soldaki listeden bir ders seçin!");
    return;
  }

  const title = document.getElementById("adminManualPageTitle").value.trim();
  const level = Number(document.getElementById("adminManualTocLevel").value) || 1;
  const content = document.getElementById("adminManualPageContent").value.trim();

  const targetSourceVal = document.getElementById("adminManualTargetSourceSelect").value;
  let targetSource = (course.sources || []).find((s) => s.id === targetSourceVal);

  if (!targetSource) {
    const customName = title || "Manuel Ders Kaynağı";
    targetSource = {
      id: "src_" + Date.now(),
      name: customName,
      folderPath: "",
      metadata: {
        workTitle: customName,
        author: "",
        publisher: "",
        pubYear: "",
        extra: ""
      },
      customCss: "",
      footnotes: {},
      pages: [],
      pageCount: 0,
      pagesLoaded: true,
      toc: []
    };
    targetSource.folderPath = `dersler/${course.id}/${targetSource.id}`;
    course.sources = course.sources || [];
    course.sources.push(targetSource);

    if (appState.currentUser) {
      appState.currentUser.enrolledSources = appState.currentUser.enrolledSources || [];
      targetSource.id && appState.currentUser.enrolledSources.push(targetSource.id);
      await saveUserProfileToFirebase(appState.currentUser);
    }
  } else if (!targetSource.pagesLoaded) {
    await ensureSourcePagesLoadedFromDerslerFolder(course.id, targetSource);
  }

  const nextPageNo =
    targetSource.pages.length > 0
      ? Math.max(...targetSource.pages.map((p) => Number(p.pageNo) || 0)) + 1
      : 1;

  const htmlContent = content.startsWith("<")
    ? content
    : `<p>${escapeHtml(content).replace(/\n/g, "</p><p>")}</p>`;

  targetSource.pages.push({
    pageNo: nextPageNo,
    title,
    filePath: `dersler/${course.id}/${targetSource.id}/sayfa_${nextPageNo}.html`,
    htmlContent
  });
  targetSource.pageCount = targetSource.pages.length;

  targetSource.toc.push({ title, pageNo: nextPageNo, level, anchor: "" });

  await saveSourceFilesToDerslerFolder(course.id, targetSource);
  await saveCourseMetaToFirebase(course);

  document.getElementById("adminManualPageTitle").value = "";
  document.getElementById("adminManualPageContent").value = "";
  renderAdminCoursesList();
  renderEnrolledSidebarCourses();
  renderProfileCoursesAndSourcesCheckboxes();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  showToast(`"${title}" konusu kaydedildi.`);
}

/**
 * DERS HOCASININ HAZIRLADIĞI SORULARI EKLEME (ÇOKTAN SEÇMELİ, BOŞLUK DOLDURMA, DOĞRU/YANLIŞ, KLASİK VE GRUPLAR)
 */
async function handleAdminAddQuestion(e) {
  e.preventDefault();
  const courseId = appState.adminSelectedCourseId;
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) {
    showToast("Lütfen önce soldaki listeden bir ders seçin!");
    return;
  }

  const sourceId = document.getElementById("adminQSourceSelect").value || "";
  const sourceObj = (course.sources || []).find((s) => s.id === sourceId);
  const topicSel = document.getElementById("adminQTopicSelect");
  const topicTitle = topicSel?.value || "Genel";
  const selectedOptEl = topicSel?.selectedOptions?.[0];
  const pageNo = Number(selectedOptEl?.getAttribute("data-page-no")) || 1;

  const qType = document.getElementById("adminQTypeSelect")?.value || "mcq";
  const questionText = document.getElementById("adminQText").value.trim();

  const setSelectVal = document.getElementById("adminQSetSelect")?.value || "Genel Sorular";
  const newSetNameInput = document.getElementById("adminNewQSetNameInput")?.value.trim();
  const groupName =
    setSelectVal === "__new__"
      ? newSetNameInput || "Hoca Soru Grubu " + new Date().toLocaleDateString("tr-TR")
      : setSelectVal;

  let options = [];
  let correctIndex = 0;
  let correctText = "";

  if (qType === "mcq") {
    options = [
      document.getElementById("adminQOpt0").value.trim(),
      document.getElementById("adminQOpt1").value.trim(),
      document.getElementById("adminQOpt2").value.trim(),
      document.getElementById("adminQOpt3").value.trim(),
      document.getElementById("adminQOpt4").value.trim()
    ].filter(Boolean); // E şıkkı zorunlu değil

    if (options.length < 2) {
      showToast("Çoktan seçmeli soru için en az 2 şık girmelisiniz.");
      return;
    }
    correctIndex = Number(document.getElementById("adminQCorrectIndex").value) || 0;
    if (correctIndex >= options.length) correctIndex = 0;
  } else if (qType === "fill") {
    correctText = (document.getElementById("adminQFillAnswer")?.value || "").trim();
    if (!correctText) {
      showToast("Lütfen boşluğa gelecek doğru cevabı yazın.");
      return;
    }
    options = [correctText];
  } else if (qType === "tf") {
    correctText = (document.getElementById("adminQTfAnswer")?.value || "Doğru").trim();
    options = ["Doğru", "Yanlış"];
    correctIndex = correctText === "Yanlış" ? 1 : 0;
  } else if (qType === "classic") {
    correctText = (document.getElementById("adminQClassicAnswer")?.value || "").trim();
    if (!correctText) {
      showToast("Lütfen klasik sorunun doğru cevabını veya açıklamasını yazın.");
      return;
    }
    options = [correctText];
  }

  course.questions = course.questions || [];
  course.questions.push({
    id: "q_" + Date.now(),
    courseId: course.id,
    courseName: course.name,
    sourceId,
    sourceName: sourceObj ? sourceObj.name : "",
    topicTitle,
    pageNo,
    question: questionText,
    options,
    correctIndex,
    questionType: qType,
    correctText,
    groupName
  });

  await saveQuestionsToSorularJson();
  await saveCourseMetaToFirebase(course);

  document.getElementById("adminQText").value = "";
  [
    "adminQOpt0",
    "adminQOpt1",
    "adminQOpt2",
    "adminQOpt3",
    "adminQOpt4",
    "adminQFillAnswer",
    "adminQClassicAnswer",
    "adminNewQSetNameInput"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  renderAdminCoursesList();
  showToast(`Soru "${groupName}" grubuna ve sorular.json dosyasına eklendi.`);
}

/********************************************************************
 * ORTAK YARDIMCI FONKSİYONLAR VE GÖRÜNÜM / TEMA KONTROLLERİ
 ********************************************************************/
function toggleBlueLightFilter() {
  setBlueLightFilter(!appState.blueLightEnabled);
  showToast(
    appState.blueLightEnabled
      ? "Mavi ışık koruma modu açıldı."
      : "Mavi ışık koruma modu kapatıldı."
  );
}

function setBlueLightFilter(enabled) {
  appState.blueLightEnabled = !!enabled;
  localStorage.setItem("md_blue_light", appState.blueLightEnabled ? "true" : "false");
  const overlay = document.getElementById("blueLightOverlay");
  const btn = document.getElementById("blueLightBtn");
  if (overlay) overlay.classList.toggle("hidden", !appState.blueLightEnabled);
  if (btn) btn.classList.toggle("active", appState.blueLightEnabled);
}

function toggleUserDropdownMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById("userDropdownMenu");
  menu.classList.toggle("hidden");
}

function setupDropdownCloseListener() {
  document.addEventListener("click", (e) => {
    const wrapper = document.getElementById("userDropdownWrapper");
    const menu = document.getElementById("userDropdownMenu");
    if (wrapper && menu && !wrapper.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });
}

function switchMainView(viewName) {
  if (viewName === "admin" && !appState.currentUser?.isAdmin) {
    showToast("Bu bölüme sadece yönetici (isAdmin: true) yetkisi verilmiş hesaplar erişebilir.");
    return;
  }

  if (viewName !== "study" && typeof stopTtsAudio === "function") {
    stopTtsAudio();
  }

  const views = ["study", "summary", "exams", "profile", "admin"];
  views.forEach((v) => {
    const sec = document.getElementById("view" + v.charAt(0).toUpperCase() + v.slice(1));
    const btn = document.getElementById("nav" + v.charAt(0).toUpperCase() + v.slice(1) + "Btn");
    if (sec) sec.classList.toggle("hidden", v !== viewName);
    if (btn) btn.classList.toggle("active", v === viewName);
  });

  document.getElementById("userDropdownMenu").classList.add("hidden");

  if (viewName === "summary" && typeof populateSummaryCourseAndSourceSelectors === "function") {
    populateSummaryCourseAndSourceSelectors();
  }
  if (viewName === "exams" && typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  if (viewName === "profile") populateProfileForm();
  if (viewName === "admin") {
    renderCategorySelectDropdowns();
    renderAdminCoursesList();
  }
}

function setTheme(themeName) {
  const validTheme = ["light", "dark", "cream"].includes(themeName) ? themeName : "light";
  document.documentElement.setAttribute("data-theme", validTheme);
  localStorage.setItem("md_theme", validTheme);
  ["light", "dark", "cream"].forEach((t) => {
    const btn = document.getElementById("theme-" + t);
    if (btn) btn.classList.toggle("active", t === validTheme);
  });
}

function setReaderScreenColor(colorMode, silent = false) {
  localStorage.setItem("md_reader_screen_color", colorMode);
  ["default", "white", "cream", "night", "slate", "green"].forEach((m) => {
    const btn = document.getElementById("scr-" + m);
    if (btn) btn.classList.toggle("active", m === colorMode);
  });

  const readerEl = document.getElementById("studyReaderContent");
  const summaryEl = document.getElementById("summaryResultContent");
  if (readerEl) {
    if (colorMode === "default") readerEl.removeAttribute("data-reader-screen");
    else readerEl.setAttribute("data-reader-screen", colorMode);
  }
  if (summaryEl) {
    if (colorMode === "default") summaryEl.removeAttribute("data-reader-screen");
    else summaryEl.setAttribute("data-reader-screen", colorMode);
  }
  const menu = document.getElementById("userDropdownMenu");
  if (menu) menu.classList.add("hidden");
  if (!silent) {
    showToast("Yazı ekranı rengi güncellendi.");
  }
}

function loadSavedReaderScreenColor() {
  const saved = localStorage.getItem("md_reader_screen_color") || "default";
  setReaderScreenColor(saved, true);
}

function toggleMobileSidebar() {
  document.getElementById("leftSidebar").classList.toggle("open");
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || tmp.innerText || "";
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function showToast(msg) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}