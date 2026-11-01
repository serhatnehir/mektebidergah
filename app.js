/********************************************************************
 * MEKTEB-İ DERGAH - APP.JS
 * (Sol Menü Tümünü Aç/Kapat, Kitap Künyesi, Okuma Ekranı,
 *  Temadan Bağımsız Ekran Renkleri, Sadece 4 Yapay Zeka Sesi ile Seslendirme,
 *  Onarılmış Akıllı Konu Özeti & Çoktan Seçmeli / Öğretici Soru Üretici,
 *  Dinamik Bitiş Konu Başlığı Filtresi ve Hoca Sorularını Görüp Değiştirme)
 ********************************************************************/

let savedSelectionRange = null;
let savedSelectionText = "";
let activePopupNoteId = null;
let tocEditorWorkingCopy = [];
let allSidebarCoursesExpanded = false;

// Özet ve Soru Üretici İçin Türkçe Bağlaç/Edat Filtresi
const TURKISH_STOP_WORDS = new Set([
  "ve", "ile", "bir", "bu", "şu", "o", "için", "da", "de", "ki", "mi", "mı", "mu", "mü",
  "gibi", "kadar", "daha", "çok", "en", "her", "ise", "ya", "veya", "hem", "ne", "ama",
  "fakat", "ancak", "lakin", "çünkü", "eğer", "olarak", "olan", "olup", "olur", "olduğu",
  "olanlar", "üzere", "göre", "karşı", "sonra", "önce", "arasında", "içinde", "üzerine"
]);

// SADECE 4 YAPAY ZEKA OKUYUCU PROFİLİ
const AI_VOICE_PERSONAS = [
  {
    key: "persona_zeynep_akici",
    label: "1. Zeynep — Akıcı & Berrak (Yapay Zeka)",
    pitchFactor: 1.0,
    preservesPitch: true,
    ttsSpeedParam: 1.0,
    fallbackPitch: 1.15
  },
  {
    key: "persona_ahmet_tok",
    label: "2. Ahmet — Tok & Belgesel Anlatıcı (Yapay Zeka)",
    pitchFactor: 0.84,
    preservesPitch: false,
    ttsSpeedParam: 1.0,
    fallbackPitch: 0.72
  },
  {
    key: "persona_elif_yumusak",
    label: "3. Elif — Yumuşak & Anlaşılır (Yapay Zeka)",
    pitchFactor: 1.09,
    preservesPitch: false,
    ttsSpeedParam: 0.85,
    fallbackPitch: 1.32
  },
  {
    key: "persona_muderris_klasik",
    label: "4. Müderris — Ağırbaşlı & Klasik Ton (Yapay Zeka)",
    pitchFactor: 0.76,
    preservesPitch: false,
    ttsSpeedParam: 0.9,
    fallbackPitch: 0.58
  }
];

let ttsState = {
  sentences: [],
  currentIndex: 0,
  isPlaying: false,
  isPaused: false,
  rate: 1.0,
  selectedVoiceKey: "persona_zeynep_akici",
  utteranceToken: 0,
  activeAudio: null,
  activeUtterance: null
};

/********************************************************************
 * SOL MENÜ: TÜMÜNÜ AÇ / TÜMÜNÜ KAPAT DÜĞMESİ & DERS/KAYNAK AKORDİYONU
 ********************************************************************/
function getFilteredSourcesForCourse(course) {
  if (!course || !course.sources) return [];
  const enrolledSources = appState.currentUser?.enrolledSources;
  if (!Array.isArray(enrolledSources) || enrolledSources.length === 0) {
    return course.sources;
  }
  const filtered = course.sources.filter((s) => enrolledSources.includes(s.id));
  return filtered.length ? filtered : course.sources;
}

function getOrderedEnrolledCourses() {
  const enrolledIds = appState.currentUser?.enrolledCourses || [];
  const ordered = [];
  enrolledIds.forEach((id) => {
    const found = appState.courses.find((c) => c.id === id);
    if (found) ordered.push(found);
  });
  return ordered;
}

function toggleAllSidebarCourses() {
  allSidebarCoursesExpanded = !allSidebarCoursesExpanded;
  const btn = document.getElementById("toggleAllCoursesBtn");
  if (btn) {
    btn.innerHTML = allSidebarCoursesExpanded
      ? `<i class="fa-solid fa-angles-up"></i> Tümünü Kapat`
      : `<i class="fa-solid fa-angles-down"></i> Tümünü Aç`;
  }

  const visibleCourses = getOrderedEnrolledCourses();
  visibleCourses.forEach((c) => {
    appState.expandedSidebarCourses[c.id] = allSidebarCoursesExpanded;
    const visibleSources = getFilteredSourcesForCourse(c);
    visibleSources.forEach((s) => {
      appState.expandedSidebarSources[s.id] = allSidebarCoursesExpanded;
    });
  });

  renderEnrolledSidebarCourses();
}

async function handleSidebarCourseClick(courseId) {
  const wasActive = appState.activeCourseId === courseId;
  if (wasActive) {
    appState.expandedSidebarCourses[courseId] = !appState.expandedSidebarCourses[courseId];
    renderEnrolledSidebarCourses();
  } else {
    appState.expandedSidebarCourses[courseId] = true;
    await selectCourseForStudy(courseId);
  }
}

function renderEnrolledSidebarCourses() {
  const listEl = document.getElementById("enrolledCoursesList");
  if (!listEl) return;
  const visibleCourses = getOrderedEnrolledCourses();

  if (!visibleCourses.length) {
    listEl.innerHTML = `
      <div class="hint-text">
        Seçili dersiniz yok. <strong>"Seç"</strong> butonuna tıklayarak ders ve kaynaklarınızı seçin.
      </div>`;
    return;
  }

  listEl.innerHTML = visibleCourses
    .map((c) => {
      const isActive = c.id === appState.activeCourseId;
      const isCourseExpanded = !!appState.expandedSidebarCourses[c.id];
      const visibleSources = getFilteredSourcesForCourse(c);
      const catName = getCategoryNameById(c.categoryId);

      const childrenHtml = isCourseExpanded
        ? buildCourseSourcesAndTocHtml(c, visibleSources)
        : "";

      return `
        <div class="sidebar-course-accordion ${isActive ? "active" : ""}">
          <div class="sidebar-course-item" onclick="handleSidebarCourseClick('${c.id}')">
            <div class="sidebar-course-info">
              <div class="sidebar-course-name">${escapeHtml(c.name)}</div>
              <div class="sidebar-course-meta">
                <span><i class="fa-solid fa-tag"></i> ${escapeHtml(catName)}</span>
                <span>• ${visibleSources.length} Kaynak</span>
              </div>
            </div>
          </div>
          ${childrenHtml}
        </div>
      `;
    })
    .join("");
}

