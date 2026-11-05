import { processMainBase, crossReferenceServices, enrichClientData, detectProactivos } from './excelLogic.js';
import { processPrimerServicio } from './primerServicio.js';

// --- INICIALIZACIÓN DE FIREBASE (FIRESTORE) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC1DVA61DPFlbGSWr45GYqeAGg89-k5a4g",
  authDomain: "citas-hyundai-coatza.firebaseapp.com",
  projectId: "citas-hyundai-coatza",
  storageBucket: "citas-hyundai-coatza.firebasestorage.app",
  messagingSenderId: "333064695297",
  appId: "1:333064695297:web:da997c42555b2cb7bc1a00"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ==========================================
// ETAPA 1: ESTADO Y VARIABLES GLOBALES
// ==========================================
const databaseKey = 'hyundaiBDC';
const papeleraKey = 'hyundaiPapelera';
let database = JSON.parse(localStorage.getItem(databaseKey)) || [];
let papelera = JSON.parse(localStorage.getItem(papeleraKey)) || [];

let activeTab = 'activos';
let papeleraSubTab = 'activos'; // Para dividir la papelera
let editingIndex = null;
let currentFilter = 'all'; 
let captchaPassed = false;

let tempSafeDatabase = []; let tempPendingPurge = []; let tempNewRecords = [];

const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const tableBody = document.getElementById('table-body');
const uploadStatus = document.getElementById('upload-status');
const inputMesFiltro = document.getElementById('mes-filtro');

inputMesFiltro.addEventListener('change', renderTable);

// ==========================================
// ETAPA 2: ANIMACIONES Y POKÉDEX LOGIN
// ==========================================
function createPokeballRain() {
    const balls = ['https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png'];
    for (let i = 0; i < 25; i++) {
        let ball = document.createElement('div');
        ball.className = 'falling-ball';
        ball.style.backgroundImage = `url('${balls[Math.floor(Math.random() * balls.length)]}')`;
        ball.style.left = `${Math.random() * 100}vw`;
        ball.style.width = `${Math.random() * 50 + 60}px`; ball.style.height = ball.style.width;
        ball.style.animationDuration = `${Math.random() * 3 + 4}s`; ball.style.animationDelay = `${Math.random() * 5}s`;
        document.getElementById('rain-container').appendChild(ball);
    }
}

function checkDailyLogin() {
    createPokeballRain();
    if (localStorage.getItem('pokeLoginDate') === new Date().toLocaleDateString()) {
        loginScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); renderTable();
    }
}

document.getElementById('btn-power-on').addEventListener('click', () => {
    document.getElementById('power-on-screen').classList.add('hidden'); document.getElementById('game-screen').classList.remove('hidden');
    new Audio("https://www.myinstants.com/media/sounds/whos-that-pokemon_.mp3").play().catch(()=>{}); loadCaptcha();
});

async function loadCaptcha() {
    captchaPassed = false; document.getElementById('captcha-img').className = 'silhouette';
    document.getElementById('password-section').classList.add('hidden'); document.getElementById('captcha-buttons').innerHTML = "Cargando...";
    try {
        const randomIds = Array.from({length: 3}, () => Math.floor(Math.random() * 151) + 1);
        const pokemons = await Promise.all(randomIds.map(id => fetch(`https://pokeapi.co/api/v2/pokemon/${id}`).then(res => res.json())));
        const correctIndex = Math.floor(Math.random() * 3);
        document.getElementById('captcha-img').src = pokemons[correctIndex].sprites.front_default;
        document.getElementById('captcha-hint').textContent = `Pista: Es ${pokemons[correctIndex].name.toUpperCase()}`;
        document.getElementById('captcha-buttons').innerHTML = "";
        pokemons.forEach((poke, index) => {
            const btn = document.createElement('button'); btn.className = 'btn-captcha'; btn.textContent = poke.name;
            btn.onclick = () => {
                if(index === correctIndex) {
                    captchaPassed = true; document.getElementById('captcha-img').classList.add('revealed');
                    document.getElementById('captcha-hint').style.color = "green"; document.getElementById('captcha-buttons').innerHTML = ""; 
                    document.getElementById('password-section').classList.remove('hidden');
                } else alert("¡Ese no es!");
            };
            document.getElementById('captcha-buttons').appendChild(btn);
        });
    } catch (e) {}
}

