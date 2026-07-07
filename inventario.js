let lotesGenerales = []; // Guardamos los lotes en la memoria para poder editarlos
let modoEdicion = false; // Bandera para saber si el modal está creando o actualizando
let loteActualId = null; // ID del lote que estamos editando

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('nexura_token');
    const usuarioStr = localStorage.getItem('nexura_usuario');

    if (!token || !usuarioStr) {
        window.location.href = "login.html";
        return;
    }

    const usuario = JSON.parse(usuarioStr);
    document.getElementById('nombreUsuario').textContent = usuario.nombre;
    const rolDOM = document.getElementById('rolUsuario');
    if (rolDOM) rolDOM.textContent = usuario.departamento || 'Administración';

    const btnCerrar = document.getElementById('btnCerrarSesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('nexura_token');
            localStorage.removeItem('nexura_usuario');
            window.location.href = "login.html";
        });
    }

    // Cambiamos el comportamiento del botón "Agregar" principal
    document.querySelector('.btn-agregar').onclick = prepararNuevoLote;

    await cargarInventario(token);
    await cargarSelectProductos(token);
});

// --- 1. LECTURA (GET) ---
async function cargarInventario(token) {
    try {
        const res = await fetch("http://localhost:3000/api/lotes", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.status === 401) return;

        const lotes = await res.json();
        lotesGenerales = lotes; // Guardamos en la variable global
        
        // Llamamos a la nueva función que dibuja la tabla
        renderizarTabla(lotesGenerales);
        
    } catch (error) {
        console.error("Error al cargar inventario:", error);
    }
}