function buildCourseSourcesAndTocHtml(course, visibleSources) {
  if (!visibleSources.length) {
    return `
      <div class="sidebar-course-children">
        <div class="hint-text">Bu derse henüz kaynak eklenmemiş.</div>
      </div>
    `;
  }

  const sourcesHtml = visibleSources
    .map((src) => {
      const isSrcActive =
        course.id === appState.activeCourseId && src.id === appState.activeSourceId;
      const isExpanded = !!appState.expandedSidebarSources[src.id];
      const isInfoOpen = !!appState.expandedSidebarSourceInfo[src.id];
      const meta = src.metadata || {};

      const hasAnyMeta =
        meta.workTitle || meta.author || meta.publisher || meta.pubYear || meta.extra;

      const bookInfoHtml = `
        <div class="sidebar-book-info-panel ${isInfoOpen ? "" : "hidden"}">
          <div style="font-weight:700;color:var(--accent);margin-bottom:3px;">
            <span><i class="fa-solid fa-circle-info"></i> Kitap Bilgilendirme</span>
          </div>
          <div class="book-meta-row">
            <span class="book-meta-label">Eserin Adı:</span>
            <span class="book-meta-val">${escapeHtml(meta.workTitle || src.name)}</span>
          </div>
          ${
            meta.author
              ? `<div class="book-meta-row"><span class="book-meta-label">Yazar:</span><span class="book-meta-val">${escapeHtml(meta.author)}</span></div>`
              : ""
          }
          ${
            meta.publisher
              ? `<div class="book-meta-row"><span class="book-meta-label">Yayınevi:</span><span class="book-meta-val">${escapeHtml(meta.publisher)}</span></div>`
              : ""
          }
          ${
            meta.pubYear
              ? `<div class="book-meta-row"><span class="book-meta-label">Basım Yılı:</span><span class="book-meta-val">${escapeHtml(meta.pubYear)}</span></div>`
              : ""
          }
          ${
            meta.extra
              ? `<div class="book-meta-row"><span class="book-meta-label">Ek Bilgi:</span><span class="book-meta-val">${escapeHtml(meta.extra)}</span></div>`
              : ""
          }
          ${
            !hasAnyMeta
              ? `<div class="hint-text">Ek künye bilgisi girilmemiş.</div>`
              : ""
          }
        </div>
      `;

      const tocItems =
        src.toc && src.toc.length
          ? src.toc
          : (src.pages || []).map((p) => ({
              title: p.title || `Konu ${p.pageNo}`,
              pageNo: p.pageNo,
              level: 1
            }));

      const currentPageNo = isSrcActive ? src.pages[appState.activePageIndex]?.pageNo : -1;

      const tocHtml = tocItems
        .map((item) => {
          const lvl = Math.min(4, Math.max(1, Number(item.level) || 1));
          const activeCls = isSrcActive && currentPageNo === item.pageNo ? "active" : "";
          const safeAnchor = item.anchor ? escapeHtml(item.anchor) : "";
          return `
            <div class="toc-item toc-level-${lvl} ${activeCls}" onclick="jumpToCourseSourceAndPage('${course.id}', '${src.id}', ${item.pageNo}, '${safeAnchor}')">
              <span>${escapeHtml(item.title)}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="sidebar-source-group">
          <div class="sidebar-source-header">
            <div class="source-header-title" onclick="selectCourseAndSourceFromSidebar('${course.id}', '${src.id}')" title="${escapeHtml(src.name)}">
              <i class="fa-solid fa-book-open"></i>
              <span>${escapeHtml(src.name)}</span>
            </div>
            <div class="source-header-actions">
              <button type="button" class="source-info-btn ${isInfoOpen ? "active" : ""}" onclick="toggleSidebarSourceInfo('${src.id}', event)" title="Kitap Bilgilendirme Menüsü">
                <i class="fa-solid fa-circle-info"></i>
              </button>
            </div>
          </div>
          ${bookInfoHtml}
          <div class="sidebar-source-toc-items ${isExpanded ? "" : "hidden"}">
            ${tocHtml || `<div class="hint-text">İçindekiler boş</div>`}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="sidebar-course-children">
      ${sourcesHtml}
    </div>
  `;
}

async function selectCourseAndSourceFromSidebar(courseId, sourceId) {
  appState.expandedSidebarSources[sourceId] = !appState.expandedSidebarSources[sourceId];
  if (appState.activeCourseId !== courseId || appState.activeSourceId !== sourceId) {
    appState.expandedSidebarSources[sourceId] = true;
    await selectCourseForStudy(courseId, sourceId);
  } else {
    renderEnrolledSidebarCourses();
  }
}

async function selectCourseForStudy(courseId, preferredSourceId = null) {
  stopTtsAudio();
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) return;

  appState.activeCourseId = courseId;
  appState.expandedSidebarCourses[courseId] = true;
  const visibleSources = getFilteredSourcesForCourse(course);

  if (preferredSourceId && visibleSources.some((s) => s.id === preferredSourceId)) {
    appState.activeSourceId = preferredSourceId;
  } else if (!visibleSources.some((s) => s.id === appState.activeSourceId)) {
    appState.activeSourceId = visibleSources[0]?.id || null;
  }

  if (appState.activeSourceId && appState.expandedSidebarSources[appState.activeSourceId] === undefined) {
    appState.expandedSidebarSources[appState.activeSourceId] = true;
  }

  appState.activePageIndex = 0;

  switchMainView("study");
  renderEnrolledSidebarCourses();

  document.getElementById("noCourseSelectedState").classList.add("hidden");
  document.getElementById("activeStudyWorkspace").classList.remove("hidden");

  const activeSource = getActiveSource();
  if (activeSource && !activeSource.pagesLoaded) {
    document.getElementById("studyReaderContent").innerHTML = `<p class="hint-text">Kaynak içeriği yükleniyor...</p>`;
    await ensureSourcePagesLoadedFromDerslerFolder(course.id, activeSource);
  }

  renderEnrolledSidebarCourses();
  renderCurrentStudyPage();
  renderUserCourseNotes();
}

function getActiveCourse() {
  return appState.courses.find((c) => c.id === appState.activeCourseId) || null;
}

function getActiveSource() {
  const course = getActiveCourse();
  if (!course) return null;
  const visibleSources = getFilteredSourcesForCourse(course);
  return visibleSources.find((s) => s.id === appState.activeSourceId) || visibleSources[0] || null;
}

function toggleSidebarSourceInfo(sourceId, event) {
  if (event) event.stopPropagation();
  appState.expandedSidebarSourceInfo[sourceId] = !appState.expandedSidebarSourceInfo[sourceId];
  renderEnrolledSidebarCourses();
}

async function jumpToCourseSourceAndPage(courseId, sourceId, pageNo, anchorId = "") {
  stopTtsAudio();
  if (appState.activeCourseId !== courseId) {
    await selectCourseForStudy(courseId, sourceId);
  } else if (appState.activeSourceId !== sourceId) {
    appState.activeSourceId = sourceId;
  }

  const course = getActiveCourse();
  const source = getActiveSource();
  if (!course || !source) return;

  if (!source.pagesLoaded) {
    await ensureSourcePagesLoadedFromDerslerFolder(course.id, source);
  }
  if (!source.pages.length) return;

  const idx = source.pages.findIndex((p) => Number(p.pageNo) === Number(pageNo));
  if (idx !== -1) {
    appState.activePageIndex = idx;
    switchMainView("study");
    renderEnrolledSidebarCourses();
    renderCurrentStudyPage();

    if (anchorId) {
      setTimeout(() => {
        const readerEl = document.getElementById("studyReaderContent");
        const targetEl =
          readerEl.querySelector(`#${CSS.escape(anchorId)}`) ||
          readerEl.querySelector(`[name="${CSS.escape(anchorId)}"]`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 80);
    }
  }
}

/********************************************************************
 * İÇİNDEKİLER (TOC) SERBEST DÜZENLEME PENCERESİ
 ********************************************************************/
function openTocEditorModal(courseId = null, sourceId = null) {
  if (!appState.currentUser?.isAdmin) {
    showToast("İçindekiler tablosunu sadece yöneticiler (Admin) düzenleyebilir.");
    return;
  }

  const targetCourseId = courseId || appState.adminSelectedCourseId || appState.activeCourseId;
  const course = appState.courses.find((c) => c.id === targetCourseId);
  const source = sourceId
    ? course?.sources?.find((s) => s.id === sourceId)
    : getActiveSource() || course?.sources?.[0];

  if (!course || !source) {
    showToast("Düzenlemek için önce bir kaynak seçin.");
    return;
  }

  editingTocTarget = { courseId: course.id, sourceId: source.id };
  document.getElementById("tocEditorSourceTitle").textContent = source.name;

  const rawToc =
    source.toc && source.toc.length
      ? source.toc
      : (source.pages || []).map((p) => ({
          title: p.title || `Konu ${p.pageNo}`,
          pageNo: p.pageNo,
          level: 1
        }));

  tocEditorWorkingCopy = rawToc.map((item) => ({
    title: item.title || "",
    pageNo: Number(item.pageNo) || 1,
    level: Number(item.level) || 1,
    anchor: item.anchor || ""
  }));

  renderTocEditorRows();
  document.getElementById("tocEditorModal").classList.remove("hidden");
}

function closeTocEditorModal() {
  document.getElementById("tocEditorModal").classList.add("hidden");
}

function renderTocEditorRows() {
  const container = document.getElementById("tocEditorRowsContainer");
  if (!tocEditorWorkingCopy.length) {
    container.innerHTML = `<p class="hint-text">İçindekiler listesi boş. Yeni satır ekleyebilirsiniz.</p>`;
    return;
  }

  container.innerHTML = tocEditorWorkingCopy
    .map(
      (row, idx) => `
      <div class="toc-editor-row">
        <input type="text" class="form-input" value="${escapeHtml(row.title)}" placeholder="Konu başlığı adı..." oninput="updateTocEditorItem(${idx}, 'title', this.value)" />
        <select class="form-input" onchange="updateTocEditorItem(${idx}, 'level', this.value)">
          <option value="1" ${row.level === 1 ? "selected" : ""}>1. Derece (Ana)</option>
          <option value="2" ${row.level === 2 ? "selected" : ""}>2. Derece (Alt)</option>
          <option value="3" ${row.level === 3 ? "selected" : ""}>3. Derece (Detay)</option>
          <option value="4" ${row.level === 4 ? "selected" : ""}>4. Derece</option>
        </select>
        <div style="display:flex;gap:4px;">
          <button type="button" class="icon-btn" onclick="moveTocEditorRow(${idx}, -1)" title="Yukarı Taşı">
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button type="button" class="icon-btn" onclick="moveTocEditorRow(${idx}, 1)" title="Aşağı Taşı">
            <i class="fa-solid fa-arrow-down"></i>
          </button>
          <button type="button" class="btn-danger-sm" onclick="removeTocEditorRow(${idx})" title="Sil">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

function updateTocEditorItem(idx, field, val) {
  if (!tocEditorWorkingCopy[idx]) return;
  if (field === "pageNo" || field === "level") {
    tocEditorWorkingCopy[idx][field] = Math.max(1, Number(val) || 1);
  } else {
    tocEditorWorkingCopy[idx][field] = val;
  }
}

function addTocEditorRow() {
  const lastPage = tocEditorWorkingCopy.length
    ? tocEditorWorkingCopy[tocEditorWorkingCopy.length - 1].pageNo
    : 1;
  tocEditorWorkingCopy.push({
    title: "Yeni Konu Başlığı",
    pageNo: lastPage,
    level: 1,
    anchor: ""
  });
  renderTocEditorRows();
}

function removeTocEditorRow(idx) {
  tocEditorWorkingCopy.splice(idx, 1);
  renderTocEditorRows();
}

function moveTocEditorRow(idx, dir) {
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= tocEditorWorkingCopy.length) return;
  const temp = tocEditorWorkingCopy[idx];
  tocEditorWorkingCopy[idx] = tocEditorWorkingCopy[targetIdx];
  tocEditorWorkingCopy[targetIdx] = temp;
  renderTocEditorRows();
}

async function saveTocEditorChanges() {
  const { courseId, sourceId } = editingTocTarget;
  const course = appState.courses.find((c) => c.id === courseId) || getActiveCourse();
  const source = course?.sources?.find((s) => s.id === sourceId) || getActiveSource();
  if (!course || !source) return;

  source.toc = tocEditorWorkingCopy
    .map((item, index) => ({
      title: item.title.trim() || `Konu ${index + 1}`,
      pageNo: Number(item.pageNo) || index + 1,
      level: Number(item.level) || 1,
      anchor: item.anchor || ""
    }))
    .filter((item) => item.title.length > 0);

  source.toc.forEach((tocItem) => {
    const pageObj = (source.pages || []).find((p) => Number(p.pageNo) === Number(tocItem.pageNo));
    if (pageObj && tocItem.level === 1) {
      pageObj.title = tocItem.title;
    }
  });

  appState.expandedSidebarSources[source.id] = true;
  await saveCourseMetaToFirebase(course);
  if (source.pagesLoaded) {
    await saveSourceFilesToDerslerFolder(course.id, source);
  }

  renderAdminSelectedCourseDetails();
  renderEnrolledSidebarCourses();
  if (typeof populateExamCourseAndSourceSelectors === "function") {
    populateExamCourseAndSourceSelectors();
  }
  if (typeof populateSummaryCourseAndSourceSelectors === "function") {
    populateSummaryCourseAndSourceSelectors();
  }
  if (appState.activeCourseId === course.id) {
    renderCurrentStudyPage();
  }
  closeTocEditorModal();
  showToast("İçindekiler tablosu güncellendi.");
}

/********************************************************************
 * YAPAY ZEKA SESLENDİRME MOTORU (SADECE 4 YAPAY ZEKA SESİ)
 ********************************************************************/
function initSpeechSynthesisEngine() {
  const savedRate = parseFloat(localStorage.getItem("md_tts_rate"));
  if (!isNaN(savedRate) && savedRate >= 0.5 && savedRate <= 2.0) {
    ttsState.rate = savedRate;
  }
  const savedVoice = localStorage.getItem("md_tts_voice");
  if (savedVoice && AI_VOICE_PERSONAS.some((p) => p.key === savedVoice)) {
    ttsState.selectedVoiceKey = savedVoice;
  } else {
    ttsState.selectedVoiceKey = AI_VOICE_PERSONAS[0].key;
  }

  populateVoiceSelectOptions();
  updateTtsUiStatus();
}

function populateVoiceSelectOptions() {
  const sel = document.getElementById("ttsVoiceSelect");
  if (!sel) return;

  sel.innerHTML = AI_VOICE_PERSONAS.map(
    (p) => `<option value="${p.key}">${escapeHtml(p.label)}</option>`
  ).join("");

  sel.value = ttsState.selectedVoiceKey;
  if (!sel.value) sel.selectedIndex = 0;
}

function openVoiceSettingsModal() {
  document.getElementById("userDropdownMenu").classList.add("hidden");
  populateVoiceSelectOptions();
  document.getElementById("ttsRateRangeInput").value = ttsState.rate;
  document.getElementById("ttsRateValueBadge").textContent = `${ttsState.rate.toFixed(2).replace(/\.00$/, ".0")}x`;
  document.getElementById("voiceSettingsModal").classList.remove("hidden");
}

function closeVoiceSettingsModal() {
  document.getElementById("voiceSettingsModal").classList.add("hidden");
}

function handleVoiceSettingsChange() {
  const sel = document.getElementById("ttsVoiceSelect");
  if (!sel) return;
  ttsState.selectedVoiceKey = sel.value;
  localStorage.setItem("md_tts_voice", ttsState.selectedVoiceKey);
  if (ttsState.isPlaying) {
    speakCurrentSentence();
  }
}

function handleVoiceRateSliderInput(val) {
  const num = parseFloat(val) || 1.0;
  ttsState.rate = Math.min(2.0, Math.max(0.5, num));
  localStorage.setItem("md_tts_rate", String(ttsState.rate));
  document.getElementById("ttsRateValueBadge").textContent = `${ttsState.rate.toFixed(2).replace(/\.00$/, ".0")}x`;
  updateTtsUiStatus();
  if (ttsState.isPlaying) {
    speakCurrentSentence();
  }
}

function setVoiceRatePreset(rateVal) {
  document.getElementById("ttsRateRangeInput").value = rateVal;
  handleVoiceRateSliderInput(rateVal);
}

function testSelectedVoiceSample() {
  stopTtsAudio();
  const persona =
    AI_VOICE_PERSONAS.find((p) => p.key === ttsState.selectedVoiceKey) ||
    AI_VOICE_PERSONAS[0];
  const sampleText = "Mekteb-i Dergah yapay zeka ders seslendirme sistemine hoş geldiniz.";
  const myToken = ++ttsState.utteranceToken;
  playCloudAiTtsSentence(sampleText, persona, myToken, null);
}

function prepareCurrentPageSentencesForTts() {
  const readerEl = document.getElementById("studyReaderContent");
  const rawHtml = readerEl ? readerEl.innerHTML : "";
  const cleanText = extractCleanTextWithoutFootnotes(rawHtml);

  if (!cleanText) {
    ttsState.sentences = [];
    return;
  }

  const rawParts = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const chunks = [];
  rawParts.forEach((part) => {
    if (part.length <= 165) {
      chunks.push(part);
    } else {
      const words = part.split(/\s+/);
      let current = "";
      words.forEach((w) => {
        if ((current + " " + w).trim().length <= 165) {
          current = (current + " " + w).trim();
        } else {
          if (current) chunks.push(current);
          current = w;
        }
      });
      if (current) chunks.push(current);
    }
  });

  ttsState.sentences = chunks;
}

function togglePlayPauseTtsAudio() {
  if (ttsState.isPlaying && !ttsState.isPaused) {
    ttsState.utteranceToken++;
    ttsState.isPaused = true;
    ttsState.isPlaying = false;
    if (ttsState.activeAudio) {
      ttsState.activeAudio.pause();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    updateTtsUiStatus();
    return;
  }

  prepareCurrentPageSentencesForTts();

  if (!ttsState.sentences.length) {
    showToast("Bu konuda seslendirilecek ders metni bulunamadı.");
    return;
  }

  if (ttsState.currentIndex >= ttsState.sentences.length) {
    ttsState.currentIndex = 0;
  }

  ttsState.isPlaying = true;
  ttsState.isPaused = false;
  speakCurrentSentence();
}

function speakCurrentSentence() {
  const myToken = ++ttsState.utteranceToken;

  if (ttsState.activeAudio) {
    ttsState.activeAudio.pause();
    ttsState.activeAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  if (ttsState.currentIndex < 0) ttsState.currentIndex = 0;
  if (ttsState.currentIndex >= ttsState.sentences.length) {
    stopTtsAudio();
    showToast("Konu seslendirmesi tamamlandı.");
    return;
  }

  const currentSentenceText = ttsState.sentences[ttsState.currentIndex];
  const persona =
    AI_VOICE_PERSONAS.find((p) => p.key === ttsState.selectedVoiceKey) ||
    AI_VOICE_PERSONAS[0];

  updateTtsUiStatus();

  playCloudAiTtsSentence(currentSentenceText, persona, myToken, () => {
    if (myToken !== ttsState.utteranceToken) return;
    if (ttsState.isPlaying && !ttsState.isPaused) {
      ttsState.currentIndex++;
      speakCurrentSentence();
    }
  });
}

function playCloudAiTtsSentence(text, persona, token, onComplete) {
  const encoded = encodeURIComponent(text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=tr&client=tw-ob&ttsspeed=${persona.ttsSpeedParam}&q=${encoded}`;

  const audio = new Audio(url);
  ttsState.activeAudio = audio;

  const preserves = persona.preservesPitch === true;
  if ("preservesPitch" in audio) audio.preservesPitch = preserves;
  if ("mozPreservesPitch" in audio) audio.mozPreservesPitch = preserves;
  if ("webkitPreservesPitch" in audio) audio.webkitPreservesPitch = preserves;

  const effectiveRate = Math.min(
    2.5,
    Math.max(0.45, ttsState.rate * (preserves ? 1.0 : persona.pitchFactor))
  );
  audio.playbackRate = effectiveRate;

  audio.onended = () => {
    if (token !== ttsState.utteranceToken) return;
    if (onComplete) onComplete();
  };

  audio.onerror = () => {
    if (token !== ttsState.utteranceToken) return;
    fallbackSpeechSynthesisWithPersona(text, persona, token, onComplete);
  };

  audio.play().catch(() => {
    if (token !== ttsState.utteranceToken) return;
    fallbackSpeechSynthesisWithPersona(text, persona, token, onComplete);
  });
}

function fallbackSpeechSynthesisWithPersona(text, persona, token, onComplete) {
  if (!("speechSynthesis" in window)) {
    if (onComplete) onComplete();
    return;
  }
  window.speechSynthesis.cancel();
  setTimeout(() => {
    if (token !== ttsState.utteranceToken) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    u.rate = ttsState.rate;
    u.pitch = persona.fallbackPitch || 1.0;

    const voices = window.speechSynthesis.getVoices() || [];
    const trVoices = voices.filter((v) => (v.lang || "").toLowerCase().includes("tr"));
    const nonTolga = trVoices.find((v) => !v.name.toLowerCase().includes("tolga"));
    if (nonTolga) u.voice = nonTolga;
    else if (trVoices.length) u.voice = trVoices[0];

    ttsState.activeUtterance = u;
    u.onend = () => {
      if (token !== ttsState.utteranceToken) return;
      if (onComplete) onComplete();
    };
    u.onerror = () => {
      if (token !== ttsState.utteranceToken) return;
      if (onComplete) onComplete();
    };
    window.speechSynthesis.speak(u);
  }, 50);
}

function stopTtsAudio() {
  ttsState.utteranceToken++;
  if (ttsState.activeAudio) {
    ttsState.activeAudio.pause();
    ttsState.activeAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  ttsState.isPlaying = false;
  ttsState.isPaused = false;
  ttsState.currentIndex = 0;
  ttsState.activeUtterance = null;
  updateTtsUiStatus();
}

function seekTtsAudio(secondsDelta) {
  prepareCurrentPageSentencesForTts();
  if (!ttsState.sentences.length) {
    showToast("Bu konuda seslendirilecek metin bulunamadı.");
    return;
  }

  const targetCharDelta = Math.round(Math.abs(secondsDelta) * 13 * ttsState.rate);
  let accumulatedChars = 0;
  let indexStep = 0;

  if (secondsDelta > 0) {
    for (let i = ttsState.currentIndex; i < ttsState.sentences.length; i++) {
      accumulatedChars += ttsState.sentences[i].length;
      indexStep++;
      if (accumulatedChars >= targetCharDelta) break;
    }
    ttsState.currentIndex = Math.min(
      ttsState.sentences.length - 1,
      ttsState.currentIndex + Math.max(1, indexStep)
    );
  } else {
    for (let i = ttsState.currentIndex; i >= 0; i--) {
      accumulatedChars += ttsState.sentences[i].length;
      indexStep++;
      if (accumulatedChars >= targetCharDelta) break;
    }
    ttsState.currentIndex = Math.max(0, ttsState.currentIndex - Math.max(1, indexStep));
  }

  updateTtsUiStatus();
  if (ttsState.isPlaying) {
    speakCurrentSentence();
  } else {
    showToast(
      secondsDelta > 0
        ? `10 saniye ileri sarıldı (${ttsState.currentIndex + 1}/${ttsState.sentences.length})`
        : `10 saniye geri sarıldı (${ttsState.currentIndex + 1}/${ttsState.sentences.length})`
    );
  }
}

function updateTtsUiStatus() {
  const playBtn = document.getElementById("ttsPlayPauseBtn");
  const statusEl = document.getElementById("ttsStatusText");
  if (!playBtn || !statusEl) return;

  const rateStr = `${ttsState.rate.toFixed(2).replace(/\.00$/, ".0")}x`;
  const persona =
    AI_VOICE_PERSONAS.find((p) => p.key === ttsState.selectedVoiceKey) ||
    AI_VOICE_PERSONAS[0];
  const shortPersonaName = persona.label.split("—")[0].replace(/^\d+\.\s*/, "").trim();

  if (ttsState.isPlaying) {
    playBtn.innerHTML = `<i class="fa-solid fa-pause"></i> <span>Duraklat</span>`;
    const currentSent = ttsState.sentences[ttsState.currentIndex] || "";
    statusEl.textContent = `[${shortPersonaName} • ${rateStr}] (${ttsState.currentIndex + 1}/${ttsState.sentences.length}) ${currentSent}`;
  } else if (ttsState.isPaused) {
    playBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Devam Et</span>`;
    statusEl.textContent = `Duraklatıldı (${ttsState.currentIndex + 1}/${ttsState.sentences.length}) • ${shortPersonaName} (${rateStr})`;
  } else {
    playBtn.innerHTML = `<i class="fa-solid fa-play"></i> <span>Oynat</span>`;
    statusEl.textContent = `Okuyucu: ${shortPersonaName} • Hız: ${rateStr}`;
  }
}

/********************************************************************
 * DERS ÇALIŞMA EKRANI: OKUMA, ORİJİNAL PDF & EPUB ŞEFFAF VURGU / NOT KATMANI
 ********************************************************************/
function normalizeReaderHighlightsToTransparent() {
  const readerEl = document.getElementById("studyReaderContent");
  if (!readerEl) return false;
  let changed = false;

  readerEl.querySelectorAll("[style*='background-color'], font, span, mark").forEach((el) => {
    if (!el.style || !el.style.backgroundColor) return;
    const bg = el.style.backgroundColor.trim();
    if (!bg || bg === "transparent" || bg === "inherit") return;

    const rgbMatch = bg.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (rgbMatch) {
      el.style.backgroundColor = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, 0.38)`;
      changed = true;
      return;
    }

    const rgbaMatch = bg.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/i);
    if (rgbaMatch && parseFloat(rgbaMatch[4]) > 0.5) {
      el.style.backgroundColor = `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, 0.38)`;
      changed = true;
    }
  });

  return changed;
}

function renderCurrentStudyPage() {
  stopTtsAudio();
  const course = getActiveCourse();
  const source = getActiveSource();
  const readerEl = document.getElementById("studyReaderContent");
  const titleEl = document.getElementById("currentPageTitleIndicator");
  const styleContainer = document.getElementById("epubCustomStylesContainer");

  if (!course || !source || !source.pages.length) {
    titleEl.textContent = "İçerik Yok";
    readerEl.innerHTML = `<p class="hint-text">Bu derse henüz kaynak eklenmemiş.</p>`;
    return;
  }

  styleContainer.innerHTML = source.customCss ? `<style>${source.customCss}</style>` : "";

  const pageObj = source.pages[appState.activePageIndex] || source.pages[0];
  titleEl.textContent =
    source.name === pageObj.title ? source.name : `${source.name} — ${pageObj.title}`;

  const editKey = `${course.id}_${source.id}_${pageObj.pageNo}`;
  const userSavedHtml = appState.userData.pageEdits[editKey];
  readerEl.innerHTML = userSavedHtml !== undefined ? userSavedHtml : pageObj.htmlContent;

  if (normalizeReaderHighlightsToTransparent()) {
    saveCurrentUserPageEdits();
  }

  loadSavedReaderScreenColor();
  prepareCurrentPageSentencesForTts();
  updateTtsUiStatus();
}

function navigateStudyPage(direction) {
  const course = getActiveCourse();
  const source = getActiveSource();
  if (!course || !source || !source.pages.length) return;

  saveCurrentUserPageEdits();
  const nextIndex = appState.activePageIndex + direction;
  if (nextIndex >= 0 && nextIndex < source.pages.length) {
    appState.activePageIndex = nextIndex;
    renderCurrentStudyPage();
    renderEnrolledSidebarCourses();
  }
}

async function saveCurrentUserPageEdits() {
  const course = getActiveCourse();
  const source = getActiveSource();
  if (!course || !source || !source.pages.length || !appState.currentUser) return;
  const pageObj = source.pages[appState.activePageIndex];
  if (!pageObj) return;

  const readerEl = document.getElementById("studyReaderContent");
  const editKey = `${course.id}_${source.id}_${pageObj.pageNo}`;
  const htmlVal = readerEl.innerHTML;
  appState.userData.pageEdits[editKey] = htmlVal;
  await saveSinglePageEditToFirebase(editKey, htmlVal);
}

async function resetCurrentUserPageEdits() {
  const course = getActiveCourse();
  const source = getActiveSource();
  if (!course || !source || !source.pages.length) return;
  const pageObj = source.pages[appState.activePageIndex];
  const editKey = `${course.id}_${source.id}_${pageObj.pageNo}`;
  delete appState.userData.pageEdits[editKey];
  await saveSinglePageEditToFirebase(editKey, null);
  renderCurrentStudyPage();
  showToast("Bu konudaki kişisel vurgularınız sıfırlandı.");
}

function setupStudyReaderContextMenuAndInteractions() {
  const readerEl = document.getElementById("studyReaderContent");
  const ctxMenu = document.getElementById("studyContextMenu");
  if (!readerEl || !ctxMenu) return;

  readerEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedSelectionRange = sel.getRangeAt(0).cloneRange();
      savedSelectionText = sel.toString().trim();
    } else {
      savedSelectionRange = null;
      savedSelectionText = "";
    }

    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 280);
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.remove("hidden");
  });

  readerEl.addEventListener("keydown", (e) => {
    if (readerEl.querySelector(".pdf-original-page")) {
      const ctrlOrMeta = e.ctrlKey || e.metaKey;
      if (!(ctrlOrMeta && (e.key || "").toLowerCase() === "c")) {
        e.preventDefault();
      }
    }
  });

  readerEl.addEventListener("input", () => {
    saveCurrentUserPageEdits();
  });

  readerEl.addEventListener("click", (e) => {
    const inlineNoteEl = e.target.closest(".user-inline-note");
    if (inlineNoteEl) {
      e.preventDefault();
      e.stopPropagation();
      const noteId = inlineNoteEl.getAttribute("data-note-id");
      openUserInlineNotePopup(noteId);
      return;
    }

    const linkEl = e.target.closest("a, sup");
    if (linkEl) {
      handleReaderLinkOrFootnoteClick(e, linkEl);
    }
  });

  document.addEventListener("click", (e) => {
    if (!ctxMenu.contains(e.target)) {
      ctxMenu.classList.add("hidden");
    }
  });
}

