document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // BAGIAN 1: REFERENSI ELEMEN DOM (HTML)
  // Mengambil elemen-elemen dari HTML agar bisa dikontrol via JavaScript
  // ==========================================
  
  // Elemen Utama Chat
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatContainer = document.getElementById("chat-container");
  const welcomeScreen = document.getElementById("welcome-screen");
  const sendBtn = document.getElementById("send-btn");

  // Elemen Sidebar (Kiri) & Mobile
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const openSidebarBtn = document.getElementById("open-sidebar");
  const closeSidebarBtn = document.getElementById("close-sidebar");

  // Elemen Riwayat Chat (History) di Sidebar
  const chatHistoryList = document.getElementById("chat-history-list");
  const newChatBtn = document.getElementById("new-chat-btn");

  // Elemen Pengaturan (Modal Settings)
  const settingsModal = document.getElementById("settings-modal");
  const settingsContent = document.getElementById("settings-content");
  const openSettingsBtn = document.getElementById("open-settings");
  const closeSettingsBtn = document.getElementById("close-settings");
  const saveSettingsBtn = document.getElementById("save-settings");
  const apiKeyInput = document.getElementById("api-key-input");
  const toast = document.getElementById("toast");

  // Elemen Profil User & Modal Autentikasi (Login/Register)
  const userProfileBtn = document.getElementById("user-profile-btn");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const userPlan = document.getElementById("user-plan");

  const authModal = document.getElementById("auth-modal");
  const authContent = document.getElementById("auth-content");
  const closeAuthBtn = document.getElementById("close-auth");
  const authTitle = document.getElementById("auth-title");
  const authFormContainer = document.getElementById("auth-form-container");
  const authLogoutContainer = document.getElementById("auth-logout-container");
  const authNicknameInput = document.getElementById("auth-nickname");
  const authSubmitBtn = document.getElementById("auth-submit-btn");
  const authGoogleBtn = document.getElementById("auth-google-btn");
  const authLogoutBtn = document.getElementById("auth-logout-btn");

  // ==========================================
  // BAGIAN 2: MANAJEMEN STATE (DATA SEMENTARA)
  // Menyimpan data seperti riwayat chat dan sesi aktif
  // ==========================================
  let chatHistory = []; // Array untuk menyimpan riwayat chat agar AI ingat konteks obrolan
  let currentSessionId = null; // ID sesi chat yang sedang aktif
  // Mengambil daftar sesi chat sebelumnya dari LocalStorage (jika ada)
  let sessions = JSON.parse(localStorage.getItem("ninas_chat_sessions")) || [];

  // Mengisi form API Key secara otomatis jika sudah pernah disimpan sebelumnya
  if (localStorage.getItem("gemini_api_key")) {
    apiKeyInput.value = localStorage.getItem("gemini_api_key");
  }

  // ==========================================
  // BAGIAN 3: PENGELOLAAN GAMBAR (UPLOAD & KOMPRESI)
  // Menyimpan data gambar yang akan dikirim ke AI
  // ==========================================
  let currentImageData = null; // Data gambar dalam format Base64
  let currentImageMimeType = null; // Format gambar (misal: image/webp)
  
  const fileInput = document.getElementById("file-input");
  const attachmentBtn = document.getElementById("attachment-btn");
  const imagePreviewContainer = document.getElementById(
    "image-preview-container",
  );
  const imagePreview = document.getElementById("image-preview");
  const removeImageBtn = document.getElementById("remove-image-btn");

  // Fungsi keamanan dasar: Mengubah karakter HTML berbahaya menjadi aman (mencegah XSS)
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

  const clearImageAttachment = () => {
    currentImageData = null;
    currentImageMimeType = null;
    if (fileInput) fileInput.value = "";
    if (imagePreviewContainer) imagePreviewContainer.classList.add("hidden");
  };

  if (attachmentBtn && fileInput) {
    attachmentBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        // Karena kita kompres di browser, batas ukuran bisa lebih besar (misal 10MB) sebelum dikompres
        if (file.size > 10 * 1024 * 1024) {
          if (typeof showToast === "function")
            showToast("Ukuran gambar terlalu besar (Maks 10MB).");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            // Kompresi Gambar agar hemat kuota (maks 1024x1024)
            const MAX_WIDTH = 1024;
            const MAX_HEIGHT = 1024;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);

            // Convert ke WebP dengan kualitas 70% (Sangat hemat kuota)
            const dataUrl = canvas.toDataURL("image/webp", 0.7);

            currentImageData = dataUrl.split(",")[1];
            currentImageMimeType = "image/webp";
            imagePreview.src = dataUrl;
            imagePreviewContainer.classList.remove("hidden");
            sendBtn.removeAttribute("disabled");
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });

    removeImageBtn.addEventListener("click", () => {
      clearImageAttachment();
      if (chatInput.value.trim().length === 0)
        sendBtn.setAttribute("disabled", "true");
    });
  }

  // ==========================================
  // BAGIAN 4: MARKDOWN & COPY CODE (FORMATTING)
  // Konfigurasi Marked.js untuk menerjemahkan teks AI menjadi HTML
  // dan menambahkan tombol "Copy" pada blok kode
  // ==========================================
  if (typeof marked !== "undefined") {
    const renderer = new marked.Renderer();
    renderer.code = function (codeInfo, language, isEscaped) {
      let textStr = "";
      let langStr = "";

      if (typeof codeInfo === "object" && codeInfo !== null) {
        textStr = codeInfo.text;
        langStr = codeInfo.lang || "";
      } else {
        textStr = codeInfo;
        langStr = language || "";
      }

      return `
        <div class="relative group my-4 rounded-xl overflow-hidden border border-slate-700/80 shadow-sm code-block-wrapper">
            <div class="flex justify-between items-center bg-slate-800/80 px-4 py-2 text-xs text-slate-400 border-b border-slate-700/80 backdrop-blur-sm">
                <span class="font-mono uppercase tracking-wider">${langStr || "Code"}</span>
                <button type="button" class="copy-code-btn hover:text-white transition-colors flex items-center gap-1.5 focus:outline-none">
                    <i class="fa-regular fa-copy"></i> <span>Copy</span>
                </button>
            </div>
            <pre class="!m-0 !rounded-none !border-none bg-[#09090b] p-4 overflow-x-auto custom-scrollbar"><code class="${langStr ? "language-" + langStr : ""} text-sm">${escapeHTML(textStr)}</code></pre>
        </div>
      `;
    };
    marked.use({ renderer });
  }

  // Event listener global untuk tombol Copy Code
  document.addEventListener("click", async (e) => {
    const copyBtn = e.target.closest(".copy-code-btn");
    if (copyBtn) {
      const codeBlock = copyBtn
        .closest(".code-block-wrapper")
        .querySelector("pre code");
      if (codeBlock) {
        try {
          await navigator.clipboard.writeText(codeBlock.innerText);
          const span = copyBtn.querySelector("span");
          const icon = copyBtn.querySelector("i");

          span.innerText = "Copied!";
          icon.className = "fa-solid fa-check text-emerald-400";
          copyBtn.classList.add("text-emerald-400");
          copyBtn.classList.remove("text-slate-400");

          setTimeout(() => {
            span.innerText = "Copy";
            icon.className = "fa-regular fa-copy";
            copyBtn.classList.remove("text-emerald-400");
          }, 2000);
        } catch (err) {
          console.error("Failed to copy:", err);
          // showToast dideklarasikan di bawah, tapi akan tersedia saat diklik
          if (typeof showToast === "function") showToast("Gagal menyalin kode");
        }
      }
    }
  });

  // ==========================================
  // BAGIAN 5: MANAJEMEN RIWAYAT & SESI CHAT
  // Menyimpan dan memuat obrolan dari LocalStorage
  // ==========================================
  
  // Menyimpan seluruh sesi ke penyimpanan lokal browser
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
      const textPart = msg.parts && msg.parts.find((p) => p.text);
      const text = textPart ? textPart.text : "";

      const inlineDataPart = msg.parts && msg.parts.find((p) => p.inlineData);
      const imageSrc = inlineDataPart
        ? `data:${inlineDataPart.inlineData.mimeType};base64,${inlineDataPart.inlineData.data}`
        : null;

      if (msg.role === "user") {
        chatContainer.insertAdjacentHTML(
          "beforeend",
          createUserMessage(text, imageSrc),
        );
      } else {
        chatContainer.insertAdjacentHTML("beforeend", createAIMessage(text));
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

  // ==========================================
  // BAGIAN 6: PENGATURAN (SETTINGS) API KEY
  // Menangani modal pengaturan untuk memasukkan API Key Gemini
  // ==========================================
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

  // ==========================================
  // BAGIAN 7: AUTENTIKASI (PROFIL & LOGIN/REGISTER)
  // Menangani tampilan profil, modal login, dan simulasi login Google
  // ==========================================
  const updateProfileUI = () => {
    const savedUser = localStorage.getItem("ninas_user");
    if (savedUser) {
      userName.textContent = savedUser;
      userPlan.textContent = "Ninas Team";
      userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(savedUser)}&background=06b6d4&color=fff&rounded=true`;
    } else {
      userName.textContent = "Anonym";
      userPlan.textContent = "Ninas Team";
      userAvatar.src = `https://ui-avatars.com/api/?name=Anonym&background=475569&color=fff&rounded=true`;
    }
  };

  const openAuthModal = () => {
    const savedUser = localStorage.getItem("ninas_user");
    if (savedUser) {
      authTitle.textContent = "Profil Anda";
      authFormContainer.classList.add("hidden");
      authGoogleBtn.classList.add("hidden");
      authLogoutContainer.classList.remove("hidden");
      authNicknameInput.value = "";
    } else {
      authTitle.textContent = "Login / Register";
      authFormContainer.classList.remove("hidden");
      authGoogleBtn.classList.remove("hidden");
      authLogoutContainer.classList.add("hidden");
      authNicknameInput.value = "";
    }

    authModal.classList.remove("hidden");
    // Paksa reflow sebelum menghapus opacity-0 agar transisi berjalan
    void authModal.offsetWidth;
    authModal.classList.remove("opacity-0");
    authContent.classList.remove("scale-95");
  };

  const closeAuthModal = () => {
    authModal.classList.add("opacity-0");
    authContent.classList.add("scale-95");
    setTimeout(() => authModal.classList.add("hidden"), 300);
  };

  const handleLogin = (nickname) => {
    if (!nickname) {
      showToast("Nickname tidak boleh kosong!");
      return;
    }
    localStorage.setItem("ninas_user", nickname);
    updateProfileUI();
    showToast(`Berhasil login sebagai ${nickname}!`);
    closeAuthModal();
  };

  const handleLogout = () => {
    localStorage.removeItem("ninas_user");
    updateProfileUI();
    showToast("Berhasil logout.");
    closeAuthModal();
  };

  if (userProfileBtn) userProfileBtn.addEventListener("click", openAuthModal);
  if (closeAuthBtn) closeAuthBtn.addEventListener("click", closeAuthModal);
  if (authModal) {
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  if (authSubmitBtn) {
    authSubmitBtn.addEventListener("click", () => {
      handleLogin(authNicknameInput.value.trim());
    });
  }

  if (authGoogleBtn) {
    authGoogleBtn.addEventListener("click", () => {
      // Karena belum ada setup Firebase Auth dari sisi developer, ini sebagai simulasi
      const mockGoogleName = prompt(
        "Simulasi Google Login berhasil! Masukkan nickname Anda untuk lanjut:",
      );
      if (mockGoogleName) handleLogin(mockGoogleName);
    });
  }

  if (authLogoutBtn) {
    authLogoutBtn.addEventListener("click", handleLogout);
  }

  // Panggil updateProfileUI saat awal muat
  updateProfileUI();

  // ==========================================
  // BAGIAN 8: KONTROL UI SIDEBAR & INPUT
  // Menangani toggle sidebar di HP dan efek otomatis membesar pada input chat
  // ==========================================
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

  // ==========================================
  // BAGIAN 9: PEMBUATAN ELEMEN UI PESAN (BUBBLE CHAT)
  // Fungsi-fungsi pembantu untuk membuat HTML bubble chat secara dinamis
  // ==========================================
  
  // Membuat bubble chat untuk pesan pengguna (User)
  const createUserMessage = (text, imageSrc = null) => {
    const imageHtml = imageSrc
      ? `<div class="mb-3 rounded-lg overflow-hidden border border-indigo-500/30 w-full max-w-[250px]"><img src="${imageSrc}" class="w-full h-auto object-cover" /></div>`
      : "";
    const textHtml = text
      ? `<p class="whitespace-pre-wrap text-sm md:text-base">${escapeHTML(text)}</p>`
      : "";

    return `
            <div class="flex justify-end animate-message w-full">
                <div class="max-w-[85%] md:max-w-[75%] flex flex-col items-end">
                    <div class="bg-gradient-to-br from-brand-indigo to-indigo-600 text-white py-3 px-5 rounded-2xl rounded-tr-sm shadow-md border border-indigo-500/30 flex flex-col items-end">
                        ${imageHtml}
                        ${textHtml}
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
                <div class="flex gap-3 max-w-[95%] md:max-w-[85%] min-w-0">
                    <div class="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-brand-card border border-slate-600 flex-shrink-0 flex items-center justify-center shadow-sm mt-1 overflow-hidden">
                        <img src="logo.png" alt="ninas.ai" class="w-full h-full object-cover">
                    </div>
                    <div class="flex flex-col items-start w-full min-w-0">
                        <div class="bg-brand-card border border-slate-700/80 text-slate-200 py-3 px-5 rounded-2xl rounded-tl-sm shadow-sm ai-content w-full overflow-x-hidden break-words" style="contain: paint;">
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

  // ==========================================
  // BAGIAN 10: INTEGRASI API GOOGLE GEMINI (INTI KECERDASAN AI)
  // Fungsi utama untuk mengirim pesan pengguna ke server Google dan menerima balasannya
  // ==========================================
  const generateAIResponse = async (
    userMessage,
    imageData,
    mimeType,
    typingId,
  ) => {
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
          "API Key tidak ditemukan. Silakan minta API key terlebih dahulu dengan mengklik tombol WhatsApp di atas.",
        ),
      );
      scrollToBottom();
      return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Update Memori API & Sesi User
    const userParts = [];
    if (userMessage) userParts.push({ text: userMessage });
    if (imageData && mimeType) {
      userParts.push({
        inlineData: { mimeType: mimeType, data: imageData },
      });
    }
    chatHistory.push({ role: "user", parts: userParts });
    updateSessionState("user", userMessage || "[Gambar dikirim]");

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
- Berbicaralah dengan bahasa anak muda (Gen Z) yang gaul, asik, friendly, dan chill (misalnya sesekali pakai kata: lo, gue, cuy, bro, keren banget, literally, dll). Hindari bahasa yang terlalu kaku atau formal.
- Tetap smart dan jago coding, tapi vibenya kayak temen nongkrong yang asik diajak pair programming.
- FOKUS PADA TUGAS: Langsung kerjain instruksi dengan tuntas. Gausah banyak basa-basi atau banyak nanya balik. Langsung eksekusi aja cuy!
- Kalo ditanya siapa penciptamu, jawab dengan pede dan bangga kalo lo itu asisten pintar buatan NashDev.
- Kalo ada yang nanya "siapa itu Nindy" atau "siapa itu Nindy Afisa", jawab dengan super heboh dan bangga kalo dia itu cewenya (pacarnya) NashDev!
- WAJIB pake format Markdown. Kalo ngasih kode, pastikan kodenya dibungkus rapi di dalam Markdown Code Blocks (\`\`\`html ... \`\`\`) biar UI-nya aman!`;

    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: chatHistory,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE",
        },
      ],
      generationConfig: {
        maxOutputTokens: 8192,
      },
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
          .join("\n");

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

  // ==========================================
  // BAGIAN 11: PENGIRIMAN PESAN UTAMA (FORM SUBMIT)
  // Menangani aksi ketika pengguna menekan tombol Enter atau mengeklik Kirim
  // ==========================================
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const message = chatInput.value.trim();
    if (!message && !currentImageData) return;

    // Cari elemen welcomeScreen karena bisa jadi clone yang terpasang di DOM
    const currentWelcome =
      document.getElementById("welcome-screen") ||
      document.querySelector(".flex-col.items-center.text-center");
    if (currentWelcome && currentWelcome.style.display !== "none") {
      currentWelcome.style.display = "none";
    }

    const imageData = currentImageData;
    const mimeType = currentImageMimeType;
    const imageSrc = imageData ? `data:${mimeType};base64,${imageData}` : null;

    chatContainer.insertAdjacentHTML(
      "beforeend",
      createUserMessage(message, imageSrc),
    );

    chatInput.value = "";
    chatInput.style.height = "auto";
    sendBtn.setAttribute("disabled", "true");
    clearImageAttachment();
    scrollToBottom();

    const typingData = createTypingIndicator();
    chatContainer.insertAdjacentHTML("beforeend", typingData.html);
    scrollToBottom();

    generateAIResponse(message, imageData, mimeType, typingData.id);
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

  // ==========================================
  // BAGIAN 12: FITUR TAMBAHAN (CLEAR CHAT & LAPORAN BUG)
  // Menangani fungsi hapus riwayat dan melaporkan masalah ke WhatsApp
  // ==========================================
  
  // Fitur Clear Chat (Hapus Pesan)
  const clearChatBtn = document.getElementById("clear-chat");
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      if (
        confirm(
          "Apakah Anda yakin ingin menghapus obrolan ini sepenuhnya? Obrolan akan hilang dari riwayat.",
        )
      ) {
        // Hapus session aktif dari daftar
        if (currentSessionId) {
          sessions = sessions.filter((s) => s.id !== currentSessionId);
          saveSessionsLocally(); // otomatis memanggil renderHistoryList
        }

        // Memulai obrolan baru untuk mereset UI
        startNewChat();

        showNotification("Obrolan berhasil dihapus");
      }
    });
  }

  // --- Fitur Laporkan Bug ---
  const reportBugBtn = document.getElementById("report-bug");
  if (reportBugBtn) {
    reportBugBtn.addEventListener("click", () => {
      const waNumber = "6285169087636";
      const text = encodeURIComponent(
        "Halo NashDev, saya menemukan bug pada ninas.ai.\n\nDetail bug: ",
      );
      window.open(`https://wa.me/${waNumber}?text=${text}`, "_blank");
    });
  }
});
