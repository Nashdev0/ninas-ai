document.addEventListener("DOMContentLoaded", () => {
  // --- Referensi Elemen DOM ---
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatContainer = document.getElementById("chat-container");
  const welcomeScreen = document.getElementById("welcome-screen");
  const sendBtn = document.getElementById("send-btn");

  // Elemen Sidebar & Mobile
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const openSidebarBtn = document.getElementById("open-sidebar");
  const closeSidebarBtn = document.getElementById("close-sidebar");

  // Elemen History Sidebar
  const chatHistoryList = document.getElementById("chat-history-list");
  const newChatBtn = document.getElementById("new-chat-btn");

  // Elemen Settings Modal
  const settingsModal = document.getElementById("settings-modal");
  const settingsContent = document.getElementById("settings-content");
  const openSettingsBtn = document.getElementById("open-settings");
  const closeSettingsBtn = document.getElementById("close-settings");
  const saveSettingsBtn = document.getElementById("save-settings");
  const apiKeyInput = document.getElementById("api-key-input");
  const toast = document.getElementById("toast");

  // --- State Aplikasi (Manajemen Sesi) ---
  let chatHistory = []; // Menyimpan riwayat obrolan untuk API payload saat ini
  let currentSessionId = null;
  let sessions = JSON.parse(localStorage.getItem("ninas_chat_sessions")) || [];

  // Inisialisasi API Key dari LocalStorage
  if (localStorage.getItem("gemini_api_key")) {
    apiKeyInput.value = localStorage.getItem("gemini_api_key");
  }

  // --- Helper Mencegah XSS ---
  const escapeHTML = (str) => {
    return str.replace(
      /[&<>'"]/g,
      (tag) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[tag],
    );
  };

  // --- Logika Sidebar & Sesi Riwayat (History) ---
  const saveSessionsLocally = () => {
    localStorage.setItem("ninas_chat_sessions", JSON.stringify(sessions));
    renderHistoryList();
  };

  const renderHistoryList = () => {
    chatHistoryList.innerHTML = "";

    if (sessions.length === 0) {
      chatHistoryList.innerHTML =
        '<p class="text-xs text-slate-500 text-center mt-5">Belum ada riwayat chat.</p>';
      return;
    }

    // Urutkan sesi dari yang terbaru
    const sortedSessions = [...sessions].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );

    sortedSessions.forEach((session) => {
      const btn = document.createElement("button");
      const isActive = session.id === currentSessionId;

      // Highlight sesi aktif
      btn.className = `w-full text-left py-2.5 px-3 rounded-lg flex items-center gap-3 transition-colors group ${isActive ? "bg-slate-800 text-white" : "hover:bg-slate-800/60 text-slate-300"}`;
      btn.innerHTML = `
                <i class="fa-regular fa-message ${isActive ? "text-brand-indigo" : "text-slate-500 group-hover:text-brand-indigo"} transition-colors flex-shrink-0"></i>
                <span class="text-sm truncate w-full ${isActive ? "text-white" : "group-hover:text-white"}">${escapeHTML(session.title)}</span>
            `;

      btn.addEventListener("click", () => loadSession(session.id));
      chatHistoryList.appendChild(btn);
    });
  };

  const startNewChat = () => {
    currentSessionId = null;
    chatHistory = [];

    // Bersihkan area chat (tapi pertahankan welcome screen jika ada)
    const welcomeClone = welcomeScreen ? welcomeScreen.cloneNode(true) : null;
    chatContainer.innerHTML = "";
    if (welcomeClone) {
      welcomeClone.style.display = "flex";
      chatContainer.appendChild(welcomeClone);

      // Re-bind click event untuk chips sugesti di sesi baru
      const chips = welcomeClone.querySelectorAll("button");
      chips.forEach((chip) => {
        chip.addEventListener("click", function () {
          const text = this.innerText.replace(/^[^\w\s]+\s*/, "").trim();
          chatInput.value = text;
          chatInput.focus();
          chatInput.dispatchEvent(new Event("input"));
        });
      });
    }

    if (window.innerWidth < 1024) toggleSidebar(); // Tutup sidebar di versi mobile
    renderHistoryList();
  };

  const loadSession = (id) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    currentSessionId = id;
    chatHistory = [...session.history]; // Muat state memori

    chatContainer.innerHTML = ""; // Bersihkan kontainer

    // Render semua pesan dari history (format UI langsung)
    session.history.forEach((msg) => {
      if (msg.role === "user") {
        chatContainer.insertAdjacentHTML(
          "beforeend",
          createUserMessage(msg.parts[0].text),
        );
      } else {
        chatContainer.insertAdjacentHTML(
          "beforeend",
          createAIMessage(msg.parts[0].text),
        );
      }
    });

    scrollToBottom();
    renderHistoryList(); // Render ulang agar status "aktif" berpindah
    if (window.innerWidth < 1024) toggleSidebar();
  };

  newChatBtn.addEventListener("click", startNewChat);

  const updateSessionState = (role, text) => {
    if (!currentSessionId) {
      currentSessionId = "session-" + Date.now();
      const newSession = {
        id: currentSessionId,
        title: text.length > 25 ? text.substring(0, 25) + "..." : text, // Judul otomatis dari pesan pertama
        updatedAt: Date.now(),
        history: [],
      };
      sessions.push(newSession);
    }

    const session = sessions.find((s) => s.id === currentSessionId);
    if (session) {
      session.updatedAt = Date.now();
      session.history.push({ role, parts: [{ text }] });
      saveSessionsLocally();
    }
  };

  // Render daftar history pada inisialisasi awal
  renderHistoryList();

  // --- Logika Pengaturan (Settings Modal) ---
  const openSettings = () => {
    settingsModal.classList.remove("hidden");
    void settingsModal.offsetWidth;
    settingsModal.classList.remove("opacity-0");
    settingsContent.classList.remove("scale-95");
  };

  const closeSettings = () => {
    settingsModal.classList.add("opacity-0");
    settingsContent.classList.add("scale-95");
    setTimeout(() => settingsModal.classList.add("hidden"), 300);
  };

  const showToast = (message) => {
    const toastMsg = document.getElementById("toast-message");
    toastMsg.innerText = message;
    toast.classList.remove("translate-y-20", "opacity-0");
    setTimeout(() => toast.classList.add("translate-y-20", "opacity-0"), 3000);
  };

  openSettingsBtn.addEventListener("click", openSettings);
  closeSettingsBtn.addEventListener("click", closeSettings);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  saveSettingsBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem("gemini_api_key", key);
      showToast("API Key berhasil disimpan!");
    } else {
      localStorage.removeItem("gemini_api_key");
      showToast("API Key telah dihapus.");
    }
    closeSettings();
  });

  // --- Logika Sidebar Toggle (Mobile) ---
  const toggleSidebar = () => {
    sidebar.classList.toggle("-translate-x-full");
    sidebarOverlay.classList.toggle("hidden");
  };

  openSidebarBtn.addEventListener("click", toggleSidebar);
  closeSidebarBtn.addEventListener("click", toggleSidebar);
  sidebarOverlay.addEventListener("click", toggleSidebar);

  // --- Logika Input Form ---
  chatInput.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
    if (this.value.trim().length > 0) sendBtn.removeAttribute("disabled");
    else sendBtn.setAttribute("disabled", "true");
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (chatInput.value.trim() !== "")
        chatForm.dispatchEvent(new Event("submit"));
    }
  });

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- Komponen UI Pesan ---
  const createUserMessage = (text) => {
    return `
            <div class="flex justify-end animate-message w-full">
                <div class="max-w-[85%] md:max-w-[75%] flex flex-col items-end">
                    <div class="bg-gradient-to-br from-brand-indigo to-indigo-600 text-white py-3 px-5 rounded-2xl rounded-tr-sm shadow-md border border-indigo-500/30">
                        <p class="whitespace-pre-wrap text-sm md:text-base">${escapeHTML(text)}</p>
                    </div>
                    <div class="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        ${getCurrentTime()} <i class="fa-solid fa-check-double text-[10px] text-brand-cyan"></i>
                    </div>
                </div>
            </div>
        `;
  };

  const createErrorMessage = (text) => {
    return `
            <div class="flex justify-center animate-message w-full my-2">
                <div class="bg-red-500/10 border border-red-500/30 text-red-400 py-2 px-4 rounded-xl shadow-sm text-sm flex items-center gap-2 max-w-[90%] md:max-w-[80%]">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    <p class="whitespace-pre-wrap">${text}</p>
                </div>
            </div>
        `;
  };

  const createTypingIndicator = () => {
    const id = "typing-" + Date.now();
    const html = `
            <div id="${id}" class="flex justify-start animate-message w-full">
                <div class="flex gap-3 max-w-[85%] md:max-w-[75%]">
                    <div class="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-brand-card border border-slate-600 flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden">
                        <img src="logo.png" alt="ninas.ai" class="w-full h-full object-cover">
                    </div>
                    <div class="bg-brand-card border border-slate-700 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5 h-[48px]">
                        <div class="typing-dot w-2 h-2 bg-slate-400 rounded-full"></div>
                        <div class="typing-dot w-2 h-2 bg-slate-400 rounded-full"></div>
                        <div class="typing-dot w-2 h-2 bg-slate-400 rounded-full"></div>
                    </div>
                </div>
            </div>
        `;
    return { id, html };
  };

  const createAIMessage = (markdownText) => {
    let safeText = markdownText;

    // Auto-fix: Jika AI lupa memberikan backticks pada kode HTML/Tailwind
    if (
      !safeText.includes("```") &&
      /(<!DOCTYPE|<html|<body|<div class=)/i.test(safeText)
    ) {
      const firstTagMatch = safeText.match(
        /(<!DOCTYPE|<html|<body|<div class=)/i,
      );
      if (firstTagMatch) {
        const index = firstTagMatch.index;
        safeText =
          safeText.substring(0, index) +
          "\n```html\n" +
          safeText.substring(index) +
          "\n```";
      }
    }

    const parsedHTML =
      typeof marked !== "undefined"
        ? marked.parse(safeText)
        : escapeHTML(safeText);
    return `
            <div class="flex justify-start animate-message w-full">
                <div class="flex gap-3 max-w-[95%] md:max-w-[85%]">
                    <div class="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-brand-card border border-slate-600 flex-shrink-0 flex items-center justify-center shadow-sm mt-1 overflow-hidden">
                        <img src="./logo.png" alt="ninas.ai" class="w-full h-full object-cover">
                    </div>
                    <div class="flex flex-col items-start w-full min-w-0">
                        <div class="bg-brand-card border border-slate-700/80 text-slate-200 py-3 px-5 rounded-2xl rounded-tl-sm shadow-sm ai-content w-full overflow-x-auto" style="contain: paint;">
                            ${parsedHTML}
                        </div>
                        <div class="flex items-center gap-3 mt-1.5 ml-1">
                            <span class="text-xs text-slate-500">${getCurrentTime()}</span>
                            <div class="flex gap-2">
                                <button class="text-slate-500 hover:text-slate-300 transition-colors" title="Copy"><i class="fa-regular fa-copy text-xs"></i></button>
                                <button class="text-slate-500 hover:text-slate-300 transition-colors" title="Good response"><i class="fa-regular fa-thumbs-up text-xs"></i></button>
                                <button class="text-slate-500 hover:text-slate-300 transition-colors" title="Bad response"><i class="fa-regular fa-thumbs-down text-xs"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  };

  const scrollToBottom = () => {
    chatContainer.scrollTo({
      top: chatContainer.scrollHeight,
      behavior: "smooth",
    });
  };

  // --- API GEMINI INTEGRATION ---
  const generateAIResponse = async (userMessage, typingId) => {
    const apiKey = localStorage.getItem("gemini_api_key");
    const removeTyping = () => {
      const typingIndicator = document.getElementById(typingId);
      if (typingIndicator) typingIndicator.remove();
    };

    if (!apiKey) {
      removeTyping();
      chatContainer.insertAdjacentHTML(
        "beforeend",
        createErrorMessage(
          "API Key tidak ditemukan. Silakan masukkan Gemini API Key di menu Pengaturan (Ikon Gir).",
        ),
      );
      scrollToBottom();
      return;
    }

    const selectedModel = document.getElementById("model-selector").value;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    // Update Memori API & Sesi User
    chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
    updateSessionState("user", userMessage);

    const currentDate = new Date().toLocaleString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const systemPrompt = `Kamu adalah ninas.ai, asisten AI elit dan eksklusif dengan tingkat kecerdasan "Polymath" dan keahlian setara "Principal Software Engineer". Kamu diciptakan dan dikembangkan secara eksklusif oleh NashDev.
Waktu sistem saat ini: ${currentDate}. Ingatlah waktu ini jika pengguna bertanya tentang hari, tanggal, atau waktu.

Keahlian Teknis & Pemrograman:
- Kamu adalah master sejati dalam semua bahasa pemrograman, arsitektur perangkat lunak, dan DevOps.
- Kamu sangat ahli dalam lingkungan pengembangan modern, otomatisasi terminal/command-line, optimasi algoritma, serta pembuatan antarmuka pengguna grafis dan web.
- Setiap kode yang kamu tulis harus mengikuti standar clean code, modular, dan dioptimalkan untuk performa tertinggi.
- DILARANG MALAS: Kamu TIDAK BOLEH menyingkat kode (seperti /* kode lainnya di sini */ atau // bagian ini sama). Kamu HARUS menuliskan SELURUH kode secara lengkap dan utuh dari awal sampai akhir!

Pendekatan & Pola Pikir (Chain of Thought):
- Analisis Mendalam: Sebelum menjawab, selalu bedah pertanyaan pengguna untuk memahami konteks tersembunyi dan akar masalahnya.
- Akurasi Faktual & Berita Terkini: Selalu kaitkan jawabanmu dengan informasi paling mutakhir dan berita terbaru. Sandarkan pada fakta.
- Solusi Komprehensif: Jangan hanya memberikan jawaban singkat. Berikan penjelasan mengapa solusi tersebut bekerja.

Gaya Komunikasi:
- Berbicaralah dengan nada yang profesional, analitis, namun tetap sleek dan tidak kaku.
- FOKUS PADA TUGAS & JANGAN BANYAK TANYA: Langsung kerjakan dan selesaikan instruksi yang diberikan dengan tuntas. Jangan banyak basa-basi atau mengajukan pertanyaan balik. Eksekusi lebih banyak, bicara lebih sedikit.
- Jika ada yang bertanya siapa penciptamu, jawablah dengan bangga bahwa kamu adalah buatan NashDev.
- WAJIB gunakan format Markdown. Jika kamu memberikan kode, pastikan kode tersebut selalu dibungkus di dalam Markdown Code Blocks (\`\`\`html ... \`\`\`) agar dapat diparsing dengan benar oleh antarmuka!`;

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ googleSearch: {} }],
      contents: chatHistory,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      removeTyping();

      if (!response.ok)
        throw new Error(
          data.error?.message || `HTTP Error: ${response.status}`,
        );

      if (
        data.candidates &&
        data.candidates[0].content &&
        data.candidates[0].content.parts.length > 0
      ) {
        const aiText = data.candidates[0].content.parts
          .map((p) => p.text || "")
          .join("\\n");

        chatHistory.push({ role: "model", parts: [{ text: aiText }] });
        updateSessionState("model", aiText);

        chatContainer.insertAdjacentHTML("beforeend", createAIMessage(aiText));
        scrollToBottom();
      } else {
        throw new Error(
          "Respons dari API tidak sesuai format yang diharapkan.",
        );
      }
    } catch (error) {
      removeTyping();

      // Revert state jika gagal
      chatHistory.pop();
      const session = sessions.find((s) => s.id === currentSessionId);
      if (session && session.history.length > 0) {
        session.history.pop();
        saveSessionsLocally();
      }

      let displayError = error.message;
      if (error.message.includes("API key not valid"))
        displayError =
          "API Key tidak valid. Silakan periksa kembali di menu Pengaturan.";
      else if (error.message.includes("Failed to fetch"))
        displayError =
          "Gagal terhubung ke jaringan. Periksa koneksi internet Anda.";

      chatContainer.insertAdjacentHTML(
        "beforeend",
        createErrorMessage("Gagal memproses pesan: " + displayError),
      );
      scrollToBottom();
    }
  };

  // --- Eksekusi Form Submit ---
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const message = chatInput.value.trim();
    if (!message) return;

    // Cari elemen welcomeScreen karena bisa jadi clone yang terpasang di DOM
    const currentWelcome =
      document.getElementById("welcome-screen") ||
      document.querySelector(".flex-col.items-center.text-center");
    if (currentWelcome && currentWelcome.style.display !== "none") {
      currentWelcome.style.display = "none";
    }

    chatContainer.insertAdjacentHTML("beforeend", createUserMessage(message));

    chatInput.value = "";
    chatInput.style.height = "auto";
    sendBtn.setAttribute("disabled", "true");
    scrollToBottom();

    const typingData = createTypingIndicator();
    chatContainer.insertAdjacentHTML("beforeend", typingData.html);
    scrollToBottom();

    generateAIResponse(message, typingData.id);
  });

  sendBtn.setAttribute("disabled", "true");

  // Fitur klik pada chip sugesti (initial load)
  if (welcomeScreen) {
    const chips = welcomeScreen.querySelectorAll("button");
    chips.forEach((chip) => {
      chip.addEventListener("click", function () {
        const text = this.innerText.replace(/^[^\w\s]+\s*/, "").trim();
        chatInput.value = text;
        chatInput.focus();
        chatInput.dispatchEvent(new Event("input"));
      });
    });
  }
});