function handleReaderLinkOrFootnoteClick(e, el) {
  const course = getActiveCourse();
  const source = getActiveSource();
  if (!course || !source) return;

  const anchorEl = el.tagName.toLowerCase() === "a" ? el : el.querySelector("a") || el.closest("a");
  const rawHref = anchorEl ? anchorEl.getAttribute("href") || "" : "";
  const targetAnchor =
    (anchorEl && anchorEl.getAttribute("data-target-anchor")) ||
    (rawHref.includes("#") ? rawHref.split("#")[1] : "");
  const targetPageAttr = anchorEl ? Number(anchorEl.getAttribute("data-target-page")) : 0;

  const elText = (el.textContent || "").trim();
  const isLikelyFootnoteNumber = /^(\[\d+\]|\(\d+\)|\d+|[¹²³⁴⁵⁶⁷⁸⁹⁰]+|\*)$/.test(elText);
  const isFootnoteAnchor =
    targetAnchor &&
    (source.footnotes?.[targetAnchor] ||
      /footnote|dipnot|endnote|^fn|note[-_]?/i.test(targetAnchor) ||
      isLikelyFootnoteNumber);

  if (isFootnoteAnchor || (isLikelyFootnoteNumber && !rawHref)) {
    e.preventDefault();
    e.stopPropagation();
    const footnoteContent = findFootnoteContentInSource(source, targetAnchor, elText);
    if (footnoteContent) {
      openPopupViewerModal(`Kaynak Dipnotu (${elText || targetAnchor})`, "", footnoteContent, null);
      return;
    }
  }

  if (targetPageAttr || targetAnchor) {
    e.preventDefault();
    e.stopPropagation();

    if (targetAnchor) {
      const fnCandidate = findFootnoteContentInSource(source, targetAnchor, elText);
      if (fnCandidate && isLikelyFootnoteNumber) {
        openPopupViewerModal(`Kaynak Dipnotu (${elText})`, "", fnCandidate, null);
        return;
      }
    }

    const destPage = targetPageAttr || source.pages[appState.activePageIndex]?.pageNo || 1;
    jumpToCourseSourceAndPage(course.id, source.id, destPage, targetAnchor);
  }
}

function findFootnoteContentInSource(source, anchorId, fallbackNumText) {
  if (!source) return null;
  if (anchorId && source.footnotes && source.footnotes[anchorId]) {
    return source.footnotes[anchorId];
  }

  const parser = new DOMParser();

  if (anchorId) {
    for (const p of source.pages || []) {
      const doc = parser.parseFromString(p.htmlContent || "", "text/html");
      const found =
        doc.getElementById(anchorId) ||
        doc.querySelector(`[name="${CSS.escape(anchorId)}"]`);
      if (found) {
        const parentBlock = found.closest("aside, li, p, div") || found;
        return parentBlock.innerHTML.trim();
      }
    }
  }

  const cleanNum = (fallbackNumText || "").replace(/\D/g, "");
  if (cleanNum) {
    const currentPage = source.pages[appState.activePageIndex];
    if (currentPage) {
      const doc = parser.parseFromString(currentPage.htmlContent || "", "text/html");
      const candidates = Array.from(doc.querySelectorAll("aside, li, p, div, small"));
      for (const c of candidates.reverse()) {
        const txt = (c.textContent || "").trim();
        const regex = new RegExp(`^(\\[${cleanNum}\\]|\\(${cleanNum}\\)|${cleanNum}[.)\\s])\\s*(.+)`);
        if (regex.test(txt) && txt.length > 10 && txt.length < 1200) {
          return c.innerHTML.trim();
        }
      }
    }
  }

  return null;
}

function restoreSavedSelectionInReader() {
  if (savedSelectionRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelectionRange);
  }
}

function applyReaderCommand(cmd) {
  restoreSavedSelectionInReader();
  document.execCommand(cmd, false, null);
  normalizeReaderHighlightsToTransparent();
  saveCurrentUserPageEdits();
  document.getElementById("studyContextMenu").classList.add("hidden");
}

