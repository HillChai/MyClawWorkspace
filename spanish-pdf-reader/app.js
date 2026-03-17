import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.mjs";

const pdfInput = document.querySelector("#pdf-input");
const readerContent = document.querySelector("#reader-content");
const documentTitle = document.querySelector("#document-title");
const statusText = document.querySelector("#status-text");
const selectionPreview = document.querySelector("#selection-preview");
const voiceSelect = document.querySelector("#voice-select");
const rateInput = document.querySelector("#rate-input");
const pitchInput = document.querySelector("#pitch-input");
const rateValue = document.querySelector("#rate-value");
const pitchValue = document.querySelector("#pitch-value");
const autoReadToggle = document.querySelector("#auto-read-toggle");
const speakButton = document.querySelector("#speak-button");
const stopButton = document.querySelector("#stop-button");
const ocrButton = document.querySelector("#ocr-button");
const ocrStopButton = document.querySelector("#ocr-stop-button");

const state = {
  voices: [],
  selectedText: "",
  currentFileName: "",
  renderJobId: 0,
  pageEntries: [],
  ocrAbortController: null,
  tesseract: null,
};

const OCR_TEXT_ITEM_THRESHOLD = 36;

const sentenceSegmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter("es", { granularity: "sentence" })
    : null;

function setStatus(message) {
  statusText.textContent = message;
}

function cleanSelectionText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function slicePreview(text, maxLength = 180) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

function getRenderScale(page) {
  const maxDesktopWidth = Math.min(readerContent.clientWidth - 96, 960);
  const targetWidth = Math.max(320, maxDesktopWidth);
  const baseViewport = page.getViewport({ scale: 1 });
  return targetWidth / baseViewport.width;
}

function getPreferredVoices(voices) {
  const spanishVoices = voices.filter((voice) =>
    /^es([-_]|$)/i.test(voice.lang) || /spanish|espa[nñ]ol/i.test(voice.name),
  );

  return spanishVoices.length > 0 ? spanishVoices : voices;
}

function syncVoiceList() {
  const voices = window.speechSynthesis.getVoices();
  const preferredVoices = getPreferredVoices(voices);
  const previousValue = voiceSelect.value;

  state.voices = preferredVoices;
  voiceSelect.innerHTML = "";

  if (preferredVoices.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "当前浏览器没有可用语音";
    voiceSelect.append(option);
    return;
  }

  for (const voice of preferredVoices) {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.append(option);
  }

  const matched = preferredVoices.find((voice) => voice.voiceURI === previousValue);
  if (matched) {
    voiceSelect.value = matched.voiceURI;
    return;
  }

  const firstSpanish = preferredVoices.find((voice) => /^es([-_]|$)/i.test(voice.lang));
  voiceSelect.value = (firstSpanish || preferredVoices[0]).voiceURI;
}

function getSelectedVoice() {
  return state.voices.find((voice) => voice.voiceURI === voiceSelect.value) || null;
}

function stopSpeaking() {
  window.speechSynthesis.cancel();
}

function buildSpeakText(rawText) {
  const cleaned = cleanSelectionText(rawText);

  if (!sentenceSegmenter || cleaned.length < 8) {
    return cleaned;
  }

  const sentences = [...sentenceSegmenter.segment(cleaned)].map((part) => part.segment.trim());
  return sentences.filter(Boolean).join(" ");
}

function speak(text) {
  const content = buildSpeakText(text);
  if (!content) {
    return;
  }

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(content);
  const selectedVoice = getSelectedVoice();

  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = "es-ES";
  }

  utterance.rate = Number(rateInput.value);
  utterance.pitch = Number(pitchInput.value);

  window.speechSynthesis.speak(utterance);
}

function updateSelection(text) {
  state.selectedText = cleanSelectionText(text);
  speakButton.disabled = !state.selectedText;

  if (state.selectedText) {
    selectionPreview.classList.remove("muted");
    selectionPreview.textContent = slicePreview(state.selectedText);
  } else {
    selectionPreview.classList.add("muted");
    selectionPreview.textContent = "还没有选中文本。导入 PDF 后，在右侧页面上直接划词即可。";
  }
}

function setOcrButtons(running) {
  ocrButton.disabled = running || state.pageEntries.length === 0;
  ocrStopButton.disabled = !running;
}

async function loadTesseract() {
  if (state.tesseract) {
    return state.tesseract;
  }

  const module = await import("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js");
  state.tesseract = module.default;
  return state.tesseract;
}

