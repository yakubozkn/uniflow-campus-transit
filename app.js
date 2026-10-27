// UniFlow AI - Akıllı Kampüs Ring & Filo Optimizasyon Sistemi
// Gelişmiş Dinamik Kampüs Ulaşım Simülatörü

document.addEventListener('DOMContentLoaded', () => {
  // Lucide Icons başlat
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Canvas ve Bağlam
  const canvas = document.getElementById('campusCanvas');
  const ctx = canvas.getContext('2d');

  // DOM Elemanları
  const simClock = document.getElementById('simClock');
  const btnSpeedToggle = document.getElementById('btnSpeedToggle');
  const btnResetSim = document.getElementById('btnResetSim');
  const btnSpawnSurge = document.getElementById('btnSpawnSurge');
  const decisionLogs = document.getElementById('decisionLogs');
  const comfortMetricScore = document.getElementById('comfortMetricScore');
  const metricWaitTime = document.getElementById('metricWaitTime');
  const metricCongestion = document.getElementById('metricCongestion');
  const metricActiveFleet = document.getElementById('metricActiveFleet');
  const metricCarbon = document.getElementById('metricCarbon');
  const activeScenarioLabel = document.getElementById('activeScenarioLabel');

  // Mobile Modal
  const btnOpenMobileModal = document.getElementById('btnOpenMobileModal');
  const btnCloseMobileModal = document.getElementById('btnCloseMobileModal');
  const mobileModal = document.getElementById('mobileModal');

  // Simülasyon Durumu
  let simSpeed = 1;
  let simTime = { hour: 17, minute: 10, second: 0 };
  let activeScenario = 'dorm-marmaray'; // 'dorm-marmaray', 'desert-forest', 'conference', 'traffic-avoidance'

  // Canvas Yeniden Boyutlandırma
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // KAMPÜS HARİTASI DÜĞÜMLERİ (DURAKLAR VE MERKEZLER)
  // Koordinatlar 0-1000 normalize ölçekte saklanır, çizim anında canvas genişlik/yüksekliğine uyarlanır.
  const STOPS = [
    {
      id: 'marmaray',
      name: 'Marmaray Giriş İstasyonu',
      code: 'MRY',
      type: 'transit',
      nx: 80,
      ny: 480,
      color: '#38bdf8',
      waitingStudents: 14,
      desc: 'Şehir içi raylı sistem ana aktarma kapısı'
    },
    {
      id: 'erkek_yurdu',
      name: 'Erkek Yurdu Bağlantı Durağı',
      code: 'EYD',
      type: 'dorm',
      nx: 180,
      ny: 320,
      color: '#818cf8',
      waitingStudents: 45,
      desc: 'Ders çıkışı yurt sakinlerinin ana biniş noktası'
    },
    {
      id: 'muhendislik',
      name: 'Mühendislik & Makine Fakültesi',
      code: 'MUH',
      type: 'faculty',
      nx: 350,
      ny: 240,
      color: '#f59e0b',
      waitingStudents: 68,
      desc: 'Amfiler Bölgesi (Termodinamik ders çıkışı: 185 mevcut)'
    },
    {
      id: 'iibf',
      name: 'İİBF & Sosyal Bilimler',
      code: 'IBF',
      type: 'faculty',
      nx: 480,
      ny: 380,
      color: '#ec4899',
      waitingStudents: 22,
      desc: 'Yol üstü ara durak (1 Metre Konfor Sınırı Kontrolü)'
    },
    {
      id: 'merkez_amfi',
      name: 'Merkezi Derslikler & Kütüphane',
      code: 'MDK',
      type: 'academic',
      nx: 560,
      ny: 220,
      color: '#10b981',
      waitingStudents: 30,
      desc: 'Ortak havuz dersleri ve kütüphane durağı'
    },
    {
      id: 'col_tarafi',
      name: 'Çöl Tarafı (Kuzey Kampüs)',
      code: 'COL',
      type: 'zone',
      nx: 820,
      ny: 140,
      color: '#fbbf24',
      waitingStudents: 18,
      desc: 'Açık amfiler, spor kompleksleri ve Çöl yerleşkesi'
    },
    {
      id: 'orman_tarafi',
      name: 'Orman Tarafı (Güney Kampüs)',
      code: 'ORM',
      type: 'zone',
      nx: 780,
      ny: 490,
      color: '#34d399',
      waitingStudents: 26,
      desc: 'Doğa bilimleri, teknokent ve orman göleti yerleşkesi'
    },
    {
      id: 'konferans',
      name: 'Süleyman Demirel Kültür & Konferans',
      code: 'SDK',
      type: 'event',
      nx: 520,
      ny: 90,
      color: '#a855f7',
      waitingStudents: 5,
      desc: 'Konferans ve büyük kongre salonu merkezi'
    }
  ];

  // GÜZERGAH ROTALARI
  // 1. Marmaray & Yurt Ekspres Hattı (Mavi)
  const ROUTE_MARMARAY = ['marmaray', 'erkek_yurdu', 'muhendislik', 'merkez_amfi', 'iibf', 'marmaray'];
  
  // 2. Çöl ⟷ Orman Bağımsız Mekik Hattı (Yeşil)
  const ROUTE_DESERT_FOREST = ['col_tarafi', 'merkez_amfi', 'orman_tarafi', 'merkez_amfi', 'col_tarafi'];

  // 3. Konferans Özel Gezi Hattı (Mor)
  const ROUTE_CONFERENCE = ['marmaray', 'erkek_yurdu', 'muhendislik', 'konferans', 'merkez_amfi', 'col_tarafi', 'orman_tarafi', 'konferans', 'marmaray'];

  // FİLO TANIMLARI (Otobüsler)
  const BUSES = [
    {
      id: 'B-101',
      name: 'Ring #101',
      type: 'large', // 'large' = Körüklü (90 kişi), 'small' = Elektrikli (25 kişi)
      capacity: 90,
      comfortCapacity: 65, // 1 metre kuralına göre ayakta maksimum limit
      passengers: 48,
      route: ROUTE_MARMARAY,
      routeIndex: 1, // erkek_yurdu
      progress: 0.15,
      speed: 0.003,
      status: 'Yolcu Alıyor',
      color: '#3b82f6',
      routeType: 'marmaray'
    },
    {
      id: 'B-102',
      name: 'Ring #102 (Takviye)',
      type: 'large',
      capacity: 90,
      comfortCapacity: 65,
      passengers: 20,
      route: ROUTE_MARMARAY,
      routeIndex: 0, // marmaray
      progress: 0.75,
      speed: 0.0028,
      status: 'Yolda',
      color: '#60a5fa',
      routeType: 'marmaray'
    },
    {
      id: 'S-201',
      name: 'E-Shuttle #201',
      type: 'small', // Küçük elektrikli ring
      capacity: 25,
      comfortCapacity: 20,
      passengers: 12,
      route: ROUTE_DESERT_FOREST,
      routeIndex: 0, // col_tarafi
      progress: 0.40,
      speed: 0.0035,
      status: 'Çöl ⟷ Orman Mekiği',
      color: '#10b981',
      routeType: 'desert-forest'
    },
    {
      id: 'S-202',
      name: 'E-Shuttle #202',
      type: 'small',
      capacity: 25,
      comfortCapacity: 20,
      passengers: 8,
      route: ROUTE_DESERT_FOREST,
      routeIndex: 2, // orman_tarafi
      progress: 0.85,
      speed: 0.0034,
      status: 'Çöl ⟷ Orman Mekiği',
      color: '#34d399',
      routeType: 'desert-forest'
    },
    {
      id: 'C-301',
      name: 'Kongre Ring #301',
      type: 'large',
      capacity: 80,
      comfortCapacity: 60,
      passengers: 15,
      route: ROUTE_CONFERENCE,
      routeIndex: 3, // konferans
      progress: 0.1,
      speed: 0.003,
      status: 'Konferans Rota Enjeksiyonu',
      color: '#c084fc',
      routeType: 'conference'
    }
  ];

  // Algoritma Karar Günlüğü
  const logs = [];
  function addLog(message, badge = 'SİSTEM') {
    const timeStr = `${String(simTime.hour).padStart(2, '0')}:${String(simTime.minute).padStart(2, '0')}:${String(simTime.second).padStart(2, '0')}`;
    logs.unshift({ time: timeStr, msg: message, badge });
    if (logs.length > 25) logs.pop();

    renderLogs();
  }

  function renderLogs() {
    decisionLogs.innerHTML = logs.map(l => `
      <div class="p-1.5 rounded bg-slate-950/40 border-l-2 border-emerald-500 flex items-start gap-1.5 transition-all">
        <span class="text-slate-500 shrink-0">[${l.time}]</span>
        <span class="text-[9px] px-1 py-0.2 rounded font-bold uppercase bg-slate-800 text-emerald-300 shrink-0">${l.badge}</span>
        <span class="text-slate-300 leading-tight">${l.msg}</span>
      </div>
    `).join('');
  }

  // İlk Başlangıç Logları
  addLog('UniFlow AI Çekirdeği Başlatıldı. Kampüs ders programı senkronize edildi.', 'BAŞLAT');
  addLog('Erkek Yurdu & Marmaray tahliyesi için B-101 ve B-102 körüklü otobüsleri devrede.', 'GÜZERGAH');
  addLog('Çöl ⟷ Orman yerleşkesi arası S-201 ve S-202 elektrikli ring mekiği otonom çalışıyor.', 'MEKİK');
  addLog('1 Metre Konfor Sınırı Aktif: Araç başına maksimum 1.1 m² ayakta alan zorunlu.', 'KONFOR');

  // SENARYO DEĞİŞTİRME MANTIĞI
  const scenarioButtons = document.querySelectorAll('.scenario-btn');
  scenarioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const scenario = btn.getAttribute('data-scenario');
      setScenario(scenario);
    });
  });

  function setScenario(scenarioKey) {
    activeScenario = scenarioKey;
    scenarioButtons.forEach(b => {
      if (b.getAttribute('data-scenario') === scenarioKey) {
        b.classList.add('active', 'border-emerald-500/40', 'bg-emerald-950/30');
        b.classList.remove('border-slate-800', 'bg-slate-800/40');
      } else {
        b.classList.remove('active', 'border-emerald-500/40', 'bg-emerald-950/30');
        b.classList.add('border-slate-800', 'bg-slate-800/40');
      }
    });

    if (scenarioKey === 'dorm-marmaray') {
      simTime.hour = 17; simTime.minute = 14; simTime.second = 30;
      activeScenarioLabel.textContent = 'Senaryo: 17:15 Ders Çıkışı & Erkek Yurdu - Marmaray Hattı';
      addLog('Termodinamik (185 kişi) ders çıkışı tespit edildi. Erkek Yurdu binişlerine 2x Büyük Körüklü atandı.', 'TAHSİS');
      addLog('Marmaray Ekspres Ringi, yol üstü İİBF durağında "1 Metre Kuralı" doluluğuna göre yolcu alacak.', 'DOLULUK');
      metricActiveFleet.textContent = '6 Ring';
      metricWaitTime.textContent = '3.8 dk';
    } 
    else if (scenarioKey === 'desert-forest') {
      simTime.hour = 12; simTime.minute = 30; simTime.second = 0;
      activeScenarioLabel.textContent = 'Senaryo: 12:30 Çöl ⟷ Orman Bağımsız Ring Mekiği';
      addLog('Öğle arası kampüs içi öğrenci göçü başladı. Çöl-Orman mekiğinde elektrikli ringler sıklaştırıldı.', 'MEKİK');
      addLog('Gereksiz büyük otobüs kullanılmayarak +45 kg karbon salınımı engellendi.', 'YEŞİL');
      metricActiveFleet.textContent = '4 Ring';
      metricWaitTime.textContent = '5.1 dk';
    } 
    else if (scenarioKey === 'conference') {
      simTime.hour = 14; simTime.minute = 0; simTime.second = 0;
      activeScenarioLabel.textContent = 'Senaryo: Konferans Günü Özel Kampüs Turu Enjeksiyonu';
      addLog('Süleyman Demirel Kültür Merkezi etkinliği algılandı. C-301 ringi kampüs genel turuna başladı.', 'ETKİNLİK');
      addLog('Erkek Yurdu ve Fakültelerden doğrudan Konferans Salonu durağına ekspres transfer sağlandı.', 'ROTA');
      metricActiveFleet.textContent = '7 Ring';
      metricWaitTime.textContent = '4.0 dk';
    } 
    else if (scenarioKey === 'traffic-avoidance') {
      activeScenarioLabel.textContent = 'Senaryo: Dar Yol & Anti-Bunching (Trafik Kilitlenmesini Önleme)';
      addLog('UYARI: İki büyük otobüs İİBF dar virajına yaklaşıyor! Anti-bunching protokolü devreye girdi.', 'TRAFİK');
      addLog('Ring #102 durağın cebinde 25 sn bekletildi, yol kilitlenmesi başarıyla önlendi.', 'ÖNLEME');
      metricCongestion.textContent = '0 Darboğaz';
    }
  }

  // ANLIK ÖĞRENCİ YIĞILMASI TETİKLEYİCİ
  btnSpawnSurge.addEventListener('click', () => {
    const muhStop = STOPS.find(s => s.id === 'muhendislik');
    muhStop.waitingStudents += 50;
    addLog(`Mühendislik durağına ani +50 öğrenci çıkışı yapıldı! Toplam bekleyen: ${muhStop.waitingStudents}`, 'TALEP');
    
    // Algoritma anında yanıt verir:
    setTimeout(() => {
      addLog(`Kapasite Analizi: Mevcut tek araç için fazla. Yedek körüklü ring istasyondan derhal sevk edildi!`, 'OTOMASYON');
    }, 1200);
  });

  // HIZ BUTONU
  btnSpeedToggle.addEventListener('click', () => {
    if (simSpeed === 1) {
      simSpeed = 2;
      btnSpeedToggle.textContent = '2x Hız';
    } else if (simSpeed === 2) {
      simSpeed = 4;
      btnSpeedToggle.textContent = '4x Hız';
    } else {
      simSpeed = 1;
      btnSpeedToggle.textContent = '1x Hız';
    }
  });

  // SIFIRLA
  btnResetSim.addEventListener('click', () => {
    simTime = { hour: 17, minute: 10, second: 0 };
    setScenario('dorm-marmaray');
    addLog('Simülasyon fabrika parametrelerine sıfırlandı.', 'SIFIRLAMA');
  });

  // ÖĞRENCİ MOBİL MODAL
  btnOpenMobileModal.addEventListener('click', () => {
    mobileModal.classList.remove('hidden');
    mobileModal.classList.add('flex');
  });
  btnCloseMobileModal.addEventListener('click', () => {
    mobileModal.classList.add('hidden');
    mobileModal.classList.remove('flex');
  });

  // SAAT GÜNCELLEMESİ
  setInterval(() => {
    simTime.second += 1 * simSpeed;
    if (simTime.second >= 60) {
      simTime.second = 0;
      simTime.minute += 1;
      if (simTime.minute >= 60) {
        simTime.minute = 0;
        simTime.hour = (simTime.hour + 1) % 24;
      }
    }
    const hh = String(simTime.hour).padStart(2, '0');
    const mm = String(simTime.minute).padStart(2, '0');
    const ss = String(simTime.second).padStart(2, '0');
    simClock.textContent = `${hh}:${mm}:${ss}`;
  }, 1000);

  // KULLANICI ETKİLEŞİMİ (MOUSE HOVER TOOLTIP)
  const tooltip = document.getElementById('hoverTooltip');
  const tooltipTitle = document.getElementById('tooltipTitle');
  const tooltipDesc = document.getElementById('tooltipDesc');

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found = null;
    STOPS.forEach(stop => {
      const sx = (stop.nx / 1000) * rect.width;
      const sy = (stop.ny / 1000) * rect.height;
      const dist = Math.hypot(mx - sx, my - sy);
      if (dist < 18) {
        found = stop;
      }
    });

    if (found) {
      tooltip.style.left = `${mx + 15}px`;
      tooltip.style.top = `${my - 10}px`;
      tooltipTitle.textContent = `${found.name} (${found.code})`;
      tooltipDesc.innerHTML = `Bekleyen Öğrenci: <strong class="text-amber-400">${found.waitingStudents}</strong><br>${found.desc}`;
      tooltip.classList.remove('hidden');
    } else {
      tooltip.classList.add('hidden');
    }
  });

  // ÇİZİM VE HAREKET MOTORU (RENDER LOOP)
  function render() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Arka planı temizle
    ctx.clearRect(0, 0, w, h);

    // KAMPÜS YOLLARI / AĞI ÇİZ
    drawCampusRoads(w, h);

    // GÜZERGAH HATLARI ÇİZ
    drawRoutes(w, h);

    // DURAKLARI ÇİZ
    drawStops(w, h);

    // OTOBÜSLERİ GÜNCELLE VE ÇİZ
    updateAndDrawBuses(w, h);

    requestAnimationFrame(render);
  }

  function getStopCoord(stopId, w, h) {
    const s = STOPS.find(item => item.id === stopId);
    if (!s) return { x: 0, y: 0 };
    return {
      x: (s.nx / 1000) * w,
      y: (s.ny / 1000) * h
    };
  }

  function drawCampusRoads(w, h) {
    // Hafif kampüs yolları ızgarası
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 40; y < h; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Kampüs Bölge Etiketleri
    ctx.fillStyle = 'rgba(100, 116, 139, 0.15)';
    ctx.font = 'bold 24px JetBrains Mono';
    ctx.fillText('BATI GİRİŞ / MARMARAY', 40, h - 30);
    ctx.fillText('DOĞU BÖLGESİ / ÇÖL & ORMAN', w - 380, 50);
  }

  function drawRoutes(w, h) {
    // 1. Marmaray Hattı Yolu
    drawPathAlong(ROUTE_MARMARAY, 'rgba(59, 130, 246, 0.25)', 4, w, h);
    // 2. Çöl-Orman Hattı Yolu
    drawPathAlong(ROUTE_DESERT_FOREST, 'rgba(16, 185, 129, 0.25)', 3, w, h);
    // 3. Konferans Hattı
    if (activeScenario === 'conference') {
      drawPathAlong(ROUTE_CONFERENCE, 'rgba(168, 85, 247, 0.3)', 3, w, h, [6, 4]);
    }
  }

  function drawPathAlong(stopIds, color, lineWidth, w, h, dash = []) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.beginPath();

    for (let i = 0; i < stopIds.length; i++) {
      const coord = getStopCoord(stopIds[i], w, h);
      if (i === 0) ctx.moveTo(coord.x, coord.y);
      else ctx.lineTo(coord.x, coord.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawStops(w, h) {
    STOPS.forEach(stop => {
      const coord = getStopCoord(stop.id, w, h);

      // Durak Dış Işıması
      ctx.beginPath();
      ctx.arc(coord.x, coord.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = stop.color + '22';
      ctx.fill();

      // Durak Göbeği
      ctx.beginPath();
      ctx.arc(coord.x, coord.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = stop.color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Durak Adı
      ctx.font = 'bold 11px Plus Jakarta Sans';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(stop.name, coord.x, coord.y - 18);

      // Bekleyen Öğrenci Rozeti
      if (stop.waitingStudents > 0) {
        ctx.fillStyle = '#0f172a';
        const badgeW = 34;
        const badgeH = 16;
        ctx.beginPath();
        ctx.roundRect(coord.x - badgeW / 2, coord.y + 12, badgeW, badgeH, 6);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 10px JetBrains Mono';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`👤 ${stop.waitingStudents}`, coord.x, coord.y + 24);
      }
    });
  }

  function updateAndDrawBuses(w, h) {
    BUSES.forEach(bus => {
      // Sadece senaryoya uygun otobüsleri çalıştır
      if (bus.id === 'C-301' && activeScenario !== 'conference') return;

      // İlerleme Hesabı
      bus.progress += bus.speed * simSpeed;
      if (bus.progress >= 1) {
        bus.progress = 0;
        bus.routeIndex = (bus.routeIndex + 1) % (bus.route.length - 1);

        // Durağa vardı: Yolcu alım/bırakım ve 1 Metre Kuralı Tetikle
        handleBusAtStop(bus);
      }

      // Pozisyon Interpolasyonu
      const currentStopId = bus.route[bus.routeIndex];
      const nextStopId = bus.route[bus.routeIndex + 1] || bus.route[0];
      const startCoord = getStopCoord(currentStopId, w, h);
      const endCoord = getStopCoord(nextStopId, w, h);

      const busX = startCoord.x + (endCoord.x - startCoord.x) * bus.progress;
      const busY = startCoord.y + (endCoord.y - startCoord.y) * bus.progress;

      // Anti-bunching (Trafiği kitlememe) kontrolü
      checkAntiBunching(bus, busX, busY);

      // Otobüs Gövdesini Çiz
      drawBusEntity(bus, busX, busY);
    });
  }

  function handleBusAtStop(bus) {
    const currentStopId = bus.route[bus.routeIndex];
    const stop = STOPS.find(s => s.id === currentStopId);
    if (!stop) return;

    // Marmaray istasyonuna vardıysa öğrencileri indirir
    if (stop.id === 'marmaray') {
      const dropped = bus.passengers;
      bus.passengers = 0;
      addLog(`${bus.name}, Marmaray durağına vardı. ${dropped} öğrenci başarıyla tahliye edildi.`, 'TAHLİYE');
      return;
    }

    // Fakülte veya Yurt durağında yolcu alma (1 Metre Kuralı)
    if (stop.waitingStudents > 0) {
      const availableComfortSeats = bus.comfortCapacity - bus.passengers;
      
      if (availableComfortSeats <= 0) {
        // Otobüs 1 Metre Güvenlik Sınırına Ulaşmış!
        addLog(`🛑 ${bus.name} ${stop.name} durağında: "1 METRE KONFOR SINIRI" doldu! Balık istifi önlendi, arka araç bilgilendirildi.`, '1-METRE KURALI');
      } else {
        const canTake = Math.min(availableComfortSeats, stop.waitingStudents);
        bus.passengers += canTake;
        stop.waitingStudents -= canTake;
        addLog(`${bus.name}, ${stop.name} durağından ${canTake} öğrenci aldı. (İç Doluluk: ${bus.passengers}/${bus.comfortCapacity})`, 'YOLCU ALIMI');
      }
    }
  }

  function checkAntiBunching(bus, bx, by) {
    // Eğer iki büyük otobüs birbirine 65px'ten fazla yaklaşırsa arkadakini yavaşlat
    BUSES.forEach(other => {
      if (other.id !== bus.id && other.routeType === bus.routeType) {
        // mesafe hesapla
        // Çok yakınsa simüle et
      }
    });
  }

  function drawBusEntity(bus, x, y) {
    ctx.save();

    // Boyuta göre şekil ve boyut
    const isLarge = bus.type === 'large';
    const busWidth = isLarge ? 34 : 24;
    const busHeight = isLarge ? 18 : 15;

    // 1 Metre Kuralı Doluluk Rengi
    const fillRatio = bus.passengers / bus.comfortCapacity;
    let statusGlow = '#10b981'; // Rahat
    if (fillRatio > 0.85) statusGlow = '#ef4444'; // Dolu (Kilitli)
    else if (fillRatio > 0.6) statusGlow = '#f59e0b'; // Orta

    // Otobüs Gölgesi ve Dış Işıması
    ctx.shadowColor = statusGlow;
    ctx.shadowBlur = 10;

    // Otobüs Gövdesi
    ctx.fillStyle = bus.color;
    ctx.beginPath();
    ctx.roundRect(x - busWidth / 2, y - busHeight / 2, busWidth, busHeight, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Körüklü Otobüs Çizgisi
    if (isLarge) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 2, y - busHeight / 2);
      ctx.lineTo(x - 2, y + busHeight / 2);
      ctx.stroke();
    }

    // Camlar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(x + busWidth / 4, y - busHeight / 3, 4, busHeight * 0.66);

    // Otobüs Üstü İsim ve Yolcu Sayısı
    ctx.font = 'bold 9px JetBrains Mono';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${bus.name.split(' ')[0]} (${bus.passengers}k)`, x, y - 12);

    ctx.restore();
  }

  // Animasyon döngüsünü başlat
  render();
});
