// ======= PRODUCTION MODE CHECK =======
const IS_PRODUCTION =
  !window.location.hostname.includes("localhost") &&
  !window.location.hostname.includes("127.0.0.1");

// Utility function untuk conditional logging
const logger = {
  log: (...args) => !IS_PRODUCTION && console.log(...args),
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => !IS_PRODUCTION && console.info(...args),
  time: (label) => !IS_PRODUCTION && console.time(label),
  timeEnd: (label) => !IS_PRODUCTION && console.timeEnd(label),
};

// ======= PERFORMANCE OPTIMIZED DATA & INIT =======
const kategoriDonatur = {
  kategori1: [
    "Mas Ani",
    "Pak Kholis",
    "Pak Hasyim",
    "Amat",
    "Mbak Is",
    "Dani",
    "Pak Napi",
    "Pak Ipin",
    "Mas Agus BZ",
    "Pak Fat",
    "Pak Ropi",
    "Mas Umam",
    "Pak Kisman",
    "Pak Yanto",
    "Pak Pardi",
    "Pak Salam",
    "Pak Piyan",
    "Pak Slamet",
    "Pak Ibin",
    "Idek",
    "Pak Ngari",
    "Pak Tukhin",
    "Pak Rofiq",
    "Pak Syafak",
    "Pak Jubaidi",
    "Mbak Kholis",
    "Pak Kholiq",
    "Pak Rokhan",
    "Mas Agus",
    "Mas Izin",
    "Pak Abror",
    "Mas Gustaf",
  ],
  kategori2: ["Pak A", "Pak B", "Pak C"],
  kategori3: ["Pak A", "Pak B", "Pak C"],
};

const kategoriLabel = {
  kategori1: "RT Tengah",
  kategori2: "RT Kulon",
  kategori3: "RT Kidul",
};

// Optimized data structures
let dataDonasi = [];
let dataCache = {
  kategori1: new Map(),
  kategori2: new Map(),
  kategori3: new Map(),
  timestamp: new Map(),
};
let donaturTerinput = {
  kategori1: new Set(),
  kategori2: new Set(),
  kategori3: new Set(),
};

// DOM Cache dengan lazy loading
let cachedElements = {};
let db;

// ======= HIGH-PERFORMANCE INITIALIZATION =======
document.addEventListener("DOMContentLoaded", async function () {
  logger.time("AppInitialization");

  try {
    // Initialize database dengan performance monitoring
    db = jimpitanDB;
    await db.init();
    console.log("✅ Database initialized successfully");

    // Pre-cache data untuk RT yang aktif
    await preloadCache("kategori1");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    showNotification("Gagal menginisialisasi penyimpanan offline", false);
  }

  // Initialize dengan batch operations
  await Promise.all([
    initializeCachedElements(),
    loadDataHariIni("kategori1"),
    muatDropdown("kategori1"),
  ]);

  setupEventListeners();

  // Show critical elements
  requestAnimationFrame(() => {
    document.querySelectorAll(".critical-hidden").forEach((el) => {
      el.classList.remove("critical-hidden");
      el.classList.add("critical-show");
    });
  });

  logger.timeEnd("AppInitialization");
});

// Optimized DOM caching
function initializeCachedElements() {
  const elements = {
    tanggalHariIni: "tanggalHariIni",
    notifikasi: "notifikasi",
    kategoriDonatur: "kategoriDonatur",
    donatur: "donatur",
    pemasukan: "pemasukan",
    btnTambah: "btnTambah",
    btnExport: "btnExport",
    btnHapus: "btnHapus",
    tabelDonasi: "tabelDonasi",
    totalDonasi: "totalDonasi",
    dataStatus: "dataStatus",
    dataInfo: "dataInfo",
    dataCount: "dataCount",
    btnRefresh: "btnRefresh",
  };

  Object.keys(elements).forEach((key) => {
    cachedElements[key] = document.getElementById(elements[key]);
  });
}