function attemptLogin() {
    if (!captchaPassed) return alert("Adivina el Pokémon.");
    if (document.getElementById('password').value.trim() === "2099") {
        localStorage.setItem('pokeLoginDate', new Date().toLocaleDateString()); confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        loginScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); renderTable();
    } else { alert("Contraseña incorrecta."); document.getElementById('password').value = ""; }
}
document.getElementById('password').addEventListener('keypress', (e) => { if (e.key === 'Enter') attemptLogin(); });
document.getElementById('btn-logout').addEventListener('click', () => { localStorage.removeItem('pokeLoginDate'); location.reload(); });

// ==========================================
// ETAPA 3: NAVEGACIÓN Y FILTROS PRINCIPALES
// ==========================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); activeTab = btn.getAttribute('data-target');
        
        if (activeTab === 'papelera') {
            document.getElementById('table-title').textContent = "Papelera de Reciclaje";
            document.getElementById('upload-panel').classList.add('hidden');
            document.getElementById('stats-panel').classList.add('hidden');
            document.getElementById('view-filters').classList.add('hidden');
            document.getElementById('papelera-filters').classList.remove('hidden');
        } else {
            document.getElementById('table-title').textContent = "Directorio de Clientes";
            document.getElementById('upload-panel').classList.remove('hidden');
            document.getElementById('stats-panel').classList.remove('hidden');
            document.getElementById('view-filters').classList.remove('hidden');
            document.getElementById('papelera-filters').classList.add('hidden');
            
            const labels = { 'activos': 'Activos', 'inactivos': 'Inactivos', 'primer': 'Primer Servicio' };
            document.getElementById('current-tab-name').textContent = labels[activeTab];
            
            if (activeTab === 'primer') {
                document.getElementById('panel-enriquecer').classList.add('hidden');
                document.getElementById('panel-vincular').classList.add('hidden');
                document.getElementById('panel-proactivos').classList.add('hidden');
            } else {
                document.getElementById('panel-enriquecer').classList.remove('hidden');
                document.getElementById('panel-vincular').classList.remove('hidden');
                document.getElementById('panel-proactivos').classList.remove('hidden');
            }
        }
        uploadStatus.textContent = ""; renderTable();
    });
});

// Filtros de Vista (Todos, Pendientes, Proactivos)
document.getElementById('filter-all').addEventListener('click', (e) => {
    currentFilter = 'all'; updateFilterButtons(e.target); renderTable();
});
document.getElementById('filter-pendientes').addEventListener('click', (e) => {
    currentFilter = 'pendientes'; updateFilterButtons(e.target); renderTable();
});
document.getElementById('filter-proactivos').addEventListener('click', (e) => {
    currentFilter = 'proactivos'; updateFilterButtons(e.target); renderTable();
});

function updateFilterButtons(activeBtn) {
    document.getElementById('filter-all').style.background = '#6c757d';
    document.getElementById('filter-pendientes').style.background = '#6c757d';
    document.getElementById('filter-proactivos').style.background = '#6c757d';
    activeBtn.style.background = (currentFilter === 'proactivos') ? '#6f42c1' : 'var(--hyundai-blue)';
}

// Filtros internos de Papelera
document.querySelectorAll('.btn-pap-sub').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-pap-sub').forEach(b => b.style.background = '#6c757d');
        e.target.style.background = 'var(--hyundai-blue)';
        papeleraSubTab = e.target.getAttribute('data-sub');
        renderTable();
    });
});

