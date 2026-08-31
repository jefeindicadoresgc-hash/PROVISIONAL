/* ================= SECCIÓN 1: FIREBASE INIT ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA-x8ZZvJXAOK7Q18PVWPybmfPZ7xDBNHo",
    authDomain: "tablero-pruebas.firebaseapp.com",
    databaseURL: "https://tablero-pruebas-default-rtdb.firebaseio.com",
    projectId: "tablero-pruebas",
    storageBucket: "tablero-pruebas.firebasestorage.app",
    messagingSenderId: "900913447132",
    appId: "1:900913447132:web:fd3b5cc73af4263d69b419"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ================= SECCIÓN 2: SISTEMA DE LOGIN ================= */
window.checkLogin = function() {
    const pwd = document.getElementById('pwd').value.trim(); 
    if (pwd === "2099" || pwd === "0") {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
    } else {
        alert("Contraseña incorrecta. ¡Boom! 🧨");
    }
};

document.getElementById('pwd').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') window.checkLogin();
});

/* ================= SECCIÓN 3: FUNCIONES HELPER Y SETUP ================= */
const formatMoney = (amount) => {
    return "$" + parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseNum = (val) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;

const formatInputWithCommas = (e) => {
    let value = e.target.value.replace(/[^0-9.-]/g, ''); 
    if (value) {
        let parts = value.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        e.target.value = parts.join('.');
    }
    if(e.target.id.includes("comp-")) updateComprasUI();
    else updateSalesUI();
};

// Auto-seleccionar el mes actual
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('month-selector').value = "2026-08";
    initComprasTable();
});

/* ================= SECCIÓN 4: TABLA DE COMPRAS (GENERACIÓN Y LÓGICA) ================= */
const lineasCompras = ['MOBIS', 'SEMI-SINTETICO', 'SINTETICO', 'WURTH', 'LLANTAS', 'ACCESORIOS'];