function applyHighlightColor(colorVal) {
  restoreSavedSelectionInReader();
  const readerEl = document.getElementById("studyReaderContent");

  if (savedSelectionRange && readerEl && readerEl.querySelector(".pdf-original-page")) {
    const hitPdfSpans = Array.from(readerEl.querySelectorAll(".pdf-text-item")).filter((sp) =>
      savedSelectionRange.intersectsNode(sp)
    );

    if (hitPdfSpans.length > 0) {
      hitPdfSpans.forEach((sp) => {
        if (colorVal === "transparent") {
          sp.style.backgroundColor = "";
          sp.querySelectorAll("[style*='background-color']").forEach((inner) => {
            inner.style.backgroundColor = "";
          });
        } else {
          sp.style.backgroundColor = colorVal;
        }
      });
      window.getSelection().removeAllRanges();
      saveCurrentUserPageEdits();
      document.getElementById("studyContextMenu").classList.add("hidden");
      return;
    }
  }

  if (colorVal === "transparent") {
    document.execCommand("hiliteColor", false, "transparent");
  } else {
    document.execCommand("hiliteColor", false, colorVal);
  }

  normalizeReaderHighlightsToTransparent();
  saveCurrentUserPageEdits();
  document.getElementById("studyContextMenu").classList.add("hidden");
}

async function handleClipboardAction(action) {
  const selection = window.getSelection().toString() || savedSelectionText;
  if (action === "copy" && selection) {
    await navigator.clipboard.writeText(selection);
    showToast("Seçili metin kopyalandı.");
  }
  document.getElementById("studyContextMenu").classList.add("hidden");
}

/********************************************************************
 * SEÇİLEN METNE NOT ALMA (HEM EPUB HEM ORİJİNAL PDF ÜZERİNDE ŞEFFAF ÇALIŞIR)
 ********************************************************************/
function takeNoteFromSelection() {
  document.getElementById("studyContextMenu").classList.add("hidden");

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    savedSelectionRange = sel.getRangeAt(0).cloneRange();
    savedSelectionText = sel.toString().trim();
  }

  if (!savedSelectionText || !savedSelectionRange) {
    showToast("Lütfen önce ders metni veya PDF üzerinde not almak istediğiniz kısmı fareyle seçip sağ tıklayın.");
    return;
  }

  const source = getActiveSource();
  const pageObj = source?.pages[appState.activePageIndex];

  document.getElementById("inlineNoteSelectedPreview").textContent = `"${savedSelectionText}"`;
  document.getElementById("inlineNoteTitleInput").value = `${pageObj ? pageObj.title : "Konu"} Notu`;
  document.getElementById("inlineNoteBodyInput").value = "";
  document.getElementById("inlineNoteCreateModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("inlineNoteBodyInput").focus(), 50);
}

function closeInlineNoteCreateModal() {
  document.getElementById("inlineNoteCreateModal").classList.add("hidden");
}

async function confirmSaveInlineHighlightedNote(e) {
  e.preventDefault();
  const course = getActiveCourse();
  const source = getActiveSource();
  if (!course || !source) return;

  const title = document.getElementById("inlineNoteTitleInput").value.trim();
  const body = document.getElementById("inlineNoteBodyInput").value.trim();
  const pageObj = source.pages[appState.activePageIndex];
  const pageNo = pageObj?.pageNo || 1;
  const topicTitle = pageObj?.title || source.name;
  const noteId = "note_" + Date.now();

  if (savedSelectionRange) {
    try {
      const readerEl = document.getElementById("studyReaderContent");
      const pdfSpans = Array.from(readerEl.querySelectorAll(".pdf-text-item")).filter(
        (sp) => savedSelectionRange.intersectsNode(sp)
      );

      if (pdfSpans.length > 0) {
        pdfSpans.forEach((sp) => {
          sp.classList.add("user-inline-note");
          sp.setAttribute("data-note-id", noteId);
          sp.setAttribute("title", `${title}: Notu görmek için tıklayın`);
        });
      } else {
        const span = document.createElement("span");
        span.className = "user-inline-note";
        span.setAttribute("data-note-id", noteId);
        span.setAttribute("title", `${title}: Notu görmek için tıklayın`);

        const contents = savedSelectionRange.extractContents();
        span.appendChild(contents);
        savedSelectionRange.insertNode(span);
      }
      window.getSelection().removeAllRanges();
    } catch (err) {
      console.warn("Vurgu ekleme uyarısı:", err);
    }
  }

  appState.userData.notes.unshift({
    id: noteId,
    courseId: course.id,
    sourceId: source.id,
    sourceName: source.name,
    topicTitle,
    pageNo,
    title,
    quote: savedSelectionText,
    body,
    createdAt: new Date().toLocaleString("tr-TR")
  });

  await saveCurrentUserPageEdits();
  await saveUserPersonalDataToFirebase();
  renderUserCourseNotes();
  closeInlineNoteCreateModal();
  showToast("Seçili kısım şeffaf olarak vurgulandı ve notunuz kaydedildi.");
}

function openUserInlineNotePopup(noteId) {
  const noteObj = (appState.userData.notes || []).find((n) => n.id === noteId);
  if (!noteObj) {
    showToast("Bu vurguya ait not kaydı bulunamadı.");
    return;
  }
  openPopupViewerModal(
    noteObj.title || "Kişisel Notum",
    noteObj.quote ? `"${noteObj.quote}"` : "",
    `<p>${escapeHtml(noteObj.body).replace(/\n/g, "<br/>")}</p>`,
    noteObj.id
  );
}

function openPopupViewerModal(title, quoteText, bodyHtml, deletableNoteId = null) {
  activePopupNoteId = deletableNoteId;
  document.getElementById("popupViewerTitle").innerHTML = `<i class="fa-solid fa-comment-dots"></i> ${escapeHtml(title)}`;

  const quoteEl = document.getElementById("popupViewerQuote");
  if (quoteText) {
    quoteEl.textContent = quoteText;
    quoteEl.classList.remove("hidden");
  } else {
    quoteEl.classList.add("hidden");
  }

  document.getElementById("popupViewerBody").innerHTML = bodyHtml;
  document.getElementById("popupDeleteNoteBtn").classList.toggle("hidden", !deletableNoteId);
  document.getElementById("popupViewerModal").classList.remove("hidden");
}

function closePopupViewerModal() {
  document.getElementById("popupViewerModal").classList.add("hidden");
  activePopupNoteId = null;
}

async function deleteActivePopupInlineNote() {
  if (!activePopupNoteId) return;
  const noteId = activePopupNoteId;

  const readerEl = document.getElementById("studyReaderContent");
  readerEl.querySelectorAll(`.user-inline-note[data-note-id="${noteId}"]`).forEach((el) => {
    if (el.classList.contains("pdf-text-item")) {
      el.classList.remove("user-inline-note");
      el.removeAttribute("data-note-id");
      el.removeAttribute("title");
    } else {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
  });

  appState.userData.notes = (appState.userData.notes || []).filter((n) => n.id !== noteId);
  await saveCurrentUserPageEdits();
  await saveUserPersonalDataToFirebase();
  renderUserCourseNotes();
  closePopupViewerModal();
  showToast("Not ve metin vurgusu kaldırıldı.");
}

/********************************************************************
 * KULLANICININ ÇALIŞTIĞI KONUYA MANUEL NOT EKLEMESİ
 ********************************************************************/
async function handleAddManualUserNote(e) {
  e.preventDefault();
  const course = getActiveCourse();
  const source = getActiveSource();
  if (!course) return;

  const title = document.getElementById("manualNoteTitle").value.trim();
  const body = document.getElementById("manualNoteBody").value.trim();
  const pageObj = source?.pages[appState.activePageIndex];
  const pageNo = pageObj?.pageNo || 1;
  const topicTitle = pageObj?.title || source?.name || "";

  appState.userData.notes.unshift({
    id: "note_" + Date.now(),
    courseId: course.id,
    sourceId: source?.id || "",
    sourceName: source?.name || "",
    topicTitle,
    pageNo,
    title,
    quote: "",
    body,
    createdAt: new Date().toLocaleString("tr-TR")
  });

  await saveUserPersonalDataToFirebase();
  document.getElementById("manualNoteTitle").value = "";
  document.getElementById("manualNoteBody").value = "";
  renderUserCourseNotes();
  showToast("Notunuz kişisel hesabınıza kaydedildi.");
}

function renderUserCourseNotes() {
  const listEl = document.getElementById("userCourseNotesList");
  const badgeEl = document.getElementById("userNotesCountBadge");
  const course = getActiveCourse();
  if (!course) return;

  const notes = (appState.userData.notes || []).filter((n) => n.courseId === course.id);
  badgeEl.textContent = `${notes.length} Not`;

  if (!notes.length) {
    listEl.innerHTML = `<p class="hint-text">Bu ders için henüz kayıtlı notunuz yok.</p>`;
    return;
  }

  listEl.innerHTML = notes
    .map(
      (n) => `
      <div class="note-item" onclick="openUserInlineNotePopup('${n.id}')">
        <div class="note-item-header">
          <span>${escapeHtml(n.title)} <span class="badge">${escapeHtml(n.topicTitle || n.sourceName || "")}</span></span>
          <button class="logout-btn" onclick="event.stopPropagation(); deleteUserNote('${n.id}')" title="Sil">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="note-item-body">${escapeHtml(n.body)}</div>
      </div>
    `
    )
    .join("");
}

async function deleteUserNote(noteId) {
  activePopupNoteId = noteId;
  await deleteActivePopupInlineNote();
}

/********************************************************************
 * ÜST BAR "KONU ÖZETİ" GÖRÜNÜMÜ & DİPNOTSUZ AKILLI ÖZET MOTORU
 * (Başlangıç konu başlığından önceki başlıklar bitiş listesinde görünmez)
 ********************************************************************/
let currentSummaryTocListCache = [];

function openSummaryViewFromHeader() {
  switchMainView("summary");
  populateSummaryCourseAndSourceSelectors();
}

async function populateSummaryCourseAndSourceSelectors() {
  const courseSel = document.getElementById("summaryCourseSelect");
  const sourceSel = document.getElementById("summarySourceSelect");
  const startTocSel = document.getElementById("summaryStartTocSelect");
  const endTocSel = document.getElementById("summaryEndTocSelect");
  if (!courseSel || !sourceSel || !startTocSel || !endTocSel) return;

  const visibleCourses = getOrderedEnrolledCourses();
  const coursesToUse = visibleCourses.length ? visibleCourses : appState.courses;

  if (!coursesToUse.length) {
    courseSel.innerHTML = `<option value="">Ders Yok</option>`;
    sourceSel.innerHTML = `<option value="">Kaynak Yok</option>`;
    startTocSel.innerHTML = `<option value="">Konu Yok</option>`;
    endTocSel.innerHTML = `<option value="">Konu Yok</option>`;
    return;
  }

  const targetCourseId =
    appState.activeCourseId && coursesToUse.some((c) => c.id === appState.activeCourseId)
      ? appState.activeCourseId
      : coursesToUse[0].id;

  courseSel.innerHTML = coursesToUse
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");
  courseSel.value = targetCourseId;

  await handleSummaryCourseChange(appState.activeSourceId);
}

async function handleSummaryCourseChange(preferredSourceId = null) {
  const courseId = document.getElementById("summaryCourseSelect")?.value;
  const sourceSel = document.getElementById("summarySourceSelect");
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course || !sourceSel) return;

  const sources = getFilteredSourcesForCourse(course);
  if (!sources.length) {
    sourceSel.innerHTML = `<option value="">Kaynak Yok</option>`;
    document.getElementById("summaryStartTocSelect").innerHTML = `<option value="">Konu Yok</option>`;
    document.getElementById("summaryEndTocSelect").innerHTML = `<option value="">Konu Yok</option>`;
    return;
  }

  sourceSel.innerHTML = sources
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");

  if (preferredSourceId && sources.some((s) => s.id === preferredSourceId)) {
    sourceSel.value = preferredSourceId;
  } else {
    sourceSel.selectedIndex = 0;
  }

  await handleSummarySourceChange();
}

async function handleSummarySourceChange() {
  const courseId = document.getElementById("summaryCourseSelect")?.value;
  const sourceId = document.getElementById("summarySourceSelect")?.value;
  const startSel = document.getElementById("summaryStartTocSelect");
  const endSel = document.getElementById("summaryEndTocSelect");

  const course = appState.courses.find((c) => c.id === courseId);
  const source = course?.sources?.find((s) => s.id === sourceId);
  if (!course || !source || !startSel || !endSel) return;

  if (!source.pagesLoaded) {
    await ensureSourcePagesLoadedFromDerslerFolder(course.id, source);
  }

  currentSummaryTocListCache =
    source.toc && source.toc.length
      ? source.toc
      : (source.pages || []).map((p) => ({
          title: p.title || `Konu ${p.pageNo}`,
          pageNo: p.pageNo,
          level: 1
        }));

  startSel.innerHTML = currentSummaryTocListCache
    .map((item, idx) => {
      const indent = "— ".repeat(Math.max(0, (item.level || 1) - 1));
      return `<option value="${idx}">${indent}${escapeHtml(item.title)}</option>`;
    })
    .join("");

  startSel.selectedIndex = 0;
  rebuildSummaryEndTocOptions(true);
}