// --- FUNCIÓN EXCLUSIVA PARA DIBUJAR LA TABLA ---
function renderizarTabla(lotesAMostrar) {
    const tbody = document.getElementById('tablaInventario');
    tbody.innerHTML = '';

    if (lotesAMostrar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No se encontraron resultados</td></tr>';
        return;
    }

    // 1. Obtener la fecha de hoy en formato YYYY-MM-DD para comparar fácilmente
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const hoyStr = `${año}-${mes}-${dia}`;

    lotesAMostrar.forEach(lote => {
        
        let claseEstado = "normal"; 
        const fechaCadStr = lote.fecha_caducidad.split('T')[0]; // Extraemos YYYY-MM-DD del lote
        
        // EVALUACIÓN DINÁMICA DE COLORES CON PRIORIDAD
        if (lote.cantidad_disponible === 0 || lote.estado === 'Agotado') {
            // Prioridad 1: Si ya no hay, está agotado independientemente de la fecha
            claseEstado = "roja"; 
            lote.estado = "Agotado"; 
            
        } else if (fechaCadStr < hoyStr) {
            // Prioridad 2: Si hay stock, pero la fecha ya pasó, está Caducado (Letra Negra)
            claseEstado = "negra"; 
            lote.estado = "Caducado";
            
        } else if (lote.cantidad_disponible <= lote.stock_minimo) {
            // Prioridad 3: Stock en nivel crítico (Rojo)
            claseEstado = "roja"; 
            
        } else if (lote.cantidad_disponible <= (lote.stock_minimo + 3)) {
            // Prioridad 4: Advertencia por stock bajo (Amarillo)
            claseEstado = "amarilla"; 
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lote.numero_lote}</td>
            <td>[${lote.producto_sku}] ${lote.producto_nombre}</td>
            <td>${lote.cantidad_disponible}</td>
            <td>${fechaCadStr}</td>
            <td><span class="estado ${claseEstado}">${lote.estado}</span></td>
            <td>
                <button class="btn-editar" onclick="prepararEdicion(${lote.id})" style="background-color: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>
                <button class="btn-eliminar" onclick="eliminarLote(${lote.id})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- LÓGICA DE FILTRADO EN TIEMPO REAL ---
document.getElementById('inputBusqueda').addEventListener('input', (e) => {
    // Convertimos lo que escribe el usuario a minúsculas
    const textoBuscado = e.target.value.toLowerCase();
    
    // Filtramos la variable global 'lotesGenerales'
    const lotesFiltrados = lotesGenerales.filter(lote => {
        return (
            lote.producto_nombre.toLowerCase().includes(textoBuscado) ||
            lote.producto_sku.toLowerCase().includes(textoBuscado) ||
            lote.numero_lote.toLowerCase().includes(textoBuscado) ||
            lote.estado.toLowerCase().includes(textoBuscado)
        );
    });
    
    // Volvemos a dibujar la tabla pero solo con los resultados que coincidieron
    renderizarTabla(lotesFiltrados);
});

// --- 2. LLENAR SELECT ---
async function cargarSelectProductos(token) {
    try {
        const res = await fetch("http://localhost:3000/api/productos", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const productos = await res.json();
        const select = document.getElementById('selectProducto');
        select.innerHTML = '<option value="">-- Selecciona un producto --</option>';
        productos.forEach(prod => {
            const option = document.createElement('option');
            option.value = prod.id;
            option.textContent = `${prod.nombre} (SKU: ${prod.sku})`;
            select.appendChild(option);
        });
    } catch (error) {}
}

// --- 3. FUNCIONES DEL MODAL (NUEVO VS EDICIÓN) ---
function prepararNuevoLote() {
    modoEdicion = false;
    loteActualId = null;
    document.querySelector('#modalProducto h2').textContent = 'Registrar Entrada de Inventario (Lote)';
    document.getElementById('formAgregarLote').reset();
    
    // Habilitamos el folio porque es una entrada nueva
    document.getElementById('inputFolio').disabled = false;
    document.getElementById('inputFolio').required = true;
    
    abrirModal();
}

window.prepararEdicion = function(id) {
    modoEdicion = true;
    loteActualId = id;
    
    // Buscamos el lote en nuestra variable global
    const lote = lotesGenerales.find(l => l.id === id);
    if (!lote) return;

    document.querySelector('#modalProducto h2').textContent = 'Actualizar Lote (Corrección)';
    
    // Llenamos los inputs con los datos existentes
    document.getElementById('selectProducto').value = lote.producto_id;
    document.getElementById('inputLote').value = lote.numero_lote;
    document.getElementById('inputCantidad').value = lote.cantidad_disponible;
    document.getElementById('inputCaducidad').value = lote.fecha_caducidad.split('T')[0];

    // Deshabilitamos el folio porque una edición no genera un nuevo movimiento en el Kardex
    document.getElementById('inputFolio').value = 'N/A (Edición)';
    document.getElementById('inputFolio').disabled = true;
    document.getElementById('inputFolio').required = false;

    abrirModal();
}

// --- 4. GUARDAR (POST O PUT) ---
document.getElementById('formAgregarLote').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('nexura_token');
    
    try {
        let url = "http://localhost:3000/api/lotes";
        let metodo = "POST";
        let payload = {};

        if (modoEdicion) {
            // LÓGICA PARA ACTUALIZAR (PUT)
            url = `http://localhost:3000/api/lotes/${loteActualId}`;
            metodo = "PUT";
            
            // Recuperamos la cantidad_inicial original para no sobreescribirla
            const loteAntiguo = lotesGenerales.find(l => l.id === loteActualId);
            const nuevaCantidad = parseInt(document.getElementById('inputCantidad').value);
            
            payload = {
                producto_id: document.getElementById('selectProducto').value,
                numero_lote: document.getElementById('inputLote').value,
                fecha_caducidad: document.getElementById('inputCaducidad').value,
                cantidad_inicial: loteAntiguo.cantidad_inicial, 
                cantidad_disponible: nuevaCantidad,
                estado: nuevaCantidad > 0 ? 'Activo' : 'Agotado'
            };
        } else {
            // LÓGICA PARA CREAR NUEVO (POST)
            const cantidad = parseInt(document.getElementById('inputCantidad').value);
            payload = {
                producto_id: document.getElementById('selectProducto').value,
                numero_lote: document.getElementById('inputLote').value,
                fecha_caducidad: document.getElementById('inputCaducidad').value,
                cantidad_inicial: cantidad,
                cantidad_disponible: cantidad,
                folio: document.getElementById('inputFolio').value,
                comentarios: "Entrada manual desde panel"
            };
        }

        const res = await fetch(url, {
            method: metodo,
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: modoEdicion ? 'Lote actualizado' : 'Entrada registrada',
                timer: 1500,
                showConfirmButton: false
            });
            cerrarModal();
            await cargarInventario(token); // Recargamos la tabla
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.Mensaje || 'Error al guardar' });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Fallo de conexión', text: 'No se pudo contactar al servidor.' });
    }
});

// --- 5. ELIMINAR (DELETE) ---
window.eliminarLote = async function(id) {
    const confirmacion = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Si eliminas este lote, desaparecerá de la tabla.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        const token = localStorage.getItem('nexura_token');
        try {
            const res = await fetch(`http://localhost:3000/api/lotes/${id}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            const data = await res.json();
            
            if (res.ok) {
                Swal.fire('¡Eliminado!', 'El lote ha sido eliminado con éxito.', 'success');
                await cargarInventario(token);
            } else if (res.status === 409) {
                // Atrapamos el error inteligente que programaste en tu base de datos (Llave foránea)
                Swal.fire('Acción Bloqueada', data.Mensaje, 'warning');
            } else {
                Swal.fire('Error', data.Mensaje || 'No se pudo eliminar el lote', 'error');
            }
        } catch (error) {
            Swal.fire('Error de conexión', 'No se pudo contactar al servidor', 'error');
        }
    }
}