// ==========================================
// ETAPA 4: PROCESAMIENTO EXCEL (BASE)
// ==========================================
document.getElementById('btn-process-excel').addEventListener('click', async () => {
    const file = document.getElementById('excel-upload').files[0];
    if (!file) return alert("Selecciona el archivo Excel.");
    uploadStatus.textContent = "Analizando datos..."; uploadStatus.style.color = "var(--hyundai-blue)";
    const mesActual = inputMesFiltro.value;
    
    try {
        if (activeTab === 'primer') {
            const newRecords = await processPrimerServicio(file, activeTab, mesActual);
            database = database.filter(d => !(d.tab_type === 'primer' && d.mes_anio === mesActual));
            database = [...database, ...newRecords];
            localStorage.setItem(databaseKey, JSON.stringify(database));
            uploadStatus.textContent = `¡Carga exitosa! (${newRecords.length} Autos Nuevos)`; uploadStatus.style.color = "green"; renderTable();
        } else {
            const result = await processMainBase(file, activeTab);
            tempNewRecords = result.newRecords.map(r => ({...r, mes_anio: mesActual}));
            if (result.discardedRecords.length > 0) {
                let listHtml = '<ul>' + result.discardedRecords.map(msg => `<li>${msg}</li>`).join('') + '</ul>';
                document.getElementById('base-report-list').innerHTML = listHtml;
                document.getElementById('base-report-modal').classList.remove('hidden');
                uploadStatus.textContent = "Pendiente confirmación..."; uploadStatus.style.color = "#ff9800";
            } else { finalizeBaseUpload(); }
        }
    } catch (err) { uploadStatus.textContent = "Error al procesar."; uploadStatus.style.color = "red"; }
});

function finalizeBaseUpload() {
    const mesActual = inputMesFiltro.value;
    database = database.filter(d => !(d.tab_type === activeTab && d.mes_anio === mesActual));
    database = [...database, ...tempNewRecords];
    localStorage.setItem(databaseKey, JSON.stringify(database));
    document.getElementById('base-report-modal').classList.add('hidden');
    uploadStatus.textContent = `¡Carga exitosa! (${tempNewRecords.length} agregados)`; uploadStatus.style.color = "green"; renderTable();
}
document.getElementById('btn-confirm-base').addEventListener('click', finalizeBaseUpload);
document.getElementById('btn-cancel-base').addEventListener('click', () => { document.getElementById('base-report-modal').classList.add('hidden'); tempNewRecords = []; uploadStatus.textContent = "Abortado."; uploadStatus.style.color = "red";});

// ==========================================
// ETAPA 5: ENRIQUECER, VINCULAR Y PROACTIVOS
// ==========================================
document.getElementById('btn-process-detalles').addEventListener('click', async () => {
    const file = document.getElementById('excel-detalles').files[0];
    if (!file) return alert("Selecciona archivo.");
    try {
        const result = await enrichClientData(file, database);
        database = result.updatedDatabase; localStorage.setItem(databaseKey, JSON.stringify(database));
        uploadStatus.textContent = `Enriquecidos: ${result.updatedCount}`; renderTable();
    } catch (err) {}
});

document.getElementById('btn-process-asesores').addEventListener('click', async () => {
    const files = document.getElementById('excel-asesores').files;
    if (files.length === 0) return alert("Selecciona archivos.");
    try {
        const result = await crossReferenceServices(files, database);
        tempSafeDatabase = [...result.verified, ...result.unaffected]; tempPendingPurge = result.pendingPurge;
        if (tempPendingPurge.length > 0) {
            let reportHtml = '';
            tempPendingPurge.forEach((c, index) => {
                reportHtml += `<label class="purge-item"><input type="checkbox" class="purge-checkbox" data-index="${index}" checked><div><strong>${c.cliente} (${c.orden})</strong><br><span style="color:#666;">${c.motivos_eliminacion}</span></div></label>`;
            });
            document.getElementById('report-list').innerHTML = reportHtml;
            document.getElementById('purge-counter').textContent = `${tempPendingPurge.length} seleccionados`;
            document.querySelectorAll('.purge-checkbox').forEach(chk => chk.addEventListener('change', () => {
                document.getElementById('purge-counter').textContent = `${document.querySelectorAll('.purge-checkbox:checked').length} seleccionados`;
            }));
            document.getElementById('report-modal').classList.remove('hidden');
        } else {
            database = tempSafeDatabase; localStorage.setItem(databaseKey, JSON.stringify(database)); renderTable();
        }
    } catch (err) {}
});