function rebuildSummaryEndTocOptions(selectLastByDefault = false) {
  const startSel = document.getElementById("summaryStartTocSelect");
  const endSel = document.getElementById("summaryEndTocSelect");
  if (!startSel || !endSel) return;

  const startIdx = Number(startSel.value) || 0;
  const prevEndIdx = Number(endSel.value);

  const filteredOptions = [];
  currentSummaryTocListCache.forEach((item, idx) => {
    if (idx >= startIdx) {
      const indent = "— ".repeat(Math.max(0, (item.level || 1) - 1));
      filteredOptions.push(`<option value="${idx}">${indent}${escapeHtml(item.title)}</option>`);
    }
  });

  endSel.innerHTML = filteredOptions.join("");

  if (!selectLastByDefault && !isNaN(prevEndIdx) && prevEndIdx >= startIdx) {
    endSel.value = String(prevEndIdx);
  } else if (endSel.options.length > 0) {
    endSel.selectedIndex = endSel.options.length - 1;
  }
}

function handleSummaryStartTocChange() {
  rebuildSummaryEndTocOptions(false);
}

async function generateSummaryFromSummaryView() {
  const courseId = document.getElementById("summaryCourseSelect")?.value;
  const sourceId = document.getElementById("summarySourceSelect")?.value;
  const course = appState.courses.find((c) => c.id === courseId);
  const source = course?.sources?.find((s) => s.id === sourceId);

  if (!course || !source) {
    showToast("Özet çıkarmak için geçerli bir ders ve kaynak seçin.");
    return;
  }

  if (!source.pagesLoaded) {
    await ensureSourcePagesLoadedFromDerslerFolder(course.id, source);
  }

  const tocList =
    source.toc && source.toc.length
      ? source.toc
      : (source.pages || []).map((p) => ({
          title: p.title || `Konu ${p.pageNo}`,
          pageNo: p.pageNo,
          level: 1
        }));

  let startIdx = Number(document.getElementById("summaryStartTocSelect")?.value) || 0;
  let endIdx = Number(document.getElementById("summaryEndTocSelect")?.value);
  if (isNaN(endIdx) || endIdx < startIdx) endIdx = startIdx;

  const selectedTocSlice = tocList.slice(startIdx, endIdx + 1);
  const startPageNo = selectedTocSlice[0]?.pageNo || 1;
  const endPageNo = selectedTocSlice[selectedTocSlice.length - 1]?.pageNo || startPageNo;
  const minPage = Math.min(startPageNo, endPageNo);
  const maxPage = Math.max(startPageNo, endPageNo);

  let pages = (source.pages || []).filter((p) => p.pageNo >= minPage && p.pageNo <= maxPage);
  if (!pages.length && source.pages?.length) {
    pages = source.pages;
  }

  if (!pages.length) {
    showToast("Seçilen konularda özet çıkarılacak içerik bulunamadı.");
    return;
  }

  const firstTitle = selectedTocSlice[0]?.title || source.name;
  const lastTitle = selectedTocSlice[selectedTocSlice.length - 1]?.title || firstTitle;
  const rangeLabel =
    firstTitle === lastTitle ? firstTitle : `${firstTitle} — ${lastTitle}`;

  buildAndDisplaySummaryForPages(pages, `${source.name} • ${rangeLabel}`);
}

function extractCleanTextWithoutFootnotes(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent || "", "text/html");

  doc
    .querySelectorAll(
      "sup, sub, aside, [epub\\:type='footnote'], [epub\\:type='rearnote'], [role='doc-footnote'], [role='doc-endnote'], .footnote, .footnotes, .dipnot, .endnote, a[href*='fn'], a[href*='note'], a[href*='dipnot'], [id^='fn'], [id*='footnote'], [id*='dipnot']"
    )
    .forEach((el) => el.remove());

  let text = "";
  const pdfItems = doc.querySelectorAll(".pdf-text-item");
  if (pdfItems.length > 0) {
    text = Array.from(pdfItems)
      .map((sp) => (sp.textContent || "").trim())
      .filter(Boolean)
      .join(" ");
  } else {
    text = doc.body ? doc.body.innerText || doc.body.textContent || "" : "";
  }

  text = text
    .replace(/-\s+/g, "")
    .replace(/\[\s*\d+\s*\]/g, "")
    .replace(/\(\s*\d+\s*\)/g, "")
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, "")
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ.,;!?])\d{1,3}(?=\s|$|[.,;!?])/g, "$1")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function splitTextIntoMeaningfulSentences(cleanText) {
  if (!cleanText) return [];

  let sentences = cleanText
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && !/^\d+$/.test(s));

  const refined = [];
  sentences.forEach((s) => {
    if (s.length <= 280) {
      refined.push(s);
    } else {
      const subParts = s.split(/(?<=[;:])\s+|,\s+(?=[A-ZÇĞİÖŞÜ])/);
      let acc = "";
      subParts.forEach((part) => {
        if ((acc + " " + part).trim().length <= 240) {
          acc = (acc + " " + part).trim();
        } else {
          if (acc.length >= 25) refined.push(acc);
          acc = part.trim();
        }
      });
      if (acc.length >= 25) refined.push(acc);
    }
  });

  if (refined.length < 3) {
    const words = cleanText.split(/\s+/).filter(Boolean);
    const chunkSize = 18;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ").trim();
      if (chunk.length >= 25) {
        refined.push(chunk + (/[.!?]$/.test(chunk) ? "" : "."));
      }
    }
  }

  return refined;
}

function buildAndDisplaySummaryForPages(pages, badgeLabel) {
  const summaryBlocks = [];

  pages.forEach((p) => {
    const cleanText = extractCleanTextWithoutFootnotes(p.htmlContent);
    if (!cleanText || cleanText.length < 20) return;

    const rawSentences = splitTextIntoMeaningfulSentences(cleanText);
    if (!rawSentences.length) return;

    const wordFreq = {};
    rawSentences.forEach((sent) => {
      const words = sent
        .toLowerCase()
        .replace(/[^a-zçğıöşü0-9\s]/gi, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !TURKISH_STOP_WORDS.has(w));
      words.forEach((w) => {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      });
    });

    const scored = rawSentences.map((sent, idx) => {
      const words = sent
        .toLowerCase()
        .replace(/[^a-zçğıöşü0-9\s]/gi, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !TURKISH_STOP_WORDS.has(w));

      let score = words.reduce((acc, w) => acc + (wordFreq[w] || 0), 0) / Math.max(1, words.length);

      if (idx === 0) score *= 1.25;
      if (/demektir|ibarettir|denir|şöyledir|önemli|esas|gerekir|şarttır|bölüm/i.test(sent)) {
        score *= 1.3;
      }
      return { sent, idx, score };
    });

    const topCount = Math.min(6, Math.max(3, Math.ceil(rawSentences.length / 4)));
    const selectedSentences = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topCount)
      .sort((a, b) => a.idx - b.idx)
      .map((item) => item.sent);

    const bulletsHtml = selectedSentences
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join("");

    summaryBlocks.push(`
      <div class="summary-section-block">
        <div class="summary-section-title">
          <i class="fa-solid fa-bookmark"></i> ${escapeHtml(p.title)}
        </div>
        <ul class="summary-bullet-list">
          ${bulletsHtml}
        </ul>
      </div>
    `);
  });

  if (!summaryBlocks.length) {
    showToast("Seçilen konularda özet çıkarılacak yeterli metin bulunamadı.");
    return;
  }

  appState.lastGeneratedSummary = summaryBlocks.join("");
  document.getElementById("summaryRangeBadge").textContent = badgeLabel;
  document.getElementById("summaryResultContent").innerHTML = appState.lastGeneratedSummary;
  showToast("Konu özeti başarıyla hazırlandı.");
}

async function saveSummaryToUserNotes() {
  const courseId = document.getElementById("summaryCourseSelect")?.value || appState.activeCourseId;
  const sourceId = document.getElementById("summarySourceSelect")?.value || appState.activeSourceId;
  const course = appState.courses.find((c) => c.id === courseId) || getActiveCourse();
  const source = course?.sources?.find((s) => s.id === sourceId) || getActiveSource();

  if (!course || !appState.lastGeneratedSummary) {
    showToast("Kaydedilecek özet bulunamadı. Önce özet çıkarın.");
    return;
  }
  const rangeText = document.getElementById("summaryRangeBadge").textContent;

  appState.userData.notes.unshift({
    id: "note_" + Date.now(),
    courseId: course.id,
    sourceId: source?.id || "",
    sourceName: source?.name || "",
    topicTitle: rangeText,
    pageNo: 1,
    title: `Özet (${rangeText})`,
    quote: "",
    body: stripHtml(appState.lastGeneratedSummary),
    createdAt: new Date().toLocaleString("tr-TR")
  });

  await saveUserPersonalDataToFirebase();
  renderUserCourseNotes();
  showToast("Özet konu notlarınıza kaydedildi.");
}

/********************************************************************
 * SINAV SAYFASI: İÇİNDEKİLER KONU BAŞLIĞI SEÇİCİLERİ
 * (Başlangıç konu başlığından önceki başlıklar bitiş listesinde gizlenir)
 ********************************************************************/
let currentExamTocListCache = [];

async function populateExamCourseAndSourceSelectors() {
  const courseSel = document.getElementById("examCourseSelect");
  const sourceSel = document.getElementById("examSourceSelect");
  const startTocSel = document.getElementById("startTocSelect");
  const endTocSel = document.getElementById("endTocSelect");
  if (!courseSel || !sourceSel || !startTocSel || !endTocSel) return;

  const visibleCourses = getOrderedEnrolledCourses();
  const coursesToUse = visibleCourses.length ? visibleCourses : appState.courses;

  if (!coursesToUse.length) {
    courseSel.innerHTML = `<option value="">Ders Yok</option>`;
    sourceSel.innerHTML = `<option value="">Kaynak Yok</option>`;
    startTocSel.innerHTML = `<option value="">Konu Yok</option>`;
    endTocSel.innerHTML = `<option value="">Konu Yok</option>`;
    return;
  }

  const targetCourseId =
    appState.activeCourseId && coursesToUse.some((c) => c.id === appState.activeCourseId)
      ? appState.activeCourseId
      : coursesToUse[0].id;

  courseSel.innerHTML = coursesToUse
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");
  courseSel.value = targetCourseId;

  await handleExamCourseChange(appState.activeSourceId);
}

async function handleExamCourseChange(preferredSourceId = null) {
  const courseId = document.getElementById("examCourseSelect")?.value;
  const sourceSel = document.getElementById("examSourceSelect");
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course || !sourceSel) return;

  const sources = getFilteredSourcesForCourse(course);
  if (!sources.length) {
    sourceSel.innerHTML = `<option value="">Kaynak Yok</option>`;
    document.getElementById("startTocSelect").innerHTML = `<option value="">Konu Yok</option>`;
    document.getElementById("endTocSelect").innerHTML = `<option value="">Konu Yok</option>`;
    renderTeacherQuestionsTab();
    return;
  }

  sourceSel.innerHTML = sources
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join("");

  if (preferredSourceId && sources.some((s) => s.id === preferredSourceId)) {
    sourceSel.value = preferredSourceId;
  } else {
    sourceSel.selectedIndex = 0;
  }

  await handleExamSourceChange();
  renderTeacherQuestionsTab();
}

async function handleExamSourceChange() {
  const courseId = document.getElementById("examCourseSelect")?.value;
  const sourceId = document.getElementById("examSourceSelect")?.value;
  const startSel = document.getElementById("startTocSelect");
  const endSel = document.getElementById("endTocSelect");

  const course = appState.courses.find((c) => c.id === courseId);
  const source = course?.sources?.find((s) => s.id === sourceId);
  if (!course || !source || !startSel || !endSel) return;

  if (!source.pagesLoaded) {
    await ensureSourcePagesLoadedFromDerslerFolder(course.id, source);
  }

  currentExamTocListCache =
    source.toc && source.toc.length
      ? source.toc
      : (source.pages || []).map((p) => ({
          title: p.title || `Konu ${p.pageNo}`,
          pageNo: p.pageNo,
          level: 1
        }));

  startSel.innerHTML = currentExamTocListCache
    .map((item, idx) => {
      const indent = "— ".repeat(Math.max(0, (item.level || 1) - 1));
      return `<option value="${idx}">${indent}${escapeHtml(item.title)}</option>`;
    })
    .join("");

  startSel.selectedIndex = 0;
  rebuildExamEndTocOptions(true);
}

function rebuildExamEndTocOptions(selectLastByDefault = false) {
  const startSel = document.getElementById("startTocSelect");
  const endSel = document.getElementById("endTocSelect");
  if (!startSel || !endSel) return;

  const startIdx = Number(startSel.value) || 0;
  const prevEndIdx = Number(endSel.value);

  const filteredOptions = [];
  currentExamTocListCache.forEach((item, idx) => {
    if (idx >= startIdx) {
      const indent = "— ".repeat(Math.max(0, (item.level || 1) - 1));
      filteredOptions.push(`<option value="${idx}">${indent}${escapeHtml(item.title)}</option>`);
    }
  });

  endSel.innerHTML = filteredOptions.join("");

  if (!selectLastByDefault && !isNaN(prevEndIdx) && prevEndIdx >= startIdx) {
    endSel.value = String(prevEndIdx);
  } else if (endSel.options.length > 0) {
    endSel.selectedIndex = endSel.options.length - 1;
  }
}

function handleExamStartTocChange() {
  rebuildExamEndTocOptions(false);
}