function createOcrWordSpan(word, scaleX, scaleY) {
  const span = document.createElement("span");
  const width = Math.max(1, word.bbox.x1 - word.bbox.x0);
  const height = Math.max(1, word.bbox.y1 - word.bbox.y0);

  span.textContent = word.text;
  span.style.left = `${word.bbox.x0 * scaleX}px`;
  span.style.top = `${word.bbox.y0 * scaleY}px`;
  span.style.width = `${width * scaleX}px`;
  span.style.height = `${height * scaleY}px`;
  span.style.fontSize = `${Math.max(10, height * scaleY)}px`;
  span.style.lineHeight = `${height * scaleY}px`;

  return span;
}

function applyOcrOverlay(pageEntry, words) {
  pageEntry.ocrLayer.innerHTML = "";

  const scaleX = pageEntry.cssWidth / pageEntry.canvas.width;
  const scaleY = pageEntry.cssHeight / pageEntry.canvas.height;
  const fragment = document.createDocumentFragment();

  for (const word of words) {
    if (!word.text || !word.bbox) {
      continue;
    }
    fragment.append(createOcrWordSpan(word, scaleX, scaleY));
  }

  pageEntry.ocrLayer.append(fragment);
  pageEntry.badge.textContent = "OCR 已补强";
  pageEntry.badge.classList.add("ready");
  pageEntry.badge.classList.remove("image-only");
}

function createPageShell(pageNumber, viewport) {
  const section = document.createElement("section");
  section.className = "page-block";

  const label = document.createElement("p");
  label.className = "page-number";
  label.textContent = `Page ${pageNumber}`;

  const pageSurface = document.createElement("div");
  pageSurface.className = "pdf-page";
  pageSurface.style.width = `${viewport.width}px`;
  pageSurface.style.height = `${viewport.height}px`;
  pageSurface.style.setProperty("--scale-factor", viewport.scale.toFixed(4));

  const canvas = document.createElement("canvas");
  canvas.className = "pdf-canvas";

  const textLayer = document.createElement("div");
  textLayer.className = "textLayer";

  const ocrLayer = document.createElement("div");
  ocrLayer.className = "ocrLayer";

  const badge = document.createElement("div");
  badge.className = "page-badge";
  badge.textContent = "渲染中...";

  pageSurface.append(canvas, textLayer, ocrLayer, badge);
  section.append(label, pageSurface);

  return { section, canvas, textLayer, ocrLayer, badge };
}

async function renderPage(page, pageNumber, renderJobId) {
  const scale = getRenderScale(page);
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;
  const { section, canvas, textLayer, ocrLayer, badge } = createPageShell(pageNumber, viewport);

  readerContent.append(section);

  const canvasContext = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const renderContext = {
    canvasContext,
    viewport,
    transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
  };

  const textContent = await page.getTextContent();

  if (renderJobId !== state.renderJobId) {
    return null;
  }

  await page.render(renderContext).promise;

  if (renderJobId !== state.renderJobId) {
    return null;
  }

  if (textContent.items.length > 0) {
    const textLayerBuilder = new pdfjsLib.TextLayer({
      container: textLayer,
      textContentSource: textContent,
      viewport,
    });

    await textLayerBuilder.render();
    badge.textContent = "可选中朗读";
    badge.classList.add("ready");
  } else {
    badge.textContent = "仅图片页";
    badge.classList.add("image-only");
  }

  return {
    hasText: textContent.items.length > 0,
    textItemCount: textContent.items.length,
    canvas,
    textLayer,
    ocrLayer,
    badge,
    cssWidth: viewport.width,
    cssHeight: viewport.height,
    pageNumber,
  };
}

async function renderPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const renderJobId = state.renderJobId;

  readerContent.classList.remove("empty");
  readerContent.innerHTML = "";
  state.pageEntries = [];

  let selectablePages = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const result = await renderPage(page, pageNumber, renderJobId);

    if (renderJobId !== state.renderJobId) {
      return null;
    }

    if (result?.hasText) {
      selectablePages += 1;
    }

    if (result) {
      state.pageEntries.push(result);
    }
  }

  return {
    totalPages: pdf.numPages,
    selectablePages,
  };
}