document.getElementById('btn-confirm-purge').addEventListener('click', () => {
    document.querySelectorAll('.purge-checkbox').forEach((chk, index) => {
        if (!chk.checked) tempSafeDatabase.push(tempPendingPurge[index]);
        else papelera.push(tempPendingPurge[index]); 
    });
    database = tempSafeDatabase; localStorage.setItem(databaseKey, JSON.stringify(database)); localStorage.setItem(papeleraKey, JSON.stringify(papelera));
    document.getElementById('report-modal').classList.add('hidden'); renderTable();
});
document.getElementById('btn-cancel-report').addEventListener('click', () => {
    database = [...tempSafeDatabase, ...tempPendingPurge]; localStorage.setItem(databaseKey, JSON.stringify(database));
    document.getElementById('report-modal').classList.add('hidden'); renderTable();
});

document.getElementById('btn-process-proactivos').addEventListener('click', async () => {
    const file = document.getElementById('excel-proactivos').files[0];
    if (!file) return alert("Selecciona archivo de los últimos meses.");
    try {
        const result = await detectProactivos(file, database);
        database = result.updatedDatabase; localStorage.setItem(databaseKey, JSON.stringify(database));
        uploadStatus.textContent = `Detectados ${result.detectadosCount} Proactivos.`; renderTable(); 
    } catch (err) {}
});

// ==========================================
// ETAPA 6: RENDER TABLA, MÉTRICAS Y MODALES
// ==========================================
function renderTable() {
    const mesActual = inputMesFiltro.value;
    let baseData = [];
    let isPapelera = activeTab === 'papelera';
    
    // Obtener los datos base según pestaña
    if (isPapelera) {
        baseData = papelera.filter(d => d.tab_type === papeleraSubTab);
    } else {
        baseData = database.filter(d => d.tab_type === activeTab && d.mes_anio === mesActual);
        
        // Calcular Estadísticas ANTES de los filtros de vista
        let total = baseData.length;
        let proact = baseData.filter(d => d.contactado === 'PROACTIVO_CONFIRMADO').length;
        let faltaContactar = baseData.filter(d => d.contactado === '-' || d.contactado === '' || d.contactado === 'PROACTIVO').length;
        let faltaCita = baseData.filter(d => d.contactado !== 'PROACTIVO_CONFIRMADO' && d.agendo !== 'SI').length;
        
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-proact').textContent = proact;
        document.getElementById('stat-contact').textContent = faltaContactar;
        document.getElementById('stat-cita').textContent = faltaCita;
    }
    
    // Aplicar Filtros de Vista (Pendientes, Proactivos)
    let dataToShow = [...baseData];
    if (!isPapelera) {
        if (currentFilter === 'proactivos') {
            dataToShow = dataToShow.filter(d => d.contactado === 'PROACTIVO' || d.contactado === 'PROACTIVO_CONFIRMADO');
        } else if (currentFilter === 'pendientes') {
            dataToShow = dataToShow.filter(d => d.contactado !== 'PROACTIVO_CONFIRMADO');
        }
    }
    
    document.getElementById('total-records').textContent = `${dataToShow.length} Registros`;
    if (dataToShow.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>No hay datos para esta vista.</td></tr>"; return;
    }
    
    let html = '';
    dataToShow.forEach((d, index) => {
        const realIndex = isPapelera ? index : database.findIndex(x => x.id === d.id);
        
        let statusTag = '';
        if (d.contactado === 'PROACTIVO') statusTag = `<button class="badge badge-proactivo" onclick="window.abrirModalProactivo(${realIndex})">Proactivo 👆</button>`;
        else if (d.contactado === 'PROACTIVO_CONFIRMADO') statusTag = '<span class="badge" style="background:#28a745; font-size:11px;">✅ Vino a Servicio</span>';
        else if (d.contactado === 'SI') statusTag = '<span class="badge" style="background:#28a745;">Contactado</span>';
        else if (d.contactado === 'NO') statusTag = '<span class="badge" style="background:#dc3545;">Fallido</span>';
        else statusTag = '<span class="badge" style="background:#6c757d;">Pendiente</span>';

        let actionButtons = '';
        if (isPapelera) {
            actionButtons = `<button class="btn-restore" onclick="window.restoreClient(${realIndex})">♻ Restaurar</button>`;
        } else {
            // BLOQUEO: Si ya es proactivo confirmado, no hay botones de acción
            if (d.contactado === 'PROACTIVO_CONFIRMADO') {
                actionButtons = `<span style="font-size:12px; color:#28a745; font-weight:bold;">Completado</span>`;
            } else {
                actionButtons = `
                    <div style="display:flex; justify-content:center; align-items:center;">
                        <button class="btn-action" onclick="window.openModal(${realIndex})">📋 Detalles</button>
                        <button class="btn-delete" title="Eliminar" onclick="window.deleteClient(${realIndex})">🗑️</button>
                    </div>`;
            }
        }

        html += `
            <tr>
                <td><strong>${d.orden}</strong></td>
                <td><div style="font-size:11px; color:#444;">${d.vin || 'N/D'}</div></td>
                <td><div class="client-name-cell">${d.cliente}</div></td>
                <td>${d.telefono}</td>
                <td><div style="font-size:10px; color:#555;">${d.ultimo_servicio}</div></td>
                <td class="highlight-col">${d.proximo_servicio}</td>
                <td>${statusTag}</td>
                <td style="text-align:center;">${actionButtons}</td>
            </tr>`;
    });
    tableBody.innerHTML = html;
}