// High-performance event listeners dengan debouncing
function setupEventListeners() {
  // Optimized click handlers
  cachedElements.btnTambah.addEventListener("click", tambahData);
  cachedElements.btnExport.addEventListener("click", exportData);
  cachedElements.btnHapus.addEventListener("click", hapusDataHariIni);

  // Debounced dropdown change
  cachedElements.kategoriDonatur.addEventListener("change", async function () {
    const kategori = this.value;

    console.log("🔄 Switching to kategori:", kategori);
    showNotification("🔄 Memuat data...", true);

    try {
      // Load data untuk kategori baru
      await loadDataHariIni(kategori);

      // 🔧 FIX: Muat dropdown SETELAH data terload
      await muatDropdown(kategori);

      console.log("✅ Kategori switched successfully");
    } catch (error) {
      console.error("❌ Error switching kategori:", error);
      showNotification("Gagal memuat data kategori", false);
    }

    // Sembunyikan loading state
    setTimeout(() => {
      const notif = cachedElements.notifikasi;
      if (notif.textContent.includes("Memuat data")) {
        notif.textContent = "";
        notif.className =
          "mb-4 md:mb-6 text-center p-3 md:p-4 rounded-xl transition-all duration-300";
      }
    }, 500);
  });

  /// Optimized input handling
  cachedElements.pemasukan.addEventListener(
    "input",
    debounce(function (e) {
      const value = e.target.value.replace(/\D/g, "");
      if (value.length > 8) {
        e.target.value = value.slice(0, 8);
      }
    }, 150)
  );

  // Auto-focus dengan delay untuk performance
  setTimeout(() => {
    cachedElements.pemasukan.focus();
  }, 100);
}

// ======= PERFORMANCE OPTIMIZED DATA LOADING =======
async function preloadCache(kategori) {
  try {
    // Cek jika cache methods tersedia
    if (typeof db.getCache !== "function") {
      console.log("⚠️ Cache methods not available, skipping preload");
      return;
    }

    const today = new Date().toLocaleDateString("id-ID");
    const cacheKey = `${kategori}_${today}`;

    const cached = await db.getCache(cacheKey);
    if (cached) {
      dataCache[kategori] = new Map(cached.map((item) => [item.donatur, item]));
      dataCache.timestamp.set(kategori, Date.now());
    }
  } catch (error) {
    console.log(
      "⚠️ Cache preload failed, continuing without cache:",
      error.message
    );
    // Jangan tampilkan error ke user, cukup continue tanpa cache
  }
}

// Di fungsi loadDataHariIni - tambahkan cache availability check
async function loadDataHariIni(kategori) {
  const today = new Date().toLocaleDateString("id-ID");
  const cacheKey = `${kategori}_${today}`;

  // Try cache first (jika available)
  const cachedTimestamp = dataCache.timestamp.get(kategori);
  if (cachedTimestamp && Date.now() - cachedTimestamp < 30000) {
    const cachedData = Array.from(dataCache[kategori].values());
    dataDonasi = cachedData.filter((item) => item.tanggal === today);

    donaturTerinput[kategori] = new Set(dataDonasi.map((item) => item.donatur));
    renderTabelTerurut(kategori);
    updateTotalDisplay();
    updateDataCount();
    return;
  }

  try {
    const savedData = await db.getDailyInputs(kategori, today);

    // Update cache (jika cache methods available)
    dataCache[kategori] = new Map(
      savedData.map((item) => [item.donatur, item])
    );
    dataCache.timestamp.set(kategori, Date.now());

    // Save to persistent cache (jika available)
    if (typeof db.setCache === "function") {
      try {
        await db.setCache(cacheKey, savedData, 300000);
      } catch (cacheError) {
        console.log("⚠️ Cache save failed, continuing:", cacheError.message);
      }
    }

    dataDonasi = savedData.map((item) => ({
      donatur: item.donatur,
      nominal: item.nominal,
      tanggal: item.tanggal,
      kategori: item.kategori,
      id: item.id,
    }));

    donaturTerinput[kategori] = new Set();
    dataDonasi.forEach((item) => {
      donaturTerinput[kategori].add(item.donatur);
    });

    renderTabelTerurut(kategori);
    updateTotalDisplay();
    updateDataCount();
  } catch (error) {
    console.error("❌ Error loading data:", error);

    // Coba fallback method
    try {
      const savedData = await db.getDailyInputsFallback(kategori, today);

      dataDonasi = savedData.map((item) => ({
        donatur: item.donatur,
        nominal: item.nominal,
        tanggal: item.tanggal,
        kategori: item.kategori,
        id: item.id,
      }));

      donaturTerinput[kategori] = new Set();
      dataDonasi.forEach((item) => {
        donaturTerinput[kategori].add(item.donatur);
      });

      renderTabelTerurut(kategori);
      updateTotalDisplay();
      updateDataCount();
    } catch (fallbackError) {
      console.error("❌ Fallback also failed:", fallbackError);

      // Reset ke state kosong
      dataDonasi = [];
      donaturTerinput[kategori] = new Set();
    }
  }
}