async function getSelectedExamTopicsAndPages() {
  const courseId = document.getElementById("examCourseSelect")?.value || appState.activeCourseId;
  const sourceId = document.getElementById("examSourceSelect")?.value || appState.activeSourceId;
  const course = appState.courses.find((c) => c.id === courseId) || getActiveCourse();
  const source =
    course?.sources?.find((s) => s.id === sourceId) ||
    getActiveSource() ||
    course?.sources?.[0];

  if (!course || !source) {
    return { course: null, source: null, pages: [], selectedTopicTitles: [], rangeLabel: "" };
  }

  if (!source.pagesLoaded) {
    await ensureSourcePagesLoadedFromDerslerFolder(course.id, source);
  }

  const tocList =
    source.toc && source.toc.length
      ? source.toc
      : (source.pages || []).map((p) => ({
          title: p.title || `Konu ${p.pageNo}`,
          pageNo: p.pageNo,
          level: 1
        }));

  let startIdx = Number(document.getElementById("startTocSelect")?.value) || 0;
  let endIdx = Number(document.getElementById("endTocSelect")?.value);
  if (isNaN(endIdx) || endIdx < startIdx) endIdx = startIdx;

  const selectedTocSlice = tocList.slice(startIdx, endIdx + 1);
  const selectedTopicTitles = selectedTocSlice.map((t) => t.title);

  const startPageNo = selectedTocSlice[0]?.pageNo || 1;
  const endPageNo = selectedTocSlice[selectedTocSlice.length - 1]?.pageNo || startPageNo;
  const minPage = Math.min(startPageNo, endPageNo);
  const maxPage = Math.max(startPageNo, endPageNo);

  let pages = (source.pages || []).filter((p) => p.pageNo >= minPage && p.pageNo <= maxPage);
  if (!pages.length && source.pages?.length) {
    pages = source.pages;
  }

  const firstTitle = selectedTocSlice[0]?.title || source.name;
  const lastTitle = selectedTocSlice[selectedTocSlice.length - 1]?.title || firstTitle;
  const rangeLabel =
    firstTitle === lastTitle ? firstTitle : `${firstTitle} — ${lastTitle}`;

  return { course, source, pages, selectedTopicTitles, rangeLabel };
}

function switchExamSubTab(mode) {
  const isMcq = mode === "mcq";
  const isInst = mode === "instructional";
  const isTeacher = mode === "teacher";

  document.getElementById("examTabMcqBtn").classList.toggle("active", isMcq);
  document.getElementById("examTabInstBtn").classList.toggle("active", isInst);
  document.getElementById("examTabTeacherBtn").classList.toggle("active", isTeacher);

  document.getElementById("mcqExamSection").classList.toggle("hidden", !isMcq);
  document.getElementById("instructionalExamSection").classList.toggle("hidden", !isInst);
  document.getElementById("teacherExamSection").classList.toggle("hidden", !isTeacher);

  if (isTeacher) {
    renderTeacherQuestionsTab();
  }
}

function openTeacherQuestionsTabFromRange() {
  switchMainView("exams");
  switchExamSubTab("teacher");
}

/********************************************************************
 * DERS HOCASININ HAZIRLADIĞI SORULAR (AYRI GRUPLAR, ÇOKTAN SEÇMELİ,
 * BOŞLUK DOLDURMA, DOĞRU/YANLIŞ, KLASİK SORU VE TÜM CEVAPLARI GÖSTER/GİZLE)
 ********************************************************************/
function renderTeacherQuestionsTab() {
  const courseId = document.getElementById("examCourseSelect")?.value || appState.activeCourseId;
  const course = appState.courses.find((c) => c.id === courseId) || getActiveCourse();
  const selectorBar = document.getElementById("teacherSetsSelectorBar");
  const emptyEl = document.getElementById("teacherEmptyState");
  const containerEl = document.getElementById("activeTeacherQuizContainer");

  if (!course || !selectorBar) return;

  const allQuestions = course.questions || [];
  if (!allQuestions.length) {
    selectorBar.innerHTML = "";
    emptyEl.classList.remove("hidden");
    containerEl.classList.add("hidden");
    return;
  }

  const groupsMap = {};
  allQuestions.forEach((q) => {
    const gName = q.groupName || "Genel Sorular";
    if (!groupsMap[gName]) groupsMap[gName] = [];
    groupsMap[gName].push(q);
  });

  const groupNames = Object.keys(groupsMap);
  if (!groupNames.length) {
    selectorBar.innerHTML = "";
    emptyEl.classList.remove("hidden");
    containerEl.classList.add("hidden");
    return;
  }

  if (
    !appState.activeTeacherQuiz ||
    !groupNames.includes(appState.activeTeacherQuiz.groupName) ||
    appState.activeTeacherQuiz.courseId !== course.id
  ) {
    const firstGroup = groupNames[0];
    appState.activeTeacherQuiz = {
      courseId: course.id,
      courseName: course.name,
      groupName: firstGroup,
      questions: groupsMap[firstGroup],
      userAnswers: {},
      answersRevealed: false,
      submitted: false
    };
  } else {
    appState.activeTeacherQuiz.questions = groupsMap[appState.activeTeacherQuiz.groupName] || [];
  }

  const activeGName = appState.activeTeacherQuiz.groupName;

  selectorBar.innerHTML = groupNames
    .map((gName) => {
      const isActive = gName === activeGName ? "active" : "";
      const qCount = groupsMap[gName].length;
      return `
        <button type="button" class="teacher-set-chip ${isActive}" onclick="selectTeacherQuestionGroup('${escapeHtml(gName)}')">
          <i class="fa-solid fa-layer-group"></i> ${escapeHtml(gName)} (${qCount} Soru)
        </button>
      `;
    })
    .join("");

  renderActiveTeacherQuiz();
}

function selectTeacherQuestionGroup(groupName) {
  const courseId = document.getElementById("examCourseSelect")?.value || appState.activeCourseId;
  const course = appState.courses.find((c) => c.id === courseId) || getActiveCourse();
  if (!course) return;

  const groupQuestions = (course.questions || []).filter(
    (q) => (q.groupName || "Genel Sorular") === groupName
  );

  appState.activeTeacherQuiz = {
    courseId: course.id,
    courseName: course.name,
    groupName,
    questions: groupQuestions,
    userAnswers: {},
    answersRevealed: false,
    submitted: false
  };

  renderTeacherQuestionsTab();
}

function renderActiveTeacherQuiz() {
  const tQuiz = appState.activeTeacherQuiz;
  const emptyEl = document.getElementById("teacherEmptyState");
  const containerEl = document.getElementById("activeTeacherQuizContainer");
  const listEl = document.getElementById("teacherQuestionsList");
  const badgeEl = document.getElementById("activeTeacherSetBadge");
  const toggleBtn = document.getElementById("toggleAllTeacherAnswersBtn");

  if (!tQuiz || !tQuiz.questions.length) {
    emptyEl.classList.remove("hidden");
    containerEl.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  containerEl.classList.remove("hidden");
  badgeEl.textContent = tQuiz.groupName;
  document.getElementById("teacherQuizStatsText").textContent = `${tQuiz.groupName} — Toplam ${tQuiz.questions.length} Soru`;

  if (toggleBtn) {
    toggleBtn.innerHTML = tQuiz.answersRevealed
      ? `<i class="fa-solid fa-eye-slash"></i> Tüm Cevapları Gizle`
      : `<i class="fa-solid fa-eye"></i> Tüm Cevapları Göster`;
  }

  const letters = ["A", "B", "C", "D", "E"];
  listEl.innerHTML = tQuiz.questions
    .map((q, qIdx) => {
      const qType = q.questionType || "mcq";
      const userAns = tQuiz.userAnswers[qIdx];
      let inputHtml = "";

      if (qType === "mcq") {
        const opts = q.options || [];
        const optsHtml = opts
          .map((optText, oIdx) => {
            let cls = "quiz-opt-btn";
            if (userAns === oIdx) cls += " selected";
            if (tQuiz.submitted || tQuiz.answersRevealed) {
              if (oIdx === q.correctIndex) cls += " correct";
              else if (userAns === oIdx && userAns !== q.correctIndex) cls += " wrong";
            }
            return `
              <button type="button" class="${cls}" onclick="selectTeacherQuizOption(${qIdx}, ${oIdx})">
                <strong>${letters[oIdx]})</strong> ${escapeHtml(optText)}
              </button>
            `;
          })
          .join("");
        inputHtml = `<div>${optsHtml}</div>`;
      } else if (qType === "fill") {
        const isCorrect =
          tQuiz.submitted || tQuiz.answersRevealed
            ? String(userAns || "").trim().toLowerCase() === String(q.correctText || "").trim().toLowerCase()
            : false;
        const correctnessCls = tQuiz.submitted || tQuiz.answersRevealed ? (isCorrect ? "correct" : "wrong") : "";

        inputHtml = `
          <div class="form-group mt-8">
            <input type="text" class="form-input ${correctnessCls}" value="${escapeHtml(userAns || "")}" placeholder="Boşluğa gelecek cevabı yazın..." oninput="inputTeacherFillAnswer(${qIdx}, this.value)" />
            ${
              tQuiz.submitted || tQuiz.answersRevealed
                ? `<div class="inst-answer-box"><strong>Doğru Cevap:</strong> ${escapeHtml(q.correctText)}</div>`
                : ""
            }
          </div>
        `;
      } else if (qType === "tf") {
        const tfOptions = ["Doğru", "Yanlış"];
        const tfOptsHtml = tfOptions
          .map((tfVal) => {
            let cls = "quiz-opt-btn";
            if (userAns === tfVal) cls += " selected";
            if (tQuiz.submitted || tQuiz.answersRevealed) {
              if (tfVal === q.correctText) cls += " correct";
              else if (userAns === tfVal && userAns !== q.correctText) cls += " wrong";
            }
            return `
              <button type="button" class="${cls}" onclick="selectTeacherTfOption(${qIdx}, '${tfVal}')">
                <i class="fa-solid ${tfVal === "Doğru" ? "fa-check" : "fa-xmark"}"></i> ${tfVal}
              </button>
            `;
          })
          .join("");
        inputHtml = `<div>${tfOptsHtml}</div>`;
      } else if (qType === "classic") {
        inputHtml = `
          <div class="form-group mt-8">
            <textarea rows="3" class="form-input" placeholder="Klasik soru cevabınızı buraya yazabilirsiniz..." oninput="inputTeacherFillAnswer(${qIdx}, this.value)">${escapeHtml(userAns || "")}</textarea>
            ${
              tQuiz.submitted || tQuiz.answersRevealed
                ? `<div class="inst-answer-box"><strong><i class="fa-solid fa-check-circle" style="color:var(--success)"></i> Hocanın Cevabı / Çözümü:</strong><p class="mt-4">${escapeHtml(q.correctText || q.options?.[0] || "")}</p></div>`
                : ""
            }
          </div>
        `;
      }

      const typeLabelMap = {
        mcq: "Çoktan Seçmeli",
        fill: "Boşluk Doldurma",
        tf: "Doğru / Yanlış",
        classic: "Klasik Soru"
      };

      return `
        <div class="quiz-q-card">
          <div class="quiz-q-title">
            ${qIdx + 1}. ${escapeHtml(q.question).replace(/\n/g, "<br/>")}
            <span class="badge">${escapeHtml(typeLabelMap[qType] || "Soru")}</span>
            <span class="badge">${escapeHtml(q.topicTitle || q.sourceName || "Genel")}</span>
          </div>
          ${inputHtml}
        </div>
      `;
    })
    .join("");
}

function selectTeacherQuizOption(qIdx, oIdx) {
  if (!appState.activeTeacherQuiz || appState.activeTeacherQuiz.submitted) return;
  appState.activeTeacherQuiz.userAnswers[qIdx] = oIdx;
  renderActiveTeacherQuiz();
}

function inputTeacherFillAnswer(qIdx, val) {
  if (!appState.activeTeacherQuiz || appState.activeTeacherQuiz.submitted) return;
  appState.activeTeacherQuiz.userAnswers[qIdx] = val;
}

function selectTeacherTfOption(qIdx, tfVal) {
  if (!appState.activeTeacherQuiz || appState.activeTeacherQuiz.submitted) return;
  appState.activeTeacherQuiz.userAnswers[qIdx] = tfVal;
  renderActiveTeacherQuiz();
}

function toggleAllTeacherQuizAnswers() {
  const tQuiz = appState.activeTeacherQuiz;
  if (!tQuiz) return;
  tQuiz.answersRevealed = !tQuiz.answersRevealed;
  renderActiveTeacherQuiz();
}

async function submitActiveTeacherQuiz() {
  const tQuiz = appState.activeTeacherQuiz;
  if (!tQuiz || tQuiz.submitted) return;

  let correct = 0;
  tQuiz.questions.forEach((q, idx) => {
    const userAns = tQuiz.userAnswers[idx];
    const qType = q.questionType || "mcq";

    if (qType === "mcq") {
      if (userAns === q.correctIndex) correct++;
    } else if (qType === "fill" || qType === "tf") {
      if (String(userAns || "").trim().toLowerCase() === String(q.correctText || "").trim().toLowerCase()) {
        correct++;
      }
    } else if (qType === "classic") {
      if (String(userAns || "").trim().length > 2) {
        correct++;
      }
    }
  });

  const total = tQuiz.questions.length;
  const score = Math.round((correct / total) * 100);
  tQuiz.submitted = true;
  tQuiz.answersRevealed = true;

  appState.userData.examHistory.unshift({
    id: "ex_" + Date.now(),
    courseId: tQuiz.courseId,
    courseName: `${tQuiz.courseName} (${tQuiz.groupName})`,
    rangeText: "Hoca Soru Grubu",
    score,
    correct,
    total,
    date: new Date().toLocaleString("tr-TR")
  });

  await saveUserPersonalDataToFirebase();
  renderActiveTeacherQuiz();
  renderExamHistoryList();
  populateProfileForm();
  showToast(`Soru grubu tamamlandı! Puanınız: ${score} / 100 (${correct}/${total} Doğru)`);
}

/********************************************************************
 * ADMİN PANELİ: HOCA SORULARINI EKLEME, TÜM SORULARI GÖRME VE DÜZENLEME
 ********************************************************************/
function handleAdminQuestionTypeChange() {
  const typeVal = document.getElementById("adminQTypeSelect")?.value || "mcq";
  document.getElementById("adminMcqOptionsBox")?.classList.toggle("hidden", typeVal !== "mcq");
  document.getElementById("adminFillOptionsBox")?.classList.toggle("hidden", typeVal !== "fill");
  document.getElementById("adminTfOptionsBox")?.classList.toggle("hidden", typeVal !== "tf");
  document.getElementById("adminClassicOptionsBox")?.classList.toggle("hidden", typeVal !== "classic");
}

function handleAdminQuestionSetSelectChange() {
  const setVal = document.getElementById("adminQSetSelect")?.value;
  const newSetGroup = document.getElementById("adminNewQSetGroup");
  if (newSetGroup) {
    newSetGroup.classList.toggle("hidden", setVal !== "__new__");
  }
}

function renderAdminTeacherSetsList() {
  const setSelect = document.getElementById("adminQSetSelect");
  const filterSelect = document.getElementById("adminFilterQSetSelect");
  if (!setSelect) return;

  const course = appState.courses.find((c) => c.id === appState.adminSelectedCourseId);
  const questions = course?.questions || [];

  const groupsMap = {};
  questions.forEach((q) => {
    const gName = q.groupName || "Genel Sorular";
    if (!groupsMap[gName]) groupsMap[gName] = 0;
    groupsMap[gName]++;
  });

  const groupNames = Object.keys(groupsMap);

  const prevSetVal = setSelect.value;
  setSelect.innerHTML =
    (groupNames.length
      ? groupNames
          .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)} (${groupsMap[g]} Soru)</option>`)
          .join("")
      : `<option value="1. Grup Sorular">1. Grup Sorular</option>`) +
    `<option value="__new__">+ Yeni Soru Grubu Oluştur</option>`;

  if (prevSetVal && (groupNames.includes(prevSetVal) || prevSetVal === "__new__")) {
    setSelect.value = prevSetVal;
  }

  handleAdminQuestionSetSelectChange();

  if (filterSelect) {
    const prevFilter = filterSelect.value;
    filterSelect.innerHTML =
      `<option value="__all__">Tüm Soru Grupları (${questions.length} Soru)</option>` +
      groupNames
        .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)} (${groupsMap[g]} Soru)</option>`)
        .join("");
    if (prevFilter && (prevFilter === "__all__" || groupNames.includes(prevFilter))) {
      filterSelect.value = prevFilter;
    }
  }

  renderAdminAllQuestionsList();
}

