// ==========================================
// ETAPA 1: UTILIDADES (Cálculo de Fechas y Lector)
// ==========================================
export function calculateNextService(dateStr) {
    if (!dateStr) return "Sin Fecha";
    const parts = String(dateStr).split('/');
    if (parts.length === 3) {
        const fecha = new Date(parts[2], parts[1] - 1, parts[0]);
        fecha.setMonth(fecha.getMonth() + 6);
        return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`;
    }
    return "Sin Fecha";
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target.result));
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

// ==========================================
// ETAPA 2: PROCESAR BASE PRINCIPAL (Con Auditoría y Extracción de VIN)
// ==========================================
export async function processMainBase(file, activeTab) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
                
                let newRecords = [];
                let discardedRecords = [];

                rawData.forEach(row => {
                    const rawOrden = row['NO. ORDEN'] || row['Orden'] || row['NO.ORDEN'];
                    const rawCliente = row['CLIENTE'] || row['Nombre'];
                    const rawAuto = row['AUTO'] || row['Auto'];
                    const rawFecha = row['FECHA'] || row['Ingreso'];
                    const rawTelefono = row['Telefono'] || row['Celular'] || 'Pendiente / No incluido';
                    const rawVin = row['No. SERIE'] || row['Serie'] || row['NUMERO DE SERIE'] || row['VIN'] || 'N/D'; // Extraemos VIN desde el inicio

                    if (!rawOrden || String(rawOrden).trim() === 'N' || String(rawOrden).trim() === 'A') {
                        if(rawCliente || rawAuto) discardedRecords.push(`Fila sin Orden válida: ${rawCliente || 'Sin nombre'} - ${rawAuto || ''}`);
                        return;
                    }
                    
                    const strOrden = String(rawOrden).toLowerCase();
                    const strNombre = String(rawCliente || '').toLowerCase();
                    
                    if (strOrden.includes("total x tipo") || strNombre.includes("total x tipo") || strOrden.includes("total ")) {
                        discardedRecords.push(`Fila de Totales ignorada: ${rawOrden} | ${rawCliente}`);
                        return;
                    }
                    
                    newRecords.push({
                        id: Date.now() + Math.random(),
                        tab_type: activeTab,
                        orden: rawOrden,
                        vin: rawVin, // Guardamos VIN
                        cliente: rawCliente || 'Sin Nombre',
                        telefono: rawTelefono,
                        auto: rawAuto || 'No Especificado',
                        ultimo_servicio: 'Por verificar',
                        proximo_servicio: calculateNextService(rawFecha),
                        contactado: '-', medio: '-', motivo: '-', agendo: '-',
                        comentarios: '', llamadas: []
                    });
                });
                
                resolve({ newRecords, discardedRecords });
            } catch (error) { reject(error); }
        };
        reader.readAsArrayBuffer(file);
    });
}

// ==========================================
// ETAPA 3: FILTRADO DE ASESORES (Regla de Clasificación)
// ==========================================
export async function crossReferenceServices(files, currentDatabase) {
    return new Promise(async (resolve, reject) => {
        try {
            const mapaOrdenes = {};

            for (let i = 0; i < files.length; i++) {
                const data = await readFileAsArrayBuffer(files[i]);
                const workbook = XLSX.read(data, { type: 'array' });
                const rawAsesores = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 3 }); 

                rawAsesores.forEach(row => {
                    if (!row['ORDEN'] || !row['CLASIFICACION']) return;
                    const orden = String(row['ORDEN']).trim();
                    const clasificacion = String(row['CLASIFICACION']).trim().toUpperCase();
                    const descripcion = row['DESCRIPCION'] ? String(row['DESCRIPCION']).trim() : "";

                    if (!mapaOrdenes[orden]) mapaOrdenes[orden] = [];
                    mapaOrdenes[orden].push({ clasificacion, descripcion });
                });
            }

            let pendingPurge = [];
            let verified = [];
            let unaffected = [];
            let updatedCount = 0;

            currentDatabase.forEach(client => {
                const lineasDeOrden = mapaOrdenes[client.orden];
                
                if (!lineasDeOrden) {
                    unaffected.push(client);
                    return;
                }

                const lineasMantenimiento = lineasDeOrden.filter(linea => linea.clasificacion === 'MO DE MANTENIMIENTO');

                if (lineasMantenimiento.length > 0) {
                    let maxKms = -1;
                    let mejorServicio = "Mantenimiento"; 
                    lineasMantenimiento.forEach(linea => {
                        const match = linea.descripcion.match(/([\d,]+)\s*KMS/i);
                        if (match) {
                            const kmsNumber = parseInt(match[1].replace(/,/g, '')); 
                            if (kmsNumber > maxKms) {
                                maxKms = kmsNumber; mejorServicio = linea.descripcion; 
                            }
                        } else {
                            if(maxKms === -1) mejorServicio = linea.descripcion;
                        }
                    });
                    client.ultimo_servicio = mejorServicio;
                    verified.push(client);
                    updatedCount++;
                } else {
                    client.motivos_eliminacion = lineasDeOrden.map(l => `${l.clasificacion}: ${l.descripcion}`).join(' | ');
                    pendingPurge.push(client);
                }
            });

            resolve({ verified, pendingPurge, unaffected, updatedCount });
        } catch (error) { reject(error); }
    });
}

// ==========================================
// ETAPA 4: ENRIQUECIMIENTO DE DATOS (TEL, VIN, KM, AUTO)
// ==========================================
export async function enrichClientData(file, currentDatabase) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
                
                const mapaDetalles = {};
                rawData.forEach(row => {
                    const orden = row['Orden'] || row['NO. ORDEN'];
                    if(!orden) return;
                    
                    mapaDetalles[String(orden).trim()] = {
                        telefono: row['Telefono'] || row['Celular'] || '',
                        auto: row['Auto'] || '',
                        modelo: row['Modelo'] || '',
                        vin: row['Serie'] || '',
                        kms: row['Kilometraje'] || ''
                    };
                });
                
                let updatedCount = 0;
                const updatedDatabase = currentDatabase.map(client => {
                    const detalles = mapaDetalles[client.orden];
                    if (detalles) {
                        if (detalles.telefono && (client.telefono.includes('Pendiente') || !client.telefono)) {
                            client.telefono = detalles.telefono;
                        }
                        client.auto = detalles.auto || client.auto;
                        client.modelo_anio = detalles.modelo;
                        client.vin = detalles.vin;
                        client.kms = detalles.kms;
                        updatedCount++;
                    }
                    return client;
                });
                
                resolve({ updatedDatabase, updatedCount });
            } catch (error) { reject(error); }
        };
        reader.readAsArrayBuffer(file);
    });
}

// ==========================================
// ETAPA 5: DETECCIÓN DE CLIENTES PROACTIVOS (POR VIN)
// ==========================================
export async function detectProactivos(file, currentDatabase) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
                
                // Creamos un diccionario (Set) rápido con todos los VINs de los últimos meses
                const vinRecientes = new Set();
                rawData.forEach(row => {
                    const serie = row['Serie'] || row['SERIE'] || row['NUMERO DE SERIE'];
                    if(serie && String(serie).trim() !== '') {
                        vinRecientes.add(String(serie).trim().toUpperCase());
                    }
                });
                
                let detectadosCount = 0;
                const updatedDatabase = currentDatabase.map(client => {
                    // Si el VIN del cliente está en la lista de recientes, lo marcamos
                    if (client.vin && vinRecientes.has(String(client.vin).trim().toUpperCase())) {
                        client.contactado = 'PROACTIVO';
                        detectadosCount++;
                    }
                    return client;
                });
                
                resolve({ updatedDatabase, detectadosCount });
            } catch (error) { reject(error); }
        };
        reader.readAsArrayBuffer(file);
    });
}