// ======= HIGH-PERFORMANCE CORE FUNCTIONS =======
async function tambahData() {
  const donatur = cachedElements.donatur.value;
  const nominal = cachedElements.pemasukan.value;
  const kategori = cachedElements.kategoriDonatur.value;

  if (!donatur || donatur === "" || nominal === "") {
    showNotification("Nama dan nominal tidak boleh kosong", false);
    return;
  }

  const tanggal = new Date().toLocaleDateString("id-ID");

  try {
    // Check cache first untuk performance
    const existingInCache = dataCache[kategori].get(donatur);
    const existingIndex = dataDonasi.findIndex(
      (item) => item.donatur === donatur
    );

    if (existingIndex !== -1 || existingInCache) {
      // Update existing data
      const itemId = existingInCache?.id || dataDonasi[existingIndex].id;

      if (existingIndex !== -1) {
        dataDonasi[existingIndex].nominal = nominal;
        dataDonasi[existingIndex].tanggal = tanggal;
      }

      // Update cache
      if (existingInCache) {
        dataCache[kategori].set(donatur, {
          ...existingInCache,
          nominal,
          tanggal,
        });
      }

      // Update database
      if (itemId) {
        await db.updateDailyInput(itemId, { nominal, tanggal });
      }

      showNotification(`✏️ Data ${donatur} diperbarui`, true);
    } else {
      // Add new data
      const newData = { donatur, nominal, tanggal, kategori };
      const newId = await db.saveDailyInput(newData);
      newData.id = newId;

      dataDonasi.push(newData);
      donaturTerinput[kategori].add(donatur);
      dataCache[kategori].set(donatur, newData);

      if (parseInt(nominal) === 0) {
        showNotification(`✅ Data ${donatur} disimpan (tidak mengisi)`, true);
      } else {
        showNotification(`✅ Data ${donatur} berhasil disimpan`, true);
      }
    }

    // Batch DOM updates
    requestAnimationFrame(() => {
      renderTabelTerurut(kategori);
      updateTotalDisplay();
      updateDataCount();
    });

    await muatDropdown(kategori);
    cachedElements.pemasukan.value = "";

    // Optimized auto-focus
    setTimeout(() => {
      cachedElements.pemasukan.focus();
    }, 50);
  } catch (error) {
    console.error("❌ Error saving data:", error);
    showNotification("Gagal menyimpan data", false);
  }
}

async function exportData() {
  const kategori = cachedElements.kategoriDonatur.value;

  if (dataDonasi.length === 0) {
    showNotification("Tidak ada data untuk diexport", false);
    return;
  }

  try {
    const sortedData = getSortedDataDonasi(kategori);

    // Optimized CSV generation
    const csvContent = generateCSVContent(sortedData, kategori);

    // Optimized file download
    downloadCSV(csvContent, kategori);

    showNotification(
      `✅ Data berhasil diexport untuk ${kategoriLabel[kategori]}`,
      true
    );
  } catch (error) {
    console.error("❌ Error exporting data:", error);
    showNotification("Gagal mengexport data", false);
  }
}