function renderAdminAllQuestionsList() {
  const listEl = document.getElementById("adminTeacherSetsList");
  const filterSelect = document.getElementById("adminFilterQSetSelect");
  if (!listEl) return;

  const course = appState.courses.find((c) => c.id === appState.adminSelectedCourseId);
  const allQuestions = course?.questions || [];
  if (!allQuestions.length) {
    listEl.innerHTML = `<p class="hint-text">Bu derse henüz soru eklenmemiş.</p>`;
    return;
  }

  const filterVal = filterSelect?.value || "__all__";
  const filteredQuestions =
    filterVal === "__all__"
      ? allQuestions
      : allQuestions.filter((q) => (q.groupName || "Genel Sorular") === filterVal);

  const typeLabelMap = {
    mcq: "Çoktan Seçmeli",
    fill: "Boşluk Doldurma",
    tf: "Doğru / Yanlış",
    classic: "Klasik Soru"
  };
  const letters = ["A", "B", "C", "D", "E"];

  listEl.innerHTML = filteredQuestions
    .map((q, idx) => {
      const qType = q.questionType || "mcq";
      let answerPreview = "";

      if (qType === "mcq") {
        const optsText = (q.options || [])
          .map((opt, oIdx) => `${letters[oIdx]}) ${opt}${oIdx === q.correctIndex ? " ✓" : ""}`)
          .join(" | ");
        answerPreview = `<div class="hint-text">${escapeHtml(optsText)}</div>`;
      } else {
        answerPreview = `<div class="hint-text"><strong>Cevap:</strong> ${escapeHtml(q.correctText || q.options?.[0] || "")}</div>`;
      }

      return `
        <div class="admin-q-manage-card">
          <div class="admin-q-manage-top">
            <div>
              <div class="admin-q-manage-meta mb-12">
                <span class="badge">${escapeHtml(q.groupName || "Genel Sorular")}</span>
                <span class="badge">${escapeHtml(typeLabelMap[qType] || "Soru")}</span>
                <span class="hint-text">${escapeHtml(q.topicTitle || "Genel")}</span>
              </div>
              <div style="font-weight:700;font-size:0.9rem;">${idx + 1}. ${escapeHtml(q.question)}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button type="button" class="btn-secondary btn-sm" onclick="openEditTeacherQuestionModal('${course.id}', '${q.id}')">
                <i class="fa-solid fa-pen"></i> Düzenle
              </button>
              <button type="button" class="btn-danger-sm" onclick="deleteAdminTeacherQuestion('${course.id}', '${q.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
          ${answerPreview}
        </div>
      `;
    })
    .join("");
}

function openEditTeacherQuestionModal(courseId, questionId) {
  const course = appState.courses.find((c) => c.id === courseId);
  const q = (course?.questions || []).find((item) => item.id === questionId);
  if (!course || !q) return;

  editingQuestionTarget = { courseId, questionId };

  document.getElementById("editQGroupName").value = q.groupName || "Genel Sorular";
  document.getElementById("editQTopicTitle").value = q.topicTitle || "Genel";
  document.getElementById("editQTypeSelect").value = q.questionType || "mcq";
  document.getElementById("editQText").value = q.question || "";

  const opts = q.options || [];
  document.getElementById("editQOpt0").value = opts[0] || "";
  document.getElementById("editQOpt1").value = opts[1] || "";
  document.getElementById("editQOpt2").value = opts[2] || "";
  document.getElementById("editQOpt3").value = opts[3] || "";
  document.getElementById("editQOpt4").value = opts[4] || "";
  document.getElementById("editQCorrectIndex").value = String(q.correctIndex || 0);

  document.getElementById("editQFillAnswer").value = q.correctText || opts[0] || "";
  document.getElementById("editQTfAnswer").value = q.correctText === "Yanlış" ? "Yanlış" : "Doğru";
  document.getElementById("editQClassicAnswer").value = q.correctText || opts[0] || "";

  handleEditQuestionTypeChange();
  document.getElementById("editTeacherQuestionModal").classList.remove("hidden");
}

function closeEditTeacherQuestionModal() {
  document.getElementById("editTeacherQuestionModal").classList.add("hidden");
}

function handleEditQuestionTypeChange() {
  const typeVal = document.getElementById("editQTypeSelect")?.value || "mcq";
  document.getElementById("editMcqOptionsBox")?.classList.toggle("hidden", typeVal !== "mcq");
  document.getElementById("editFillOptionsBox")?.classList.toggle("hidden", typeVal !== "fill");
  document.getElementById("editTfOptionsBox")?.classList.toggle("hidden", typeVal !== "tf");
  document.getElementById("editClassicOptionsBox")?.classList.toggle("hidden", typeVal !== "classic");
}

async function handleSaveEditedTeacherQuestion(e) {
  e.preventDefault();
  const { courseId, questionId } = editingQuestionTarget;
  const course = appState.courses.find((c) => c.id === courseId);
  const q = (course?.questions || []).find((item) => item.id === questionId);
  if (!course || !q) return;

  const qType = document.getElementById("editQTypeSelect").value || "mcq";
  q.groupName = document.getElementById("editQGroupName").value.trim() || "Genel Sorular";
  q.topicTitle = document.getElementById("editQTopicTitle").value.trim() || "Genel";
  q.questionType = qType;
  q.question = document.getElementById("editQText").value.trim();

  if (qType === "mcq") {
    const opts = [
      document.getElementById("editQOpt0").value.trim(),
      document.getElementById("editQOpt1").value.trim(),
      document.getElementById("editQOpt2").value.trim(),
      document.getElementById("editQOpt3").value.trim(),
      document.getElementById("editQOpt4").value.trim()
    ].filter(Boolean);

    if (opts.length < 2) {
      showToast("Çoktan seçmeli soru için en az 2 şık bulunmalıdır.");
      return;
    }
    q.options = opts;
    q.correctIndex = Math.min(opts.length - 1, Number(document.getElementById("editQCorrectIndex").value) || 0);
    q.correctText = "";
  } else if (qType === "fill") {
    q.correctText = document.getElementById("editQFillAnswer").value.trim();
    q.options = [q.correctText];
    q.correctIndex = 0;
  } else if (qType === "tf") {
    q.correctText = document.getElementById("editQTfAnswer").value;
    q.options = ["Doğru", "Yanlış"];
    q.correctIndex = q.correctText === "Yanlış" ? 1 : 0;
  } else if (qType === "classic") {
    q.correctText = document.getElementById("editQClassicAnswer").value.trim();
    q.options = [q.correctText];
    q.correctIndex = 0;
  }

  await saveQuestionsToSorularJson();
  await saveCourseMetaToFirebase(course);

  closeEditTeacherQuestionModal();
  renderAdminTeacherSetsList();
  renderAdminCoursesList();
  showToast("Soru güncellendi ve sorular.json dosyasına kaydedildi.");
}

async function deleteAdminTeacherQuestion(courseId, questionId) {
  const course = appState.courses.find((c) => c.id === courseId);
  if (!course) return;

  course.questions = (course.questions || []).filter((q) => q.id !== questionId);
  await saveQuestionsToSorularJson();
  await saveCourseMetaToFirebase(course);

  renderAdminTeacherSetsList();
  renderAdminCoursesList();
  showToast("Soru silindi.");
}

/********************************************************************
 * 10 SORULUK ÇOKTAN SEÇMELİ SINAV VE ÖĞRETİCİ SORULAR (AKILLI ÜRETİCİ)
 ********************************************************************/
function startMultipleChoiceQuizFromRange() {
  switchMainView("exams");
  getSelectedExamTopicsAndPages().then(({ course, source, pages, selectedTopicTitles, rangeLabel }) => {
    if (!course || !source || (!pages.length && !(course.questions || []).length)) {
      showToast("Sınav hazırlamak için geçerli bir ders, kaynak ve konu başlığı seçin!");
      return;
    }

    const topicSet = new Set(selectedTopicTitles.map((t) => t.trim().toLowerCase()));

    const jsonTopicQuestions = (course.questions || [])
      .filter((q) => {
        if ((q.questionType || "mcq") !== "mcq") return false;
        if (q.sourceId && q.sourceId !== source.id) return false;
        if (q.topicTitle && topicSet.has(q.topicTitle.trim().toLowerCase())) return true;
        return pages.some((p) => Number(p.pageNo) === Number(q.pageNo));
      })
      .map((q) => ({
        ...q,
        topicTitle: q.topicTitle || rangeLabel
      }));

    const neededAutoCount = Math.max(0, 10 - jsonTopicQuestions.length);
    const autoQuestions = generateSmartQuestionsFromPages(
      pages,
      source.pages || pages,
      neededAutoCount + 4
    );

    const combinedPool = [...shuffleArray(jsonTopicQuestions), ...autoQuestions];
    const finalTenQuestions = combinedPool.slice(0, 10);

    if (!finalTenQuestions.length) {
      showToast("Seçilen konu başlıklarında soru üretilecek yeterli içerik bulunamadı.");
      return;
    }

    appState.activeQuiz = {
      courseId: course.id,
      courseName: `${course.name} (${source.name})`,
      rangeText: rangeLabel,
      questions: finalTenQuestions,
      userAnswers: {},
      submitted: false
    };

    switchExamSubTab("mcq");
    renderActiveQuiz();
    showToast(`Seçilen konu başlıklarından Çoktan Seçmeli Sınav hazırlandı.`);
  });
}

function startInstructionalQuestionsFromRange() {
  switchMainView("exams");
  getSelectedExamTopicsAndPages().then(({ course, source, pages, rangeLabel }) => {
    if (!course || !source || !pages.length) {
      showToast("Öğretici sorular hazırlamak için geçerli bir konu başlığı aralığı seçin!");
      return;
    }

    const instQuestions = generateInstructionalQuestionsFromPages(pages, 10);
    if (!instQuestions.length) {
      showToast("Seçilen konu başlıklarında öğretici soru üretilecek yeterli metin bulunamadı.");
      return;
    }

    appState.activeInstructionalQuiz = {
      courseId: course.id,
      courseName: `${course.name} (${source.name})`,
      rangeText: rangeLabel,
      questions: instQuestions
    };

    switchExamSubTab("instructional");
    renderActiveInstructionalQuestions();
    showToast(`Seçilen konu başlıklarından 10 adet Öğretici Soru hazırlandı.`);
  });
}

function toggleAllInstructionalAnswers() {
  const instQuiz = appState.activeInstructionalQuiz;
  if (!instQuiz) return;

  const anyRevealed = instQuiz.questions.some((q) => q.revealed);
  const targetState = !anyRevealed;

  instQuiz.questions.forEach((q) => {
    q.revealed = targetState;
  });

  const btn = document.getElementById("toggleAllInstAnswersBtn");
  if (btn) {
    btn.innerHTML = targetState
      ? `<i class="fa-solid fa-eye-slash"></i> Tüm Cevapları Gizle`
      : `<i class="fa-solid fa-eye"></i> Tüm Cevapları Göster`;
  }
  renderActiveInstructionalQuestions();
}