// ------------------------------------------------
// MODAL PROACTIVO (Validación Segura)
// ------------------------------------------------
let proactivoIndex = null;
window.abrirModalProactivo = function(index) {
    proactivoIndex = index;
    document.getElementById('proactivo-name').textContent = database[index].cliente;
    document.getElementById('proactivo-vin-text').textContent = database[index].vin || 'N/D';
    document.getElementById('proactivo-modal').classList.remove('hidden');
};
document.getElementById('btn-proactivo-yes').addEventListener('click', () => {
    database[proactivoIndex].contactado = 'PROACTIVO_CONFIRMADO';
    database[proactivoIndex].agendo = 'SI';
    database[proactivoIndex].comentarios = (database[proactivoIndex].comentarios + " | [Vino a Servicio - Validado]").trim();
    localStorage.setItem(databaseKey, JSON.stringify(database));
    document.getElementById('proactivo-modal').classList.add('hidden'); renderTable();
});
document.getElementById('btn-proactivo-no').addEventListener('click', () => {
    database[proactivoIndex].contactado = '-'; 
    database[proactivoIndex].comentarios = (database[proactivoIndex].comentarios + " | [Falsa alarma de sistema]").trim();
    localStorage.setItem(databaseKey, JSON.stringify(database));
    document.getElementById('proactivo-modal').classList.add('hidden'); renderTable();
});
document.getElementById('btn-proactivo-cancel').addEventListener('click', () => document.getElementById('proactivo-modal').classList.add('hidden'));

// ------------------------------------------------
// Papelera y Limpieza
// ------------------------------------------------
window.deleteClient = function(realIndex) {
    if(confirm("¿Enviar este cliente a la papelera?")) {
        papelera.push(database.splice(realIndex, 1)[0]);
        localStorage.setItem(databaseKey, JSON.stringify(database)); localStorage.setItem(papeleraKey, JSON.stringify(papelera)); renderTable();
    }
};
window.restoreClient = function(papeleraIndex) {
    database.push(papelera.splice(papeleraIndex, 1)[0]);
    localStorage.setItem(databaseKey, JSON.stringify(database)); localStorage.setItem(papeleraKey, JSON.stringify(papelera)); renderTable();
};