async function hapusDataHariIni() {
  const kategori = cachedElements.kategoriDonatur.value;
  const today = new Date().toLocaleDateString("id-ID");

  if (dataDonasi.length === 0) {
    showNotification("Tidak ada data untuk dihapus", false);
    return;
  }

  if (
    !confirm(
      `Apakah Anda yakin ingin menghapus semua data hari ini untuk ${kategoriLabel[kategori]}?`
    )
  ) {
    return;
  }

  try {
    // Coba method utama dulu
    let result;
    if (typeof db.deleteDailyInputsByDate === "function") {
      result = await db.deleteDailyInputsByDate(kategori, today);
    } else {
      // Fallback ke method manual
      console.log("🔄 Using fallback delete method");
      result = await db.deleteDailyInputsByDateFallback(kategori, today);
    }

    // Clear cache
    dataCache[kategori].clear();
    dataCache.timestamp.delete(kategori);

    // Reset state
    dataDonasi = [];
    donaturTerinput[kategori] = new Set();

    // Batch DOM updates
    requestAnimationFrame(() => {
      const tbody = cachedElements.tabelDonasi.querySelector("tbody");
      tbody.innerHTML = "";
      updateTotalDisplay();
      updateDataCount();
    });

    await muatDropdown(kategori);
    showNotification("🗑️ Data hari ini berhasil dihapus", true);
  } catch (error) {
    console.error("❌ Error deleting data:", error);

    // Coba fallback: delete satu per satu
    try {
      console.log("🔄 Trying individual delete fallback...");
      await deleteDataIndividually(kategori, today);

      // Clear cache
      dataCache[kategori].clear();
      dataCache.timestamp.delete(kategori);

      // Reset state
      dataDonasi = [];
      donaturTerinput[kategori] = new Set();

      // Batch DOM updates
      requestAnimationFrame(() => {
        const tbody = cachedElements.tabelDonasi.querySelector("tbody");
        tbody.innerHTML = "";
        updateTotalDisplay();
        updateDataCount();
      });

      await muatDropdown(kategori);
      showNotification("🗑️ Data hari ini berhasil dihapus", true);
    } catch (fallbackError) {
      console.error("❌ All delete methods failed:", fallbackError);
      showNotification("Gagal menghapus data", false);
    }
  }
}

// Fallback function: delete data satu per satu
async function deleteDataIndividually(kategori, tanggal) {
  const savedData = await db.getDailyInputs(kategori, tanggal);

  let successCount = 0;
  let errorCount = 0;

  for (const item of savedData) {
    try {
      await db.deleteDailyInput(item.id);
      successCount++;
    } catch (error) {
      errorCount++;
      console.error("❌ Failed to delete item:", item.id, error);
    }
  }

  console.log(
    `✅ Deleted ${successCount} items individually, ${errorCount} errors`
  );

  if (errorCount > 0) {
    throw new Error(`Failed to delete ${errorCount} items`);
  }
}

// ======= HIGH-PERFORMANCE HELPER FUNCTIONS =======
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showNotification(message, isSuccess = true) {
  requestAnimationFrame(() => {
    const notif = cachedElements.notifikasi;
    notif.textContent = message;
    notif.className =
      "mb-4 md:mb-6 text-center p-3 md:p-4 rounded-xl transition-all duration-300 opacity-100 show";

    if (isSuccess) {
      notif.classList.add("bg-green-50", "border-green-200", "text-green-700");
    } else {
      notif.classList.add("bg-red-50", "border-red-200", "text-red-700");
    }

    setTimeout(() => {
      notif.classList.remove("show");
      setTimeout(() => {
        notif.textContent = "";
        notif.className =
          "mb-4 md:mb-6 text-center p-3 md:p-4 rounded-xl transition-all duration-300";
      }, 300);
    }, 4000);
  });
}