function generateInstructionalQuestionsFromPages(rangePages, targetCount = 10) {
  const candidates = [];

  rangePages.forEach((p) => {
    const cleanText = extractCleanTextWithoutFootnotes(p.htmlContent);
    const sents = splitTextIntoMeaningfulSentences(cleanText);

    sents.forEach((s, idx) => {
      const nextContext = sents[idx + 1] ? " " + sents[idx + 1] : "";
      candidates.push({
        topicTitle: p.title,
        mainSentence: s,
        fullExplanation: s + nextContext
      });
    });
  });

  if (!candidates.length) return [];

  const shuffled = shuffleArray(candidates).slice(0, targetCount);

  return shuffled.map((item, i) => {
    const words = item.mainSentence
      .replace(/[.,;!?()"']/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !TURKISH_STOP_WORDS.has(w.toLowerCase()));

    const keyConcept = words[0] || item.topicTitle;
    let promptQuestion = "";

    if (/demektir|ibarettir|denir/i.test(item.mainSentence)) {
      promptQuestion = `"${item.topicTitle}" konusunda geçen "${keyConcept}" kavramı nasıl tanımlanmakta ve açıklanmaktadır?`;
    } else if (/gerekir|şarttır|lazımdır|esastır/i.test(item.mainSentence)) {
      promptQuestion = `"${item.topicTitle}" konusuna göre "${keyConcept}" hususunda dikkat edilmesi gereken temel ilke ve gereklilik nedir?`;
    } else {
      promptQuestion = `"${item.topicTitle}" başlığı altında "${keyConcept}" ile ilgili vurgulanan temel öğretici bilgi nedir? Açıklayınız.`;
    }

    return {
      id: `inst_${Date.now()}_${i}`,
      topicTitle: item.topicTitle,
      question: promptQuestion,
      answer: item.fullExplanation,
      revealed: false
    };
  });
}

function renderActiveInstructionalQuestions() {
  const instQuiz = appState.activeInstructionalQuiz;
  const emptyEl = document.getElementById("instEmptyState");
  const containerEl = document.getElementById("activeInstContainer");
  const listEl = document.getElementById("instQuestionsList");
  const badgeEl = document.getElementById("activeInstRangeBadge");
  const toggleBtn = document.getElementById("toggleAllInstAnswersBtn");

  if (!instQuiz) {
    emptyEl.classList.remove("hidden");
    containerEl.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  containerEl.classList.remove("hidden");
  badgeEl.textContent = `${instQuiz.courseName} • ${instQuiz.rangeText}`;
  document.getElementById("instStatsText").textContent = `Toplam ${instQuiz.questions.length} Öğretici Soru`;

  const allShown = instQuiz.questions.every((q) => q.revealed);
  if (toggleBtn) {
    toggleBtn.innerHTML = allShown
      ? `<i class="fa-solid fa-eye-slash"></i> Tüm Cevapları Gizle`
      : `<i class="fa-solid fa-eye"></i> Tüm Cevapları Göster`;
  }

  listEl.innerHTML = instQuiz.questions
    .map((q, idx) => {
      return `
        <div class="quiz-q-card">
          <div class="quiz-q-title">
            ${idx + 1}. ${escapeHtml(q.question)} <span class="badge">${escapeHtml(q.topicTitle)}</span>
          </div>
          <button type="button" class="btn-secondary btn-sm" onclick="toggleInstructionalAnswer(${idx})">
            <i class="fa-solid ${q.revealed ? "fa-eye-slash" : "fa-eye"}"></i>
            ${q.revealed ? "Cevabı ve Açıklamayı Gizle" : "Öğretici Cevabı ve Açıklamayı Göster"}
          </button>
          <div class="inst-answer-box ${q.revealed ? "" : "hidden"}">
            <strong><i class="fa-solid fa-check-circle" style="color:var(--success)"></i> Öğretici Cevap (${escapeHtml(q.topicTitle)}):</strong>
            <p class="mt-8">${escapeHtml(q.answer)}</p>
          </div>
        </div>
      `;
    })
    .join("");
}

function toggleInstructionalAnswer(idx) {
  if (!appState.activeInstructionalQuiz?.questions[idx]) return;
  appState.activeInstructionalQuiz.questions[idx].revealed =
    !appState.activeInstructionalQuiz.questions[idx].revealed;
  renderActiveInstructionalQuestions();
}

function generateSmartQuestionsFromPages(rangePages, allSourcePages, targetCount = 10) {
  const cleanFactPool = [];
  const keyTermsPool = new Set();

  rangePages.forEach((p) => {
    const cleanText = extractCleanTextWithoutFootnotes(p.htmlContent);
    const sents = splitTextIntoMeaningfulSentences(cleanText);

    sents.forEach((s) => {
      cleanFactPool.push({ topicTitle: p.title, text: s });
      const words = s
        .replace(/[.,;!?()"']/g, "")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !TURKISH_STOP_WORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));
      words.forEach((w) => keyTermsPool.add(w));
    });
  });

  const externalSentences = [];
  (allSourcePages || []).forEach((p) => {
    const cleanText = extractCleanTextWithoutFootnotes(p.htmlContent);
    splitTextIntoMeaningfulSentences(cleanText).forEach((s) => externalSentences.push(s));
  });

  if (!cleanFactPool.length) return [];

  const allTermsArray = Array.from(keyTermsPool);
  const shuffledFacts = shuffleArray(cleanFactPool);
  const questions = [];

  function createPlausibleFalseStatement(sentence) {
    if (/gerekir/i.test(sentence)) return sentence.replace(/gerekir/i, "gerekmez");
    if (/vardır/i.test(sentence)) return sentence.replace(/vardır/i, "yoktur");
    if (/olur/i.test(sentence)) return sentence.replace(/olur/i, "olmaz");
    if (/kabul edilir/i.test(sentence)) return sentence.replace(/kabul edilir/i, "reddedilir");
    if (/önemlidir/i.test(sentence)) return sentence.replace(/önemlidir/i, "önemsiz sayılır");
    if (/caizdir/i.test(sentence)) return sentence.replace(/caizdir/i, "caiz değildir");
    if (/şarttır/i.test(sentence)) return sentence.replace(/şarttır/i, "şart değildir");
    if (allTermsArray.length >= 2) {
      const words = sentence.split(/\s+/);
      const longWordIdx = words.findIndex((w) => w.length >= 5 && !TURKISH_STOP_WORDS.has(w.toLowerCase()));
      if (longWordIdx !== -1) {
        const replacement = allTermsArray.find((t) => t.toLowerCase() !== words[longWordIdx].toLowerCase());
        if (replacement) {
          const copy = [...words];
          copy[longWordIdx] = replacement;
          return copy.join(" ");
        }
      }
    }
    return sentence.replace(/\.$/, "") + " ifadesi bu bağlamda geçerli değildir.";
  }

  let idx = 0;
  while (questions.length < targetCount && idx < Math.max(20, shuffledFacts.length * 3)) {
    const fact = shuffledFacts[idx % shuffledFacts.length];
    const qType = questions.length % 3;

    if (qType === 0 && allTermsArray.length >= 5) {
      const candidateWords = fact.text
        .replace(/[.,;!?()"']/g, "")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !TURKISH_STOP_WORDS.has(w.toLowerCase()));

      const targetWord = candidateWords[Math.floor(candidateWords.length / 2)] || candidateWords[0];
      if (targetWord && fact.text.includes(targetWord)) {
        const blankedSentence = fact.text.replace(targetWord, "__________");
        const distractorTerms = shuffleArray(
          allTermsArray.filter((t) => t.toLowerCase() !== targetWord.toLowerCase())
        ).slice(0, 4);

        if (distractorTerms.length === 4) {
          const opts = shuffleArray([targetWord, ...distractorTerms]);
          questions.push({
            id: `autoq_${Date.now()}_${questions.length}`,
            topicTitle: fact.topicTitle,
            question: `"${fact.topicTitle}" konusunda geçen aşağıdaki ifadede boş bırakılan yere hangi kavram gelmelidir?\n\n"${blankedSentence}"`,
            options: opts,
            correctIndex: opts.indexOf(targetWord)
          });
          idx++;
          continue;
        }
      }
    }

    if (qType === 2 && cleanFactPool.length >= 5) {
      const trueStatements = shuffleArray(
        cleanFactPool.filter((f) => f.text !== fact.text)
      )
        .slice(0, 4)
        .map((f) => f.text);

      const falseStatement = createPlausibleFalseStatement(fact.text);
      if (trueStatements.length === 4 && falseStatement !== fact.text) {
        const opts = shuffleArray([falseStatement, ...trueStatements]);
        questions.push({
          id: `autoq_${Date.now()}_${questions.length}`,
          topicTitle: fact.topicTitle,
          question: `"${fact.topicTitle}" konusu dikkate alındığında aşağıdaki ifadelerden hangisi yanlıştır / söylenemez?`,
          options: opts,
          correctIndex: opts.indexOf(falseStatement)
        });
        idx++;
        continue;
      }
    }

    const falseDistractors = shuffleArray(
      cleanFactPool
        .filter((f) => f.text !== fact.text)
        .map((f) => createPlausibleFalseStatement(f.text))
        .filter((s) => s !== fact.text)
    ).slice(0, 4);

    while (falseDistractors.length < 4 && externalSentences.length > falseDistractors.length) {
      falseDistractors.push(createPlausibleFalseStatement(externalSentences[falseDistractors.length]));
    }
    while (falseDistractors.length < 4) {
      falseDistractors.push(`Bu bölümde (${fact.topicTitle}) yer almayan farklı bir değerlendirmedir (${falseDistractors.length + 1}).`);
    }

    const opts = shuffleArray([fact.text, ...falseDistractors.slice(0, 4)]);
    questions.push({
      id: `autoq_${Date.now()}_${questions.length}`,
      topicTitle: fact.topicTitle,
      question: `"${fact.topicTitle}" konusuna göre aşağıdakilerden hangisi ders kaynağında yer alan doğru bir bilgidir?`,
      options: opts,
      correctIndex: opts.indexOf(fact.text)
    });

    idx++;
  }

  return questions.slice(0, 10);
}

function renderActiveQuiz() {
  const quiz = appState.activeQuiz;
  const emptyEl = document.getElementById("quizEmptyState");
  const containerEl = document.getElementById("activeQuizContainer");
  const listEl = document.getElementById("quizQuestionsList");
  const badgeEl = document.getElementById("activeQuizRangeBadge");

  if (!quiz) {
    emptyEl.classList.remove("hidden");
    containerEl.classList.add("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  containerEl.classList.remove("hidden");
  badgeEl.textContent = `${quiz.courseName} • ${quiz.rangeText}`;
  document.getElementById("quizStatsText").textContent = `Toplam ${quiz.questions.length} Çoktan Seçmeli Soru (Yapay Zeka Desteği ile hazırlanmıştır)`;
  document.getElementById("finishQuizBtn").classList.toggle("hidden", quiz.submitted);

  const letters = ["A", "B", "C", "D", "E"];
  listEl.innerHTML = quiz.questions
    .map((q, qIdx) => {
      const selectedOpt = quiz.userAnswers[qIdx];
      const optsHtml = q.options
        .map((optText, oIdx) => {
          let cls = "quiz-opt-btn";
          if (selectedOpt === oIdx) cls += " selected";
          if (quiz.submitted) {
            if (oIdx === q.correctIndex) cls += " correct";
            else if (selectedOpt === oIdx && selectedOpt !== q.correctIndex) cls += " wrong";
          }
          return `
            <button type="button" class="${cls}" onclick="selectQuizOption(${qIdx}, ${oIdx})">
              <strong>${letters[oIdx]})</strong> ${escapeHtml(optText)}
            </button>
          `;
        })
        .join("");

      return `
        <div class="quiz-q-card">
          <div class="quiz-q-title">${qIdx + 1}. ${escapeHtml(q.question).replace(/\n/g, "<br/>")} <span class="badge">${escapeHtml(q.topicTitle || quiz.rangeText)}</span></div>
          <div>${optsHtml}</div>
        </div>
      `;
    })
    .join("");
}

function selectQuizOption(qIdx, oIdx) {
  if (!appState.activeQuiz || appState.activeQuiz.submitted) return;
  appState.activeQuiz.userAnswers[qIdx] = oIdx;
  renderActiveQuiz();
}

async function submitActiveQuiz() {
  const quiz = appState.activeQuiz;
  if (!quiz || quiz.submitted) return;

  let correct = 0;
  quiz.questions.forEach((q, idx) => {
    if (quiz.userAnswers[idx] === q.correctIndex) correct++;
  });

  const total = quiz.questions.length;
  const score = Math.round((correct / total) * 100);
  quiz.submitted = true;

  appState.userData.examHistory.unshift({
    id: "ex_" + Date.now(),
    courseId: quiz.courseId,
    courseName: quiz.courseName,
    rangeText: quiz.rangeText,
    score,
    correct,
    total,
    date: new Date().toLocaleString("tr-TR")
  });

  await saveUserPersonalDataToFirebase();
  renderActiveQuiz();
  renderExamHistoryList();
  populateProfileForm();
  showToast(`Sınav tamamlandı! Notunuz: ${score} / 100 (${correct}/${total} Doğru)`);
}

function renderExamHistoryList() {
  const listEl = document.getElementById("examHistoryList");
  const badgeEl = document.getElementById("examHistoryCountBadge");
  if (!listEl || !badgeEl) return;
  const history = appState.userData.examHistory || [];

  badgeEl.textContent = `${history.length} Kayıt`;
  if (!history.length) {
    listEl.innerHTML = `<p class="hint-text">Henüz tamamlanmış sınav kaydınız bulunmuyor.</p>`;
    return;
  }

  listEl.innerHTML = history
    .map(
      (h) => `
      <div class="history-item">
        <div>
          <strong>${escapeHtml(h.courseName)}</strong> <span class="badge">${escapeHtml(h.rangeText)}</span>
          <div class="hint-text">${h.date} • ${h.correct}/${h.total} Doğru</div>
        </div>
        <div class="score-pill">${h.score} Puan</div>
      </div>
    `
    )
    .join("");
}