function initComprasTable() {
    const tbody = document.getElementById('compras-tbody');
    tbody.innerHTML = '';
    
    lineasCompras.forEach(linea => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: bold; color: white;">${linea}</td>
            <td><input type="text" id="comp-obj-${linea}" class="val-box" value="0"></td>
            <td><input type="text" id="comp-real-${linea}" class="val-box" value="0"></td>
            <td id="comp-alcance-${linea}" style="font-weight: bold;">0%</td>
            <td id="comp-dif-${linea}" style="font-weight: bold;">$0.00</td>
        `;
        tbody.appendChild(tr);

        document.getElementById(`comp-obj-${linea}`).addEventListener('input', formatInputWithCommas);
        document.getElementById(`comp-real-${linea}`).addEventListener('input', formatInputWithCommas);
    });
}

function updateComprasUI() {
    let totalObj = 0, totalReal = 0;

    lineasCompras.forEach(linea => {
        const obj = parseNum(document.getElementById(`comp-obj-${linea}`).value);
        const real = parseNum(document.getElementById(`comp-real-${linea}`).value);
        
        totalObj += obj;
        totalReal += real;

        const dif = real - obj;
        const alcance = obj > 0 ? Math.round((real / obj) * 100) : 0;

        const difColor = dif < 0 ? 'var(--red-acme)' : '#4CAF50';
        const alcanceColor = alcance < 100 ? 'var(--red-acme)' : '#4CAF50';

        document.getElementById(`comp-dif-${linea}`).innerHTML = `<span style="color:${difColor}">${formatMoney(dif)}</span>`;
        document.getElementById(`comp-alcance-${linea}`).innerHTML = `<span style="color:${alcanceColor}">${alcance}%</span>`;
    });

    const totalDif = totalReal - totalObj;
    const totalAlcance = totalObj > 0 ? Math.round((totalReal / totalObj) * 100) : 0;

    document.getElementById('comp-obj-total').innerText = formatMoney(totalObj);
    document.getElementById('comp-real-total').innerText = formatMoney(totalReal);
    document.getElementById('comp-alcance-total').innerText = totalAlcance + "%";
    document.getElementById('comp-dif-total').innerText = formatMoney(totalDif);
}

/* ================= SECCIÓN 5: GUARDAR Y CARGAR RESPALDOS ================= */
document.getElementById('btn-save').addEventListener('click', () => {
    const month = document.getElementById('month-selector').value;
    if(!month) return alert("Selecciona un mes.");

    // Recolectar Obsoletos
    let obsData = [];
    document.querySelectorAll('#obs-tbody tr').forEach(tr => {
        obsData.push({
            parte: tr.children[0].innerText,
            desc: tr.children[1].innerText,
            importe: parseNum(tr.children[2].innerText),
            clasificacion: tr.children[3].innerText,
            comentario: tr.querySelector('.comment-input').value
        });
    });

    // Recolectar Ventas
    let ventasData = {
        mostrador: {
            obj: parseNum(document.getElementById('obj-mostrador').value),
            venta: parseNum(document.getElementById('ven-mostrador').innerText),
            costo: parseNum(document.getElementById('cos-mostrador').innerText)
        },
        taller: {
            obj: parseNum(document.getElementById('obj-taller').value),
            venta: parseNum(document.getElementById('ven-taller').innerText),
            costo: parseNum(document.getElementById('cos-taller').innerText)
        }
    };

    // Recolectar Compras
    let comprasData = {};
    lineasCompras.forEach(linea => {
        comprasData[linea] = {
            obj: parseNum(document.getElementById(`comp-obj-${linea}`).value),
            real: parseNum(document.getElementById(`comp-real-${linea}`).value)
        };
    });

    set(ref(db, `respaldos/${month}`), { obsoletos: obsData, ventas: ventasData, compras: comprasData })
        .then(() => alert(`Respaldo de ${month} guardado en la bóveda de ACME Corp 📦`));
});

document.getElementById('btn-load').addEventListener('click', () => {
    const month = document.getElementById('month-selector').value;
    if(!month) return alert("Selecciona un mes.");

    get(child(ref(db), `respaldos/${month}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Llenar Obsoletos
            const tbody = document.getElementById('obs-tbody');
            tbody.innerHTML = '';
            let g3_c=0, g3_i=0, g4_c=0, g4_i=0;

            if(data.obsoletos) {
                data.obsoletos.forEach(item => {
                    if(item.clasificacion.includes("G3")) { g3_c++; g3_i += item.importe; }
                    if(item.clasificacion.includes("G4")) { g4_c++; g4_i += item.importe; }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.parte}</td>
                        <td>${item.desc}</td>
                        <td>${formatMoney(item.importe)}</td>
                        <td>${item.clasificacion}</td>
                        <td><input type="text" class="comment-input" value="${item.comentario || ''}" placeholder="Escribe..."></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            document.getElementById('g3-sku').innerText = g3_c.toLocaleString();
            document.getElementById('g3-imp').innerText = g3_i.toLocaleString('en-US', {minimumFractionDigits: 2});
            document.getElementById('g4-sku').innerText = g4_c.toLocaleString();
            document.getElementById('g4-imp').innerText = g4_i.toLocaleString('en-US', {minimumFractionDigits: 2});

            // Llenar Ventas
            if(data.ventas) {
                document.getElementById('obj-mostrador').value = data.ventas.mostrador.obj.toLocaleString('en-US');
                document.getElementById('obj-taller').value = data.ventas.taller.obj.toLocaleString('en-US');
                dataVentas.mostrador = { venta: data.ventas.mostrador.venta, costo: data.ventas.mostrador.costo };
                dataVentas.taller = { venta: data.ventas.taller.venta, costo: data.ventas.taller.costo };
                updateSalesUI();
            }

            // Llenar Compras
            if(data.compras) {
                lineasCompras.forEach(linea => {
                    if(data.compras[linea]){
                        document.getElementById(`comp-obj-${linea}`).value = data.compras[linea].obj.toLocaleString('en-US');
                        document.getElementById(`comp-real-${linea}`).value = data.compras[linea].real.toLocaleString('en-US');
                    }
                });
                updateComprasUI();
            }
            alert(`Información de ${month} cargada con éxito.`);
        } else {
            // Limpiar todo si el mes está vacío
            document.getElementById('obs-tbody').innerHTML = '';
            document.getElementById('g3-sku').innerText = '0'; document.getElementById('g3-imp').innerText = '0.00';
            document.getElementById('g4-sku').innerText = '0'; document.getElementById('g4-imp').innerText = '0.00';
            
            document.getElementById('obj-mostrador').value = '0'; document.getElementById('obj-taller').value = '0';
            dataVentas = { mostrador: { venta: 0, costo: 0 }, taller: { venta: 0, costo: 0 } };
            updateSalesUI();

            lineasCompras.forEach(linea => {
                document.getElementById(`comp-obj-${linea}`).value = '0';
                document.getElementById(`comp-real-${linea}`).value = '0';
            });
            updateComprasUI();
            
            alert(`No hay datos guardados para ${month}. La pantalla se ha limpiado.`);
        }
    });
});