async function muatDropdown(kategori = "kategori1") {
  const select = cachedElements.donatur;
  const names = kategoriDonatur[kategori];

  logger.log("📝 Loading dropdown for kategori:", kategori);
  logger.log("📊 Total donatur:", names.length);
  logger.log("✅ Sudah diinput:", donaturTerinput[kategori]?.size || 0);

  // Filter hanya donatur yang belum diinput
  const donaturBelumDiinput = names.filter(
    (nama) => !donaturTerinput[kategori]?.has(nama)
  );

  logger.log("📋 Belum diinput:", donaturBelumDiinput.length);

  // Kosongkan dropdown
  select.innerHTML = "";

  if (donaturBelumDiinput.length === 0) {
    // Semua donatur sudah diinput
    const option = new Option("🎉 Semua donatur sudah diinput", "");
    option.disabled = true;
    select.appendChild(option);

    cachedElements.btnTambah.disabled = true;
    if (cachedElements.btnTambah.querySelector("#btnText")) {
      cachedElements.btnTambah.querySelector("#btnText").textContent =
        "Selesai";
    }
    cachedElements.pemasukan.disabled = true;

    console.log("✅ All donors completed for", kategori);
  } else {
    // 🔧 FIX: Hanya tambahkan donatur yang tersedia, TANPA default option
    const fragment = document.createDocumentFragment();

    // 🔧 PERUBAHAN PENTING: Langsung tambahkan donatur pertama sebagai selected
    if (donaturBelumDiinput.length > 0) {
      const firstDonor = donaturBelumDiinput[0];
      const firstOption = new Option(firstDonor, firstDonor);
      firstOption.selected = true; // Langsung select yang pertama
      fragment.appendChild(firstOption);

      // Tambahkan sisa donatur (jika ada lebih dari 1)
      for (let i = 1; i < donaturBelumDiinput.length; i++) {
        fragment.appendChild(
          new Option(donaturBelumDiinput[i], donaturBelumDiinput[i])
        );
      }
    }

    select.appendChild(fragment);
    cachedElements.btnTambah.disabled = false;
    if (cachedElements.btnTambah.querySelector("#btnText")) {
      cachedElements.btnTambah.querySelector("#btnText").textContent = "Tambah";
    }
    cachedElements.pemasukan.disabled = false;

    logger.log(
      "✅ Dropdown loaded with",
      donaturBelumDiinput.length,
      "options"
    );
    logger.log("🎯 First donor auto-selected:", donaturBelumDiinput[0]);
  }

  // Trigger change event untuk update UI
  setTimeout(() => {
    select.dispatchEvent(new Event("change"));
  }, 10);
}

function getSortedDataDonasi(kategori) {
  const dataMap = new Map(dataDonasi.map((item) => [item.donatur, item]));
  const sortedData = [];

  kategoriDonatur[kategori].forEach((nama) => {
    if (dataMap.has(nama)) {
      sortedData.push(dataMap.get(nama));
    }
  });

  return sortedData;
}

// FIXED: High-performance table rendering
function renderTabelTerurut(kategori) {
  const tbody = cachedElements.tabelDonasi.querySelector("tbody");
  const sortedData = getSortedDataDonasi(kategori);

  // Clear existing content efficiently
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  if (sortedData.length === 0) {
    const row = tbody.insertRow();
    const cell = row.insertCell(0);
    cell.colSpan = 3;
    cell.className = "py-8 text-center text-gray-500";
    cell.innerHTML =
      '<i class="fas fa-inbox text-4xl mb-2 block"></i><span>Tidak ada data untuk ditampilkan</span>';
    return;
  }

  // Use DocumentFragment untuk batch DOM updates - FIXED VERSION
  const fragment = document.createDocumentFragment();

  sortedData.forEach((item) => {
    // Create row using tbody method, not fragment
    const row = document.createElement("tr");
    row.className = "hover:bg-gray-50 transition-colors";

    // Donatur cell
    const donaturCell = document.createElement("td");
    donaturCell.className = "py-3 md:py-4 px-4 md:px-6";
    donaturCell.textContent = item.donatur;
    row.appendChild(donaturCell);

    // Nominal cell
    const nominalCell = document.createElement("td");
    nominalCell.className = "py-3 md:py-4 px-4 md:px-6 text-right font-mono";

    if (parseInt(item.nominal) === 0) {
      nominalCell.textContent = "Tidak Mengisi";
      nominalCell.classList.add("text-gray-400", "italic");
    } else {
      nominalCell.textContent =
        "Rp " + Number(item.nominal).toLocaleString("id-ID");
    }
    row.appendChild(nominalCell);

    // Actions cell
    const aksiCell = document.createElement("td");
    aksiCell.className = "py-3 md:py-4 px-4 md:px-6 text-center";

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.className =
      "bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-lg transition duration-200 mx-1";
    editBtn.onclick = () => editRow(row, kategori, item.donatur, item.id);
    aksiCell.appendChild(editBtn);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.className =
      "bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition duration-200 mx-1";
    deleteBtn.onclick = () => hapusRow(kategori, item.donatur, item.id);
    aksiCell.appendChild(deleteBtn);

    row.appendChild(aksiCell);
    fragment.appendChild(row);
  });

  // Single DOM update
  tbody.appendChild(fragment);
}

function updateTotalDisplay() {
  let total = 0;
  for (let i = 0; i < dataDonasi.length; i++) {
    total += Number(dataDonasi[i].nominal);
  }

  cachedElements.totalDonasi.textContent =
    "Rp " + total.toLocaleString("id-ID");
}