document.getElementById('btn-clear-data').addEventListener('click', () => { 
    const pass = prompt("Acción Crítica. Ingresa la contraseña de administrador para borrar la memoria local:");
    if (pass === "2099") {
        database = []; papelera = []; 
        localStorage.setItem(databaseKey, '[]'); localStorage.setItem(papeleraKey, '[]'); 
        alert("Memoria borrada."); renderTable(); 
    } else if (pass !== null) { alert("Contraseña incorrecta."); }
});

// ------------------------------------------------
// Modal Normal (Client Card)
// ------------------------------------------------
window.openModal = function(index) {
    editingIndex = index; const d = database[index];
    document.getElementById('modal-client-name').textContent = d.cliente;
    document.getElementById('modal-contactado').value = d.contactado;
    document.getElementById('modal-medio').value = d.medio || '-';
    document.getElementById('modal-motivo').value = d.motivo || '-';
    document.getElementById('modal-agendo').value = d.agendo;
    document.getElementById('modal-comentarios').value = d.comentarios;
    
    document.getElementById('modal-auto').textContent = d.auto || 'N/D';
    document.getElementById('modal-anio').textContent = d.modelo_anio || 'N/D';
    document.getElementById('modal-vin').textContent = d.vin || 'N/D';
    document.getElementById('modal-km').textContent = d.kms ? new Intl.NumberFormat().format(d.kms) : 'N/D';
    document.getElementById('modal-tel').textContent = d.telefono || 'N/D';

    updateModalLogic(); renderModalHistory();
    document.getElementById('client-modal').classList.remove('hidden');
};

const modalContactado = document.getElementById('modal-contactado');
modalContactado.addEventListener('change', updateModalLogic);

function updateModalLogic() {
    const val = modalContactado.value;
    document.getElementById('group-medio').classList.add('hidden'); document.getElementById('group-motivo').classList.add('hidden');
    if(val === 'SI') document.getElementById('group-medio').classList.remove('hidden');
    else if (val === 'NO') {
        document.getElementById('group-motivo').classList.remove('hidden');
        if(document.getElementById('modal-comentarios').value === '') document.getElementById('modal-comentarios').value = "Se asume SMS enviado por defecto.";
    }
}

function renderModalHistory() {
    const logs = database[editingIndex].llamadas;
    document.getElementById('modal-history').innerHTML = logs.length === 0 ? "<em>Sin intentos.</em>" : logs.map((f, i) => `<div><strong>Intento ${i+1}:</strong> ${f}</div>`).join('');
}

document.getElementById('btn-register-call').addEventListener('click', () => {
    if(database[editingIndex].llamadas.length >= 4) return alert("Límite de intentos alcanzado (Máx 4).");
    const now = new Date();
    const fecha = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const medio = document.getElementById('modal-medio').value;
    const agendo = document.getElementById('modal-agendo').value;
    
    let detalle = `${fecha}`;
    if(medio !== '-') detalle += ` | Medio: ${medio}`;
    if(agendo !== '-') detalle += ` | Agendó: ${agendo}`;

    database[editingIndex].llamadas.push(detalle);
    localStorage.setItem(databaseKey, JSON.stringify(database)); renderModalHistory();
});

document.getElementById('btn-save-modal').addEventListener('click', () => {
    if (modalContactado.value !== '-' && modalContactado.value !== '') database[editingIndex].contactado = modalContactado.value;
    database[editingIndex].medio = modalContactado.value === 'SI' ? document.getElementById('modal-medio').value : '-';
    database[editingIndex].motivo = modalContactado.value === 'NO' ? document.getElementById('modal-motivo').value : '-';
    database[editingIndex].agendo = document.getElementById('modal-agendo').value;
    database[editingIndex].comentarios = document.getElementById('modal-comentarios').value;
    
    localStorage.setItem(databaseKey, JSON.stringify(database));
    document.getElementById('client-modal').classList.add('hidden'); renderTable();
});

document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('client-modal').classList.add('hidden'));
document.getElementById('btn-close-x').addEventListener('click', () => document.getElementById('client-modal').classList.add('hidden'));

checkDailyLogin();