/* ================= SECCIÓN 6: LÓGICA EXCEL OBSOLETOS ================= */
// Nota: La subida de Excel sobreescribe la vista actual de obsoletos
document.getElementById('file-obs').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {header: 1});
        
        let headersRow = -1;
        for(let i=0; i<5; i++){
            if(json[i] && json[i].includes("PARTE") && json[i].includes("Clasificacion")){
                headersRow = i; break;
            }
        }
        if(headersRow === -1) return alert("No se encontraron las columnas.");

        const headers = json[headersRow];
        const partIdx = headers.indexOf("PARTE");
        const descIdx = headers.indexOf("DESCRIPCION");
        const impIdx = headers.indexOf("IMPORTE");
        const clasIdx = headers.indexOf("Clasificacion");

        let g3_count = 0, g3_imp = 0, g4_count = 0, g4_imp = 0;
        const tbody = document.getElementById('obs-tbody');
        tbody.innerHTML = '';
        
        let obsoletosData = [];
        for(let i = headersRow + 1; i < json.length; i++) {
            const row = json[i];
            if(!row || row.length === 0) continue;
            const clasificacion = row[clasIdx] ? row[clasIdx].toString().trim() : "";
            if(clasificacion === "G3 Tecnicamente Obsoletas" || clasificacion === "G4 Obsoletas") {
                const importe = parseNum(row[impIdx]);
                if(clasificacion.includes("G3")) { g3_count++; g3_imp += importe; }
                if(clasificacion.includes("G4")) { g4_count++; g4_imp += importe; }
                obsoletosData.push({ parte: row[partIdx], desc: row[descIdx], importe: importe, clasificacion: clasificacion });
            }
        }

        obsoletosData.sort((a, b) => a.clasificacion.localeCompare(b.clasificacion));

        obsoletosData.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.parte || ''}</td>
                <td>${item.desc || ''}</td>
                <td>${formatMoney(item.importe)}</td>
                <td>${item.clasificacion}</td>
                <td><input type="text" class="comment-input" placeholder="Escribe un comentario..."></td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('g3-sku').innerText = g3_count.toLocaleString();
        document.getElementById('g3-imp').innerText = g3_imp.toLocaleString('en-US', {minimumFractionDigits: 2});
        document.getElementById('g4-sku').innerText = g4_count.toLocaleString();
        document.getElementById('g4-imp').innerText = g4_imp.toLocaleString('en-US', {minimumFractionDigits: 2});
        
        alert("Archivo cargado. Recuerda presionar 'Guardar Respaldo' para guardarlo en este mes.");
    };
    reader.readAsArrayBuffer(file);
});

/* ================= SECCIÓN 7: LÓGICA EXCEL VENTAS ================= */
let dataVentas = { mostrador: { venta: 0, costo: 0 }, taller: { venta: 0, costo: 0 } };

const processVentasExcel = (file, tipo) => {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {header: 1});

        for (let i = json.length - 1; i >= 0; i--) {
            if (json[i] && json[i][0] && typeof json[i][0] === 'string' && json[i][0].includes("Total General")) {
                dataVentas[tipo].venta = parseNum(json[i][9]); 
                dataVentas[tipo].costo = parseNum(json[i][12]);
                updateSalesUI();
                return;
            }
        }
        alert(`No se encontró "Total General" en ${tipo}.`);
    };
    reader.readAsArrayBuffer(file);
};

document.getElementById('file-mostrador').addEventListener('change', (e) => processVentasExcel(e.target.files[0], 'mostrador'));
document.getElementById('file-taller').addEventListener('change', (e) => processVentasExcel(e.target.files[0], 'taller'));
document.getElementById('obj-mostrador').addEventListener('input', formatInputWithCommas);
document.getElementById('obj-taller').addEventListener('input', formatInputWithCommas);

function updateSalesUI() {
    const objMostrador = parseNum(document.getElementById('obj-mostrador').value);
    const objTaller = parseNum(document.getElementById('obj-taller').value);
    const objTotal = objMostrador + objTaller;

    document.getElementById('ven-mostrador').innerText = dataVentas.mostrador.venta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('cos-mostrador').innerText = dataVentas.mostrador.costo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('ven-taller').innerText = dataVentas.taller.venta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('cos-taller').innerText = dataVentas.taller.costo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const venTotal = dataVentas.mostrador.venta + dataVentas.taller.venta;
    const cosTotal = dataVentas.mostrador.costo + dataVentas.taller.costo;
    const utiMostrador = dataVentas.mostrador.venta - dataVentas.mostrador.costo;
    const utiTaller = dataVentas.taller.venta - dataVentas.taller.costo;
    const utiTotal = venTotal - cosTotal;
    const alcance = objTotal > 0 ? Math.round((venTotal / objTotal) * 100) : 0;

    document.getElementById('obj-total').innerText = formatMoney(objTotal);
    document.getElementById('ven-total').innerText = formatMoney(venTotal);
    document.getElementById('cos-total').innerText = formatMoney(cosTotal);
    document.getElementById('uti-mostrador').innerText = formatMoney(utiMostrador);
    document.getElementById('uti-taller').innerText = formatMoney(utiTaller);
    document.getElementById('uti-total').innerText = formatMoney(utiTotal);
    
    document.getElementById('alcance-total').innerHTML = `<span style="color: ${alcance < 0 ? 'var(--red-acme)' : 'var(--cyan-acme)'}">${alcance}%</span>`;
}