function updateDataCount() {
  if (cachedElements.dataCount) {
    cachedElements.dataCount.textContent = `${dataDonasi.length} data`;
  }
}

// Optimized CSV generation
function generateCSVContent(sortedData, kategori) {
  let csvContent = "Nama,Nominal,Tanggal,Kategori\n";

  for (let i = 0; i < sortedData.length; i++) {
    const item = sortedData[i];
    const nominal =
      item.nominal === "0"
        ? "Tidak Mengisi"
        : `Rp ${Number(item.nominal).toLocaleString("id-ID")}`;
    csvContent += `"${item.donatur}","${nominal}","${item.tanggal}","${kategoriLabel[kategori]}"\n`;
  }

  const total = sortedData.reduce((sum, item) => sum + Number(item.nominal), 0);
  csvContent += `\n"Total","Rp ${total.toLocaleString("id-ID")}","",""`;

  return csvContent;
}

// Optimized file download
function downloadCSV(csvContent, kategori) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const today = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `data-jimpitan-${kategoriLabel[kategori]}-${today}.csv`
  );

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Optimized edit functionality
function editRow(row, kategori, donaturLama, itemId) {
  const nominalCell = row.cells[1];
  const aksiCell = row.cells[2];
  const currentNominal = nominalCell.textContent.replace(/[Rp\s.]/g, "");

  nominalCell.innerHTML = `<input type="number" id="editInput" value="${currentNominal}" min="0" 
        class="w-24 md:w-32 px-3 py-2 border border-gray-300 rounded text-right font-mono 
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500">`;

  aksiCell.innerHTML = "";

  const saveBtn = document.createElement("button");
  saveBtn.innerHTML = '<i class="fas fa-check"></i>';
  saveBtn.className =
    "bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-lg transition duration-200 mx-1";
  saveBtn.onclick = () =>
    simpanEdit(
      kategori,
      donaturLama,
      document.getElementById("editInput").value,
      itemId
    );
  aksiCell.appendChild(saveBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
  cancelBtn.className =
    "bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg transition duration-200 mx-1";
  cancelBtn.onclick = () => loadDataHariIni(kategori);
  aksiCell.appendChild(cancelBtn);

  requestAnimationFrame(() => {
    const editInput = document.getElementById("editInput");
    if (editInput) {
      editInput.focus();
      editInput.select();
    }
  });
}

async function simpanEdit(kategori, donaturLama, nominalBaru, itemId) {
  try {
    const tanggal = new Date().toLocaleDateString("id-ID");

    if (itemId) {
      await db.updateDailyInput(itemId, { nominal: nominalBaru, tanggal });
    }

    // Update cache
    const cachedItem = dataCache[kategori].get(donaturLama);
    if (cachedItem) {
      dataCache[kategori].set(donaturLama, {
        ...cachedItem,
        nominal: nominalBaru,
        tanggal,
      });
    }

    // Update local data
    const itemIndex = dataDonasi.findIndex((item) => item.id === itemId);
    if (itemIndex !== -1) {
      dataDonasi[itemIndex].nominal = nominalBaru;
      dataDonasi[itemIndex].tanggal = tanggal;
    }

    requestAnimationFrame(() => {
      renderTabelTerurut(kategori);
      updateTotalDisplay();
    });

    await muatDropdown(kategori);
    showNotification(`✅ Data ${donaturLama} berhasil diperbarui`, true);
  } catch (error) {
    console.error("❌ Error updating data:", error);
    showNotification("Gagal memperbarui data", false);
  }
}

async function hapusRow(kategori, donatur, itemId) {
  if (!confirm(`Hapus data ${donatur}?`)) return;

  try {
    if (itemId) {
      await db.deleteDailyInput(itemId);
    }

    // Update cache
    dataCache[kategori].delete(donatur);

    // Update local data
    dataDonasi = dataDonasi.filter((item) => item.id !== itemId);
    donaturTerinput[kategori].delete(donatur);

    requestAnimationFrame(() => {
      renderTabelTerurut(kategori);
      updateTotalDisplay();
      updateDataCount();
    });

    await muatDropdown(kategori);
    showNotification(`🗑️ Data ${donatur} berhasil dihapus`, true);
  } catch (error) {
    console.error("❌ Error deleting row:", error);
    showNotification("Gagal menghapus data", false);
  }
}