async function handleFileChange(event) {
  const [file] = event.target.files ?? [];

  if (!file) {
    return;
  }

  state.renderJobId += 1;
  state.currentFileName = file.name;
  documentTitle.textContent = file.name;
  setStatus("正在渲染 PDF 页面，请稍等...");
  updateSelection("");
  stopSpeaking();
  if (state.ocrAbortController) {
    state.ocrAbortController.abort();
    state.ocrAbortController = null;
  }
  setOcrButtons(false);

  try {
    const result = await renderPdf(file);

    if (!result) {
      return;
    }

    setOcrButtons(false);

    if (result.selectablePages === 0) {
      setStatus(
        `加载完成，共 ${result.totalPages} 页。图片和版式已保留，但当前 PDF 没有可直接选中的文字层。`,
      );
      return;
    }

    if (result.selectablePages === result.totalPages) {
      setStatus(`加载完成，共 ${result.totalPages} 页。现在可以直接在页面上选中文本朗读。`);
      return;
    }

    setStatus(
      `加载完成，共 ${result.totalPages} 页，其中 ${result.selectablePages} 页可选中文本，其余页面仅显示原始图片内容。`,
    );
  } catch (error) {
    console.error(error);
    readerContent.classList.add("empty");
    readerContent.innerHTML = `
      <div class="empty-state">
        <p>PDF 渲染失败。</p>
        <small>请换一个 PDF 再试一次；如果你愿意，我也可以继续帮你做 OCR 版本。</small>
      </div>
    `;
    setStatus("渲染失败。");
  }
}

function handleSelectionChange() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    updateSelection("");
    return;
  }

  const anchorNode = selection.anchorNode;
  const text = cleanSelectionText(selection.toString());

  if (!anchorNode || !readerContent.contains(anchorNode)) {
    updateSelection("");
    return;
  }

  updateSelection(text);
}

function handleReaderMouseUp() {
  if (!state.selectedText || !autoReadToggle.checked) {
    return;
  }

  speak(state.selectedText);
}

async function runOcrEnhancement() {
  const candidates = state.pageEntries.filter(
    (pageEntry) => pageEntry.textItemCount < OCR_TEXT_ITEM_THRESHOLD,
  );

  if (candidates.length === 0) {
    setStatus("当前文档的文字层已经比较完整，暂时没有需要 OCR 补强的页面。");
    return;
  }

  const Tesseract = await loadTesseract();
  const abortController = new AbortController();
  state.ocrAbortController = abortController;
  setOcrButtons(true);

  try {
    for (let index = 0; index < candidates.length; index += 1) {
      const pageEntry = candidates[index];

      if (abortController.signal.aborted) {
        throw new DOMException("OCR aborted", "AbortError");
      }

      pageEntry.badge.textContent = "OCR 处理中...";
      pageEntry.badge.classList.remove("image-only");
      setStatus(`OCR 补强中：第 ${index + 1}/${candidates.length} 个候选页（Page ${pageEntry.pageNumber}）。`);

      const result = await Tesseract.recognize(pageEntry.canvas, "spa+eng", {
        logger: () => {},
      });

      if (abortController.signal.aborted) {
        throw new DOMException("OCR aborted", "AbortError");
      }

      const words = (result.data?.words || []).filter((word) => word.confidence >= 45);

      if (words.length > 0) {
        applyOcrOverlay(pageEntry, words);
      } else {
        pageEntry.badge.textContent = "OCR 未提取到文字";
        pageEntry.badge.classList.add("image-only");
      }
    }

    setStatus("OCR 补强完成。现在可以再试着选取之前漏掉的词或句子。");
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("OCR 已中止。");
    } else {
      console.error(error);
      setStatus("OCR 补强失败。可能是网络或浏览器内存限制。");
    }
  } finally {
    state.ocrAbortController = null;
    setOcrButtons(false);
  }
}

pdfInput.addEventListener("change", handleFileChange);
readerContent.addEventListener("mouseup", handleReaderMouseUp);
document.addEventListener("selectionchange", handleSelectionChange);
speakButton.addEventListener("click", () => speak(state.selectedText));
stopButton.addEventListener("click", stopSpeaking);
ocrButton.addEventListener("click", runOcrEnhancement);
ocrStopButton.addEventListener("click", () => {
  state.ocrAbortController?.abort();
});
rateInput.addEventListener("input", () => {
  rateValue.textContent = Number(rateInput.value).toFixed(1);
});
pitchInput.addEventListener("input", () => {
  pitchValue.textContent = Number(pitchInput.value).toFixed(1);
});

window.speechSynthesis.onvoiceschanged = syncVoiceList;
syncVoiceList();
setOcrButtons(false);
